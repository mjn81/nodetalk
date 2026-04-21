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
import { wsConnect, wsDisconnect, onWS, wsSendReadReceipt } from '@/ws';
import { apiGetVersion } from '@/api/client';

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

	// App Status
	appVersion: string;
	wsState: 'connecting' | 'connected' | 'disconnected';
	fetchVersion: () => Promise<void>;
}

let wsListenerRegistered = false;

export const useStore = create<AppState>((set, get) => ({
	// Auth state
	user: null,
	isAuthLoading: true,

	initAuth: () => {
		const saved = loadUser();
		get().fetchVersion();
		if (saved) {
			set({ user: saved, isAuthLoading: false, wsState: 'connecting' });
			wsConnect();

			// Auto-refresh channels on initial load if auth'd
			get().refreshChannels();

			if (!wsListenerRegistered) {
				onWS('channel_key', () => {
					get().refreshChannels();
				});
				onWS('open', () => set({ wsState: 'connected' }));
				onWS('close', () => set({ wsState: 'disconnected' }));
				onWS('message', (msg: any) => {
					const { activeChannel, channels } = get();
					if (activeChannel?.id === msg.channel_id) {
						wsSendReadReceipt(msg.channel_id);
					} else {
						// Increment unread count globally
						set({
							channels: channels.map(c => 
								c.id === msg.channel_id ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c
							)
						});
					}
				});
				wsListenerRegistered = true;
			}
		} else {
			set({ isAuthLoading: false });
		}
	},

	login: async (username, password) => {
		const resp = await apiLogin(username, password);
		set({ user: resp, wsState: 'connecting' });
		wsConnect();
		get().refreshChannels();

		if (!wsListenerRegistered) {
			onWS('channel_key', () => {
				get().refreshChannels();
			});
			onWS('open', () => set({ wsState: 'connected' }));
			onWS('close', () => set({ wsState: 'disconnected' }));
			onWS('message', (msg: any) => {
				const { activeChannel, channels } = get();
				if (activeChannel?.id === msg.channel_id) {
					wsSendReadReceipt(msg.channel_id);
				} else {
					// Increment unread count globally
					set({
						channels: channels.map(c => 
							c.id === msg.channel_id ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c
						)
					});
				}
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

	appVersion: 'V...',
	wsState: 'disconnected',

	fetchVersion: async () => {
		try {
			const res = await apiGetVersion();
			set({ appVersion: res.version });
		} catch {
			// ignore
		}
	},

	setActiveChannel: (ch: Channel) => {
		set((state) => {
			wsSendReadReceipt(ch.id);
			// Clear unread count optimistically locally
			return {
				activeChannel: ch,
				channels: state.channels.map(c => c.id === ch.id ? { ...c, unread_count: 0 } : c)
			};
		});
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
