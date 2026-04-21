export interface AuthUser {
	user_id: string;
	username: string;
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
