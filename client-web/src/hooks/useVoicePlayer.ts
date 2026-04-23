import { useState, useEffect, useCallback } from 'react';
import { voicePlayer, type VoicePlayerState } from '@/lib/voicePlayer';

/** Subscribe to the singleton VoicePlayerStore and return a reactive snapshot. */
export function useVoicePlayer(): VoicePlayerState {
	const [state, setState] = useState<VoicePlayerState>(() => voicePlayer.state);

	useEffect(() => {
		// Sync immediately in case state changed between render and effect
		setState({ ...voicePlayer.state });
		return voicePlayer.subscribe(setState);
	}, []);

	return state;
}

/** Returns a stable reference to the voicePlayer API methods. */
export function useVoicePlayerActions() {
	return {
		play:       useCallback((t: Parameters<typeof voicePlayer.play>[0]) => voicePlayer.play(t),  []),
		pause:      useCallback(() => voicePlayer.pause(),       []),
		togglePlay: useCallback(() => voicePlayer.togglePlay(),  []),
		seek:       useCallback((p: number) => voicePlayer.seek(p), []),
		cycleSpeed: useCallback(() => voicePlayer.cycleSpeed(),  []),
		close:      useCallback(() => voicePlayer.close(),       []),
	};
}
