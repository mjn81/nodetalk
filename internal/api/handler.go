package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/google/uuid"
	"nodetalk/internal/auth"
	"nodetalk/internal/middleware"
	"nodetalk/internal/models"
	"nodetalk/internal/store"
)

// Handler bundles all HTTP handler dependencies.
type Handler struct {
	Store    *store.Store
	Sessions *auth.SessionStore
	KEK      []byte   // Server Key Encryption Key — used to decrypt channel keys
	UploadDir string  // Filesystem path for uploaded file storage
}

// NewRouter wires the full HTTP API with rate limiting and returns an http.ServeMux.
func NewRouter(h *Handler, globalRPS, authRPS float64) http.Handler {
	mux := http.NewServeMux()

	// Public rate-limited auth endpoints.
	authLimiter := middleware.NewRateLimiter(authRPS, int(authRPS)*2)
	mux.Handle("POST /api/register", authLimiter.Limit(http.HandlerFunc(h.Register)))
	mux.Handle("POST /api/login", authLimiter.Limit(http.HandlerFunc(h.Login)))

	// Protected routes (require a valid Bearer session token).
	globalLimiter := middleware.NewRateLimiter(globalRPS, int(globalRPS)*2)
	auth_ := h.Sessions.Require
	protect := func(handler http.HandlerFunc) http.Handler {
		return globalLimiter.Limit(auth_(handler))
	}

	mux.Handle("POST /api/logout", protect(h.Logout))
	mux.Handle("GET /api/me", protect(h.Me))

	// Channels
	mux.Handle("POST /api/channels", protect(h.CreateChannel))
	mux.Handle("GET /api/channels", protect(h.ListChannels))
	mux.Handle("GET /api/channels/{id}", protect(h.GetChannel))
	mux.Handle("POST /api/channels/{id}/members", protect(h.AddMember))

	// Messages
	mux.Handle("GET /api/channels/{id}/messages", protect(h.ListMessages))

	// Files
	mux.Handle("POST /api/upload", protect(h.UploadFile))
	mux.Handle("GET /api/files/{id}", protect(h.DownloadFile))

	// Presence
	mux.Handle("GET /api/users/{id}/presence", protect(h.GetPresence))

	// Wrap the entire mux in CORS middleware.
	return middleware.CORS(mux)
}

// ============================================================
//  Auth Handlers
// ============================================================

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
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
	writeJSON(w, http.StatusCreated, map[string]any{
		"id":       u.ID,
		"username": u.Username,
	})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
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
	writeJSON(w, http.StatusOK, map[string]any{
		"token":    token,
		"user_id":  u.ID,
		"username": u.Username,
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	token, _ := auth.BearerToken(r)
	session := auth.SessionFromContext(r.Context())
	if session != nil {
		_ = h.Store.SetPresence(session.UserID, "offline")
	}
	h.Sessions.Delete(token)
	writeJSON(w, http.StatusOK, map[string]string{"status": "logged out"})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	u, err := h.Store.GetUser(session.UserID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":       u.ID,
		"username": u.Username,
		"domain":   u.Domain,
		"status":   u.Status,
	})
}

// ============================================================
//  Channel Handlers
// ============================================================

func (h *Handler) CreateChannel(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	var body struct {
		Name    string   `json:"name"`
		Members []string `json:"members"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	// Always include the creator in the members list.
	memberSet := uniqueStrings(append(body.Members, session.UserID))
	ch, err := h.Store.CreateChannel(body.Name, session.UserID, memberSet, h.KEK)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "channel creation failed")
		return
	}
	writeJSON(w, http.StatusCreated, ch)
}

func (h *Handler) ListChannels(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	channels, err := h.Store.ListUserChannels(session.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list channels")
		return
	}
	writeJSON(w, http.StatusOK, channels)
}

func (h *Handler) GetChannel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ch, err := h.Store.GetChannel(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "channel not found")
		return
	}
	writeJSON(w, http.StatusOK, ch)
}

func (h *Handler) AddMember(w http.ResponseWriter, r *http.Request) {
	channelID := r.PathValue("id")
	var body struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := h.Store.AddMemberToChannel(channelID, body.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to add member")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "member added"})
}

// ============================================================
//  Message Handlers
// ============================================================

func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	channelID := r.PathValue("id")
	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	msgs, err := h.Store.ListMessages(channelID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch messages")
		return
	}
	writeJSON(w, http.StatusOK, msgs)
}

// ============================================================
//  File Upload / Download Handlers
// ============================================================

const maxUploadSize = 50 << 20 // 50 MB

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

	ext := filepath.Ext(header.Filename)
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
	writeJSON(w, http.StatusCreated, map[string]any{
		"file_id":  f.ID,
		"size":     f.SizeBytes,
		"mime":     f.MIMEType,
		"uploaded": f.UploadedAt.Format(time.RFC3339),
	})
}

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

// ============================================================
//  Presence Handlers
// ============================================================

func (h *Handler) GetPresence(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("id")
	p, err := h.Store.GetPresence(userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "presence not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// ============================================================
//  Store proxy helper (bridge for handlers to call store methods)
// ============================================================

func (h *Handler) GetFile(id string) (*models.File, error) {
	return h.Store.GetFile(id)
}

// ============================================================
//  Response Helpers
// ============================================================

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func uniqueStrings(s []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, v := range s {
		if _, ok := seen[v]; !ok {
			seen[v] = struct{}{}
			out = append(out, v)
		}
	}
	return out
}
