import React, { useState, useRef, useCallback } from 'react';
import { Plus, X, FileIcon, Loader2, Smile, SendHorizontal } from 'lucide-react';
import EmojiPicker from '../EmojiPicker';
import VoiceRecorder from '../VoiceRecorder';
import { getChannelDisplayName } from '@/store/store';
import type { Channel } from '@/types/api';
import { apiUploadFile } from '@/api/client';
import { encryptAndCompressFile } from '@/utils/file';
import { wsSendMessage } from '@/ws';
import { bytesToBase64 } from '@/ws';

interface ChatInputAreaProps {
	channel: Channel;
	currentUser: any;
	channelKey: Uint8Array;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({ channel, currentUser, channelKey }) => {
	const [inputText, setInputText] = useState('');
	const [sending, setSending] = useState(false);
	const [showEmoji, setShowEmoji] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [files, setFiles] = useState<{ file: File; id: string; status: 'idle' | 'uploading' | 'done'; progress: number }[]>([]);
	
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleSend = useCallback(async () => {
		const text = inputText.trim();
		if ((!text && files.length === 0) || sending) return;
		setSending(true);

		try {
			// Handle file uploads first
			for (const f of files) {
				const processed = await encryptAndCompressFile(f.file, channelKey);
				
				// Upload to server
				const res = await apiUploadFile(
					new Blob([processed.ciphertext as any], { type: processed.mimeType }),
					processed.mimeType,
					processed.thumbnailCipher ? bytesToBase64(processed.thumbnailCipher) : undefined,
					processed.thumbnailNonce ? bytesToBase64(processed.thumbnailNonce) : undefined
				);

				// Send message via WebSocket with file reference
				// The ciphertext in the WebSocket message will contain the file metadata
				// formatted as JSON and then encrypted.
				const fileMetadata = JSON.stringify({
					file_id: (res as any).id,
					mime: processed.mimeType,
					size: processed.originalSize,
					nonce: bytesToBase64(processed.nonce),
					thumb_ciphertext: processed.thumbnailCipher ? bytesToBase64(processed.thumbnailCipher) : undefined,
					thumb_nonce: processed.thumbnailNonce ? bytesToBase64(processed.thumbnailNonce) : undefined,
				});

				await wsSendMessage(channel.id, fileMetadata, 'file');
			}

			// Handle text message
			if (text) {
				await wsSendMessage(channel.id, text, 'text');
			}

			setInputText('');
			setFiles([]);
		} catch (err) {
			console.error('Failed to send messages:', err);
		} finally {
			setSending(false);
			inputRef.current?.focus();
		}
	}, [inputText, files, sending, channel.id, channelKey]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleEmojiSelect = (emoji: { native: string }) => {
		setInputText((prev) => prev + emoji.native);
		setShowEmoji(false);
		inputRef.current?.focus();
	};

	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInputText(e.target.value);
		e.target.style.height = 'auto';
		e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
	};

	const onDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const onDragLeave = () => {
		setIsDragging(false);
	};

	const onDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const droppedFiles = Array.from(e.dataTransfer.files);
		if (droppedFiles.length > 0) {
			addFiles(droppedFiles);
		}
	};

	const addFiles = (newFiles: File[]) => {
		setFiles(prev => [
			...prev,
			...newFiles.map(f => ({
				file: f,
				id: Math.random().toString(36).substring(7),
				status: 'idle' as const,
				progress: 0
			}))
		]);
	};

	const removeFile = (id: string) => {
		setFiles(prev => prev.filter(f => f.id !== id));
	};

	return (
		<div 
			className="px-4 pb-6 pt-2 shrink-0 relative"
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			{/* Drag & Drop Overlay */}
			{isDragging && (
				<div className="absolute inset-x-4 inset-y-2 bg-[#4752c4]/20 border-2 border-dashed border-[#4752c4] rounded-lg z-50 flex items-center justify-center backdrop-blur-sm transition-all animate-in fade-in zoom-in duration-200">
					<div className="bg-[#313338] p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
						<Plus size={48} className="text-[#4752c4]" />
						<span className="text-white font-bold text-lg">Drop to upload</span>
					</div>
				</div>
			)}

			<div className="bg-[#383a40] rounded-lg flex flex-col relative focus-within:ring-2 focus-within:ring-[#4752c4]/50 transition-all overflow-hidden">
				
				{/* File Previews */}
				{files.length > 0 && (
					<div className="flex gap-3 p-3 overflow-x-auto border-b border-[#2e3035]">
						{files.map((f) => (
							<div key={f.id} className="relative w-24 h-24 bg-[#2b2d31] rounded-md flex flex-col items-center justify-center p-2 group transition-transform hover:scale-105">
								<button 
									onClick={() => removeFile(f.id)}
									className="absolute -top-1.5 -right-1.5 bg-[#da373c] text-white rounded-full p-0.5 shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<X size={14} />
								</button>
								{f.file.type.startsWith('image/') ? (
									<img 
										src={URL.createObjectURL(f.file)} 
										alt="preview" 
										className="w-full h-full object-cover rounded" 
									/>
								) : (
									<div className="flex flex-col items-center gap-1">
										<FileIcon size={32} className="text-[#949ba4]" />
										<span className="text-[10px] text-[#949ba4] truncate w-20 text-center">{f.file.name}</span>
									</div>
								)}
							</div>
						))}
					</div>
				)}

				<div className="flex items-start px-4 py-2.5 gap-3">
					<button 
						onClick={() => fileInputRef.current?.click()}
						className="mt-0.5 text-[#b5bac1] hover:text-[#dbdee1] transition"
						title="Upload file"
					>
						<Plus className="bg-[#b5bac1]/10 rounded-full p-1 w-6 h-6 hover:bg-[#b5bac1]/20" />
					</button>
					<input 
						type="file" 
						ref={fileInputRef} 
						className="hidden" 
						multiple 
						onChange={(e) => e.target.files && addFiles(Array.from(e.target.files))}
					/>

					<textarea
						ref={inputRef}
						className="flex-1 bg-transparent border-none outline-none text-[#dbdee1] text-[15px] leading-6 resize-none min-h-[24px] max-h-[140px] placeholder-[#80848e] py-0"
						placeholder={`Message ${getChannelDisplayName(channel, currentUser?.user_id ?? '')}`}
						value={inputText}
						onChange={handleInput}
						onKeyDown={handleKeyDown}
						rows={1}
						dir="auto"
						aria-label="Type a message"
					/>
					
					<div className="flex items-center gap-3 shrink-0 h-6">
						<VoiceRecorder channelId={channel.id} />
						<div className="relative flex items-center justify-center">
							<button
								onClick={() => setShowEmoji((v) => !v)}
								className="text-[#b5bac1] hover:text-[#dbdee1] transition flex items-center"
								title="Add emoji"
							>
								<Smile size={24} />
							</button>
							{showEmoji && (
								<div className="absolute bottom-10 right-0 z-50">
									<EmojiPicker
										onSelect={handleEmojiSelect}
										onClickOutside={() => setShowEmoji(false)}
									/>
								</div>
							)}
						</div>
						<button
							onClick={handleSend}
							disabled={(!inputText.trim() && files.length === 0) || sending}
							className="text-[#b5bac1] hover:text-[#dbdee1] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
							title="Send message"
						>
							{sending ? <Loader2 size={24} className="animate-spin" /> : <SendHorizontal size={24} />}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
