import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessages } from '@/hooks/useMessages';
import type { Message, Channel } from '@/types/api';
import { onWS, decryptMessage } from '@/ws';
import { useAuthStore, useCryptoStore } from '@/store/store';
import { db } from '@/lib/db';

import { ChatTopbar } from './Chat/ChatTopbar';
import { ChatMessageFeed } from './Chat/ChatMessageFeed';
import { ChatInputArea } from './Chat/ChatInputArea';
import { VoicePlayer } from './Chat/VoicePlayer';

interface ChatAreaProps {
	channel: Channel;
}

interface DecryptedMessage extends Message {
	text?: string;
}

export default function ChatArea({ channel }: ChatAreaProps) {
	const user = useAuthStore((state) => state.user);
	const queryClient = useQueryClient();

	// Scroll to bottom helper
	const scrollToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			const feed = document.getElementById('messages-feed');
			if (feed) {
				feed.scrollTop = feed.scrollHeight;
			}
		});
	}, []);

	const { data: messages = [] } = useMessages(channel.id, scrollToBottom);

	// Automatically scroll to bottom when messages change
	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	}, [messages.length, scrollToBottom]);

	// Pre-populate query data from IndexedDB when channel changes
	useEffect(() => {
		const preloadFromDB = async () => {
			const cached = await db.getCachedMessages(channel.id);
			if (cached.length > 0) {
				queryClient.setQueryData(['messages', channel.id], (old: any) => {
					// Only set if we don't have fresh data yet
					return (old && old.length > 0) ? old : cached;
				});
			}
		};
		preloadFromDB();
	}, [channel.id, queryClient]);

	// Decrypt and set a message via cache
	const addMessage = useCallback(
		async (msg: Message) => {
			// Avoid duplicates if we just fetched from REST
			const text = msg.type === 'text' ? await decryptMessage(msg) : undefined;
			const fullMsg = { ...msg, text };

			// Save to IndexedDB
			await db.cacheMessages([fullMsg]);

			queryClient.setQueryData<DecryptedMessage[]>(
				['messages', channel.id],
				(old) => {
					if (!old) return [fullMsg];
					// Check if message already exists
					if (old.some((m) => m.id === msg.id)) return old;
					const updated = [...old, fullMsg];
					// Ensure chronological order
					return updated.sort(
						(a, b) =>
							new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
					);
				},
			);
		},
		[queryClient, channel.id],
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

	// Invalidate messages if the channel key arrives late
	useEffect(() => {
		return onWS('channel_key', (payload: any) => {
			if (payload.channel_id === channel.id) {
				queryClient.invalidateQueries({ queryKey: ['messages', channel.id] });
			}
		});
	}, [channel.id, queryClient]);

	const channelKey = useCryptoStore((state) => state.channelKeys.get(channel.id));

	return (
		<div className="flex flex-col h-full w-full bg-background relative overflow-hidden">
				<ChatTopbar channel={channel} currentUserId={user?.id ?? ''} />
			<VoicePlayer />
			<ChatMessageFeed messages={messages} channel={channel} />

			<ChatInputArea 
				channel={channel} 
				channelKey={channelKey ?? new Uint8Array(32)} // Fallback in case key isn't loaded
			/>
		</div>
	);
}
