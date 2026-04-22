import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiListMessages } from '@/api/client';
import type { Message, Channel } from '@/types/api';
import { onWS, decryptMessage } from '@/ws';
import { useAuthStore, useCryptoStore } from '@/store/store';

import { ChatTopbar } from './Chat/ChatTopbar';
import { ChatMessageFeed } from './Chat/ChatMessageFeed';
import { ChatInputArea } from './Chat/ChatInputArea';

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

	// Decrypt and set a message via cache
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
			<ChatTopbar channel={channel} currentUserId={user?.user_id ?? ''} />
			
			<ChatMessageFeed messages={messages} channel={channel} />

			<ChatInputArea 
				channel={channel} 
				channelKey={channelKey ?? new Uint8Array(32)} // Fallback in case key isn't loaded
			/>
		</div>
	);
}
