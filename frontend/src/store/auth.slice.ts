// auth.slice.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
	apiLogin,
	apiRegister,
	apiLogout,
	type AuthUser,
} from '@/api/client';

import { connectWS, disconnectWS } from './ws.manager';
import { useChannelStore } from './channels.slice';

export interface AuthSlice {
	user: AuthUser | null;
	isAuthLoading: boolean;

	initAuth: () => void;
	login: (u: string, p: string) => Promise<void>;
	register: (u: string, p: string) => Promise<void>;
	logout: () => Promise<void>;
}

export const useAuthStore = create<AuthSlice>()(
	persist(
		(set, get) => ({
			user: null,
			isAuthLoading: true,

			initAuth: () => {
				const saved = get().user;

				if (saved) {
					set({ isAuthLoading: false });
					connectWS();
					useChannelStore.getState().refreshChannels();
				} else {
					set({ isAuthLoading: false });
				}
			},

			login: async (u, p) => {
				const user = await apiLogin(u, p);
				set({ user });

				connectWS();
				useChannelStore.getState().refreshChannels();
			},

			register: async (u, p) => {
				await apiRegister(u, p);
				await get().login(u, p);
			},

			logout: async () => {
				await apiLogout().catch(() => {});

				disconnectWS();
				useChannelStore.getState().resetChannels();

				set({ user: null });
			},
		}),
		{
			name: 'auth',
			partialize: (s) => ({
				user: s.user,
			}),
		},
	),
);
