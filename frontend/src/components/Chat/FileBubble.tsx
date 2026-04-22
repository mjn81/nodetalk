import React, { useState, useEffect } from 'react';
import { Download, FileIcon, ImageIcon, Film, Loader2 } from 'lucide-react';
import { type Message } from '@/types/api';
import { decryptMessage, getChannelKey, base64ToBytes, onWS } from '@/ws';
import { decryptAndDecompressFile, ensureZstdReady } from '@/utils/file';
import { apiGetFileUrl } from '@/api/client';

interface FileBubbleProps {
	msg: Message;
}

interface FileMetadata {
	file_id: string;
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
	const [error, setError] = useState<string | null>(null);



	useEffect(() => {
		let currentThumbUrl: string | null = null;
		
		const loadMeta = async () => {
			const key = getChannelKey(msg.channel_id);
			if (!key) return;

			try {
				const decrypted = await decryptMessage(msg);
				if (decrypted === '[encrypted]' || decrypted === '[decryption failed]') return;
				
				const parsed = JSON.parse(decrypted) as FileMetadata;
				setMeta(parsed);

				// Prepare thumbnail if present
				if (parsed.thumb_ciphertext && parsed.thumb_nonce) {
					await ensureZstdReady();
					const thumbCipher = base64ToBytes(parsed.thumb_ciphertext);
					const thumbNonce = base64ToBytes(parsed.thumb_nonce);
					
                    const cryptoKey = await crypto.subtle.importKey(
                        'raw', key.buffer as ArrayBuffer,
                        { name: 'AES-GCM' }, false, ['decrypt'],
                    );
                    const decryptedThumb = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: thumbNonce as any },
                        cryptoKey,
                        thumbCipher as any
                    );
					const blob = new Blob([decryptedThumb], { type: 'image/jpeg' });
					if (currentThumbUrl) URL.revokeObjectURL(currentThumbUrl);
					currentThumbUrl = URL.createObjectURL(blob);
					setThumbUrl(currentThumbUrl);
				}
			} catch (err) {
				console.error('FileBubble decryption error:', err);
				setError('Failed to load file preview');
			}
		};

		loadMeta();

		// Listen for key arrival if we don't have it yet
		const unsubKey = onWS('channel_key', (payload: any) => {
			if (payload.channel_id === msg.channel_id) {
				loadMeta();
			}
		});

		return () => {
			unsubKey();
			if (currentThumbUrl) URL.revokeObjectURL(currentThumbUrl);
		};
	}, [msg]);

	const handleDownload = async () => {
		const key = getChannelKey(msg.channel_id);
		if (!meta || !key || isDecrypting) return;
		setIsDecrypting(true);
		setError(null);

		try {
			const url = apiGetFileUrl(meta.file_id);
			const res = await fetch(url);
			if (!res.ok) throw new Error('Download failed');
			
			const encryptedBuffer = await res.arrayBuffer();
			const decrypted = await decryptAndDecompressFile(
				new Uint8Array(encryptedBuffer),
				base64ToBytes(meta.nonce),
				key
			);

			const blob = new Blob([decrypted as any], { type: meta.mime });
			const downloadUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = `file-${meta.file_id.substring(0, 8)}.${meta.mime.split('/')[1] || 'bin'}`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
		} catch (err) {
			console.error('Download error:', err);
			setError('Download failed');
		} finally {
			setIsDecrypting(false);
		}
	};

	if (!meta) {
		return (
			<div className="mt-2 flex items-center gap-2 p-3 bg-[#2b2d31] border border-[#1e1f22] rounded-md animate-pulse max-w-[200px]">
				<Loader2 size={16} className="animate-spin text-[#949ba4]" />
				<span className="text-sm text-[#949ba4]">Decrypting...</span>
			</div>
		);
	}

	const isImage = meta.mime.startsWith('image/');
	const isVideo = meta.mime.startsWith('video/');
	const hasPreview = isImage || isVideo;

	return (
		<div className="mt-2 group/bubble max-w-[400px]">
			{/* Preview Area (Images / Videos) */}
			{hasPreview ? (
				<div 
					className="relative rounded-lg overflow-hidden bg-[#2b2d31] border border-[#1e1f22] cursor-pointer hover:border-[#4752c4] transition group"
					onClick={handleDownload}
				>
					{thumbUrl ? (
						<img 
							src={thumbUrl} 
							alt="thumbnail" 
							className="w-full h-auto max-h-[350px] object-contain block" 
						/>
					) : (
						<div className="w-full h-[200px] flex flex-col items-center justify-center text-[#949ba4] gap-2 bg-[#232428]">
							{isVideo ? <Film size={48} /> : <ImageIcon size={48} />}
							<span className="text-xs uppercase font-bold tracking-wider opacity-50">
								{isDecrypting ? 'Decrypting...' : 'View Preview'}
							</span>
						</div>
					)}
					
					{/* Overlay */}
					<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
						<div className="bg-[#313338] p-3 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform">
							{isDecrypting ? (
								<Loader2 size={24} className="text-white animate-spin" />
							) : (
								<Download size={24} className="text-white" />
							)}
						</div>
					</div>
				</div>
			) : (
				/* File Info Card (Generic) */
				<div className="flex items-center gap-4 bg-[#2b2d31] border border-[#1e1f22] rounded-md p-3 w-full hover:bg-[#313338] transition cursor-pointer" onClick={handleDownload}>
					<div className="w-10 h-10 bg-[#313338] rounded flex items-center justify-center text-[#949ba4] shrink-0">
						{isDecrypting ? <Loader2 size={20} className="animate-spin" /> : <FileIcon size={20} />}
					</div>
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-[14px] text-white font-medium truncate">
							Encrypted File
						</span>
						<span className="text-xs text-[#949ba4]">
							{(meta.size / 1024).toFixed(1)} KB • {meta.mime.split('/')[1]?.toUpperCase() || 'FILE'}
						</span>
					</div>
					<button className="text-[#dbdee1] hover:text-white transition p-1">
						<Download size={20} />
					</button>
				</div>
			)}

			{error && <div className="text-[#f23f43] text-xs mt-1 bg-[#f23f43]/10 px-2 py-1 rounded border border-[#f23f43]/20">{error}</div>}
		</div>
	);
}
