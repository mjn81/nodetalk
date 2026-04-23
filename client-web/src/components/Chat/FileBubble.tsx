import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { type Message } from '@/types/api';
import { decryptMessage, getChannelKey, base64ToBytes, onWS } from '@/ws';
import { decryptAndDecompressFile, ensureZstdReady } from '@/utils/file';
import { apiGetFile } from '@/api/client';

import { VoiceBubble } from './File/VoiceBubble';
import { ImageVideoBubble } from './File/ImageVideoBubble';
import { GenericFileBubble } from './File/GenericFileBubble';

interface FileBubbleProps {
	msg: Message;
}

interface FileMetadata {
	file_id: string;
	name?: string;
	mime: string;
	size: number;
	nonce: string;
	thumb_ciphertext?: string;
	thumb_nonce?: string;
}

export const FileBubble: React.FC<FileBubbleProps> = ({ msg }) => {
	const [meta, setMeta] = useState<FileMetadata | null>(null);
	const [thumbUrl, setThumbUrl] = useState<string | null>(null);
	const [isDecrypting, setIsDecrypting] = useState(false);
	const [progress, setProgress] = useState(0);
	const [fullUrl, setFullUrl] = useState<string | null>(null);
	const [waveform, setWaveform] = useState<number[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let currentThumbUrl: string | null = null;

		const loadMeta = async () => {
			const key = getChannelKey(msg.channel_id);
			if (!key) return;

			try {
				const decrypted = await decryptMessage(msg);
				if (decrypted === '[encrypted]' || decrypted === '[decryption failed]')
					return;

				const parsed = JSON.parse(decrypted) as FileMetadata;
				setMeta(parsed);

				// Prepare thumbnail or waveform if present
				if (parsed.thumb_ciphertext && parsed.thumb_nonce) {
					await ensureZstdReady();
					const thumbCipher = base64ToBytes(parsed.thumb_ciphertext);
					const thumbNonce = base64ToBytes(parsed.thumb_nonce);

					const cryptoKey = await crypto.subtle.importKey(
						'raw',
						key.buffer as ArrayBuffer,
						{ name: 'AES-GCM' },
						false,
						['decrypt'],
					);
					const decryptedThumb = await crypto.subtle.decrypt(
						{ name: 'AES-GCM', iv: thumbNonce as any },
						cryptoKey,
						thumbCipher as any,
					);

					if (parsed.mime.startsWith('audio/')) {
						setWaveform(Array.from(new Uint8Array(decryptedThumb)));
					} else {
						const blob = new Blob([decryptedThumb], { type: 'image/webp' });
						if (currentThumbUrl) URL.revokeObjectURL(currentThumbUrl);
						currentThumbUrl = URL.createObjectURL(blob);
						setThumbUrl(currentThumbUrl);
					}
				}
			} catch (err) {
				console.error('FileBubble error:', err);
				setError('Failed to load file preview');
			}
		};

		loadMeta();

		const unsubKey = onWS('channel_key', (payload: any) => {
			if (payload.channel_id === msg.channel_id) {
				loadMeta();
			}
		});

		return () => {
			unsubKey();
			if (currentThumbUrl) URL.revokeObjectURL(currentThumbUrl);
			if (fullUrl) URL.revokeObjectURL(fullUrl);
		};
	}, [msg]);

	const handleDownload = async (e?: React.MouseEvent) => {
		e?.stopPropagation();
		const key = getChannelKey(msg.channel_id);
		if (!meta || !key || isDecrypting) return;
		setIsDecrypting(true);
		setProgress(0);
		setError(null);

		try {
			const encryptedBuffer = await apiGetFile(meta.file_id, (pe) => {
				const pct = Math.round((pe.loaded * 100) / pe.total);
				setProgress(pct);
			});

			const decrypted = await decryptAndDecompressFile(
				new Uint8Array(encryptedBuffer),
				base64ToBytes(meta.nonce),
				key,
				meta.mime.startsWith('audio/'),
			);

			const blob = new Blob([decrypted as any], { type: meta.mime });
			const downloadUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download =
				meta.name ||
				`file-${meta.file_id.substring(0, 8)}.${meta.mime.split('/')[1] || 'bin'}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
		} catch (err) {
			console.error('Download error:', err);
			setError('Download failed');
		} finally {
			setIsDecrypting(false);
			setProgress(0);
		}
	};

	const handleFullscreen = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (fullUrl) return;

		const key = getChannelKey(msg.channel_id);
		if (!meta || !key || isDecrypting) return;
		setIsDecrypting(true);
		setProgress(0);

		try {
			const encryptedBuffer = await apiGetFile(meta.file_id, (pe) => {
				const pct = Math.round((pe.loaded * 100) / pe.total);
				setProgress(pct);
			});
			const decrypted = await decryptAndDecompressFile(
				new Uint8Array(encryptedBuffer),
				base64ToBytes(meta.nonce),
				key,
				meta.mime.startsWith('audio/'),
			);
			const blob = new Blob([decrypted as any], { type: meta.mime });
			const url = URL.createObjectURL(blob);
			setFullUrl(url);
		} catch (err) {
			console.error('Fullscreen error:', err);
			setError('Failed to load full content');
		} finally {
			setIsDecrypting(false);
			setProgress(0);
		}
	};

	if (!meta) {
		return (
			<div className="mt-2 flex items-center gap-2 text-muted-foreground text-sm animate-pulse italic">
				<Loader2 size={14} className="animate-spin" /> Decrypting metadata...
			</div>
		);
	}

	const isAudio = meta.mime.startsWith('audio/');
	const isImage = meta.mime.startsWith('image/') && !meta.mime.includes('heic');
	const isVideo = meta.mime.startsWith('video/');

	return (
		<div className="mt-2 group/bubble max-w-[400px]">
			{isAudio ? (
				<VoiceBubble
					meta={meta}
					channelId={msg.channel_id}
					waveform={waveform}
					handleDownload={handleDownload}
				/>
			) : isImage || isVideo ? (
				<ImageVideoBubble
					meta={meta}
					thumbUrl={thumbUrl}
					fullUrl={fullUrl}
					isDecrypting={isDecrypting}
					progress={progress}
					handleDownload={handleDownload}
					handleFullscreen={handleFullscreen}
				/>
			) : (
				<GenericFileBubble
					meta={meta}
					isDecrypting={isDecrypting}
					progress={progress}
					handleDownload={handleDownload}
				/>
			)}

			{error && <div className="text-destructive text-xs mt-1">{error}</div>}
		</div>
	);
};
