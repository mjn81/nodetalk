package ws

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"nodetalk/backend/internal/auth"
	"nodetalk/backend/internal/models"
	"nodetalk/backend/internal/store"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// Hub manages all active WebSocket connections and broadcasts messages.
type Hub struct {
	mu      sync.RWMutex
	clients map[string]*Client // key: userID

	store    *store.Store
	sessions *auth.SessionStore
	kek      []byte

	broadcast chan *envelope
}

// Client represents a connected WebSocket peer.
type Client struct {
	UserID   string
	Username string
	conn     *websocket.Conn
	send     chan *envelope
	hub      *Hub
}

// envelope wraps a wire message with routing metadata.
type envelope struct {
	channelID string
	senderID  string
	msg       *models.WSMessage
}

// NewHub creates and starts a Hub.
func NewHub(s *store.Store, sessions *auth.SessionStore, kek []byte) *Hub {
	h := &Hub{
		clients:   make(map[string]*Client),
		store:     s,
		sessions:  sessions,
		kek:       kek,
		broadcast: make(chan *envelope, 256),
	}
	go h.run()
	return h
}

// run is the Hub's main event loop — dispatches inbound envelopes to the
// correct channel members.
func (h *Hub) run() {
	for env := range h.broadcast {
		h.mu.RLock()
		members, err := h.store.GetChannelMembers(env.channelID)
		if err != nil {
			h.mu.RUnlock()
			continue
		}
		for _, m := range members {
			if c, ok := h.clients[m.UserID]; ok {
				select {
				case c.send <- env:
				default:
					log.Printf("ws: slow receiver %s, message dropped", m.UserID)
				}
			}
		}
		h.mu.RUnlock()
	}
}

// ServeHTTP upgrades an HTTP request to a WebSocket connection.
// Authentication is via the `nodetalk_session` cookie or a `token` query parameter.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var token string
	if c, err := r.Cookie("nodetalk_session"); err == nil && c.Value != "" {
		token = c.Value
	} else {
		token = r.URL.Query().Get("token")
	}

	if token == "" {
		http.Error(w, `{"error":"missing token"}`, http.StatusUnauthorized)
		return
	}
	session, err := h.sessions.Validate(token)
	if err != nil {
		http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		// Allow any origin in development; restrict with OriginPatterns in production.
		InsecureSkipVerify: true,
	})
	if err != nil {
		log.Printf("ws: upgrade failed for user %s: %v", session.UserID, err)
		return
	}
	// Set a generous read limit for file/voice payloads (5 MB).
	conn.SetReadLimit(5 << 20)

	client := &Client{
		UserID:   session.UserID,
		Username: session.Username,
		conn:     conn,
		send:     make(chan *envelope, 64),
		hub:      h,
	}
	h.register(client)
	defer h.unregister(client)

	// Fetch user to check their status preference
	effectiveStatus := "online"
	isAuto := true
	if u, err := h.store.GetUser(session.UserID); err == nil {
		if u.StatusPreference != "" && u.StatusPreference != "auto" {
			effectiveStatus = u.StatusPreference
			isAuto = false
		}
	}

	_ = h.store.SetPresence(session.UserID, effectiveStatus)
	if isAuto {
		_ = h.store.UpdateUserStatus(session.UserID, effectiveStatus)
	}

	if effectiveStatus != "offline" {
		h.BroadcastPresence(session.UserID, effectiveStatus)
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Push all channel AES keys immediately after connect.
	go client.writeChannelKeys(ctx, h.store, h.kek)

	// Write pump — drains the send channel to the WebSocket.
	go func() {
		defer cancel()
		for {
			select {
			case <-ctx.Done():
				return
			case env, ok := <-client.send:
				if !ok {
					return
				}
				writeCtx, writeCancel := context.WithTimeout(ctx, 10*time.Second)
				if err := wsjson.Write(writeCtx, conn, env.msg); err != nil {
					writeCancel()
					return
				}
				writeCancel()
			}
		}
	}()

	// Read pump — receives inbound messages from the client.
	for {
		var raw models.WSMessage
		if err := wsjson.Read(ctx, conn, &raw); err != nil {
			break
		}
		if err := client.handleMessage(ctx, &raw); err != nil {
			log.Printf("ws: handle error for %s: %v", client.UserID, err)
		}
	}

	// Set presence to offline
	_ = h.store.SetPresence(session.UserID, "offline")

	// Update DB if auto
	if u, err := h.store.GetUser(session.UserID); err == nil {
		if u.StatusPreference == "auto" || u.StatusPreference == "" {
			_ = h.store.UpdateUserStatus(session.UserID, "offline")
		}
	}

	h.BroadcastPresence(session.UserID, "offline")
	conn.Close(websocket.StatusNormalClosure, "goodbye")
}

// BroadcastChannelCreated notifies all connected clients of a user's status change.
func (h *Hub) BroadcastChannelCreated(ch *models.Channel) {
	rawKey, err := h.store.DecryptChannelKey(ch, h.kek)
	if err != nil {
		log.Printf("ws: cannot decrypt key for new channel %s: %v", ch.ID, err)
		return
	}
	payload, _ := json.Marshal(map[string]any{
		"channel_id": ch.ID,
		"aes_key":    rawKey,
	})
	msg := &models.WSMessage{Type: "channel_key", Payload: payload}
	env := &envelope{msg: msg}

	members, err := h.store.GetChannelMembers(ch.ID)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, m := range members {
		if c, ok := h.clients[m.UserID]; ok {
			select {
			case c.send <- env:
			default:
			}
		}
	}
}

// SendChannelKey pushes a specific channel's AES key to a specific user.
func (h *Hub) SendChannelKey(channelID, userID string) {
	ch, err := h.store.GetChannel(channelID)
	if err != nil {
		return
	}

	rawKey, err := h.store.DecryptChannelKey(ch, h.kek)
	if err != nil {
		log.Printf("ws: cannot decrypt key for channel %s: %v", channelID, err)
		return
	}

	payload, _ := json.Marshal(map[string]any{
		"channel_id": ch.ID,
		"aes_key":    rawKey,
	})
	msg := &models.WSMessage{Type: "channel_key", Payload: payload}
	env := &envelope{msg: msg}

	h.mu.RLock()
	defer h.mu.RUnlock()
	if c, ok := h.clients[userID]; ok {
		select {
		case c.send <- env:
		default:
		}
	}
}

// BroadcastPresence notifies all connected clients of a user's status change.
func (h *Hub) BroadcastPresence(userID, status string) {
	payload, _ := json.Marshal(map[string]string{
		"user_id": userID,
		"status":  status,
	})
	msg := &models.WSMessage{Type: "presence", Payload: payload}
	env := &envelope{msg: msg}

	h.mu.RLock()
	for _, c := range h.clients {
		select {
		case c.send <- env:
		default:
		}
	}
	h.mu.RUnlock()
}

// BroadcastMemberJoined notifies channel members that a new user has joined,
// and ensures the new member receives the channel's AES key.
func (h *Hub) BroadcastMemberJoined(channelID string, userID string) {
	payload, _ := json.Marshal(map[string]any{
		"channel_id": channelID,
		"user_id":    userID,
		"type":       "member_joined",
	})
	msg := &models.WSMessage{Type: "channel_update", Payload: payload}
	h.broadcast <- &envelope{channelID: channelID, msg: msg}

	// Also send the AES key to the joining user immediately.
	h.SendChannelKey(channelID, userID)
}

// BroadcastMemberLeft notifies channel members that a user has left or been kicked.
func (h *Hub) BroadcastMemberLeft(channelID string, userID string) {
	payload, _ := json.Marshal(map[string]any{
		"channel_id": channelID,
		"user_id":    userID,
		"type":       "member_left",
	})
	msg := &models.WSMessage{Type: "channel_update", Payload: payload}
	// Broadcast to remaining members
	h.broadcast <- &envelope{channelID: channelID, msg: msg}

	// Also send targeted notification to the user who left/was kicked 
	// so their UI can react (e.g. remove channel from sidebar)
	h.mu.RLock()
	defer h.mu.RUnlock()
	if c, ok := h.clients[userID]; ok {
		kickPayload, _ := json.Marshal(map[string]any{
			"channel_id": channelID,
			"type":       "kicked",
		})
		kickMsg := &models.WSMessage{Type: "channel_update", Payload: kickPayload}
		select {
		case c.send <- &envelope{msg: kickMsg}:
		default:
		}
	}
}

// BroadcastMemberRoleUpdated notifies all members that a user's role has changed.
// This is important for the affected user to gain/lose permissions in real-time.
func (h *Hub) BroadcastMemberRoleUpdated(channelID string, userID string, role int) {
	payload, _ := json.Marshal(map[string]any{
		"channel_id": channelID,
		"user_id":    userID,
		"role":       role,
		"type":       "role_updated",
	})
	msg := &models.WSMessage{Type: "channel_update", Payload: payload}
	// Broadcast to everyone in the channel
	h.broadcast <- &envelope{channelID: channelID, msg: msg}

	// Also send targeted notification to the user who was updated
	h.mu.RLock()
	defer h.mu.RUnlock()
	if c, ok := h.clients[userID]; ok {
		select {
		case c.send <- &envelope{msg: msg}:
		default:
		}
	}
}
