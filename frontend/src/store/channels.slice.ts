// channels.slice.ts
import { create } from 'zustand';
import { apiListChannels, apiCreateChannel } from '@/api/client';
import type { Channel } from '@/types/api';
import { wsSendReadReceipt } from '@/ws';

export interface ChannelSlice {
	channels: Channel[];
	activeChannel: Channel | null;
	isChannelsLoading: boolean;

	refreshChannels: () => Promise<void>;
	setActiveChannel: (ch: Channel) => void;
	createChannel: (name: string, members: string[]) => Promise<Channel>;
	incrementUnread: (id: string) => void;
	resetChannels: () => void;
}

export const useChannelStore = create<ChannelSlice>((set,) => ({
	channels: [],
	activeChannel: null,
	isChannelsLoading: false,

	refreshChannels: async () => {
		set({ isChannelsLoading: true });

		try {
			const list = await apiListChannels();
			set({ channels: list });
		} finally {
			set({ isChannelsLoading: false });
		}
	},

	setActiveChannel: (ch) => {
		wsSendReadReceipt(ch.id);
		set((state) => ({
			activeChannel: ch,
			channels: state.channels.map((c) =>
				c.id === ch.id ? { ...c, unread_count: 0 } : c,
			),
		}));
	},

	incrementUnread: (id) => {
		set((state) => ({
			channels: state.channels.map((c) =>
				c.id === id ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c,
			),
		}));
	},

	createChannel: async (name, members) => {
		const ch = await apiCreateChannel(name, members);
		set((s) => ({ channels: [ch, ...s.channels] }));
		return ch;
	},

	resetChannels: () => {
		set({ channels: [], activeChannel: null });
	},
}));
