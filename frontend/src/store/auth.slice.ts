// auth.slice.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { apiLogin, apiRegister, apiLogout, apiMe, apiUpdateProfile, apiDeleteAccount } from '@/api/client';
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
	updateUser: (data: { avatar_id?: string; username?: string; custom_msg?: string; password?: string; old_password?: string }) => Promise<void>;
	deleteAccount: () => Promise<void>;
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
						// Verify session is still valid on server and get fresh data
						const fresh = await apiMe();
						set({ user: fresh, isAuthLoading: false });
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

			updateUser: async (data) => {
				const fresh = await apiUpdateProfile(data);
				set({ user: fresh });
			},

			deleteAccount: async () => {
				await apiDeleteAccount();
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
