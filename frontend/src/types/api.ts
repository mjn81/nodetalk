export interface AuthUser {
	user_id: string;
	username: string;
}

export interface Channel {
	id: string;
	name: string;
	is_private: boolean;
	invite_link?: string;
	creator_id: string;
	members: string[];
	member_names?: Record<string, string>;
	created_at: string;
	unread_count?: number;
}

export interface ExploreChannel {
	id: string;
	name: string;
	invite_link: string;
	member_count: number;
	created_at: string;
}

export interface Message {
	id: string;
	channel_id: string;
	sender_id: string;
	type: 'text' | 'file' | 'voice';
	ciphertext: string;
	nonce: string;
	sent_at: string;
}

export interface Presence {
	last_seen: string;
	current_status: 'online' | 'away' | 'offline';
}

export interface UploadedFile {
	id: string;
	owner_id: string;
	size: number;
	mime: string;
	thumb_ciphertext?: string;
	thumb_nonce?: string;
	uploaded_at: string;
}

export interface User {
  id: string;
  username: string;
  domain: string;
  status: string;
}
