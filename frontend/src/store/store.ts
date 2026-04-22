import type { Channel } from '@/types/api';

// store.ts
export { useAuthStore } from './auth.slice';
export { useChannelStore } from './channels.slice';
export { useAppStore } from './app.slice';
export { useCryptoStore } from './crypto.slice';

export function getChannelDisplayName(
	ch: Channel,
	currentUserId: string,
): string {
	if (ch.members.length === 2 && (!ch.name || ch.name.trim() === '')) {
		const otherId = ch.members.find((m: string) => m !== currentUserId);
		if (otherId && ch.member_names && ch.member_names[otherId]) {
			return ch.member_names[otherId];
		}
		return otherId || 'Unknown';
	}
	return ch.name || `Group (${ch.members.length})`;
}
