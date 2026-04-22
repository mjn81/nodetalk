// ws.manager.ts
import { wsConnect, wsDisconnect, onWS, wsSendReadReceipt } from '@/ws';
import { useChannelStore } from './channels.slice';
import type { Message } from '@/types/api';
import { useAppStore } from './app.slice';

let initialized = false;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedRefresh() {
	if (refreshTimeout) clearTimeout(refreshTimeout);
	refreshTimeout = setTimeout(() => {
		useChannelStore.getState().refreshChannels();
	}, 100);
}

export function initWebSocket() {
	if (initialized) return;
	initialized = true;

	onWS('open', () => {
		useAppStore.getState().setWsState('connected');
	});

	onWS('close', () => {
		useAppStore.getState().setWsState('disconnected');
	});

	onWS('channel_key', () => {
		debouncedRefresh();
	});

	onWS('message', (payload: unknown) => {
		const msg = payload as Message;
		const { activeChannel, incrementUnread } = useChannelStore.getState();

		if (activeChannel?.id === msg.channel_id) {
			wsSendReadReceipt(msg.channel_id);
		} else {
			incrementUnread(msg.channel_id);
		}
	});

	onWS('presence', () => {
		// Invalidate queries to refresh status in UI
		const queryClient = (window as any).queryClient;
		if (queryClient) {
			queryClient.invalidateQueries({ queryKey: ['channels'] });
			const activeChannelId = useChannelStore.getState().activeChannel?.id;
			if (activeChannelId) {
				queryClient.invalidateQueries({ queryKey: ['channels', activeChannelId, 'members'] });
			}
		}
	});
}

export function connectWS() {
	useAppStore.getState().setWsState('connecting');
	wsConnect();
	initWebSocket();
}

export function disconnectWS() {
	wsDisconnect();
	useAppStore.getState().setWsState('disconnected');
}
