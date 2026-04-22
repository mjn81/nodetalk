package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"nodetalk/internal/auth"
	"nodetalk/internal/models"
)

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

	// DM de-duplication: if this is a DM, check if it already exists
	if body.Name == "" && len(memberSet) == 2 {
		existingByMe, err := h.Store.ListUserChannels(session.UserID)
		if err == nil {
			for _, ex := range existingByMe {
				if ex.Name != "" { continue }
				
				exMembers, _ := h.Store.GetChannelMembers(ex.ID)
				if len(exMembers) == 2 {
					matches := 0
					for _, m1 := range memberSet {
						for _, m2 := range exMembers {
							if m1 == m2.UserID {
								matches++
							}
						}
					}
					if matches == 2 {
						writeJSON(w, http.StatusOK, h.toChannelResponse(ex))
						return
					}
				}
			}
		}
	}

	ch, err := h.Store.CreateChannel(body.Name, session.UserID, body.IsPrivate, memberSet, h.KEK)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "channel creation failed")
		return
	}

	// Notify all members via WebSocket
	if h.Hub != nil {
		h.Hub.BroadcastChannelCreated(ch)
	}

	writeJSON(w, http.StatusCreated, h.toChannelResponse(ch))
}

//	@Summary     List channels for the current user
//	@Tags        channels
//	@Produce     json
//	@Security    BearerAuth
//	@Success     200 {array} models.Channel
//	@Router      /api/channels [get]
func (h *Handler) ListChannels(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())

	channels, err := h.Store.ListUserChannels(session.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list channels")
		return
	}
	
	resp := make([]ChannelResponse, 0)
	for _, ch := range channels {
		resp = append(resp, h.toChannelResponse(ch))
	}
	writeJSON(w, http.StatusOK, resp)
}

// ExploreChannels godoc
//	@Summary     Search public channels
//	@Tags        channels
//	@Produce     json
//	@Security    BearerAuth
//	@Param       q query string false "Search query"
//	@Success     200 {array} ExploreChannelResponse
//	@Router      /api/channels/explore [get]
func (h *Handler) ExploreChannels(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("q")
	allChannels, err := h.Store.ListAllChannels()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not list all channels")
		return
	}

	filtered := make([]ExploreChannelResponse, 0)
	searchQuery := strings.ToLower(search)

	for _, ch := range allChannels {
		if ch.IsPrivate {
			continue // Hide private
		}
		
		members, _ := h.Store.GetChannelMembers(ch.ID)

		if search == "" || strings.Contains(strings.ToLower(ch.Name), searchQuery) {
			filtered = append(filtered, ExploreChannelResponse{
				ID:          ch.ID,
				Name:        ch.Name,
				InviteLink:  ch.InviteLink,
				MemberCount: len(members),
				CreatedAt:   ch.CreatedAt,
			})
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
	ch := ChannelFromContext(r.Context())
	writeJSON(w, http.StatusOK, h.toChannelResponse(ch))
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

	if err := h.Store.AddMemberToChannel(ch.ID, session.UserID, models.RoleMember); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to join channel")
		return
	}

	// Notify members
	if h.Hub != nil {
		h.Hub.BroadcastMemberJoined(ch.ID, session.UserID)
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
	ch := ChannelFromContext(r.Context())
	memberList, err := h.Store.GetChannelMembers(ch.ID)
	if err != nil {
		writeJSON(w, http.StatusOK, []UserResponse{})
		return
	}

	var members []UserResponse
	for _, m := range memberList {
		if u, err := h.Store.GetUser(m.UserID); err == nil {
			members = append(members, UserResponse{
				ID: u.ID,
				Username: u.Username,
				Domain: u.Domain,
				Status: u.Status,
			})
		}
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
	ch := ChannelFromContext(r.Context())
	var body AddMembersRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(body.UserIDs) == 0 {
		writeError(w, http.StatusBadRequest, "user_ids required")
		return
	}
	
	for _, uid := range body.UserIDs {
		if err := h.Store.AddMemberToChannel(ch.ID, uid, models.RoleMember); err == nil {
			h.Hub.BroadcastMemberJoined(ch.ID, uid)
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
	ch         := ChannelFromContext(r.Context())
	targetUID  := r.PathValue("uid")

	// Get actor's role
	actorUC, err := h.Store.GetUserChannel(session.UserID, ch.ID)
	if err != nil {
		writeError(w, http.StatusForbidden, "membership error")
		return
	}

	// Case 1: User leaving voluntarily
	if session.UserID == targetUID {
		if err := h.Store.RemoveMemberFromChannel(ch.ID, targetUID, models.StatusLeft); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to leave channel")
			return
		}
		writeJSON(w, http.StatusOK, StatusResponse{Status: "left channel"})
		return
	}

	// Case 2: Kick-out (Requires Admin/Owner)
	if actorUC.Role < models.RoleAdmin {
		writeError(w, http.StatusForbidden, "insufficient permissions to kick")
		return
	}

	// Target role check: cannot kick someone with equal or higher role
	targetUC, err := h.Store.GetUserChannel(targetUID, ch.ID)
	if err == nil && targetUC.Role >= actorUC.Role {
		writeError(w, http.StatusForbidden, "cannot kick user with equal or higher role")
		return
	}

	if err := h.Store.RemoveMemberFromChannel(ch.ID, targetUID, models.StatusKicked); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to remove member")
		return
	}
	writeJSON(w, http.StatusOK, StatusResponse{Status: "member kicked"})
}

// --- Helpers & Middleware ---

type apiContextKey int
const channelCtxKey apiContextKey = 0

func (h *Handler) RequireMember(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := auth.SessionFromContext(r.Context())
		channelID := r.PathValue("id")
		if channelID == "" {
			writeError(w, http.StatusBadRequest, "missing channel id")
			return
		}

		ch, err := h.Store.GetChannel(channelID)
		if err != nil {
			writeError(w, http.StatusNotFound, "channel not found")
			return
		}

		uc, err := h.Store.GetUserChannel(session.UserID, channelID)
		if err != nil || uc.Status != models.StatusActive {
			writeError(w, http.StatusForbidden, "not a member of this channel")
			return
		}

		ctx := context.WithValue(r.Context(), channelCtxKey, ch)
		next(w, r.WithContext(ctx))
	}
}

func ChannelFromContext(ctx context.Context) *models.Channel {
	ch, _ := ctx.Value(channelCtxKey).(*models.Channel)
	return ch
}

func (h *Handler) toChannelResponse(ch *models.Channel) ChannelResponse {
	memberNames := make(map[string]string)
	members, err := h.Store.GetChannelMembers(ch.ID)
	
	var memberIDs []string
	if err == nil {
		for _, m := range members {
			memberIDs = append(memberIDs, m.UserID)
			u, err := h.Store.GetUser(m.UserID)
			if err == nil {
				memberNames[m.UserID] = u.Username
			}
		}
	}

	return ChannelResponse{
		ID:          ch.ID,
		Name:        ch.Name,
		IsPrivate:   ch.IsPrivate,
		InviteLink:  ch.InviteLink,
		CreatorID:   ch.CreatorID,
		Members:     memberIDs,
		MemberNames: memberNames,
		CreatedAt:   ch.CreatedAt,
		UnreadCount: ch.UnreadCount,
	}
}
