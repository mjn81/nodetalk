// ws.manager.ts
import { wsConnect, wsDisconnect, onWS, wsSendReadReceipt } from '@/ws';
import { useChannelStore } from './channels.slice';
import type { Message } from '@/types/api';
import { useAppStore } from './app.slice';

let initialized = false;

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
		useChannelStore.getState().refreshChannels();
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
