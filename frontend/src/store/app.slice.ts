import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiGetVersion } from '@/api/client';

export interface AppSlice {
	appVersion: string;
	wsState: 'connecting' | 'connected' | 'disconnected';
	theme: 'dark' | 'light';

	fetchVersion: () => Promise<void>;
	setWsState: (s: AppSlice['wsState']) => void;
	setTheme: (theme: 'dark' | 'light') => void;
}

export const useAppStore = create<AppSlice>()(
	persist(
		(set) => ({
			appVersion: 'V...',
			wsState: 'disconnected',
			theme: 'dark',

			setWsState: (wsState) => set({ wsState }),
			setTheme: (theme) => set({ theme }),

			fetchVersion: async () => {
				try {
					const res = await apiGetVersion();
					set({ appVersion: res.version });
				} catch {
					console.error('Failed to fetch version');
				}
			},
		}),
		{
			name: 'app-settings',
			partialize: (s) => ({
				theme: s.theme,
			}),
		},
	),
);
