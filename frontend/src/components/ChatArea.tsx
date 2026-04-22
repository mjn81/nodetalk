import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessages } from '@/hooks/useMessages';
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

	const { data: messages = [] } = useMessages(channel.id, scrollToBottom);

	// Automatically scroll to bottom when messages change
	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	}, [messages.length, scrollToBottom]);

	// Decrypt and set a message via cache
	const addMessage = useCallback(
		async (msg: Message) => {
			// Avoid duplicates if we just fetched from REST
			const text = msg.type === 'text' ? await decryptMessage(msg) : undefined;
			queryClient.setQueryData<DecryptedMessage[]>(
				['messages', channel.id],
				(old) => {
					if (!old) return [{ ...msg, text }];
					// Check if message already exists (e.g. from a concurrent REST fetch)
					if (old.some(m => m.id === msg.id)) return old;
					return [...old, { ...msg, text }];
				}
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
			
			<ChatMessageFeed messages={messages} channel={channel} />

			<ChatInputArea 
				channel={channel} 
				channelKey={channelKey ?? new Uint8Array(32)} // Fallback in case key isn't loaded
			/>
		</div>
	);
}
