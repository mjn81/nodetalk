import { useQuery } from '@tanstack/react-query';
import { apiListMessages } from '@/api/client';
import { decryptMessage } from '@/ws';
import { db, type CachedMessage } from '@/lib/db';

export function useMessages(channelId: string, scrollToBottom: () => void) {
	return useQuery({
		queryKey: ['messages', channelId],
		queryFn: async () => {
			// 1. Try to load from IndexedDB cache first
			const cached = await db.getCachedMessages(channelId);
			
			// 2. Fetch fresh messages from API
			try {
				const msgs = await apiListMessages(channelId, 50);
				const decrypted: CachedMessage[] = await Promise.all(
					msgs.map(async (m) => ({
						...m,
						text: m.type === 'text' ? await decryptMessage(m) : undefined,
					})),
				);

				// 3. Cache the decrypted messages
				await db.cacheMessages(decrypted);

				setTimeout(scrollToBottom, 50);
				
				// We return the API results as the source of truth, 
				// but Dexie ensures they are available offline next time.
				return decrypted.sort((a, b) => 
					new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
				);
			} catch (error) {
				console.error('Failed to fetch messages, falling back to cache:', error);
				if (cached.length > 0) return cached;
				throw error;
			}
		},
		staleTime: 0, // Always refetch on mount or key change to ensure sync with server
		refetchOnWindowFocus: true,
	});
}
