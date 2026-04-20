package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
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
		ch, err := h.store.GetChannel(env.channelID)
		if err != nil {
			h.mu.RUnlock()
			continue
		}
		for _, memberID := range ch.Members {
			if c, ok := h.clients[memberID]; ok {
				select {
				case c.send <- env:
				default:
					// Slow receiver — drop the message instead of blocking.
					log.Printf("ws: slow receiver %s, message dropped", memberID)
				}
			}
		}
		h.mu.RUnlock()
	}
}

// ServeHTTP upgrades an HTTP request to a WebSocket connection.
// Authentication is done via a `token` query parameter (sent on the initial
// upgrade request before headers are exhausted).
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
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
		InsecureSkipVerify: true, // Allow all origins for now; tighten in prod.
	})
	if err != nil {
		log.Printf("ws: upgrade failed for user %s: %v", session.UserID, err)
		return
	}

	client := &Client{
		UserID:   session.UserID,
		Username: session.Username,
		conn:     conn,
		send:     make(chan *envelope, 64),
		hub:      h,
	}
	h.register(client)
	defer h.unregister(client)

	// Signal online presence.
	_ = h.store.SetPresence(session.UserID, "online")

	// On connect: push all channel keys for this user's channels.
	go client.writeChannelKeys(h.store, h.kek)

	ctx := conn.CloseRead(context.Background())

	// Write pump — drains the send channel to the WebSocket.
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case env, ok := <-client.send:
				if !ok {
					return
				}
				if err := wsjson.Write(ctx, conn, env.msg); err != nil {
					return
				}
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
}

func (h *Hub) register(c *Client) {
	h.mu.Lock()
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

// ---- Client Methods -------------------------------------------------------- //

// writeChannelKeys pushes all decrypted channel keys to the client over WSS
// immediately after connect, so the client can decrypt incoming messages.
func (c *Client) writeChannelKeys(s *store.Store, kek []byte) {
	channels, err := s.ListUserChannels(c.UserID)
	if err != nil {
		return
	}
	for _, ch := range channels {
		rawKey, err := s.DecryptChannelKey(ch, kek)
		if err != nil {
			continue
		}
		payload, _ := json.Marshal(map[string]any{
			"channel_id": ch.ID,
			"aes_key":    rawKey, // Raw bytes — client stores in memory only
		})
		msg := &models.WSMessage{Type: "channel_key", Payload: payload}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = wsjson.Write(ctx, c.conn, msg)
		cancel()
	}
}

// handleMessage routes inbound WSS messages to the appropriate handler.
func (c *Client) handleMessage(ctx context.Context, msg *models.WSMessage) error {
	switch msg.Type {
	case "message":
		return c.handleChatMessage(ctx, msg)
	case "ping":
		// Update presence on heartbeat.
		return c.hub.store.SetPresence(c.UserID, "online")
	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}
}

// handleChatMessage persists and broadcasts an incoming encrypted chat message.
func (c *Client) handleChatMessage(_ context.Context, raw *models.WSMessage) error {
	var body struct {
		ChannelID  string          `json:"channel_id"`
		Type       models.MessageType `json:"type"`
		Ciphertext []byte          `json:"ciphertext"`
		Nonce      []byte          `json:"nonce"`
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

	msg := &models.Message{
		ID:         fmt.Sprintf("%d", time.Now().UnixNano()),
		ChannelID:  body.ChannelID,
		SenderID:   c.UserID,
		Type:       body.Type,
		Ciphertext: body.Ciphertext,
		Nonce:      body.Nonce,
		SentAt:     time.Now().UTC(),
	}
	if err := c.hub.store.SaveMessage(msg); err != nil {
		return fmt.Errorf("persist message: %w", err)
	}

	// Broadcast the opaque message to all channel members.
	outPayload, _ := json.Marshal(msg)
	outMsg := &models.WSMessage{Type: "message", Payload: outPayload}
	c.hub.broadcast <- &envelope{
		channelID: body.ChannelID,
		senderID:  c.UserID,
		msg:       outMsg,
	}
	return nil
}
