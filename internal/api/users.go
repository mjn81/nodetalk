package api

import (
	"encoding/json"
	"net/http"
	"time"
	"nodetalk/internal/auth"
)

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
	writeJSON(w, http.StatusOK, UserResponse{
		ID:       u.ID,
		Username: u.Username,
		Domain:   u.Domain,
		Status:   u.Status,
		AvatarID: u.AvatarID,
	})
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

// UpdateProfile godoc
//	@Summary     Update current user profile
//	@Tags        users
//	@Accept      json
//	@Produce     json
//	@Security    BearerAuth
//	@Param       body body UpdateUserRequest true "Update payload"
//	@Success     200 {object} UserResponse
//	@Router      /api/users/me [patch]
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())
	var body UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	u, err := h.Store.GetUser(session.UserID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	if body.AvatarID != "" {
		u.AvatarID = body.AvatarID
	}

	if err := h.Store.UpdateUser(u); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}

	writeJSON(w, http.StatusOK, UserResponse{
		ID:       u.ID,
		Username: u.Username,
		Domain:   u.Domain,
		Status:   u.Status,
		AvatarID: u.AvatarID,
	})
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
		res = append(res, UserResponse{
			ID:       u.ID,
			Username: u.Username,
			Domain:   u.Domain,
			Status:   u.Status,
			AvatarID: u.AvatarID,
		})
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
	writeJSON(w, http.StatusOK, UserResponse{
		ID:       u.ID,
		Username: u.Username,
		Domain:   u.Domain,
		Status:   u.Status,
		AvatarID: u.AvatarID,
	})
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
