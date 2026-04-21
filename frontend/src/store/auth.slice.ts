// auth.slice.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { apiLogin, apiRegister, apiLogout, apiMe } from '@/api/client';
import type { AuthUser } from '@/types/api';

import { connectWS, disconnectWS } from './ws.manager';
import { useChannelStore } from './channels.slice';

export interface AuthSlice {
	user: AuthUser | null;
	isAuthLoading: boolean;

	initAuth: () => Promise<void>;
	login: (u: string, p: string) => Promise<void>;
	register: (u: string, p: string) => Promise<void>;
	logout: () => Promise<void>;
}

export const useAuthStore = create<AuthSlice>()(
	persist(
		(set, get) => ({
			user: null,
			isAuthLoading: true,

			initAuth: async () => {
				const saved = get().user;

				if (saved) {
					try {
						// Verify session is still valid on server
						await apiMe();
						set({ isAuthLoading: false });
						connectWS();
						useChannelStore.getState().refreshChannels();
					} catch {
						// Session invalid or server down
						set({ user: null, isAuthLoading: false });
						disconnectWS();
					}
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
