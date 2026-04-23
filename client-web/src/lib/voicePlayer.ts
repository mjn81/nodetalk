/**
 * VoicePlayerStore — uses AudioContext + AudioBufferSourceNode instead of
 * HTMLAudioElement so MediaRecorder WebM files are always seekable.
 */

import { db } from '@/lib/db';
import { apiGetFile } from '@/api/client';
import { decryptAndDecompressFile } from '@/utils/file';
import { base64ToBytes, getChannelKey } from '@/ws';

export interface VoiceTrack {
	fileId: string;
	channelId: string;
	mime: string;
	nonce: string;
	waveform: number[] | null;
	label?: string;
}

export interface VoicePlayerState {
	track: VoiceTrack | null;
	isPlaying: boolean;
	isLoading: boolean;
	currentTime: number;
	duration: number;
	speed: number;
}

type Listener = (state: VoicePlayerState) => void;
export const SPEEDS = [1, 1.5, 2];

class VoicePlayerStore {
	private listeners = new Set<Listener>();
	private buffers   = new Map<string, AudioBuffer>(); // fileId → decoded buffer

	private ctx:         AudioContext | null = null;
	private sourceNode:  AudioBufferSourceNode | null = null;
	private activeBuffer: AudioBuffer | null = null;

	// Track where playback started so we can compute currentTime from AudioContext clock
	private startCtxTime = 0;  // ctx.currentTime at the moment play began
	private startOffset  = 0;  // position in seconds from which we started

	private raf: number | null = null;

	state: VoicePlayerState = {
		track: null, isPlaying: false, isLoading: false,
		currentTime: 0, duration: 0, speed: 1,
	};

	// ─── Store plumbing ─────────────────────────────────────────────────────
	subscribe(fn: Listener) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
	private emit()                               { this.listeners.forEach(fn => fn({ ...this.state })); }
	private patch(p: Partial<VoicePlayerState>) { this.state = { ...this.state, ...p }; this.emit(); }

	// ─── AudioContext helpers ────────────────────────────────────────────────
	private getCtx(): AudioContext {
		if (!this.ctx || this.ctx.state === 'closed') this.ctx = new AudioContext();
		return this.ctx;
	}

	/** Compute live playback position from AudioContext clock (accurate, no events needed). */
	private liveTime(): number {
		if (!this.ctx || !this.state.isPlaying) return this.startOffset;
		const elapsed = (this.ctx.currentTime - this.startCtxTime) * this.state.speed;
		return Math.min(this.startOffset + elapsed, this.state.duration);
	}

	private startRaf() {
		const tick = () => {
			if (this.state.isPlaying) {
				this.state.currentTime = this.liveTime();
				this.emit();
				this.raf = requestAnimationFrame(tick);
			}
		};
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = requestAnimationFrame(tick);
	}

	private stopRaf() { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; } }

	/** Stop and discard current source node without triggering onended side-effects. */
	private stopSource() {
		if (this.sourceNode) {
			this.sourceNode.onended = null;
			try { this.sourceNode.stop(); } catch { /* already stopped */ }
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}
	}

	/** Create and start a new source node from the given buffer at the given offset. */
	private startSource(buffer: AudioBuffer, offset: number) {
		const ctx = this.getCtx();
		this.stopSource();

		const src = ctx.createBufferSource();
		src.buffer          = buffer;
		src.playbackRate.value = this.state.speed;
		src.connect(ctx.destination);
		src.start(0, offset);
		src.onended = () => {
			// Guard: only handle if this source is still active (not stopped by seek/pause)
			if (this.sourceNode === src) {
				this.stopRaf();
				this.startOffset = 0;
				this.patch({ isPlaying: false, currentTime: 0 });
			}
		};

		this.sourceNode   = src;
		this.activeBuffer = buffer;
		this.startOffset  = offset;
		this.startCtxTime = ctx.currentTime;
	}

	// ─── Fetch / decode ──────────────────────────────────────────────────────
	private async fetchAndDecode(track: VoiceTrack): Promise<AudioBuffer> {
		const cached = this.buffers.get(track.fileId);
		if (cached) return cached;

		let data: Uint8Array;
		const dbCached = await db.getCachedFile(track.fileId);
		if (dbCached) {
			data = dbCached.data;
		} else {
			const key = getChannelKey(track.channelId);
			if (!key) throw new Error('Missing channel key');
			const enc = await apiGetFile(track.fileId);
			data = await decryptAndDecompressFile(
				new Uint8Array(enc), base64ToBytes(track.nonce), key, true,
			);
			await db.cacheFile(track.fileId, data, track.mime);
		}

		const ctx    = this.getCtx();
		const buffer = await ctx.decodeAudioData(data.slice(0).buffer);
		this.buffers.set(track.fileId, buffer);
		return buffer;
	}

	// ─── Public API ──────────────────────────────────────────────────────────

	async play(track: VoiceTrack) {
		// Resume same track from current position
		if (this.state.track?.fileId === track.fileId && this.activeBuffer) {
			const ctx = this.getCtx();
			if (ctx.state === 'suspended') await ctx.resume();
			this.startSource(this.activeBuffer, this.state.currentTime);
			this.patch({ isPlaying: true });
			this.startRaf();
			return;
		}

		this.patch({ track, isLoading: true, isPlaying: false, currentTime: 0, duration: 0 });

		try {
			const ctx = this.getCtx();
			if (ctx.state === 'suspended') await ctx.resume();

			const buffer = await this.fetchAndDecode(track);
			this.startSource(buffer, 0);
			this.patch({ duration: buffer.duration, isLoading: false, isPlaying: true });
			this.startRaf();
		} catch (err) {
			console.error('[VoicePlayer] play error:', err);
			this.patch({ isLoading: false, isPlaying: false });
		}
	}

	pause() {
		if (!this.state.isPlaying) return;
		const pos = this.liveTime();
		this.stopSource();
		this.stopRaf();
		this.startOffset = pos;
		this.patch({ isPlaying: false, currentTime: pos });
	}

	togglePlay() {
		if (this.state.isPlaying) this.pause();
		else if (this.state.track) this.play(this.state.track);
	}

	/** Seek to a position (0–1 fraction of duration). Works instantly — no browser seeking needed. */
	seek(percent: number) {
		const dur = this.state.duration;
		if (dur <= 0) return;
		const t = Math.max(0, Math.min(1, percent)) * dur;
		this.startOffset = t;
		this.patch({ currentTime: t });

		if (this.state.isPlaying && this.activeBuffer) {
			this.startSource(this.activeBuffer, t); // restart at new position
			this.startRaf();
		}
	}

	cycleSpeed() {
		const next = SPEEDS[(SPEEDS.indexOf(this.state.speed) + 1) % SPEEDS.length];
		if (this.state.isPlaying && this.activeBuffer) {
			const pos = this.liveTime();
			this.patch({ speed: next });        // update speed BEFORE startSource reads it
			this.startSource(this.activeBuffer, pos);
			this.startRaf();
		} else {
			this.patch({ speed: next });
		}
	}

	close() {
		this.stopSource();
		this.stopRaf();
		this.activeBuffer = null;
		this.startOffset  = 0;
		this.patch({ track: null, isPlaying: false, currentTime: 0, duration: 0 });
	}

	progressFor(fileId: string): number {
		if (this.state.track?.fileId !== fileId) return 0;
		const { currentTime, duration } = this.state;
		return duration > 0 ? currentTime / duration : 0;
	}
}

export const voicePlayer = new VoicePlayerStore();
