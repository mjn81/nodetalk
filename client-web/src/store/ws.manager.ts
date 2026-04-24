// ws.manager.ts
import { wsConnect, wsDisconnect, onWS, wsSendReadReceipt, decryptMessage } from '@/ws';
import { useChannelStore, useAuthStore, getChannelDisplayName } from './store';
import { playNotificationSound, showBrowserNotification } from '@/utils/notifications';
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

let connectTime = 0;

export function initWebSocket() {
	if (initialized) return;
	initialized = true;

	onWS('open', () => {
		useAppStore.getState().setWsState('connected');
	});

	onWS('close', () => {
		useAppStore.getState().setWsState('disconnected');
	});

	onWS('channel_key', (payload: any) => {
		const { channel_id } = payload;
		const hasKey = useChannelStore.getState().channels.some(c => c.id === channel_id);
		
		// Only play sound if we didn't have the channel AND we are already connected for a while (avoiding login burst)
		const isLoginBurst = (Date.now() - connectTime) < 2000;
		if (!hasKey && !isLoginBurst) {
			playNotificationSound('new-group');
		}

		debouncedRefresh();
	});

	onWS('message', async (payload: unknown) => {
		const msg = payload as Message;
		const { activeChannel, incrementUnread, channels } = useChannelStore.getState();
		const currentUserId = useAuthStore.getState().user?.id;

		// 1. NEVER increment unread for our own messages
		if (currentUserId && msg.sender_id === currentUserId) return;

		// 2. If viewing the channel, send read receipt. Otherwise, increment unread.
		if (activeChannel?.id === msg.channel_id) {
			wsSendReadReceipt(msg.channel_id);
		} else {
			incrementUnread(msg.channel_id);
			
			// Play sound
			playNotificationSound('message');
			
			// Show browser notification if tab is hidden/unfocused
			if (document.visibilityState !== 'visible' || !document.hasFocus()) {
				const channel = channels.find(c => c.id === msg.channel_id);
				if (channel && currentUserId) {
					const senderName = channel.member_names?.[msg.sender_id] || 'Someone';
					const channelName = getChannelDisplayName(channel, currentUserId);
					const text = msg.type === 'text' ? await decryptMessage(msg) : `Sent a ${msg.type}`;
					showBrowserNotification(`${senderName} (#${channelName})`, text);
				}
			}
		}
	});

	onWS('presence', (payload: any) => {
		if (payload && payload.user_id && payload.status) {
			const { user, updateStatus } = useAuthStore.getState();
			
			// Update our own status if it changed
			if (user && payload.user_id === user.id) {
				updateStatus(payload.status);
			}
			
			// Update status in channel members list
			useChannelStore.getState().updateMemberStatus(payload.user_id, payload.status);
		}

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

	onWS('channel_update', (payload: any) => {
		const { type, channel_id, name, is_private } = payload;
		if (type === 'settings_updated' && channel_id) {
			useChannelStore.getState().updateChannelSettings(channel_id, {
				name,
				is_private,
			});
		}
		debouncedRefresh();
	});
}

export function connectWS(token?: string) {
	connectTime = Date.now();
	useAppStore.getState().setWsState('connecting');
	initWebSocket(); // Register listeners FIRST
	wsConnect(token); // Then connect
}

export function disconnectWS() {
	wsDisconnect();
	useAppStore.getState().setWsState('disconnected');
}
