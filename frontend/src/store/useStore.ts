import { create } from 'zustand';
import {
	apiLogin,
	apiRegister,
	apiLogout,
	loadUser,
	clearToken,
	type AuthUser,
	type Channel,
	apiListChannels,
	apiCreateChannel,
} from '@/api/client';
import { wsConnect, wsDisconnect, onWS } from '@/ws';

interface AppState {
	// Auth
	user: AuthUser | null;
	isAuthLoading: boolean;
	login: (u: string, p: string) => Promise<void>;
	register: (u: string, p: string) => Promise<void>;
	logout: () => Promise<void>;
	initAuth: () => void;

	// Channels
	channels: Channel[];
	activeChannel: Channel | null;
	isChannelsLoading: boolean;
	setActiveChannel: (ch: Channel) => void;
	createChannel: (name: string, members: string[]) => Promise<Channel>;
	refreshChannels: () => Promise<void>;
}

let wsListenerRegistered = false;

export const useStore = create<AppState>((set, get) => ({
	// Auth state
	user: null,
	isAuthLoading: true,

	initAuth: () => {
		const saved = loadUser();
		if (saved) {
			set({ user: saved, isAuthLoading: false });
			wsConnect();

			// Auto-refresh channels on initial load if auth'd
			get().refreshChannels();

			if (!wsListenerRegistered) {
				onWS('channel_key', () => {
					get().refreshChannels();
				});
				wsListenerRegistered = true;
			}
		} else {
			set({ isAuthLoading: false });
		}
	},

	login: async (username, password) => {
		const resp = await apiLogin(username, password);
		set({ user: resp });
		wsConnect();
		get().refreshChannels();

		if (!wsListenerRegistered) {
			onWS('channel_key', () => {
				get().refreshChannels();
			});
			wsListenerRegistered = true;
		}
	},

	register: async (username, password) => {
		await apiRegister(username, password);
		await get().login(username, password);
	},

	logout: async () => {
		await apiLogout().catch(() => {});
		clearToken();
		wsDisconnect();
		set({ user: null, channels: [], activeChannel: null });
	},

	// Channel state
	channels: [],
	activeChannel: null,
	isChannelsLoading: false,

	setActiveChannel: (ch: Channel) => {
		set({ activeChannel: ch });
	},

	createChannel: async (name: string, members: string[]) => {
		const ch = await apiCreateChannel(name, members);
		set((state) => ({ channels: [ch, ...state.channels] }));
		return ch;
	},

	refreshChannels: async () => {
		const user = get().user;
		if (!user) return;
		set({ isChannelsLoading: true });
		try {
			const list = await apiListChannels();
			set({ channels: list });
		} finally {
			set({ isChannelsLoading: false });
		}
	},
}));

export function getChannelDisplayName(
	ch: Channel,
	currentUserId: string,
): string {
	if (ch.members.length === 2) {
		return ch.members.find((m) => m !== currentUserId) ?? ch.name;
	}
	return ch.name || `Group (${ch.members.length})`;
}
