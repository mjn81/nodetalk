// Package api provides HTTP REST handlers for the NodeTalk API.
package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"nodetalk/internal/auth"
	"nodetalk/internal/middleware"
	"nodetalk/internal/models"
	"nodetalk/internal/store"

	"github.com/google/uuid"
)

// Handler bundles all HTTP handler dependencies.
type Handler struct {
	Store     *store.Store
	Sessions  *auth.SessionStore
	KEK       []byte
	UploadDir string
	TokenTTL  time.Duration
}

// NewRouter wires the full HTTP API with rate limiting.
func NewRouter(h *Handler, globalRPS, authRPS float64) http.Handler {
	mux := http.NewServeMux()

	authLimiter   := middleware.NewRateLimiter(authRPS, int(authRPS)*2)
	globalLimiter := middleware.NewRateLimiter(globalRPS, int(globalRPS)*2)
	protect := func(handler http.HandlerFunc) http.Handler {
		return globalLimiter.Limit(h.Sessions.Require(handler))
	}

	// Public
	mux.Handle("GET /api/version",   http.HandlerFunc(h.GetVersion))
	mux.Handle("POST /api/register", authLimiter.Limit(http.HandlerFunc(h.Register)))
	mux.Handle("POST /api/login",    authLimiter.Limit(http.HandlerFunc(h.Login)))

	// Protected
	mux.Handle("POST /api/logout",                       protect(h.Logout))
	mux.Handle("GET /api/me",                            protect(h.Me))
	mux.Handle("DELETE /api/users/me",                   protect(h.DeleteAccount))
	mux.Handle("GET /api/users",                         protect(h.SearchUsers))
	mux.Handle("GET /api/users/{id}",                    protect(h.GetUser))
	mux.Handle("GET /api/users/{id}/presence",           protect(h.GetPresence))

	mux.Handle("POST /api/channels",                     protect(h.CreateChannel))
	mux.Handle("GET /api/channels",                      protect(h.ListChannels))
	mux.Handle("GET /api/channels/{id}",                 protect(h.GetChannel))
	mux.Handle("POST /api/join/{link}",                  protect(h.JoinChannel))
	mux.Handle("GET /api/channels/{id}/members",         protect(h.GetChannelMembers))
	mux.Handle("POST /api/channels/{id}/members",        protect(h.AddMembers))
	mux.Handle("DELETE /api/channels/{id}/members/{uid}",protect(h.RemoveMember))
	
	mux.Handle("GET /api/channels/{id}/messages",        protect(h.ListMessages))
	
	mux.Handle("POST /api/upload",                       protect(h.UploadFile))
	mux.Handle("GET /api/files/{id}",                    protect(h.DownloadFile))

	return middleware.CORS(mux)
}

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
	Usernames []string `json:"usernames" example:"[\"bob\",\"charlie\"]"`
}

type UploadFileResponse struct {
	FileID   string `json:"file_id"`
	Size     int64  `json:"size"`
	Mime     string `json:"mime"`
	Uploaded string `json:"uploaded"`
}

// ============================
//  Auth Handlers
// ============================

// Register godoc
//	@Summary     Register a new account
//	@Description Creates a new NodeTalk user account.
//	@Tags        auth
//	@Accept      json
//	@Produce     json
//	@Param       body body RegisterRequest true "Registration payload"
//	@Success     201 {object} RegisterResponse
//	@Failure     400 {object} ErrorResponse
//	@Failure     409 {object} ErrorResponse
//	@Router      /api/register [post]
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var body RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.Username == "" || len(body.Password) < 8 {
		writeError(w, http.StatusBadRequest, "username required and password must be ≥8 chars")
		return
	}
	u, err := h.Store.CreateUser(body.Username, body.Password, "localhost")
	if err != nil {
		writeError(w, http.StatusConflict, "username already taken or server error")
		return
	}
	writeJSON(w, http.StatusCreated, RegisterResponse{ID: u.ID, Username: u.Username})
}

// Login godoc
//	@Summary     Log in and obtain a session token
//	@Tags        auth
//	@Accept      json
//	@Produce     json
//	@Param       body body LoginRequest true "Login credentials"
//	@Success     200 {object} LoginResponse
//	@Failure     400 {object} ErrorResponse
//	@Failure     401 {object} ErrorResponse
//	@Router      /api/login [post]
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	u, err := h.Store.AuthenticateUser(body.Username, body.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := h.Sessions.Create(u.ID, u.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "session creation failed")
		return
	}
	_ = h.Store.SetPresence(u.ID, "online")
	http.SetCookie(w, &http.Cookie{
		Name:     "nodetalk_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true in prod mapped over HTTPS
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(h.TokenTTL.Seconds()),
	})
	writeJSON(w, http.StatusOK, LoginResponse{UserID: u.ID, Username: u.Username})
}

// Logout godoc
//	@Summary     Log out and invalidate session
//	@Tags        auth
//	@Produce     json
//	@Security    BearerAuth
//	@Success     200 {object} StatusResponse
//	@Router      /api/logout [post]
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	token, _ := auth.BearerToken(r)
	session := auth.SessionFromContext(r.Context())
	if session != nil {
		_ = h.Store.SetPresence(session.UserID, "offline")
	}
	h.Sessions.Delete(token)
	http.SetCookie(w, &http.Cookie{
		Name:     "nodetalk_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
	})
	writeJSON(w, http.StatusOK, StatusResponse{Status: "logged out"})
}

// ============================
//  User Handlers
// ============================

// Me godoc
//	@Summary     Get current authenticated user
//	@Tags        users
//	@Produce     json
//	@Security    BearerAuth
//	@Success     200 {object} UserResponse
//	@Router      /api/me [get]
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	u, err := h.Store.GetUser(session.UserID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, UserResponse{ID: u.ID, Username: u.Username, Domain: u.Domain, Status: u.Status})
}

// DeleteAccount godoc
//	@Summary     Delete current user account
//	@Tags        users
//	@Produce     json
//	@Security    BearerAuth
//	@Success     200 {object} StatusResponse
//	@Router      /api/users/me [delete]
func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	token, _ := auth.BearerToken(r)

	if err := h.Store.DeleteUser(session.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete account")
		return
	}
	
	h.Sessions.Delete(token)
	http.SetCookie(w, &http.Cookie{
		Name:     "nodetalk_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
	})
	writeJSON(w, http.StatusOK, StatusResponse{Status: "account deleted"})
}

// SearchUsers godoc
//	@Summary     Search globally for users by username
//	@Tags        users
//	@Produce     json
//	@Security    BearerAuth
//	@Param       q query string false "Search query to filter by username"
//	@Success     200 {array} UserResponse
//	@Router      /api/users [get]
func (h *Handler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusOK, []UserResponse{})
		return
	}
	users, err := h.Store.SearchUsers(q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "search failed")
		return
	}
	
	var res []UserResponse
	for _, u := range users {
		res = append(res, UserResponse{ID: u.ID, Username: u.Username, Domain: u.Domain, Status: u.Status})
	}
	if res == nil {
		res = []UserResponse{}
	}
	writeJSON(w, http.StatusOK, res)
}

// GetUser godoc
//	@Summary     Get a user by ID
//	@Tags        users
//	@Produce     json
//	@Security    BearerAuth
//	@Param       id path string true "User ID"
//	@Success     200 {object} UserResponse
//	@Router      /api/users/{id} [get]
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	u, err := h.Store.GetUser(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, UserResponse{ID: u.ID, Username: u.Username, Domain: u.Domain, Status: u.Status})
}

// ============================
//  Channel Handlers
// ============================

// CreateChannel godoc
//	@Summary     Create a channel or direct message
//	@Tags        channels
//	@Accept      json
//	@Produce     json
//	@Security    BearerAuth
//	@Param       body body CreateChannelRequest true "Channel payload"
//	@Success     201 {object} models.Channel
//	@Router      /api/channels [post]
func (h *Handler) CreateChannel(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	var body CreateChannelRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	memberSet := uniqueStrings(append(body.Members, session.UserID))
	ch, err := h.Store.CreateChannel(body.Name, session.UserID, body.IsPrivate, memberSet, h.KEK)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "channel creation failed")
		return
	}
	writeJSON(w, http.StatusCreated, ch)
}

// ListChannels godoc
//	@Summary     List channels for the user OR search global public channels
//	@Description Without ?q=, returns your joined channels. With ?q=, searches across all public channels globally.
//	@Tags        channels
//	@Produce     json
//	@Security    BearerAuth
//	@Param       q query string false "Search query for ALL public channels"
//	@Success     200 {array} models.Channel
//	@Router      /api/channels [get]
func (h *Handler) ListChannels(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	search := r.URL.Query().Get("q")

	if search == "" {
		// No search, just return joined channels
		channels, err := h.Store.ListUserChannels(session.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not list channels")
			return
		}
		if channels == nil {
			channels = []*models.Channel{}
		}
		writeJSON(w, http.StatusOK, channels)
		return
	}

	// Search provided -> List all public matching channels
	allChannels, err := h.Store.ListAllChannels()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list all channels")
		return
	}

	filtered := make([]*models.Channel, 0)
	searchQuery := strings.ToLower(search)

	for _, ch := range allChannels {
		if ch.IsPrivate {
			continue // Hide private
		}
		if strings.Contains(strings.ToLower(ch.Name), searchQuery) {
			filtered = append(filtered, ch)
		}
	}

	writeJSON(w, http.StatusOK, filtered)
}

// GetChannel godoc
//	@Summary     Get a channel by ID
//	@Tags        channels
//	@Produce     json
//	@Security    BearerAuth
//	@Param       id path string true "Channel ID"
//	@Success     200 {object} models.Channel
//	@Router      /api/channels/{id} [get]
func (h *Handler) GetChannel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ch, err := h.Store.GetChannel(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}
	writeJSON(w, http.StatusOK, ch)
}

// JoinChannel godoc
//	@Summary     Join a channel via a unique invite link
//	@Tags        channels
//	@Produce     json
//	@Security    BearerAuth
//	@Param       link path string true "Unique Channel Invite Link"
//	@Success     200 {object} StatusResponse
//	@Router      /api/join/{link} [post]
func (h *Handler) JoinChannel(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	link := r.PathValue("link")

	ch, err := h.Store.GetChannelByInviteLink(link)
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}

	if err := h.Store.AddMemberToChannel(ch.ID, session.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to join channel")
		return
	}
	writeJSON(w, http.StatusOK, StatusResponse{Status: "joined"})
}

// GetChannelMembers godoc
//	@Summary     List members of a channel
//	@Tags        channels
//	@Produce     json
//	@Security    BearerAuth
//	@Param       id path string true "Channel ID"
//	@Success     200 {array} UserResponse
//	@Router      /api/channels/{id}/members [get]
func (h *Handler) GetChannelMembers(w http.ResponseWriter, r *http.Request) {
	channelID := r.PathValue("id")
	ch, err := h.Store.GetChannel(channelID)
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}

	var members []UserResponse
	for _, uid := range ch.Members {
		if u, err := h.Store.GetUser(uid); err == nil {
			members = append(members, UserResponse{
				ID: u.ID,
				Username: u.Username,
				Domain: u.Domain,
				Status: u.Status,
			})
		}
	}
	if members == nil {
		members = []UserResponse{}
	}
	writeJSON(w, http.StatusOK, members)
}

// AddMembers godoc
//	@Summary     Add multiple members to a channel by username
//	@Tags        channels
//	@Accept      json
//	@Produce     json
//	@Security    BearerAuth
//	@Param       id   path string        true "Channel ID"
//	@Param       body body AddMembersRequest true "Members to add (by username)"
//	@Success     200 {object} StatusResponse
//	@Router      /api/channels/{id}/members [post]
func (h *Handler) AddMembers(w http.ResponseWriter, r *http.Request) {
	channelID := r.PathValue("id")
	var body AddMembersRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(body.Usernames) == 0 {
		writeError(w, http.StatusBadRequest, "usernames required")
		return
	}
	
	for _, uname := range body.Usernames {
		// Look up user by username
		if u, err := h.Store.GetUserByUsername(uname); err == nil {
			_ = h.Store.AddMemberToChannel(channelID, u.ID)
		}
	}
	writeJSON(w, http.StatusOK, StatusResponse{Status: "members added"})
}

// RemoveMember godoc
//	@Summary     Remove a member from a channel
//	@Tags        channels
//	@Produce     json
//	@Security    BearerAuth
//	@Param       id  path string true "Channel ID"
//	@Param       uid path string true "User ID to remove"
//	@Success     200 {object} StatusResponse
//	@Router      /api/channels/{id}/members/{uid} [delete]
func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	session    := auth.SessionFromContext(r.Context())
	channelID  := r.PathValue("id")
	targetUID  := r.PathValue("uid")

	ch, err := h.Store.GetChannel(channelID)
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}
	// Only the creator or the user themselves can remove a member.
	if ch.CreatorID != session.UserID && session.UserID != targetUID {
		writeError(w, http.StatusForbidden, "insufficient permissions")
		return
	}
	if err := h.Store.RemoveMemberFromChannel(channelID, targetUID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to remove member")
		return
	}
	writeJSON(w, http.StatusOK, StatusResponse{Status: "member removed"})
}

// ============================
//  Message Handlers
// ============================

// ListMessages godoc
//	@Summary     List recent messages for a channel
//	@Description Returns messages newest-first. Supports cursor pagination.
//	@Tags        messages
//	@Produce     json
//	@Security    BearerAuth
//	@Param       id     path  string true  "Channel ID"
//	@Param       limit  query int    false "Max messages to return (default 50, max 200)"
//	@Param       before query int    false "Unix timestamp (nanoseconds) cursor for pagination"
//	@Success     200 {array}  models.Message
//	@Router      /api/channels/{id}/messages [get]
func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	channelID := r.PathValue("id")
	limit := 50
	var before int64 = 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	if b := r.URL.Query().Get("before"); b != "" {
		if n, err := strconv.ParseInt(b, 10, 64); err == nil && n > 0 {
			before = n
		}
	}

	msgs, err := h.Store.ListMessages(channelID, before, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch messages")
		return
	}
	if msgs == nil {
		msgs = []*models.Message{}
	}
	writeJSON(w, http.StatusOK, msgs)
}

// ============================
//  File Handlers
// ============================

const maxUploadSize = 50 << 20 // 50 MB

// UploadFile godoc
//	@Summary     Upload a file or voice note
//	@Tags        files
//	@Accept      mpfd
//	@Produce     json
//	@Security    BearerAuth
//	@Param       file formData file true "File to upload (max 50 MB)"
//	@Success     201 {object} UploadFileResponse
//	@Router      /api/upload [post]
func (h *Handler) UploadFile(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "file too large or malformed request")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing file field")
		return
	}
	defer file.Close()

	ext    := filepath.Ext(header.Filename)
	fileID := uuid.New().String()
	dstPath := filepath.Join(h.UploadDir, fileID+ext)

	if err := os.MkdirAll(h.UploadDir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "upload dir error")
		return
	}
	dst, err := os.Create(dstPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save file")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "file write error")
		return
	}

	mime := header.Header.Get("Content-Type")
	if mime == "" {
		mime = "application/octet-stream"
	}

	f, err := h.Store.RegisterFile(session.UserID, mime, dstPath, written)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to register file")
		return
	}
	writeJSON(w, http.StatusCreated, UploadFileResponse{
		FileID:   f.ID,
		Size:     f.SizeBytes,
		Mime:     f.MIMEType,
		Uploaded: f.UploadedAt.Format(time.RFC3339),
	})
}

// DownloadFile godoc
//	@Summary     Download a file by ID
//	@Tags        files
//	@Produce     application/octet-stream
//	@Security    BearerAuth
//	@Param       id path string true "File ID"
//	@Success     200 "File content"
//	@Router      /api/files/{id} [get]
func (h *Handler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	f, err := h.Store.GetFile(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}
	w.Header().Set("Content-Type", f.MIMEType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filepath.Base(f.StoragePath)))
	http.ServeFile(w, r, f.StoragePath)
}

// ============================
//  Presence Handlers
// ============================

// GetPresence godoc
//	@Summary     Get presence status for a user
//	@Tags        users
//	@Produce     json
//	@Security    BearerAuth
//	@Param       id path string true "User ID"
//	@Success     200 {object} models.Presence
//	@Router      /api/users/{id}/presence [get]
func (h *Handler) GetPresence(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	p, err := h.Store.GetPresence(userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "presence not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// ============================
//  Response & utility helpers
// ============================

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, ErrorResponse{Error: msg})
}

func uniqueStrings(s []string) []string {
	seen := make(map[string]struct{})
	out  := make([]string, 0, len(s))
	for _, v := range s {
		if _, ok := seen[v]; !ok {
			seen[v] = struct{}{}
			out = append(out, v)
		}
	}
	return out
}
