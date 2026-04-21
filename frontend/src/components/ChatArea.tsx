import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiListMessages, type Message, type Channel } from '@/api/client';
import { onWS, wsSendMessage, decryptMessage } from '@/ws';

import { Avatar } from './Avatar';
import EmojiPicker from './EmojiPicker';
import VoiceRecorder from './VoiceRecorder';
import { Search, Users as UsersIcon, Smile, SendHorizontal, Play, Pause } from 'lucide-react';

interface ChatAreaProps {
	channel: Channel;
}

interface DecryptedMessage extends Message {
	text?: string;
}

// Group consecutive messages from the same sender
function isGrouped(
	prev: DecryptedMessage | undefined,
	curr: DecryptedMessage,
): boolean {
	if (!prev) return false;
	return (
		prev.sender_id === curr.sender_id &&
		new Date(curr.sent_at).getTime() - new Date(prev.sent_at).getTime() <
			120_000
	);
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (d.toDateString() === today.toDateString()) return 'Today';
	if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
	return d.toLocaleDateString([], {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	});
}

export default function ChatArea({ channel }: ChatAreaProps) {
	const [inputText, setInputText] = useState('');
	const [sending, setSending] = useState(false);
	const [showEmoji, setShowEmoji] = useState(false);
	const feedRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	
	// Scroll to bottom helper
	const scrollToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			if (feedRef.current) {
				feedRef.current.scrollTop = feedRef.current.scrollHeight;
			}
		});
	}, []);

	const queryClient = useQueryClient();

	const { data: messages = [] } = useQuery({
		queryKey: ['messages', channel.id],
		queryFn: async () => {
			const msgs = await apiListMessages(channel.id, 50);
			const decrypted = await Promise.all(
				msgs.reverse().map(async (m) => ({
					...m,
					text: m.type === 'text' ? await decryptMessage(m) : undefined,
				})),
			);
			setTimeout(scrollToBottom, 50);
			return decrypted;
		},
		staleTime: 60000,
	});

	// Decrypt and set a message via cache (so other components can read if needed)
	const addMessage = useCallback(
		async (msg: Message) => {
			const text = msg.type === 'text' ? await decryptMessage(msg) : undefined;
			queryClient.setQueryData<DecryptedMessage[]>(
				['messages', channel.id],
				(old = []) => [...old, { ...msg, text }]
			);
			scrollToBottom();
		},
		[scrollToBottom, queryClient, channel.id],
	);

	// Subscribe to incoming messages for this channel
	useEffect(() => {
		return onWS('message', (payload) => {
			const msg = payload as Message;
			if (msg.channel_id === channel.id) {
				addMessage(msg);
			}
		});
	}, [channel.id, addMessage]);

	// Send text message
	const handleSend = useCallback(async () => {
		const text = inputText.trim();
		if (!text || sending) return;
		setSending(true);
		setInputText('');
		await wsSendMessage(channel.id, text, 'text');
		setSending(false);
		inputRef.current?.focus();
	}, [inputText, sending, channel.id]);

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

	// Auto-resize textarea
	const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInputText(e.target.value);
		e.target.style.height = 'auto';
		e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
	};

	// Group messages and inject date separators
	const rendered: Array<
		| { type: 'date'; label: string }
		| { type: 'msg'; msg: DecryptedMessage; grouped: boolean }
	> = [];
	let lastDate = '';
	messages.forEach((msg, i) => {
		const dateLabel = formatDate(msg.sent_at);
		if (dateLabel !== lastDate) {
			rendered.push({ type: 'date', label: dateLabel });
			lastDate = dateLabel;
		}
		const grouped = isGrouped(messages[i - 1], msg);
		rendered.push({ type: 'msg', msg, grouped });
	});

	return (
		<div className="flex flex-col h-full w-full bg-background relative overflow-hidden">
			{/* Topbar */}
			<div className="flex items-center justify-between px-4 h-12 border-b border-[#1e1f22] shrink-0 shadow-sm relative z-10 bg-background">
				<div className="flex items-center gap-3">
					<Avatar userId={channel.id} size={36} />
					<div className="flex flex-col min-w-0">
						<div className="text-[15px] font-bold text-white leading-tight truncate">
							{channel.name || channel.id}
						</div>
						<div className="text-[13px] text-[#949ba4] leading-tight">
							{channel.members.length === 2
								? 'Direct Message'
								: `${channel.members.length} members`}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-4 text-[#b5bac1]">
					<button className="hover:text-[#dbdee1] transition" title="Search">
						<Search size={22} className="opacity-80 hover:opacity-100" />
					</button>
					<button className="hover:text-[#dbdee1] transition" title="Members">
						<UsersIcon size={22} className="opacity-80 hover:opacity-100" />
					</button>
				</div>
			</div>

			{/* Messages Feed */}
			<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col pt-0 scroll-smooth" ref={feedRef} id="messages-feed">
				{rendered.map((item, idx) => {
					if (item.type === 'date') {
						return (
							<div className="flex items-center justify-center my-6 relative" key={`date-${idx}`}>
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-[#3f4147]"></div>
								</div>
								<div className="relative flex justify-center text-xs font-semibold text-[#949ba4] bg-[#313338] px-2 rounded-lg">
									{item.label}
								</div>
							</div>
						);
					}
					const { msg, grouped } = item;

					return (
						<div
							key={msg.id}
							className={`group flex mb-0.5 hover:bg-[#2e3035] -mx-4 px-4 py-0.5 ${!grouped ? 'mt-4' : ''}`}
						>
							<div className="flex shrink-0 w-[55px] pt-1">
								{!grouped ? (
									<Avatar userId={msg.sender_id} size={40} />
								) : (
									<div className="w-full text-center text-[10px] text-transparent group-hover:text-[#949ba4] select-none pt-1">
										{formatTime(msg.sent_at)}
									</div>
								)}
							</div>
							<div className="flex flex-col min-w-0 flex-1">
								{!grouped && (
									<div className="flex items-baseline gap-2 mb-0.5">
										<span className="font-semibold text-[15px] text-[#f2f3f5] tracking-wide hover:underline cursor-pointer">
											{msg.sender_id}
										</span>
										<span className="text-xs text-[#949ba4]">
											{formatTime(msg.sent_at)}
										</span>
									</div>
								)}
								{msg.type === 'text' && (
									<div className="text-[15px] text-[#dbdee1] leading-[22px] whitespace-pre-wrap break-words" dir="auto">
										{msg.text ?? '[encrypted]'}
									</div>
								)}
								{msg.type === 'voice' && <VoiceBubble msg={msg} />}
							</div>
						</div>
					);
				})}
				<div className="h-4 shrink-0"></div>
			</div>

			{/* Input area */}
			<div className="px-4 pb-6 pt-2 shrink-0">
				<div className="bg-[#383a40] rounded-lg flex items-start px-4 py-2.5 gap-3 relative focus-within:ring-2 focus-within:ring-[#4752c4]/50 transition-all">
					<textarea
						ref={inputRef}
						id="chat-input"
						className="flex-1 bg-transparent border-none outline-none text-[#dbdee1] text-[15px] leading-6 resize-none min-h-[24px] max-h-[140px] placeholder-[#80848e] py-0"
						placeholder={`Message ${channel.name ? '#' + channel.name : channel.id}`}
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
							disabled={!inputText.trim() || sending}
							className="text-[#b5bac1] hover:text-[#dbdee1] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
							title="Send message"
						>
							{sending ? <span className="w-5 h-5 border-2 border-t-white border-[#b5bac1] rounded-full animate-spin" /> : <SendHorizontal size={24} />}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// ── Voice Bubble ─────────────────────────────────────────────────────────
function VoiceBubble({ msg }: { msg: DecryptedMessage }) {
	const [playing, setPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Fake waveform bars for visual interest (real waveform needs WebAudio)
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
		<div className="flex items-center gap-3 bg-[#2b2d31] border border-[#1e1f22] rounded-md p-2 w-max max-w-full">
			<button
				className="w-10 h-10 rounded-full bg-[#4752c4] text-white flex items-center justify-center hover:bg-[#5865f2] transition shrink-0"
				onClick={handlePlay}
				aria-label={playing ? 'Pause' : 'Play'}
			>
				{playing ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-1" />}
			</button>
			<div className="flex items-end gap-[2px] h-8 shrink-0 overflow-hidden" aria-hidden="true">
				{bars.map((h, i) => (
					<div
						key={i}
						className="w-1 bg-[#4f545c] rounded-full"
						style={{ height: `${Math.max(20, h * 100)}%` }}
					/>
				))}
			</div>
			<span className="text-xs font-medium text-[#949ba4] px-2 shrink-0">0:00</span>
		</div>
	);
}
