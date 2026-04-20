// Centralized API client for NodeTalk backend

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// ── Session Token Storage ────────────────────────────────────────────────
const TOKEN_KEY = 'nodetalk_token';
const USER_KEY  = 'nodetalk_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

// ── Types ────────────────────────────────────────────────────────────────
export interface AuthUser {
  user_id: string;
  username: string;
  token: string;
}

export interface Channel {
  id: string;
  name: string;
  creator_id: string;
  members: string[];
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  type: 'text' | 'file' | 'voice';
  ciphertext: number[]; // Raw bytes from server
  nonce: number[];
  sent_at: string;
}

export interface Presence {
  last_seen: string;
  current_status: 'online' | 'away' | 'offline';
}

export interface UploadedFile {
  file_id: string;
  size: number;
  mime: string;
  uploaded: string;
}

// ── Core Fetch Helper ────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!resp.ok) {
    let message = `HTTP ${resp.status}`;
    try {
      const err = await resp.json();
      message = err.error ?? message;
    } catch {}
    throw new Error(message);
  }

  // 204 No Content
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────
export async function apiRegister(username: string, password: string): Promise<{ id: string; username: string }> {
  return apiFetch('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function apiLogin(username: string, password: string): Promise<AuthUser> {
  const resp = await apiFetch<AuthUser>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(resp.token);
  saveUser(resp);
  return resp;
}

export async function apiLogout(): Promise<void> {
  await apiFetch('/api/logout', { method: 'POST' });
  clearToken();
}

export async function apiMe(): Promise<{ id: string; username: string; domain: string; status: string }> {
  return apiFetch('/api/me');
}

// ── Channels ─────────────────────────────────────────────────────────────
export async function apiListChannels(): Promise<Channel[]> {
  const result = await apiFetch<Channel[] | null>('/api/channels');
  return result ?? [];
}

export async function apiCreateChannel(name: string, members: string[]): Promise<Channel> {
  return apiFetch('/api/channels', {
    method: 'POST',
    body: JSON.stringify({ name, members }),
  });
}

export async function apiGetChannel(id: string): Promise<Channel> {
  return apiFetch(`/api/channels/${id}`);
}

export async function apiAddMember(channelId: string, userId: string): Promise<void> {
  return apiFetch(`/api/channels/${channelId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

// ── Messages ──────────────────────────────────────────────────────────────
export async function apiListMessages(channelId: string, limit = 50): Promise<Message[]> {
  const result = await apiFetch<Message[] | null>(`/api/channels/${channelId}/messages?limit=${limit}`);
  return result ?? [];
}

// ── Files ────────────────────────────────────────────────────────────────
export async function apiUploadFile(file: Blob, mimeType: string): Promise<UploadedFile> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file, `upload.${mimeType.split('/')[1] ?? 'bin'}`);

  const resp = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? `Upload failed: ${resp.status}`);
  }
  return resp.json();
}

export function apiFileUrl(fileId: string): string {
  return `${BASE_URL}/api/files/${fileId}`;
}

// ── Presence ─────────────────────────────────────────────────────────────
export async function apiGetPresence(userId: string): Promise<Presence> {
  return apiFetch(`/api/users/${userId}/presence`);
}
