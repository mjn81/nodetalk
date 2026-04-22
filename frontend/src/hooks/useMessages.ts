import { useQuery } from '@tanstack/react-query';
import { apiListMessages } from '@/api/client';
import { decryptMessage } from '@/ws';

export function useMessages(channelId: string, scrollToBottom: () => void) {
	return useQuery({
		queryKey: ['messages', channelId],
		queryFn: async () => {
			const msgs = await apiListMessages(channelId, 50);
			const decrypted = await Promise.all(
				msgs.reverse().map(async (m) => ({
					...m,
					text: m.type === 'text' ? await decryptMessage(m) : undefined,
				})),
			);
			setTimeout(scrollToBottom, 50);
			return decrypted;
		},
		staleTime: 0,
		refetchOnWindowFocus: true,
	});
}
