import { useQuery } from '@tanstack/react-query';
import { apiSearchUsers } from '@/api/client';

export function useUserSearch(debouncedQuery: string, currentUsername: string | undefined) {
	return useQuery({
		queryKey: ['users', 'search', debouncedQuery],
		queryFn: () => apiSearchUsers(debouncedQuery),
		enabled: debouncedQuery.length > 0,
		select: (data) => data.filter((u) => u.username !== currentUsername),
	});
}
