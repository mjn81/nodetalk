import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiGetVersion } from '@/api/client';

export interface AppSlice {
	appVersion: string;
	wsState: 'connecting' | 'connected' | 'disconnected';
	theme: 'dark' | 'light';

	isLeftSidebarOpen: boolean;
	isRightSidebarOpen: boolean;

	fetchVersion: () => Promise<void>;
	setWsState: (s: AppSlice['wsState']) => void;
	setTheme: (theme: 'dark' | 'light') => void;
	setLeftSidebarOpen: (open: boolean) => void;
	setRightSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppSlice>()(
	persist(
		(set) => ({
			appVersion: 'V...',
			wsState: 'disconnected',
			theme: 'dark',
			isLeftSidebarOpen: false,
			isRightSidebarOpen: false,

			setWsState: (wsState) => set({ wsState }),
			setTheme: (theme) => set({ theme }),
			setLeftSidebarOpen: (isLeftSidebarOpen) => set({ isLeftSidebarOpen }),
			setRightSidebarOpen: (isRightSidebarOpen) => set({ isRightSidebarOpen }),

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
