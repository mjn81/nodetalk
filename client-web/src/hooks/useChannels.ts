import { useQuery } from '@tanstack/react-query';
import { apiExploreChannels, apiGetChannelMembers } from '@/api/client';

export function useExploreChannels(debouncedSearch: string) {
	return useQuery({
		queryKey: ['channels', 'explore', debouncedSearch],
		queryFn: () => apiExploreChannels(debouncedSearch),
		enabled: debouncedSearch.length > 0,
	});
}

export function useChannelMembers(channelId: string | undefined) {
	return useQuery({
		queryKey: ['channels', channelId, 'members'],
		queryFn: () => (channelId ? apiGetChannelMembers(channelId) : Promise.resolve([])),
		enabled: !!channelId,
		staleTime: 30000,
	});
}
