package models

import (
	"encoding/json"
	"time"
)

// ---- User ------------------------------------------------------------------ //

// User represents an authenticated account stored under u:{id}.
type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	PwdHash   []byte    `json:"pwd_hash"`  // Argon2id SaltedHash JSON blob
	Domain    string    `json:"domain"`    // e.g. "localhost" or "chat.example.com"
	Status    string    `json:"status"`    // "online" | "away" | "offline"
	CustomMsg string    `json:"custom_msg"` // Optional status message
	PublicKey []byte    `json:"pub_key"`   // Reserved for future E2EE key exchange
	CreatedAt time.Time `json:"created_at"`
}

// ---- Channel --------------------------------------------------------------- //

// Channel represents a chat channel across the platform (group or direct message).
type Channel struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	IsPrivate       bool      `json:"is_private"` // If true, hidden from public search
	InviteLink      string    `json:"invite_link"` // Unique public/private join link
	CreatorID       string    `json:"creator_id"`
	Members         []string  `json:"members"`
	AESKeyEncrypted []byte    `json:"aes_key_enc"` // Channel AES-256 key encrypted with server KEK
	CreatedAt       time.Time `json:"created_at"`
	UnreadCount     int       `json:"unread_count"` // Ephemeral: Populated per-user in handlers
}

// ---- UserChannel (Junction Index) ------------------------------------------ //

// UserChannel is the secondary index stored under uc:{user_id}:{channel_id}.
// It enables O(1) lookup of all channels for a specific user.
type UserChannel struct {
	JoinedAt   time.Time `json:"joined_at"`
	LastReadAt time.Time `json:"last_read_at"`
}

// ---- Message --------------------------------------------------------------- //

// MessageType enumerates the valid payload types for a message.
type MessageType string

const (
	MessageTypeText  MessageType = "text"
	MessageTypeFile  MessageType = "file"
	MessageTypeVoice MessageType = "voice"
)

// Message is stored under m:{chan_id}:{time_nano}. The server only sees
// opaque ciphertext — it never decrypts message bodies.
type Message struct {
	ID         string      `json:"id"`
	ChannelID  string      `json:"channel_id"`
	SenderID   string      `json:"sender_id"`
	Type       MessageType `json:"type"`       // "text" | "file" | "voice"
	Ciphertext []byte      `json:"ciphertext"` // AES-256-GCM encrypted payload
	Nonce      []byte      `json:"nonce"`      // GCM nonce (also prepended in ciphertext)
	Sig        []byte      `json:"sig"`        // Reserved: future sender signature
	SentAt     time.Time   `json:"sent_at"`
}

// ---- Presence -------------------------------------------------------------- //

// Presence is an ephemeral record stored under p:{user_id}, updated on every
// WebSocket heartbeat. TTL is enforced by the WSS hub — stale entries are
// overwritten or removed on disconnect.
type Presence struct {
	LastSeen      time.Time `json:"last_seen"`
	CurrentStatus string    `json:"current_status"` // "online" | "away" | "offline"
}

// ---- File / Media ---------------------------------------------------------- //

// File holds metadata for uploaded files and encrypted voice notes, stored
// under f:{uuid}. The actual binary sits on disk at StoragePath.
type File struct {
	ID             string    `json:"id"`
	OwnerID        string    `json:"owner_id"`
	SizeBytes      int64     `json:"size"`
	MIMEType       string    `json:"mime"`             // e.g. "audio/webm", "image/png"
	StoragePath    string    `json:"storage_path"`
	ThumbCipher    []byte    `json:"thumb_ciphertext"` // Optional encrypted thumbnail
	ThumbNonce     []byte    `json:"thumb_nonce"`      // Nonce for thumbnail
	UploadedAt     time.Time `json:"uploaded_at"`
}

// ---- WebSocket Wire Types -------------------------------------------------- //

// WSMessage is the envelope sent over the WebSocket connection. The Payload
// field contains the type-specific JSON body.
type WSMessage struct {
	Type    string          `json:"type"`    // e.g. "message", "presence", "channel_key"
	Payload json.RawMessage `json:"payload"` // Type-specific JSON
}
