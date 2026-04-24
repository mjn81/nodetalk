import { create } from 'zustand';

interface VoiceState {
	activeChannelId: string | null;
	isActive: boolean;
	isMuted: boolean;
	isDeafened: boolean;
	speakingUsers: Set<string>;
	participants: Record<string, string[]>; // channelID -> list of userIDs
	logs: string[];
	userVolumes: Record<string, number>; // userID -> volume (0-2)
	userMutes: Set<string>; // userIDs that are locally muted
	
	// Actions
	joinVoice: (channelId: string) => void;
	leaveVoice: () => void;
	updateParticipants: (channelId: string, users: string[]) => void;
	setUserVolume: (userId: string, volume: number) => void;
	toggleUserMute: (userId: string) => void;
	addLog: (message: string) => void;
	clearLogs: () => void;
	
	// Internal setters for the controller
	_setInternalState: (state: Partial<VoiceState>) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
	activeChannelId: null,
	isActive: false,
	isMuted: false,
	isDeafened: false,
	speakingUsers: new Set(),
	participants: {},
	logs: [],
	userVolumes: {},
	userMutes: new Set(),

	joinVoice: (channelId) => set({ activeChannelId: channelId, isActive: true, logs: [`[${new Date().toLocaleTimeString()}] Joining channel ${channelId}...`] }),
	leaveVoice: () => set({ activeChannelId: null, isActive: false }),
	updateParticipants: (channelId, users) => set((state) => ({
		participants: { ...state.participants, [channelId]: users }
	})),
	setUserVolume: (userId, volume) => set((state) => ({
		userVolumes: { ...state.userVolumes, [userId]: volume }
	})),
	toggleUserMute: (userId) => set((state) => {
		const next = new Set(state.userMutes);
		if (next.has(userId)) next.delete(userId);
		else next.add(userId);
		return { userMutes: next };
	}),
	addLog: (message) => set((state) => {
		console.log(`[VoiceStore Log] ${message}`);
		return {
			logs: [...state.logs.slice(-49), `[${new Date().toLocaleTimeString()}] ${message}`]
		};
	}),
	clearLogs: () => set({ logs: [] }),
	
	_setInternalState: (newState) => set(newState),
}));
