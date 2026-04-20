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

// ── WebSocket Manager ────────────────────────────────────────────────────
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const MAX_DELAY = 30_000;

export function wsConnect(): void {
  if (socket?.readyState === WebSocket.OPEN) return;

  const token = getToken();
  if (!token) return;

  const url = `${WS_URL}/ws?token=${encodeURIComponent(token)}`;
  socket = new WebSocket(url);

  socket.onopen = () => {
    reconnectDelay = 1000;
    emit('open', null);
    console.info('[ws] connected');
    // Heartbeat every 25 seconds to keep the connection alive.
    startHeartbeat();
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as { type: string; payload: unknown };
      handleInbound(msg);
    } catch (e) {
      console.warn('[ws] unparseable message', e);
    }
  };

  socket.onclose = (ev) => {
    stopHeartbeat();
    emit('close', ev.code);
    console.info(`[ws] closed (${ev.code}). Reconnecting in ${reconnectDelay}ms…`);
    scheduleReconnect();
  };

  socket.onerror = (e) => {
    console.warn('[ws] error', e);
  };
}

export function wsDisconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  stopHeartbeat();
  socket?.close();
  socket = null;
  channelKeys.clear();
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_DELAY);
    wsConnect();
  }, reconnectDelay);
}

// ── Heartbeat ────────────────────────────────────────────────────────────
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    wsSend({ type: 'ping', payload: null });
  }, 25_000);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

// ── Inbound Handler ──────────────────────────────────────────────────────
function handleInbound(msg: { type: string; payload: unknown }) {
  switch (msg.type) {
    case 'channel_key': {
      // Server sends: { channel_id: string, aes_key: number[] }
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
      console.debug('[ws] unknown message type', msg.type);
  }
}

// ── Outbound Helpers ─────────────────────────────────────────────────────
function wsSend(msg: { type: string; payload: unknown }): boolean {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(msg));
  return true;
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
