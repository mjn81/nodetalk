import { Profiler, useEffect, useCallback, useState, useMemo, memo } from 'react';
import { logProfiler } from '@/utils/profiler';

import { useQueryClient } from '@tanstack/react-query';
import { useMessages } from '@/hooks/useMessages';
import type { Message, Channel } from '@/types/api';
import { onWS, decryptMessage, wsSendReadReceipt } from '@/ws';
import { useAuthStore, useCryptoStore, useChannelStore } from '@/store/store';
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

const ChatArea = memo(({ channel }: ChatAreaProps) => {
	const user = useAuthStore((state) => state.user);
	const queryClient = useQueryClient();
	const refreshChannels = useChannelStore((state) => state.refreshChannels);
	const [searchQuery, setSearchQuery] = useState('');

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

	// Send read receipt when opening channel
	useEffect(() => {
		wsSendReadReceipt(channel.id);
		// Clear local unread count in sidebar immediately on entry
		refreshChannels();
	}, [channel.id, refreshChannels]);

	// Automatically scroll to bottom when messages change
	useEffect(() => {
		if (messages.length > 0 && !searchQuery) {
			scrollToBottom();
		}
	}, [messages.length, scrollToBottom, searchQuery]);

	const filteredMessages = useMemo(() => 
		searchQuery
			? messages.filter((m) =>
					m.text?.toLowerCase().includes(searchQuery.toLowerCase()),
			  )
			: messages,
	[messages, searchQuery]);

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
		const unsubMsg = onWS('message', (payload) => {
			const msg = payload as Message;
			if (msg.channel_id === channel.id) {
				addMessage(msg);
			}
		});

		const unsubUpdate = onWS('message_update', async (payload) => {
			const msg = payload as Message;
			if (msg.channel_id === channel.id) {
				const text = msg.type === 'text' ? await decryptMessage(msg) : undefined;
				const fullMsg = { ...msg, text };
				
				await db.cacheMessages([fullMsg]);
				
				queryClient.setQueryData<DecryptedMessage[]>(
					['messages', channel.id],
					(old) => {
						if (!old) return [fullMsg];
						return old.map(m => m.id === msg.id ? fullMsg : m);
					}
				);
			}
		});

		const unsubDelete = onWS('message_delete', (payload: any) => {
			const { channel_id, message_id } = payload;
			if (channel_id === channel.id) {
				db.deleteMessage(message_id);
				queryClient.setQueryData<DecryptedMessage[]>(
					['messages', channel.id],
					(old) => {
						if (!old) return [];
						return old.filter(m => m.id !== message_id);
					}
				);
			}
		});

		return () => {
			unsubMsg();
			unsubUpdate();
			unsubDelete();
		};
	}, [channel.id, addMessage, queryClient]);

	// Invalidate messages if the channel key arrives late
	useEffect(() => {
		return onWS('channel_key', (payload: any) => {
			if (payload.channel_id === channel.id) {
				queryClient.invalidateQueries({ queryKey: ['messages', channel.id] });
			}
		});
	}, [channel.id, queryClient]);

	const channelKey = useCryptoStore((state) => state.channelKeys.get(channel.id));
	const [replyTo, setReplyTo] = useState<DecryptedMessage | null>(null);

	const handleReply = useCallback((msg: DecryptedMessage) => {
		setReplyTo(msg);
	}, []);

	return (
		<Profiler id="ChatArea" onRender={logProfiler}>
			<div className="flex flex-col h-full w-full bg-background relative overflow-hidden">
				<ChatTopbar 
					channel={channel} 
					currentUserId={user?.id ?? ''} 
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
				/>
				<VoicePlayer />
				<ChatMessageFeed 
					messages={filteredMessages} 
					channel={channel} 
					onReply={handleReply}
				/>

				<ChatInputArea 
					channel={channel} 
					channelKey={channelKey ?? new Uint8Array(32)} // Fallback in case key isn't loaded
					replyTo={replyTo}
					onCancelReply={() => setReplyTo(null)}
					messages={messages}
				/>
			</div>
		</Profiler>
	);
});

ChatArea.whyDidYouRender = true;
export default ChatArea;
