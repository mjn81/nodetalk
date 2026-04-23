import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Loader2, Download } from 'lucide-react';
import { db } from '@/lib/db';
import { apiGetFile } from '@/api/client';
import { decryptAndDecompressFile } from '@/utils/file';
import { base64ToBytes, getChannelKey } from '@/ws';

interface FileMetadata {
	file_id: string;
	name?: string;
	mime: string;
	size: number;
	nonce: string;
	thumb_ciphertext?: string;
	thumb_nonce?: string;
}

interface VoiceBubbleProps {
	meta: FileMetadata;
	channelId: string;
	waveform: number[] | null;
	handleDownload: () => void;
}

export const VoiceBubble: React.FC<VoiceBubbleProps> = ({ meta, channelId, waveform, handleDownload }) => {
	const audioRef        = useRef<HTMLAudioElement>(null);
	const objectUrlRef    = useRef<string | null>(null);
	const rawDataRef      = useRef<Uint8Array | null>(null);
	const rafRef          = useRef<number | null>(null);
	const waveformRef     = useRef<HTMLDivElement>(null);
	const setupPromiseRef = useRef<Promise<number> | null>(null);
	const durationRef     = useRef(0); // mirrors duration state, safe in async closures

	const [isPlaying,   setIsPlaying]   = useState(false);
	const [isLoading,   setIsLoading]   = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration,    setDuration]    = useState(0);
	const [error,       setError]       = useState<string | null>(null);

	// Fetch/decrypt audio data, cache it, return blob URL.
	// Also stores the raw bytes in rawDataRef for AudioContext decoding.
	const getBlobUrl = async (): Promise<string> => {
		if (objectUrlRef.current) return objectUrlRef.current;

		let data: Uint8Array;
		let mime = meta.mime;

		const cached = await db.getCachedFile(meta.file_id);
		if (cached) {
			data = cached.data;
			mime = cached.mime;
		} else {
			const key = getChannelKey(channelId);
			if (!key) throw new Error('Missing channel key');
			const enc = await apiGetFile(meta.file_id);
			data = await decryptAndDecompressFile(new Uint8Array(enc), base64ToBytes(meta.nonce), key, true);
			await db.cacheFile(meta.file_id, data, mime);
		}

		rawDataRef.current = data;
		const simplifiedMime = mime.split(';')[0] || 'audio/webm';
		const blob = new Blob([data.buffer], { type: simplifiedMime });
		const url  = URL.createObjectURL(blob);
		objectUrlRef.current = url;
		return url;
	};

	// Decode via AudioContext to get the true duration.
	// Reliable even for Chrome MediaRecorder WebM (which reports Infinity).
	const decodeDuration = async (data: Uint8Array): Promise<number> => {
		try {
			const ctx = new AudioContext();
			const buf = await ctx.decodeAudioData(data.slice(0).buffer);
			const dur = buf.duration;
			ctx.close();
			return dur;
		} catch {
			return 0;
		}
	};

	// Seek to 1e101 so Chrome builds an internal seek-index for WebM files.
	// Without this, audio.currentTime assignments are silently ignored.
	// Has a 3-second timeout so it can NEVER hang the UI.
	const fixSeekability = (audio: HTMLAudioElement): Promise<void> =>
		new Promise((resolve) => {
			// Already seekable (normal MP3 / OGG / properly-muxed WebM)
			if (isFinite(audio.duration) && audio.duration > 0) { resolve(); return; }
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				audio.removeEventListener('seeked', onSeeked);
				resolve();
			};
			const onSeeked = () => { audio.currentTime = 0; finish(); };
			audio.addEventListener('seeked', onSeeked, { once: true });
			setTimeout(finish, 3000); // safety net
			audio.currentTime = 1e101;
		});

	/**
	 * Full setup — idempotent, singleton (concurrent calls share one promise):
	 *   1. Fetch/decrypt → blob URL
	 *   2. Get real duration via AudioContext (no seeked-event hack needed)
	 *   3. Set audio.src and wait for canplay
	 * Returns the real duration in seconds.
	 */
	const setupAudio = (): Promise<number> => {
		const audio = audioRef.current;
		if (!audio) return Promise.reject(new Error('no audio element'));

		// Already fully ready
		if (objectUrlRef.current && durationRef.current > 0 && audio.readyState >= 2) {
			return Promise.resolve(durationRef.current);
		}

		// Reuse in-flight promise
		if (setupPromiseRef.current) return setupPromiseRef.current;

		const p = (async (): Promise<number> => {
			// Step 1: blob URL (also fills rawDataRef)
			const url = await getBlobUrl();

			// Step 2: kick off AudioContext decode in parallel
			const durPromise = durationRef.current > 0
				? Promise.resolve(durationRef.current)
				: decodeDuration(rawDataRef.current!);

			// Step 3: load audio element (only once — never call load() twice)
			if (!audio.src) {
				audio.src = url;
				audio.load();
			}

			// Step 4: wait until canplay
			if (audio.readyState < 2) {
				await new Promise<void>((resolve, reject) => {
					if (audio.readyState >= 2) { resolve(); return; }
					const fin = (ok: boolean) => {
						audio.removeEventListener('canplay', onOk);
						audio.removeEventListener('error',   onErr);
						ok ? resolve() : reject(new Error('audio load failed'));
					};
					const onOk  = () => fin(true);
					const onErr = () => fin(false);
					audio.addEventListener('canplay', onOk,  { once: true });
					audio.addEventListener('error',   onErr, { once: true });
				});
			}

			// Step 5: build Chrome's seek index (3-second timeout so it NEVER hangs)
			await fixSeekability(audio);

			// Step 6: resolve real duration from AudioContext
			const dur = await durPromise;
			if (dur > 0) {
				durationRef.current = dur;
				setDuration(dur);
			}

			return dur;
		})();

		p.finally(() => { setupPromiseRef.current = null; });
		setupPromiseRef.current = p;
		return p;
	};

	// ─── RAF progress loop ──────────────────────────────────────────────────
	const startRaf = () => {
		const tick = () => {
			const audio = audioRef.current;
			if (audio && !audio.paused && !audio.ended) {
				setCurrentTime(audio.currentTime);
				rafRef.current = requestAnimationFrame(tick);
			}
		};
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		rafRef.current = requestAnimationFrame(tick);
	};
	const stopRaf = () => {
		if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
	};

	// ─── Audio event listeners ──────────────────────────────────────────────
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const onPlay  = () => { setIsPlaying(true);  startRaf(); };
		const onPause = () => { setIsPlaying(false); stopRaf();  setCurrentTime(audio.currentTime); };
		const onEnded = () => { setIsPlaying(false); stopRaf();  setCurrentTime(0); audio.currentTime = 0; };
		const onError = () => { if (audio.src) setError('Playback error'); };

		audio.addEventListener('play',   onPlay);
		audio.addEventListener('pause',  onPause);
		audio.addEventListener('ended',  onEnded);
		audio.addEventListener('error',  onError);

		return () => {
			audio.pause();
			stopRaf();
			audio.removeEventListener('play',   onPlay);
			audio.removeEventListener('pause',  onPause);
			audio.removeEventListener('ended',  onEnded);
			audio.removeEventListener('error',  onError);
			if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// ─── Silent background preload ──────────────────────────────────────────
	useEffect(() => {
		let active = true;
		setupAudio().catch(() => {}).finally(() => { if (!active) return; });
		return () => { active = false; };
	}, [meta.file_id]); // eslint-disable-line react-hooks/exhaustive-deps

	// ─── Interactions ───────────────────────────────────────────────────────
	const togglePlay = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const audio = audioRef.current;
		if (!audio) return;
		if (isPlaying) { audio.pause(); return; }

		setIsLoading(true);
		setError(null);
		try {
			await setupAudio();
			await audio.play();
		} catch (err: any) {
			console.error('[VoiceBubble] play error:', err);
			setError('Playback failed');
		} finally {
			setIsLoading(false);
		}
	};

	const handleWaveformClick = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!waveformRef.current) return;
		const audio = audioRef.current;
		if (!audio) return;

		const rect           = waveformRef.current.getBoundingClientRect();
		const clickedPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

		setIsLoading(true);
		setError(null);
		try {
			const dur = await setupAudio();
			if (dur > 0) {
				const newTime = clickedPercent * dur;
				audio.currentTime = newTime;
				setCurrentTime(newTime); // use target directly — don't wait for browser to reflect
			}
			if (audio.paused) await audio.play();
		} catch (err) {
			console.error('[VoiceBubble] seek error:', err);
		} finally {
			setIsLoading(false);
		}
	};

	// ─── Render ─────────────────────────────────────────────────────────────
	const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
	const formatTime = (s: number) => {
		if (!isFinite(s) || isNaN(s)) return '0:00';
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
	};

	return (
		<div className="flex flex-col select-none">
			<audio ref={audioRef} preload="auto" className="hidden" />
			<div
				className="mt-2 flex items-center gap-3 bg-secondary/80 border border-border p-3 rounded-2xl w-full max-w-[320px] shadow-sm hover:bg-secondary transition-colors cursor-default"
				onClick={(e) => e.stopPropagation()}
			>
				<button
					onClick={togglePlay}
					disabled={isLoading}
					className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:scale-105 transition active:scale-95 shrink-0"
				>
					{isLoading ? <Loader2 size={20} className="animate-spin" />
					: isPlaying ? <Pause size={20} fill="currentColor" />
					: <Play size={20} fill="currentColor" className="ml-0.5" />}
				</button>

				<div className="flex flex-col flex-1 min-w-0 gap-1.5">
					<div
						ref={waveformRef}
						className="flex items-end gap-[1.5px] h-8 px-1 cursor-pointer group/wave"
						onMouseDown={handleWaveformClick}
					>
						{waveform ? waveform.map((peak, i) => (
							<div
								key={i}
								className={`flex-1 rounded-full transition-colors duration-75 pointer-events-none ${
									progressPercent > (i / waveform.length) * 100
										? 'bg-primary'
										: 'bg-muted-foreground/30 group-hover/wave:bg-muted-foreground/50'
								}`}
								style={{ height: `${Math.max(15, peak)}%` }}
							/>
						)) : (
							<div className="w-full h-1 bg-muted-foreground/20 rounded-full animate-pulse" />
						)}
					</div>

					<div className="flex justify-between items-center px-0.5">
						<span className="text-[10px] font-medium text-muted-foreground tabular-nums">
							{isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
						</span>
						<button onClick={handleDownload} className="text-muted-foreground hover:text-foreground transition p-0.5" title="Download Voice Note">
							<Download size={14} />
						</button>
					</div>
				</div>
			</div>
			{error && <div className="text-destructive text-[10px] mt-1 ml-3 animate-in fade-in duration-300">{error}</div>}
		</div>
	);
};
