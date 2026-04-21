// WebSocket client with auto-reconnect and channel key management

import { getToken, type Message } from './api/client';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';

// ── Channel Key Registry ────────────────────────────────────────────────
// Keys are received from the server over WSS on connect and kept in memory.
// They are NEVER persisted to disk / localStorage.
const channelKeys = new Map<string, Uint8Array>();

export function getChannelKey(channelId: string): Uint8Array | undefined {
  return channelKeys.get(channelId);
}

// ── Event Listeners ─────────────────────────────────────────────────────
type WSEventType = 'message' | 'presence' | 'channel_key' | 'open' | 'close';
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

export function wsConnect(): void {
  if (worker) return; // already initialized

  const token = getToken();
  if (!token) return;

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
      token,
      url: `${WS_URL}/ws`,
    }
  });
}

export function wsDisconnect(): void {
  worker?.port.postMessage({ cmd: 'DISCONNECT' });
  worker = null;
  channelKeys.clear();
}

// ── Inbound Handler ──────────────────────────────────────────────────────
function handleInbound(msg: { type: string; payload: unknown }) {
  switch (msg.type) {
    case 'channel_key': {
      const { channel_id, aes_key } = msg.payload as { channel_id: string; aes_key: number[] };
      channelKeys.set(channel_id, new Uint8Array(aes_key));
      emit('channel_key', { channel_id });
      break;
    }
    case 'message':
      emit('message', msg.payload as Message);
      break;
    case 'presence':
      emit('presence', msg.payload);
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
): Promise<boolean> {
  const key = channelKeys.get(channelId);

  let ciphertext: Uint8Array;
  let nonce: Uint8Array;

  if (key) {
    // Full AES-256-GCM encryption using the Web Crypto API
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      { name: 'AES-GCM' }, false, ['encrypt'],
    );
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, cryptoKey, encoded,
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
      ciphertext: Array.from(ciphertext),
      nonce: Array.from(nonce),
    },
  });
}

// ── Decryption Helper ────────────────────────────────────────────────────
export async function decryptMessage(msg: Message): Promise<string> {
  const key = channelKeys.get(msg.channel_id);
  if (!key) return '[encrypted]';

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
      { name: 'AES-GCM' }, false, ['decrypt'],
    );
    const nonce = new Uint8Array(msg.nonce);
    const ct = new Uint8Array(msg.ciphertext);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce }, cryptoKey, ct,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return '[decryption failed]';
  }
}
