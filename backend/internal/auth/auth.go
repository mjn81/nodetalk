package auth

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Session represents an authenticated server-side session stored in memory.
// For production, consider backing sessions with BadgerDB for persistence
// across restarts.
type Session struct {
	UserID    string
	Username  string
	CreatedAt time.Time
	ExpiresAt time.Time
}

// SessionStore is an in-memory session registry with TTL-based expiry.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	ttl      time.Duration
}

// NewSessionStore creates a new SessionStore and starts the background
// expiry sweeper.
func NewSessionStore(ttl time.Duration) *SessionStore {
	ss := &SessionStore{
		sessions: make(map[string]*Session),
		ttl:      ttl,
	}
	go ss.sweepExpired()
	return ss
}

// Create generates a secure random token, stores the session, and returns
// the token string.
func (ss *SessionStore) Create(userID, username string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("auth: token generation failed: %w", err)
	}
	token := base64.URLEncoding.EncodeToString(raw)
	now := time.Now()
	ss.mu.Lock()
	ss.sessions[token] = &Session{
		UserID:    userID,
		Username:  username,
		CreatedAt: now,
		ExpiresAt: now.Add(ss.ttl),
	}
	ss.mu.Unlock()
	return token, nil
}

// Validate returns the session associated with token, or an error if it is
// invalid or expired.
func (ss *SessionStore) Validate(token string) (*Session, error) {
	ss.mu.RLock()
	s, ok := ss.sessions[token]
	ss.mu.RUnlock()
	if !ok {
		return nil, errors.New("auth: invalid session token")
	}
	if time.Now().After(s.ExpiresAt) {
		ss.Delete(token)
		return nil, errors.New("auth: session expired")
	}
	return s, nil
}

// Delete removes a session (logout).
func (ss *SessionStore) Delete(token string) {
	ss.mu.Lock()
	delete(ss.sessions, token)
	ss.mu.Unlock()
}

// sweepExpired runs every hour to purge expired sessions.
func (ss *SessionStore) sweepExpired() {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		ss.mu.Lock()
		for token, s := range ss.sessions {
			if now.After(s.ExpiresAt) {
				delete(ss.sessions, token)
			}
		}
		ss.mu.Unlock()
	}
}

// ---- HTTP Helpers ---------------------------------------------------------- //

// BearerToken extracts the token from the `Authorization: Bearer <token>` header or query parameter.
func BearerToken(r *http.Request) (string, error) {
	h := r.Header.Get("Authorization")
	if len(h) >= 8 && h[:7] == "Bearer " {
		return h[7:], nil
	}
	// Fallback for query parameter (required for WebSocket handshake)
	if t := r.URL.Query().Get("token"); t != "" {
		return t, nil
	}
	return "", errors.New("auth: missing or malformed token")
}

// Require is an HTTP middleware that enforces session authentication.
// On success, the session is written to the request context via the sessionKey.
func (ss *SessionStore) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := BearerToken(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		session, err := ss.Validate(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		// Attach session into context for downstream handlers.
		ctx := withSession(r.Context(), session)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
