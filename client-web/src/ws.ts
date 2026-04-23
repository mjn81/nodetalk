// WebSocket client with auto-reconnect and channel key management

import type { Message } from '@/types/api';

const getWsUrl = () => {
	const envUrl = import.meta.env.VITE_WS_URL;
	if (envUrl && !envUrl.includes('localhost')) return envUrl.replace(/\/$/, '');

	if (typeof window !== 'undefined') {
		const host = window.location.hostname;
		if (host === '[::1]' || host === '127.0.0.1' || host === 'localhost') {
			return `ws://${host}:8080`;
		}
	}
	return (envUrl ?? 'ws://localhost:8080').replace(/\/$/, '');
};

const WS_URL = getWsUrl();

// ── Binary Helpers ───────────────────────────────────────────────────────
export function base64ToBytes(base64: string): Uint8Array {
	const binString = atob(base64);
	return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

export function bytesToBase64(bytes: Uint8Array): string {
    // Correct way to handle potential stack issues with larger arrays
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
	return btoa(binString);
}

import { useCryptoStore } from '@/store/crypto.slice';

// ── Channel Key Registry ────────────────────────────────────────────────
// Keys are received from the server over WSS on connect and kept in memory.
// They are NEVER persisted to disk / localStorage.

export function getChannelKey(channelId: string): Uint8Array | undefined {
  return useCryptoStore.getState().channelKeys.get(channelId);
}

// ── Event Listeners ─────────────────────────────────────────────────────
type WSEventType = 'message' | 'message_update' | 'message_delete' | 'presence' | 'channel_key' | 'channel_update' | 'open' | 'close';
type WSListener = (payload: unknown) => void;

const listeners = new Map<WSEventType, Set<WSListener>>();

export function onWS(event: WSEventType, fn: WSListener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => listeners.get(event)?.delete(fn);
}

function emit(event: WSEventType, payload: unknown) {
  listeners.get(event)?.forEach(fn => fn(payload));
}

// ── SharedWorker Manager ────────────────────────────────────────────────
let worker: SharedWorker | null = null;
let connectTime = 0;

export function wsConnect(): void {
  if (worker) return; // already initialized
  connectTime = Date.now();

  worker = new SharedWorker(new URL('./ws/shared.worker.ts', import.meta.url), {
    type: 'module',
    name: 'nodetalk-ws' // Groups tabs into same worker namespace
  });

  worker.port.onmessage = (event: MessageEvent) => {
    const { type, payload, code } = event.data;
    if (type === 'WS_OPEN') {
      emit('open', null);
      console.info('[ws-worker] connected');
    } else if (type === 'WS_CLOSE') {
      emit('close', code);
      console.info('[ws-worker] closed');
    } else if (type === 'WS_MESSAGE') {
      handleInbound(payload as { type: string; payload: unknown });
    }
  };

  worker.port.start();

  worker.port.postMessage({
    cmd: 'CONNECT',
    payload: {
      url: `${WS_URL}/ws`,
    }
  });
}

export function wsDisconnect(): void {
  worker?.port.postMessage({ cmd: 'DISCONNECT' });
  worker = null;
  useCryptoStore.getState().clearKeys();
}

// ── Inbound Handler ──────────────────────────────────────────────────────
function handleInbound(msg: { type: string; payload: unknown }) {
  switch (msg.type) {
    case 'channel_key': {
      const { channel_id, aes_key } = msg.payload as { channel_id: string; aes_key: string };
      // Backend (Go) sends bytes as base64 strings
      useCryptoStore.getState().setChannelKey(channel_id, base64ToBytes(aes_key));
      emit('channel_key', { channel_id });
      break;
    }
    case 'message':
      emit('message', msg.payload as Message);
      break;
    case 'message_update':
      emit('message_update', msg.payload as Message);
      break;
    case 'message_delete':
      emit('message_delete', msg.payload as { channel_id: string; message_id: string });
      break;
    case 'presence':
      emit('presence', msg.payload);
      break;
    case 'channel_update':
      emit('channel_update', msg.payload);
      break;
    default:
      console.debug('[ws-worker] unknown message type', msg.type);
  }
}

// ── Outbound Helpers ─────────────────────────────────────────────────────
function wsSend(msg: { type: string; payload: unknown }): boolean {
  if (!worker) return false;
  worker.port.postMessage({
    cmd: 'SEND',
    payload: msg
  });
  return true;
}

export function wsSendReadReceipt(channelId: string) {
  wsSend({
    type: 'read_receipt',
    payload: { channel_id: channelId }
  });
}

/**
 * Sends an encrypted message payload. The client-side encryption is done here.
 * Currently ships the plaintext as a stub — full AES-256-GCM integration
 * to be wired in Phase 4 with the Web Crypto API.
 */
export async function wsSendMessage(
	channelId: string,
	text: string,
	type: 'text' | 'file' | 'voice' = 'text',
	compression: string = 'none',
	replyToId?: string,
): Promise<boolean> {
	const key = useCryptoStore.getState().channelKeys.get(channelId);

	let ciphertext: Uint8Array;
	let nonce: Uint8Array;

	if (key) {
		// Full AES-256-GCM encryption using the Web Crypto API
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			key.buffer.slice(
				key.byteOffset,
				key.byteOffset + key.byteLength,
			) as ArrayBuffer,
			{ name: 'AES-GCM' },
			false,
			['encrypt'],
		);
		const encoded = new TextEncoder().encode(text);
		const encrypted = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv },
			cryptoKey,
			encoded,
		);
		nonce = iv;
		ciphertext = new Uint8Array(encrypted);
	} else {
		// No key yet — encode as plaintext bytes (development fallback)
		console.warn('[ws] no channel key for', channelId, '— sending unencrypted');
		ciphertext = new TextEncoder().encode(text);
		nonce = new Uint8Array(12);
	}

	return wsSend({
		type: 'message',
		payload: {
			channel_id: channelId,
			type,
			ciphertext: bytesToBase64(ciphertext),
			nonce: bytesToBase64(nonce),
			compression,
			reply_to_id: replyToId,
		},
	});
}

export async function wsEditMessage(
  channelId: string,
  messageId: string,
  text: string
): Promise<boolean> {
  const key = useCryptoStore.getState().channelKeys.get(channelId);
  if (!key) return false;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
    { name: 'AES-GCM' }, false, ['encrypt'],
  );
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cryptoKey, encoded,
  );

  return wsSend({
    type: 'message_edit',
    payload: {
      channel_id: channelId,
      message_id: messageId,
      ciphertext: bytesToBase64(new Uint8Array(encrypted)),
      nonce: bytesToBase64(iv),
    },
  });
}

export function wsDeleteMessage(channelId: string, messageId: string): boolean {
  return wsSend({
    type: 'message_delete',
    payload: {
      channel_id: channelId,
      message_id: messageId,
    },
  });
}

// ── Decryption Helper ────────────────────────────────────────────────────
export async function decryptMessage(msg: Message): Promise<string> {
  const key = useCryptoStore.getState().channelKeys.get(msg.channel_id);
  if (!key) return '[encrypted]';

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      { name: 'AES-GCM' }, false, ['decrypt'],
    );
    const nonce = base64ToBytes(msg.nonce);
    const ct = base64ToBytes(msg.ciphertext);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce as any }, cryptoKey, ct as any,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return '[decryption failed]';
  }
}
