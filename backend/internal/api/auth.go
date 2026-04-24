package api

import (
	"encoding/json"
	"net/http"
	"time"
	"nodetalk/backend/internal/auth"
)

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
		writeError(w, http.StatusBadRequest, "auth.errors.invalid_json")
		return
	}
	if len(body.Username) < 3 || len(body.Password) < 8 {
		writeError(w, http.StatusBadRequest, "auth.errors.invalid_length")
		return
	}
	u, err := h.Store.CreateUser(body.Username, body.Password, "localhost")
	if err != nil {
		writeError(w, http.StatusConflict, "auth.errors.username_taken")
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
		writeError(w, http.StatusBadRequest, "auth.errors.invalid_json")
		return
	}
	u, err := h.Store.AuthenticateUser(body.Username, body.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "auth.errors.invalid_credentials")
		return
	}
	token, err := h.Sessions.Create(u.ID, u.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "auth.errors.session_failed")
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
	writeJSON(w, http.StatusOK, LoginResponse{
		ID:               u.ID,
		Username:         u.Username,
		Domain:           u.Domain,
		Status:           u.Status,
		StatusPreference: u.StatusPreference,
		AvatarID:         u.AvatarID,
		CustomMsg:        u.CustomMsg,
	})
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
