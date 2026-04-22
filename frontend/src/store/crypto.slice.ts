import { create } from 'zustand';

interface CryptoState {
	channelKeys: Map<string, Uint8Array>;
	setChannelKey: (channelId: string, key: Uint8Array) => void;
	clearKeys: () => void;
}

export const useCryptoStore = create<CryptoState>((set) => ({
	channelKeys: new Map<string, Uint8Array>(),
	setChannelKey: (channelId, key) =>
		set((state) => {
			const newMap = new Map(state.channelKeys);
			newMap.set(channelId, key);
			return { channelKeys: newMap };
		}),
	clearKeys: () => set({ channelKeys: new Map<string, Uint8Array>() }),
}));
