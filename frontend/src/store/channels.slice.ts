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
	createChannel: (name: string, memberIds: string[], isPrivate: boolean) => Promise<Channel>;
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
			set((state) => {
				const active = state.activeChannel;
				let nextActive = active;
				if (active) {
					// Update the active channel object to reflect new members/metadata
					const updated = list.find((c) => c.id === active.id);
					if (updated) nextActive = updated;
				}
				return { channels: list, activeChannel: nextActive };
			});
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

	createChannel: async (name, memberIds, isPrivate) => {
		const ch = await apiCreateChannel(name, memberIds, isPrivate);
		set((s) => {
			const exists = s.channels.some((c) => c.id === ch.id);
			if (exists) return s;
			return { channels: [ch, ...s.channels] };
		});
		return ch;
	},

	resetChannels: () => {
		set({ channels: [], activeChannel: null });
	},
}));
