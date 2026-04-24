import { useRef, useMemo, memo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type Message, type Channel } from '@/types/api';
import { MessageItem } from './MessageItem';

interface ChatMessageFeedProps {
	messages: (Message & { text?: string })[];
	channel: Channel;
	onReply?: (msg: Message & { text?: string }) => void;
	fetchNextPage?: () => void;
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
}

// Group consecutive messages from the same sender
function isGrouped(
	prev: (Message & { text?: string }) | undefined,
	curr: Message & { text?: string },
): boolean {
	if (!prev) return false;
	// Replies never get grouped for better UI
	if (curr.reply_to_id) return false;
	return (
		prev.sender_id === curr.sender_id &&
		Math.abs(new Date(curr.sent_at).getTime() - new Date(prev.sent_at).getTime()) <
			300_000 // 5 minutes
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

export const ChatMessageFeed = memo(
	({
		messages,
		channel,
		onReply,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
	}: ChatMessageFeedProps) => {
		const feedRef = useRef<HTMLDivElement>(null);

		const renderedItems = useMemo(() => {
			const items: Array<
				| { type: 'date'; label: string; id: string }
				| { type: 'header'; id: string }
				| {
						type: 'msg';
						msg: Message & { text?: string };
						grouped: boolean;
						id: string;
				  }
			> = [];

			// messages is newest-first. Index 0 is newest.
			messages.forEach((msg, i) => {
				const olderMsg = messages[i + 1];
				const grouped = isGrouped(olderMsg, msg);
				items.push({ type: 'msg', msg, grouped, id: msg.id });

				const dateLabel = formatDate(msg.sent_at);
				const nextMsg = messages[i + 1]; // next in array = older in time
				const nextDateLabel = nextMsg ? formatDate(nextMsg.sent_at) : '';

				if (dateLabel !== nextDateLabel) {
					items.push({
						type: 'date',
						label: dateLabel,
						id: `date-${dateLabel}`,
					});
				}
			});

			// If no more history, add a welcome header at the end of history (top of feed)
			if (!hasNextPage && items.length > 0) {
				items.push({
					type: 'header',
					id: 'welcome-header'
				});
			}

			return items;
		}, [messages, hasNextPage]);

		const virtualizer = useVirtualizer({
			count: renderedItems.length,
			getScrollElement: () => feedRef.current,
			estimateSize: () => 80,
			getItemKey: (index) => renderedItems[index]?.id || `item-${index}`,
			overscan: 40,
			observeElementOffset: (instance, cb) => {
				const element = instance.scrollElement;
				if (!element) return;

				const handler = () => {
					// In flex-col-reverse, scrollTop is 0 at bottom and negative towards top.
					// We want the absolute distance from the bottom.
					cb(Math.abs(element.scrollTop), false);
				};

				element.addEventListener('scroll', handler, { passive: true });
				handler();
				return () => element.removeEventListener('scroll', handler);
			},
		});

		const virtualItems = virtualizer.getVirtualItems();
		const totalSize = virtualizer.getTotalSize();

		// Load more when reaching the top (end of our newest-first array)
		const loaderRef = useRef<HTMLDivElement>(null);
		useEffect(() => {
			if (!hasNextPage || isFetchingNextPage || !loaderRef.current) return;

			const observer = new IntersectionObserver(
				(entries) => {
					if (entries[0].isIntersecting) {
						fetchNextPage?.();
					}
				},
				{ threshold: 0.1, rootMargin: '400px' },
			);

			observer.observe(loaderRef.current);
			return () => observer.disconnect();
		}, [hasNextPage, isFetchingNextPage, fetchNextPage, renderedItems.length]);

		const startSpacerHeight = virtualItems[0]?.start || 0;
		const endSpacerHeight = totalSize - (virtualItems[virtualItems.length - 1]?.end || 0);

		return (
			<div
				className="flex-1 overflow-y-auto px-4 py-6 flex flex-col-reverse"
				ref={feedRef}
				id="messages-feed"
				style={{ overflowAnchor: 'none' }}
			>
				{/* 1. Bottom Spacer (visually newest items) */}
				<div 
					style={{ 
						height: `${startSpacerHeight}px`,
						flexShrink: 0,
						overflowAnchor: 'none'
					}} 
				/>

				{/* 2. Visible Items */}
				{virtualItems.map((virtualRow) => {
					const item = renderedItems[virtualRow.index];
					if (!item) return null;

					if (item.type === 'header') {
						return (
							<div
								key={virtualRow.key}
								ref={virtualizer.measureElement}
								className="py-12 px-4 mb-8 border-b border-border/50"
							>
								<div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
									<span className="text-3xl">#</span>
								</div>
								<h1 className="text-3xl font-bold mb-2">Welcome to #{channel.name}!</h1>
								<p className="text-muted-foreground">
									This is the start of the #{channel.name} channel.
								</p>
							</div>
						);
					}

					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							className="w-full shrink-0"
						>
							{item.type === 'date' ? (
								<div className="flex items-center justify-center my-6 relative">
									<div className="absolute inset-0 flex items-center">
										<div className="w-full border-t border-[#3f4147]"></div>
									</div>
									<div className="relative flex justify-center text-xs font-semibold text-[#949ba4] bg-[#313338] px-2 rounded-lg">
										{item.label}
									</div>
								</div>
							) : (
								<MessageItem
									msg={item.msg}
									channel={channel}
									grouped={item.grouped}
									formatTime={formatTime}
									onReply={onReply}
									replyTarget={
										item.msg.reply_to_id
											? messages.find((m) => m.id === item.msg.reply_to_id)
											: undefined
									}
								/>
							)}
						</div>
					);
				})}

				{/* 3. Top Spacer (visually older items) */}
				<div 
					style={{ 
						height: `${endSpacerHeight}px`,
						flexShrink: 0,
						overflowAnchor: 'none'
					}} 
				/>

				{/* 4. Loader (visually at the very top) */}
				<div
					ref={loaderRef}
					className="flex justify-center py-4 h-[60px] items-center shrink-0"
					style={{ 
						display: hasNextPage ? 'flex' : 'none',
						overflowAnchor: 'none' 
					}}
				>
					{hasNextPage && <span className="spinner small" />}
				</div>
			</div>
		);
	},
);

ChatMessageFeed.displayName = 'ChatMessageFeed';
export default ChatMessageFeed;
