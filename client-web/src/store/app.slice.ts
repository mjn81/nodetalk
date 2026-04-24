import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiGetVersion } from '@/api/client';

export interface AppSlice {
	appVersion: string;
	wsState: 'connecting' | 'connected' | 'disconnected';
	theme: 'dark' | 'light';

	isLeftSidebarOpen: boolean;
	isRightSidebarOpen: boolean;

	// Notification Settings
	enableDesktopNotifications: boolean;
	enableNotificationSounds: boolean;

	// Voice Settings
	preferredMicId: string;
	setPreferredMicId: (id: string) => void;

	fetchVersion: () => Promise<void>;
	setWsState: (s: AppSlice['wsState']) => void;
	setTheme: (theme: 'dark' | 'light') => void;
	setLeftSidebarOpen: (open: boolean) => void;
	setRightSidebarOpen: (open: boolean) => void;
	setEnableDesktopNotifications: (enabled: boolean) => void;
	setEnableNotificationSounds: (enabled: boolean) => void;
}

export const useAppStore = create<AppSlice>()(
	persist(
		(set) => ({
			appVersion: 'V...',
			wsState: 'disconnected',
			theme: 'dark',
			isLeftSidebarOpen: false,
			isRightSidebarOpen: false,
			enableDesktopNotifications: true,
			enableNotificationSounds: true,
			preferredMicId: 'default',

			setWsState: (wsState) => set({ wsState }),
			setTheme: (theme) => set({ theme }),
			setLeftSidebarOpen: (isLeftSidebarOpen) => set({ isLeftSidebarOpen }),
			setRightSidebarOpen: (isRightSidebarOpen) => set({ isRightSidebarOpen }),
			setEnableDesktopNotifications: (enableDesktopNotifications) =>
				set({ enableDesktopNotifications }),
			setEnableNotificationSounds: (enableNotificationSounds) =>
				set({ enableNotificationSounds }),
			setPreferredMicId: (preferredMicId) => set({ preferredMicId }),

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
				enableDesktopNotifications: s.enableDesktopNotifications,
				enableNotificationSounds: s.enableNotificationSounds,
				preferredMicId: s.preferredMicId,
			}),
		},
	),
);
