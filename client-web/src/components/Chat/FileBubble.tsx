import React, { useState, useEffect } from 'react';
import {
	Download,
	FileIcon,
	ImageIcon,
	Film,
	Loader2,
	Expand,
	X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { type Message } from '@/types/api';
import { decryptMessage, getChannelKey, base64ToBytes, onWS } from '@/ws';
import { decryptAndDecompressFile, ensureZstdReady } from '@/utils/file';
import { apiGetFile } from '@/api/client';

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

				// Prepare thumbnail if present
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
					const blob = new Blob([decryptedThumb], { type: 'image/webp' });
					if (currentThumbUrl) URL.revokeObjectURL(currentThumbUrl);
					currentThumbUrl = URL.createObjectURL(blob);
					setThumbUrl(currentThumbUrl);
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

	const isHEIC = meta.mime.includes('heic') || meta.mime.includes('heif');
	const isImage = meta.mime.startsWith('image/') && !isHEIC;
	const isVideo = meta.mime.startsWith('video/');
	const hasPreview = isImage || isVideo;

	return (
		<div className="mt-2 group/bubble max-w-[400px]">
			{hasPreview ? (
				<div className="relative rounded-lg overflow-hidden bg-secondary border border-border cursor-pointer hover:border-primary transition group">
					{thumbUrl ? (
						<img
							src={thumbUrl}
							alt="thumbnail"
							className="w-full h-auto max-h-[350px] object-contain block"
						/>
					) : (
						<div className="w-full h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2 bg-popover">
							{isVideo ? <Film size={48} /> : <ImageIcon size={48} />}
						</div>
					)}

					{/* Progress bar overlay for images */}
					{isDecrypting && (
						<div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4">
							<Loader2 size={24} className="text-white animate-spin mb-2" />
							<div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
								<div
									className="bg-primary h-full transition-all"
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>
					)}

					{/* Overlay Actions */}
					{!isDecrypting && (
						<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
							<Dialog.Root
								onOpenChange={(open) => {
									if (open)
										handleFullscreen({ stopPropagation: () => {} } as any);
								}}
							>
								<Dialog.Trigger asChild>
									<button className="bg-background p-3 rounded-full shadow-2xl hover:scale-110 transition cursor-pointer text-foreground">
										<Expand size={24} />
									</button>
								</Dialog.Trigger>
								<Dialog.Portal>
									<Dialog.Overlay className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100]" />
									<Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-screen h-screen flex flex-col items-center justify-center p-10 focus:outline-none">
										<Dialog.Close asChild>
											<button className="absolute top-6 right-6 text-white/50 hover:text-white transition-all p-2 bg-white/10 rounded-full z-[105] hover:rotate-90">
												<X size={32} />
											</button>
										</Dialog.Close>

										<div className="relative w-full h-full flex flex-col items-center justify-center">
											{fullUrl ? (
												isImage ? (
													<img
														src={fullUrl}
														className="max-w-full max-h-full object-contain"
														alt="fullscreen"
													/>
												) : (
													<video
														src={fullUrl}
														controls
														autoPlay
														className="max-w-full max-h-full"
													/>
												)
											) : (
												<div className="flex flex-col items-center gap-4">
													<Loader2
														size={48}
														className="text-primary animate-spin"
													/>
													<div className="w-48 bg-white/20 h-1 rounded-full">
														<div
															className="bg-primary h-full"
															style={{ width: `${progress}%` }}
														/>
													</div>
												</div>
											)}
											<div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/60 px-6 py-3 rounded-full border border-white/10 backdrop-blur-md">
												<div className="text-white text-sm font-medium">
													{meta.name || 'File'} •{' '}
													{(meta.size / 1024).toFixed(1)} KB
												</div>
												<button
													onClick={handleDownload}
													className="text-white bg-primary hover:opacity-90 px-4 py-1.5 rounded font-bold transition flex items-center gap-2"
												>
													<Download size={18} /> Download
												</button>
											</div>
										</div>
									</Dialog.Content>
								</Dialog.Portal>
							</Dialog.Root>

							<button
								onClick={handleDownload}
								className="bg-background p-3 rounded-full shadow-2xl hover:scale-110 transition cursor-pointer text-foreground"
							>
								<Download size={24} />
							</button>
						</div>
					)}
				</div>
			) : (
				/* File Info Card - Reverted Style with Hover Slide-in */
				<div
					className="relative flex items-center gap-4 bg-secondary border border-border rounded-md p-3 w-full hover:bg-accent transition cursor-pointer group overflow-hidden"
					onClick={() => handleDownload()}
				>
					<div className="w-10 h-10 bg-background rounded flex items-center justify-center text-muted-foreground shrink-0">
						{isDecrypting ? (
							<Loader2 size={20} className="animate-spin text-primary" />
						) : (
							<FileIcon size={20} />
						)}
					</div>
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-[14px] text-foreground font-medium truncate">
							{meta.name || 'Encrypted File'}
						</span>
						<span className="text-xs text-muted-foreground">
							{(meta.size / 1024).toFixed(1)} KB •{' '}
							{meta.mime.split('/')[1]?.toUpperCase() || 'FILE'}
						</span>
					</div>
					<button className="text-muted-foreground hover:text-foreground transition p-1 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-200">
						<Download size={20} />
					</button>

					{/* Tiny progress bar for card */}
					{isDecrypting && (
						<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/20 rounded-b-md">
							<div
								className="h-full bg-primary transition-all"
								style={{ width: `${progress}%` }}
							/>
						</div>
					)}
				</div>
			)}

			{error && <div className="text-destructive text-xs mt-1">{error}</div>}
		</div>
	);
};
