import { useVoiceStore } from '@/store/voiceStore';

/**
 * Hook for components to trigger voice chat actions.
 * The actual processing logic is handled by VoiceChatController.
 */
export const useVoiceChat = () => {
	const { joinVoice, leaveVoice, isMuted, isDeafened, _setInternalState } = useVoiceStore();

	return {
		startVoice: (channelId: string) => joinVoice(channelId),
		stopVoice: () => leaveVoice(),
		toggleMute: () => _setInternalState({ isMuted: !isMuted }),
		toggleDeafen: () => _setInternalState({ isDeafened: !isDeafened }),
	};
};
