import Dexie, { type Table } from 'dexie';
import type { Message } from '@/types/api';

export interface CachedMessage extends Message {
	text?: string; // Decrypted content if available
}

/**
 * NodeTalkDB - Local IndexedDB for message persistence.
 * Used for persistent message caching and offline availability.
 */
export class NodeTalkDB extends Dexie {
	messages!: Table<CachedMessage>;

	constructor() {
		super('NodeTalkDB');
		
		// Schema definition
		// id: Message ID (from server)
		// channel_id: For querying messages by channel
		// sent_at: For sorting chronologically
		this.version(1).stores({
			messages: 'id, channel_id, sent_at'
		});
	}

	/**
	 * Persist messages to the local database.
	 * Uses bulkPut to handle updates/duplicates efficiently.
	 */
	async cacheMessages(msgs: CachedMessage[]) {
		if (msgs.length === 0) return;
		return this.messages.bulkPut(msgs);
	}

	/**
	 * Retrieve cached messages for a specific channel.
	 * Sorted by sent_at chronologically.
	 */
	async getCachedMessages(channelId: string, limit: number = 50): Promise<CachedMessage[]> {
		return this.messages
			.where('channel_id')
			.equals(channelId)
			.reverse()
			.limit(limit)
			.toArray()
			.then(msgs => msgs.reverse());
	}

	/**
	 * Clear cache for a specific channel or entirely.
	 */
	async clearChannelCache(channelId: string) {
		return this.messages.where('channel_id').equals(channelId).delete();
	}
}

// Singleton instance
export const db = new NodeTalkDB();
