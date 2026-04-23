import React, { useState, useRef, useMemo } from 'react';
import { useAuthStore } from '@/store/store';
import { Avatar } from '../Avatar';
import { type Message, type Channel } from '@/types/api';
import { FileBubble } from './FileBubble';
import { Pencil, Trash2, Play, Pause } from 'lucide-react';
import { wsEditMessage, wsDeleteMessage } from '@/ws';

import { JoinPreview } from './JoinPreview';

import { ConfirmModal } from '../ConfirmModal';

interface MessageItemProps {
	msg: Message & { text?: string };
	channel: Channel;
	grouped: boolean;
	formatTime: (iso: string) => string;
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, channel, grouped, formatTime }) => {
	const user = useAuthStore((state) => state.user);
	const [isEditing, setIsEditing] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [editValue, setEditValue] = useState(msg.text || '');
	const isOwn = user?.id === msg.sender_id;
	
	const joinCode = useMemo(() => {
		if (!msg.text) return null;
		// Match /join/ followed by alphanumeric/dashes
		const match = msg.text.match(/\/join\/([a-zA-Z0-9-]+)/);
		return match ? match[1] : null;
	}, [msg.text]);

	const isMentioned = useMemo(() => {
		if (!user || !msg.text) return false;
		// Simple check for @username. In a real app we might use regex for boundaries.
		return msg.text.includes(`@${user.username}`);
	}, [user, msg.text]);

	const handleEdit = async () => {
		if (!editValue.trim() || editValue === msg.text) {
			setIsEditing(false);
			return;
		}
		const ok = await wsEditMessage(channel.id, msg.id, editValue);
		if (ok) setIsEditing(false);
	};

	const handleDelete = async () => {
		wsDeleteMessage(channel.id, msg.id);
	};

	const renderText = (text: string) => {
		if (!text) return text;
		const parts = text.split(/(@\w+)/g);
		return parts.map((part, i) => {
			if (part.startsWith('@')) {
				const username = part.substring(1);
				const isMe = user?.username === username;
				return (
					<span 
						key={i} 
						className={`rounded-[3px] px-[2px] font-medium transition-colors cursor-pointer ${
							isMe 
								? 'bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground' 
								: 'text-primary hover:underline'
						}`}
					>
						{part}
					</span>
				);
			}
			return part;
		});
	};

	return (
		<div
			className={`group flex mb-0.5 -mx-4 px-4 py-0.5 transition-colors relative ${
				!grouped ? 'mt-4' : ''
			} ${
				isMentioned 
					? 'bg-mention border-l-2 border-mention-border hover:opacity-90' 
					: 'hover:bg-accent/30 border-l-2 border-transparent'
			}`}
		>
			{/* Action Menu (Only for own messages) */}
			{isOwn && !isEditing && (
				<div className="absolute right-4 -top-3 hidden group-hover:flex items-center gap-0.5 bg-background border border-border rounded-md shadow-sm overflow-hidden z-20">
					{msg.type === 'text' && (
						<button 
							onClick={() => {
								setEditValue(msg.text || '');
								setIsEditing(true);
							}}
							className="p-1.5 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
							title="Edit Message"
						>
							<Pencil size={14} />
						</button>
					)}
					<button 
						onClick={() => setShowDeleteConfirm(true)}
						className={`p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ${msg.type === 'text' ? 'border-l border-border' : ''}`}
						title="Delete Message"
					>
						<Trash2 size={14} />
					</button>
				</div>
			)}

			<ConfirmModal
				isOpen={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={handleDelete}
				title="Delete Message"
				message="Are you sure you want to delete this message? This action cannot be undone."
				confirmText="Delete"
				variant="danger"
			/>

			<div className="flex shrink-0 w-[55px] pt-1">
				{!grouped ? (
					<Avatar 
						userId={msg.sender_id} 
						avatarId={channel.member_avatars?.[msg.sender_id]}
						size={40} 
					/>
				) : (
					<div className="w-full text-center text-[10px] text-transparent group-hover:text-muted-foreground select-none pt-1">
						{formatTime(msg.sent_at)}
					</div>
				)}
			</div>
			<div className="flex flex-col min-w-0 flex-1">
				{!grouped && (
					<div className="flex items-baseline gap-2 mb-0.5">
						<span className="font-semibold text-[15px] text-foreground tracking-wide hover:underline cursor-pointer">
							{channel.member_names?.[msg.sender_id] || msg.sender_id}
						</span>
						<span className="text-xs text-muted-foreground">
							{formatTime(msg.sent_at)}
						</span>
					</div>
				)}
				{msg.type === 'text' && (
					<>
						{isEditing ? (
							<div className="mt-1">
								<div className="bg-secondary rounded-lg px-3 py-2 border border-primary/30">
									<textarea
										autoFocus
										value={editValue}
										onChange={(e) => setEditValue(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												handleEdit();
											} else if (e.key === 'Escape') {
												setIsEditing(false);
											}
										}}
										className="w-full bg-transparent border-none outline-none text-[15px] resize-none min-h-[44px]"
										rows={1}
									/>
								</div>
								<div className="flex gap-2 mt-1.5 text-[11px]">
									<span className="text-muted-foreground">
										escape to <span className="text-primary hover:underline cursor-pointer" onClick={() => setIsEditing(false)}>cancel</span>
									</span>
									<span className="text-muted-foreground">•</span>
									<span className="text-muted-foreground">
										enter to <span className="text-primary hover:underline cursor-pointer" onClick={handleEdit}>save</span>
									</span>
								</div>
							</div>
						) : (
							<div className="text-[15px] text-foreground/90 leading-[22px] whitespace-pre-wrap break-words" dir="auto">
								{msg.text ? renderText(msg.text) : '[encrypted]'}
								{msg.edited_at && (
									<span className="text-[10px] text-muted-foreground ml-1 inline-block select-none">
										(edited)
									</span>
								)}
							</div>
						)}
						{joinCode && !isEditing && <JoinPreview inviteCode={joinCode} />}
					</>
				)}
				{msg.type === 'voice' && <VoiceBubble msg={msg} />}
				{msg.type === 'file' && <FileBubble msg={msg} />}
			</div>
		</div>
	);
};

function VoiceBubble({ msg }: { msg: Message }) {
	const [playing, setPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const bars = Array.from(
		{ length: 28 },
		(_, i) =>
			Math.sin(i * 0.8 + (msg.id.charCodeAt(i % msg.id.length) ?? 1)) * 0.5 +
			0.5,
	);

	const handlePlay = () => {
		if (!audioRef.current) return;
		if (playing) {
			audioRef.current.pause();
			setPlaying(false);
		} else {
			audioRef.current.play();
			setPlaying(true);
		}
	};

	return (
		<div className="flex items-center gap-3 bg-card border border-border rounded-md p-2 w-max max-w-full mt-1">
			<button
				className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition shrink-0"
				onClick={handlePlay}
			>
				{playing ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-1" />}
			</button>
			<div className="flex items-end gap-[2px] h-8 shrink-0 overflow-hidden">
				{bars.map((h, i) => (
					<div
						key={i}
						className="w-1 bg-muted-foreground/30 rounded-full"
						style={{ height: `${Math.max(20, h * 100)}%` }}
					/>
				))}
			</div>
			<span className="text-xs font-medium text-muted-foreground px-2 shrink-0">0:00</span>
		</div>
	);
}


