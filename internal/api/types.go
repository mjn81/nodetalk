package api

import (
	"time"
)

// ── Request / Response types (used in Swagger annotations) ──────────────────

type RegisterRequest struct {
	Username string `json:"username" example:"alice"`
	Password string `json:"password" example:"s3cur3P@ss!"`
}

type RegisterResponse struct {
	ID       string `json:"id"       example:"a3f4..."`
	Username string `json:"username" example:"alice"`
}

type LoginRequest struct {
	Username string `json:"username" example:"alice"`
	Password string `json:"password" example:"s3cur3P@ss!"`
}

type LoginResponse struct {
	UserID   string `json:"user_id"  example:"a3f4..."`
	Username string `json:"username" example:"alice"`
}

type ChannelResponse struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	IsPrivate   bool              `json:"is_private"`
	InviteLink  string            `json:"invite_link"`
	CreatorID   string            `json:"creator_id"`
	Members     []string          `json:"members,omitempty"`
	MemberNames map[string]string `json:"member_names,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UnreadCount int               `json:"unread_count,omitempty"`
}

type ExploreChannelResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	InviteLink  string    `json:"invite_link"`
	MemberCount int       `json:"member_count"`
	CreatedAt   time.Time `json:"created_at"`
}

type UserResponse struct {
	ID       string `json:"id" example:"user-1"`
	Username string `json:"username" example:"alice"`
	Domain   string `json:"domain" example:"localhost"`
	Status   string `json:"status" example:"online"`
}

type ErrorResponse struct {
	Error string `json:"error" example:"invalid credentials"`
}

type StatusResponse struct {
	Status string `json:"status" example:"success"`
}

type CreateChannelRequest struct {
	Name      string   `json:"name"       example:"Design Team"`
	IsPrivate bool     `json:"is_private" example:"false"`
	Members   []string `json:"members"    example:"[\"user-id-1\",\"user-id-2\"]"`
}

type AddMembersRequest struct {
	UserIDs []string `json:"user_ids" example:"[\"user-1\",\"user-2\"]"`
}

type UploadFileResponse struct {
	FileID   string `json:"file_id"`
	Size     int64  `json:"size"`
	Mime     string `json:"mime"`
	Uploaded string `json:"uploaded"`
}
