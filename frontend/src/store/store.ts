import type { Channel } from '@/types/api';

// store.ts
export { useAuthStore } from './auth.slice';
export { useChannelStore } from './channels.slice';
export { useAppStore } from './app.slice';

export function getChannelDisplayName(
	ch: Channel,
	currentUserId: string,
): string {
	if (ch.members.length === 2) {
		return ch.members.find((m: string) => m !== currentUserId) ?? ch.name;
	}
	return ch.name || `Group (${ch.members.length})`;
}
