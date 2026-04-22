import React, { useRef, useMemo } from 'react';
import { type Message, type Channel } from '@/types/api';
import { MessageItem } from './MessageItem';

interface ChatMessageFeedProps {
	messages: (Message & { text?: string })[];
	channel: Channel;
}

// Group consecutive messages from the same sender
function isGrouped(
	prev: (Message & { text?: string }) | undefined,
	curr: Message & { text?: string },
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

export const ChatMessageFeed: React.FC<ChatMessageFeedProps> = ({ messages, channel }) => {
	const feedRef = useRef<HTMLDivElement>(null);

	const renderedItems = useMemo(() => {
		const items: Array<
			| { type: 'date'; label: string }
			| { type: 'msg'; msg: Message & { text?: string }; grouped: boolean }
		> = [];
		let lastDate = '';

		messages.forEach((msg, i) => {
			const dateLabel = formatDate(msg.sent_at);
			if (dateLabel !== lastDate) {
				items.push({ type: 'date', label: dateLabel });
				lastDate = dateLabel;
			}
			const grouped = isGrouped(messages[i - 1], msg);
			items.push({ type: 'msg', msg, grouped });
		});

		return items;
	}, [messages]);

	return (
		<div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col pt-0 scroll-smooth" ref={feedRef} id="messages-feed">
			{renderedItems.map((item, idx) => {
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
				
				return (
					<MessageItem 
						key={item.msg.id}
						msg={item.msg}
						channel={channel}
						grouped={item.grouped}
						formatTime={formatTime}
					/>
				);
			})}
			<div className="h-4 shrink-0"></div>
		</div>
	);
};
