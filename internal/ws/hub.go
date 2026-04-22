package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"nodetalk/internal/auth"
	"nodetalk/internal/models"
	"nodetalk/internal/store"
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

	_ = h.store.SetPresence(session.UserID, "online")

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

	_ = h.store.SetPresence(session.UserID, "offline")
	h.broadcastPresence(session.UserID, "offline")
	conn.Close(websocket.StatusNormalClosure, "goodbye")
}

func (h *Hub) register(c *Client) {
	h.mu.Lock()
	// Close any existing connection for this user (new login replaced old tab).
	if old, ok := h.clients[c.UserID]; ok {
		old.conn.Close(websocket.StatusGoingAway, "replaced by new connection")
		close(old.send)
	}
	h.clients[c.UserID] = c
	h.mu.Unlock()
}

func (h *Hub) unregister(c *Client) {
	h.mu.Lock()
	if existing, ok := h.clients[c.UserID]; ok && existing == c {
		delete(h.clients, c.UserID)
		close(c.send)
	}
	h.mu.Unlock()
}

// broadcastPresence notifies all connected clients of a user's status change.
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

// broadcastPresence notifies all connected clients of a user's status change.
func (h *Hub) broadcastPresence(userID, status string) {
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

// BroadcastMemberJoined notifies channel members that a new user has joined.
func (h *Hub) BroadcastMemberJoined(channelID string, userID string) {
	payload, _ := json.Marshal(map[string]any{
		"channel_id": channelID,
		"user_id":    userID,
		"type":       "member_joined",
	})
	msg := &models.WSMessage{Type: "channel_update", Payload: payload}
	h.broadcast <- &envelope{channelID: channelID, msg: msg}
}

// ---- Client Methods -------------------------------------------------------- //

// writeChannelKeys pushes all decrypted AES channel keys to the client so it
// can decrypt incoming messages immediately.
func (c *Client) writeChannelKeys(ctx context.Context, s *store.Store, kek []byte) {
	channels, err := s.ListUserChannels(c.UserID)
	if err != nil {
		log.Printf("ws: writeChannelKeys list error for %s: %v", c.UserID, err)
		return
	}
	for _, ch := range channels {
		rawKey, err := s.DecryptChannelKey(ch, kek)
		if err != nil {
			log.Printf("ws: cannot decrypt key for channel %s: %v", ch.ID, err)
			continue
		}
		payload, _ := json.Marshal(map[string]any{
			"channel_id": ch.ID,
			"aes_key":    rawKey,
		})
		msg := &models.WSMessage{Type: "channel_key", Payload: payload}
		writeCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		_ = wsjson.Write(writeCtx, c.conn, msg)
		cancel()
	}
}

// handleMessage routes inbound WSS frames.
func (c *Client) handleMessage(ctx context.Context, msg *models.WSMessage) error {
	switch msg.Type {
	case "message":
		return c.handleChatMessage(msg)
	case "read_receipt":
		return c.handleReadReceipt(msg)
	case "ping":
		return c.hub.store.SetPresence(c.UserID, "online")
	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}
}

// handleChatMessage persists and broadcasts an incoming encrypted chat message.
func (c *Client) handleChatMessage(raw *models.WSMessage) error {
	var body struct {
		ChannelID   string             `json:"channel_id"`
		Type        models.MessageType `json:"type"`
		Ciphertext  []byte             `json:"ciphertext"`
		Nonce       []byte             `json:"nonce"`
		Compression string             `json:"compression"`
	}
	if err := json.Unmarshal(raw.Payload, &body); err != nil {
		return fmt.Errorf("invalid message payload: %w", err)
	}
	if body.ChannelID == "" || body.Ciphertext == nil {
		return fmt.Errorf("missing channel_id or ciphertext")
	}
	if body.Type == "" {
		body.Type = models.MessageTypeText
	}
	if body.Compression == "" {
		body.Compression = "none"
	}

	// Membership check
	uc, err := c.hub.store.GetUserChannel(c.UserID, body.ChannelID)
	if err != nil || uc.Status != models.StatusActive {
		return fmt.Errorf("not an active member of channel: %s", body.ChannelID)
	}

	msg := &models.Message{
		ID:          fmt.Sprintf("%d", time.Now().UnixNano()),
		ChannelID:   body.ChannelID,
		SenderID:    c.UserID,
		Type:        body.Type,
		Ciphertext:  body.Ciphertext,
		Nonce:       body.Nonce,
		Compression: body.Compression,
		SentAt:      time.Now().UTC(),
	}
	if err := c.hub.store.SaveMessage(msg); err != nil {
		return fmt.Errorf("persist message: %w", err)
	}

	outPayload, _ := json.Marshal(msg)
	outMsg := &models.WSMessage{Type: "message", Payload: outPayload}
	c.hub.broadcast <- &envelope{
		channelID: body.ChannelID,
		senderID:  c.UserID,
		msg:       outMsg,
	}
	return nil
}

// handleReadReceipt updates the last read timestamp for the channel.
func (c *Client) handleReadReceipt(raw *models.WSMessage) error {
	var body struct {
		ChannelID string `json:"channel_id"`
	}
	if err := json.Unmarshal(raw.Payload, &body); err != nil {
		return fmt.Errorf("invalid read_receipt payload: %w", err)
	}
	if body.ChannelID == "" {
		return fmt.Errorf("missing channel_id")
	}
	return c.hub.store.UpdateChannelRead(c.UserID, body.ChannelID)
}
