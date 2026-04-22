import React, { useState, useEffect } from 'react';
import { Download, FileIcon, ImageIcon, Film, Loader2, Expand, X } from 'lucide-react';
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
    const [fullUrl, setFullUrl] = useState<string | null>(null);
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
		setError(null);

		try {
			const encryptedBuffer = await apiGetFile(meta.file_id);
			const decrypted = await decryptAndDecompressFile(
				new Uint8Array(encryptedBuffer),
				base64ToBytes(meta.nonce),
				key
			);

			const blob = new Blob([decrypted as any], { type: meta.mime });
			const downloadUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = downloadUrl;
			a.download = meta.name || `file-${meta.file_id.substring(0, 8)}.${meta.mime.split('/')[1] || 'bin'}`;
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

    const handleFullscreen = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (fullUrl) return; // Already loaded

        const key = getChannelKey(msg.channel_id);
		if (!meta || !key || isDecrypting) return;
		setIsDecrypting(true);

        try {
            const encryptedBuffer = await apiGetFile(meta.file_id);
			const decrypted = await decryptAndDecompressFile(
				new Uint8Array(encryptedBuffer),
				base64ToBytes(meta.nonce),
				key
			);
            const blob = new Blob([decrypted as any], { type: meta.mime });
			const url = URL.createObjectURL(blob);
            setFullUrl(url);
        } catch (err) {
            console.error('Fullscreen load error:', err);
            setError('Failed to load full image');
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

	const isHEIC = meta.mime.includes('heic') || meta.mime.includes('heif');
	const isImage = meta.mime.startsWith('image/') && !isHEIC;
	const isVideo = meta.mime.startsWith('video/');
	const hasPreview = isImage || isVideo;

	return (
		<div className="mt-2 group/bubble max-w-[400px]">
			{hasPreview ? (
				<div 
					className="relative rounded-lg overflow-hidden bg-[#2b2d31] border border-[#1e1f22] transition group"
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
					
					{/* Overlay Actions */}
					<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-4">
                        <Dialog.Root onOpenChange={(open) => { if (open) handleFullscreen(({ stopPropagation: () => {} } as any)) }}>
                            <Dialog.Trigger asChild>
                                <button className="bg-[#313338] p-3 rounded-full shadow-2xl hover:scale-110 transition cursor-pointer text-white">
                                    <Expand size={24} />
                                </button>
                            </Dialog.Trigger>
                            <Dialog.Portal>
                                <Dialog.Overlay className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] animate-in fade-in duration-200" />
                                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-screen h-screen flex flex-col items-center justify-center p-10 focus:outline-none">
                                    <Dialog.Close asChild>
                                        <button className="absolute top-6 right-6 text-white/50 hover:text-white transition p-2 bg-white/10 rounded-full z-[102]">
                                            <X size={32} />
                                        </button>
                                    </Dialog.Close>
                                    
                                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                                        {fullUrl ? (
                                            isImage ? (
                                                <img src={fullUrl} className="max-w-full max-h-full object-contain shadow-2xl" alt="fullscreen" />
                                            ) : (
                                                <video src={fullUrl} controls autoPlay className="max-w-full max-h-full" />
                                            )
                                        ) : (
                                            <div className="flex flex-col items-center gap-4">
                                                <Loader2 size={48} className="text-white animate-spin" />
                                                <span className="text-white text-lg font-medium">Decrypting Full Content...</span>
                                            </div>
                                        )}
                                        
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 px-6 py-3 rounded-full border border-white/10">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium text-sm truncate max-w-[200px]">{meta.name || 'File'}</span>
                                                <span className="text-white/50 text-xs uppercase">{(meta.size/1024).toFixed(1)} KB</span>
                                            </div>
                                            <div className="w-[1px] h-6 bg-white/20" />
                                            <button 
                                                onClick={handleDownload}
                                                className="flex items-center gap-2 text-white bg-[#5865f2] hover:bg-[#4752c4] px-4 py-2 rounded-md font-bold transition text-sm"
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
                            className="bg-[#313338] p-3 rounded-full shadow-2xl hover:scale-110 transition cursor-pointer text-white"
                        >
							<Download size={24} />
						</button>
					</div>
				</div>
			) : (
				/* File Info Card (Generic) */
				<div 
                    className="flex items-center gap-4 bg-[#2b2d31] border border-[#1e1f22] rounded-md p-3 w-full hover:bg-[#313338] transition cursor-pointer group" 
                    onClick={() => handleDownload()}
                >
					<div className="w-10 h-10 bg-[#313338] rounded flex items-center justify-center text-[#949ba4] shrink-0">
						{isDecrypting ? <Loader2 size={20} className="animate-spin" /> : <FileIcon size={20} />}
					</div>
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-[14px] text-white font-medium truncate">
							{meta.name || 'Encrypted File'}
						</span>
						<span className="text-xs text-[#949ba4]">
							{(meta.size / 1024).toFixed(1)} KB • {meta.mime.split('/')[1]?.toUpperCase() || 'FILE'}
						</span>
					</div>
					<button className="text-[#dbdee1] hover:text-[#5865f2] transition p-2 bg-[#1e1f22] rounded-full opacity-0 group-hover:opacity-100 shadow-lg translate-x-2 group-hover:translate-x-0 transition-all">
						<Download size={20} />
					</button>
				</div>
			)}

			{error && <div className="text-[#f23f43] text-xs mt-1 bg-[#f23f43]/10 px-2 py-1 rounded border border-[#f23f43]/20">{error}</div>}
		</div>
	);
};
