// app.slice.ts
import { create } from 'zustand';
import { apiGetVersion } from '@/api/client';

export interface AppSlice {
	appVersion: string;
	wsState: 'connecting' | 'connected' | 'disconnected';

	fetchVersion: () => Promise<void>;
	setWsState: (s: AppSlice['wsState']) => void;
}

export const useAppStore = create<AppSlice>((set) => ({
	appVersion: 'V...',
	wsState: 'disconnected',

	setWsState: (wsState) => set({ wsState }),

	fetchVersion: async () => {
		try {
      const res = await apiGetVersion();
			set({ appVersion: res.version });
    } catch {
      console.error()
    }
	},
}));
