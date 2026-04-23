import Dexie, { type Table } from 'dexie';
import type { Message } from '@/types/api';

export interface CachedMessage extends Message {
	text?: string; // Decrypted content if available
}

export interface CachedFile {
	id: string; // File ID
	data: Uint8Array; // Decrypted file bytes
	mime: string;
}

/**
 * NodeTalkDB - Local IndexedDB for message and file persistence.
 */
export class NodeTalkDB extends Dexie {
	messages!: Table<CachedMessage>;
	files!: Table<CachedFile>;

	constructor() {
		super('NodeTalkDB');
		
		this.version(2).stores({
			messages: 'id, channel_id, sent_at',
			files: 'id'
		});
	}

	async cacheMessages(msgs: CachedMessage[]) {
		if (msgs.length === 0) return;
		return this.messages.bulkPut(msgs);
	}

	async getCachedMessages(channelId: string, limit: number = 50): Promise<CachedMessage[]> {
		return this.messages
			.where('channel_id')
			.equals(channelId)
			.reverse()
			.limit(limit)
			.toArray()
			.then(msgs => msgs.reverse());
	}

	async clearChannelCache(channelId: string) {
		return this.messages.where('channel_id').equals(channelId).delete();
	}

	// File Caching
	async cacheFile(id: string, data: Uint8Array, mime: string) {
		return this.files.put({ id, data, mime });
	}

	async getCachedFile(id: string): Promise<CachedFile | undefined> {
		return this.files.get(id);
	}

	async clearFileCache(id: string) {
		return this.files.delete(id);
	}
}

export const db = new NodeTalkDB();
