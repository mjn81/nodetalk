// client.ts — Fully improved API client

import { logger } from '@/utils/logger';

// ─────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────
const BASE_URL = (
	import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
).replace(/\/$/, '');

// ─────────────────────────────────────────────
// Custom Error Types
// ─────────────────────────────────────────────
export class APIError extends Error {
	status: number;
	data: unknown;

	constructor(status: number, message: string, data?: unknown) {
		super(message);
		this.status = status;
		this.data = data;
	}
}

export class AuthError extends APIError {
	constructor(message = 'Authentication error', data?: unknown) {
		super(401, message, data);
	}
}

export class NetworkError extends Error {
	constructor(message = 'Network error') {
		super(message);
	}
}

// ─────────────────────────────────────────────
// Token + User Storage
// ─────────────────────────────────────────────
const TOKEN_KEY = 'nodetalk_token';
const USER_KEY = 'nodetalk_user';

export function getToken() {
	return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
	localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
	localStorage.removeItem(TOKEN_KEY);
	localStorage.removeItem(USER_KEY);
}
export function saveUser(u: AuthUser) {
	localStorage.setItem(USER_KEY, JSON.stringify(u));
}
export function loadUser(): AuthUser | null {
	try {
		const raw = localStorage.getItem(USER_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

// ─────────────────────────────────────────────
// Timeout wrapper
// ─────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
	let timer: number;
	return new Promise((resolve, reject) => {
		timer = window.setTimeout(
			() => reject(new NetworkError('Request timeout')),
			ms,
		);
		promise
			.then((r) => {
				clearTimeout(timer);
				resolve(r);
			})
			.catch((err) => {
				clearTimeout(timer);
				reject(err);
			});
	});
}

// ─────────────────────────────────────────────
// Core Fetch Wrapper
// ─────────────────────────────────────────────
async function apiFetch<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const url = BASE_URL + path;

	const token = getToken();

	const headers: Record<string, string> = {
		...(options.headers as any),
	};

	if (!(options.body instanceof FormData)) {
		headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
	}

	if (token) headers['Authorization'] = `Bearer ${token}`;

	let resp: Response;

	try {
		resp = await withTimeout(fetch(url, { ...options, headers }));
	} catch (err) {
		logger.error('Network error', { url, err });
		throw new NetworkError();
	}

	let data: unknown = null;
	try {
		if (resp.status !== 204) {
			data = await resp.clone().json();
		}
	} catch {
		// ignore json parse errors
	}

  if (!resp.ok) {
		const message = data?.error || `HTTP ${resp.status}`;

		if (resp.status === 401) {
			clearToken();
			logger.warn('Unauthorized API error', { url, data });
			throw new AuthError(message, data);
		}

		logger.error('API error', { status: resp.status, url, data });
		throw new APIError(resp.status, message, data);
	}

	return data as T;
}

// ─────────────────────────────────────────────
// Types (same as before)
// ─────────────────────────────────────────────
export interface AuthUser {
	user_id: string;
	username: string;
	token: string;
}

export interface Channel {
	id: string;
	name: string;
	is_private: boolean;
	creator_id: string;
	members: string[];
	created_at: string;
	unread_count?: number;
}

export interface Message {
	id: string;
	channel_id: string;
	sender_id: string;
	type: 'text' | 'file' | 'voice';
	ciphertext: number[];
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

export interface User {
  id: string;
  username: string;
  domain: string;
  status: string;
}

// ─────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────
export async function apiRegister(username: string, password: string) {
	return apiFetch<{ id: string; username: string }>('/api/register', {
		method: 'POST',
		body: JSON.stringify({ username, password }),
	});
}

export async function apiLogin(
	username: string,
	password: string,
): Promise<AuthUser> {
	const user = await apiFetch<AuthUser>('/api/login', {
		method: 'POST',
		body: JSON.stringify({ username, password }),
	});
	setToken(user.token);
	saveUser(user);
	return user;
}

export async function apiLogout() {
	await apiFetch('/api/logout', { method: 'POST' });
	clearToken();
}

export async function apiMe() {
	return apiFetch<{
		id: string;
		username: string;
		domain: string;
		status: string;
	}>('/api/me');
}

// ─────────────────────────────────────────────
// Channels
// ─────────────────────────────────────────────
export async function apiListChannels() {
	return apiFetch<Channel[] | null>('/api/channels').then((r) => r ?? []);
}

export async function apiCreateChannel(name: string, members: string[]) {
	return apiFetch<Channel>('/api/channels', {
		method: 'POST',
		body: JSON.stringify({ name, members }),
	});
}

export async function apiGetChannel(id: string) {
	return apiFetch<Channel>(`/api/channels/${id}`);
}

export async function apiAddMember(channelId: string, usernames: string[]) {
	return apiFetch(`/api/channels/${channelId}/members`, {
		method: 'POST',
		body: JSON.stringify({ usernames }),
	});
}

export async function apiGetChannelMembers(channelId: string) {
	return apiFetch<User[] | null>(`/api/channels/${channelId}/members`).then(
		(r) => r ?? [],
	);
}

export async function apiSearchUsers(query: string) {
	return apiFetch<User[] | null>(
		`/api/users?q=${encodeURIComponent(query)}`,
	).then((r) => r ?? []);
}

// ─────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────
export async function apiListMessages(id: string, limit = 50) {
	return apiFetch<Message[] | null>(
		`/api/channels/${id}/messages?limit=${limit}`,
	).then((r) => r ?? []);
}

// ─────────────────────────────────────────────
// File Uploads
// ─────────────────────────────────────────────
export async function apiUploadFile(file: Blob, mimeType: string) {
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
		throw new APIError(resp.status, err.error ?? 'Upload failed', err);
	}

	return resp.json();
}

export function apiFileUrl(fileId: string) {
	return `${BASE_URL}/api/files/${fileId}`;
}

// ─────────────────────────────────────────────
// Presence
// ─────────────────────────────────────────────
export async function apiGetPresence(userId: string) {
	return apiFetch<Presence>(`/api/users/${userId}/presence`);
}

export async function apiGetVersion() {
	return fetch(`${BASE_URL}/api/version`)
		.then((r) => {
			if (!r.ok) throw new APIError(r.status, 'Failed to fetch version');
			return r.json();
		})
		.catch((err) => {
			logger.error('Version fetch error', err);
			throw err;
		});
}
