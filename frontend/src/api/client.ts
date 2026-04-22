// client.ts — Fully improved API client

import { logger } from '@/utils/logger';
import axios, { AxiosError } from 'axios';

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
// Axios Instance
// ─────────────────────────────────────────────
export const apiClient = axios.create({
	baseURL: BASE_URL,
	withCredentials: true,
	timeout: 8000,
});

apiClient.interceptors.response.use(
	(res) => res.data, // Strip AxiosResponse wrapper
	(error: AxiosError) => {
		if (error.code === 'ECONNABORTED' || !error.response) {
			logger.error('Network error', { url: error.config?.url, error });
			throw new NetworkError(error.message);
		}

		const url = error.config?.url || '';
		const status = error.response.status;
		const data = error.response.data as any;
		const message = data?.error || error.message || `HTTP ${status}`;

		if (status === 401) {
			logger.warn('Unauthorized API error', { url, data });
			if (typeof window !== 'undefined' && !url.includes('/api/logout')) {
				window.dispatchEvent(new Event('auth:unauthorized'));
			}
			throw new AuthError(message, data);
		}

		logger.error('API error', { status, url, data });
		throw new APIError(status, message, data);
	},
);

import type {
	AuthUser,
	Channel,
	ExploreChannel,
	Message,
	Presence,
	User,
} from '@/types/api';

// ─────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────
export async function apiRegister(username: string, password: string) {
	return apiClient.post<{ id: string; username: string }>('/api/register', {
		username,
		password,
	}) as unknown as Promise<{ id: string; username: string }>;
}

export async function apiLogin(
	username: string,
	password: string,
): Promise<AuthUser> {
	return apiClient.post('/api/login', {
		username,
		password,
	}) as unknown as Promise<AuthUser>;
}

export async function apiLogout() {
	return apiClient.post('/api/logout');
}

export async function apiMe() {
	return apiClient.get<{
		id: string;
		username: string;
		domain: string;
		status: string;
	}>('/api/me') as unknown as Promise<{
		id: string;
		username: string;
		domain: string;
		status: string;
	}>;
}

// ─────────────────────────────────────────────
// Channels
// ─────────────────────────────────────────────
export async function apiListChannels() {
	return apiClient
		.get<Channel[]>('/api/channels')
		.then((r) => (r as unknown as Channel[]) || []);
}

export async function apiExploreChannels(query: string) {
	return apiClient
		.get<
			ExploreChannel[]
		>(`/api/channels/explore?q=${encodeURIComponent(query)}`)
		.then((r) => (r as unknown as ExploreChannel[]) || []);
}

export async function apiCreateChannel(
	name: string,
	memberIds: string[],
	isPrivate: boolean,
) {
	return apiClient.post<Channel>('/api/channels', {
		name,
		members: memberIds,
		is_private: isPrivate,
	}) as unknown as Promise<Channel>;
}

export async function apiGetChannel(id: string) {
	return apiClient.get<Channel>(
		`/api/channels/${id}`,
	) as unknown as Promise<Channel>;
}

export async function apiJoinChannel(link: string) {
	return apiClient.post(`/api/join/${link}`);
}

export async function apiAddMember(channelId: string, userIds: string[]) {
	return apiClient.post(`/api/channels/${channelId}/members`, {
		user_ids: userIds,
	});
}

export async function apiGetChannelMembers(channelId: string) {
	return apiClient
		.get<User[]>(`/api/channels/${channelId}/members`)
		.then((r) => (r as unknown as User[]) || []);
}

export async function apiSearchUsers(query: string) {
	return apiClient
		.get<User[]>(`/api/users?q=${encodeURIComponent(query)}`)
		.then((r) => (r as unknown as User[]) || []);
}

// ─────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────
export async function apiListMessages(id: string, limit = 50) {
	return apiClient
		.get<Message[]>(`/api/channels/${id}/messages?limit=${limit}`)
		.then((r) => (r as unknown as Message[]) || []);
}

// ─────────────────────────────────────────────
// File Uploads
// ─────────────────────────────────────────────
export async function apiUploadFile(
	file: Blob,
	mimeType: string,
	thumbCipher?: string,
	thumbNonce?: string,
) {
	const formData = new FormData();
	formData.append('file', file, `upload.${mimeType.split('/')[1] ?? 'bin'}`);
	if (thumbCipher) formData.append('thumb_ciphertext', thumbCipher);
	if (thumbNonce) formData.append('thumb_nonce', thumbNonce);

	return apiClient.post('/api/files', formData, {
		headers: {
			'Content-Type': 'multipart/form-data',
		},
	});
}

export function apiGetFileUrl(fileId: string) {
	return `${BASE_URL}/api/files/${fileId}`;
}

export async function apiGetFile(fileId: string): Promise<ArrayBuffer> {
	return apiClient.get(`/api/files/${fileId}`, {
		responseType: 'arraybuffer',
	}) as Promise<ArrayBuffer>;
}

// ─────────────────────────────────────────────
// Presence
// ─────────────────────────────────────────────
export async function apiGetPresence(userId: string) {
	return apiClient.get<Presence>(
		`/api/users/${userId}/presence`,
	) as unknown as Promise<Presence>;
}

export async function apiGetVersion() {
	return apiClient.get<{ version: string }>('/api/version').catch((err) => {
		logger.error('Version fetch error', err);
		throw err;
	}) as unknown as Promise<{ version: string }>;
}
