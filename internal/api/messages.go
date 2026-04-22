package api

import (
	"net/http"
	"strconv"
	"nodetalk/internal/models"
)

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
	ch := ChannelFromContext(r.Context())
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

	msgs, err := h.Store.ListMessages(ch.ID, before, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not fetch messages")
		return
	}
	if msgs == nil {
		msgs = []*models.Message{}
	}
	writeJSON(w, http.StatusOK, msgs)
}
