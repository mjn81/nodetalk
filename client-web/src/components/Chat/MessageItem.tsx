import React, { useState, useRef, useMemo } from 'react';
import { useAuthStore } from '@/store/store';
import { Avatar } from '../Avatar';
import { Play, Pause } from 'lucide-react';
import { type Message, type Channel } from '@/types/api';
import { FileBubble } from './FileBubble';

interface MessageItemProps {
	msg: Message & { text?: string };
	channel: Channel;
	grouped: boolean;
	formatTime: (iso: string) => string;
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, channel, grouped, formatTime }) => {
	const user = useAuthStore((state) => state.user);
	
	const isMentioned = useMemo(() => {
		if (!user || !msg.text) return false;
		// Simple check for @username. In a real app we might use regex for boundaries.
		return msg.text.includes(`@${user.username}`);
	}, [user, msg.text]);

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
			className={`group flex mb-0.5 -mx-4 px-4 py-0.5 transition-colors ${
				!grouped ? 'mt-4' : ''
			} ${
				isMentioned 
					? 'bg-mention border-l-2 border-mention-border hover:opacity-90' 
					: 'hover:bg-accent/30 border-l-2 border-transparent'
			}`}
		>
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
					<div className="text-[15px] text-foreground/90 leading-[22px] whitespace-pre-wrap break-words" dir="auto">
						{msg.text ? renderText(msg.text) : '[encrypted]'}
					</div>
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


