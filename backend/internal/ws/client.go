package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"nodetalk/backend/internal/models"
	"nodetalk/backend/internal/store"
)

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
	case "message_edit":
		return c.handleEditMessage(msg)
	case "message_delete":
		return c.handleDeleteMessage(msg)
	case "read_receipt":
		return c.handleReadReceipt(msg)
	case "ping":
		return c.hub.store.SetPresence(c.UserID, "online")
	default:
		return fmt.Errorf("unknown message type: %s", msg.Type)
	}
}
