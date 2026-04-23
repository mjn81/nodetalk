import type { Channel } from '@/types/api';

/**
 * Determines if a channel is a Direct Message based on membership count and name.
 */
export function isDirectMessage(channel: Channel): boolean {
	return (
		channel.members.length === 2 &&
		(!channel.name || channel.name.trim() === '')
	);
}
