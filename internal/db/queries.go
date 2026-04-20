package db

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"nodetalk/internal/models"
)

// ============================================================
//  Users
// ============================================================

// SetUser writes a User record to BadgerDB.
func (d *DB) SetUser(u *models.User) error {
	return d.set(userKey(u.ID), u)
}

// GetUser retrieves a User by ID.
func (d *DB) GetUser(id string) (*models.User, error) {
	var u models.User
	if err := d.get(userKey(id), &u); err != nil {
		return nil, err
	}
	return &u, nil
}

// ListUsers returns every user stored in the database.
// This is a full scan — add a username→id index if the user count grows large.
func (d *DB) ListUsers() ([]*models.User, error) {
	var users []*models.User
	err := d.bdb.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.Prefix = []byte(prefixUser)
		it := txn.NewIterator(opts)
		defer it.Close()
		for it.Rewind(); it.Valid(); it.Next() {
			var u models.User
			if err := it.Item().Value(func(val []byte) error {
				return json.Unmarshal(val, &u)
			}); err != nil {
				return err
			}
			users = append(users, &u)
		}
		return nil
	})
	return users, err
}

// ============================================================
//  Channels
// ============================================================

// SetChannel writes a Channel record to BadgerDB.
func (d *DB) SetChannel(ch *models.Channel) error {
	return d.set(channelKey(ch.ID), ch)
}

// GetChannel retrieves a Channel by ID.
func (d *DB) GetChannel(id string) (*models.Channel, error) {
	var ch models.Channel
	if err := d.get(channelKey(id), &ch); err != nil {
		return nil, err
	}
	return &ch, nil
}

// SetUserChannel writes the junction index entry for a user↔channel mapping.
func (d *DB) SetUserChannel(userID, channelID string) error {
	uc := models.UserChannel{JoinedAt: time.Now().UTC()}
	return d.set(ucKey(userID, channelID), uc)
}

// ListUserChannels fetches all channels a user belongs to by scanning the
// uc:{user_id}: prefix and then resolving each channel record.
func (d *DB) ListUserChannels(userID string) ([]*models.Channel, error) {
	prefix := prefixUserChannel + userID + ":"
	var channels []*models.Channel

	err := d.bdb.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.PrefetchValues = false // keys only for the index scan
		opts.Prefix = []byte(prefix)
		it := txn.NewIterator(opts)
		defer it.Close()

		for it.Rewind(); it.Valid(); it.Next() {
			rawKey := string(it.Item().Key())
			// Extract channelID from "uc:{uid}:{cid}"
			parts := strings.SplitN(rawKey, ":", 3)
			if len(parts) != 3 {
				continue
			}
			channelID := parts[2]

			var ch models.Channel
			item, err := txn.Get([]byte(channelKey(channelID)))
			if errors.Is(err, badger.ErrKeyNotFound) {
				continue // Orphan index — skip gracefully.
			}
			if err != nil {
				return err
			}
			if err := item.Value(func(val []byte) error {
				return json.Unmarshal(val, &ch)
			}); err != nil {
				return err
			}
			channels = append(channels, &ch)
		}
		return nil
	})
	return channels, err
}

// ============================================================
//  Messages
// ============================================================

// SetMessage writes a message record to BadgerDB using a time-ordered key.
func (d *DB) SetMessage(msg *models.Message) error {
	key := fmt.Sprintf("%s%s:%019d", prefixMessage, msg.ChannelID, msg.SentAt.UnixNano())
	return d.set(key, msg)
}

// ListMessages returns up to `limit` messages for a channel, newest-first.
func (d *DB) ListMessages(channelID string, limit int) ([]*models.Message, error) {
	prefix := []byte(fmt.Sprintf("%s%s:", prefixMessage, channelID))
	var msgs []*models.Message

	err := d.bdb.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.Reverse = true
		opts.Prefix = prefix
		it := txn.NewIterator(opts)
		defer it.Close()

		// For reverse iteration, seed with the lexicographically largest key
		// in this prefix range (append 0xFF bytes).
		seekKey := append(append([]byte{}, prefix...), 0xFF)
		for it.Seek(seekKey); it.Valid() && len(msgs) < limit; it.Next() {
			var m models.Message
			if err := it.Item().Value(func(val []byte) error {
				return json.Unmarshal(val, &m)
			}); err != nil {
				return err
			}
			msgs = append(msgs, &m)
		}
		return nil
	})
	return msgs, err
}

// ============================================================
//  Presence
// ============================================================

// SetPresence writes a Presence record for a user.
func (d *DB) SetPresence(userID string, p *models.Presence) error {
	return d.set(presenceKey(userID), p)
}

// GetPresence retrieves a Presence record for a user.
func (d *DB) GetPresence(userID string) (*models.Presence, error) {
	var p models.Presence
	if err := d.get(presenceKey(userID), &p); err != nil {
		return nil, err
	}
	return &p, nil
}

// ============================================================
//  Files
// ============================================================

// SetFile writes a File metadata record to BadgerDB.
func (d *DB) SetFile(f *models.File) error {
	return d.set(fileKey(f.ID), f)
}

// GetFile retrieves a File metadata record by ID.
func (d *DB) GetFile(id string) (*models.File, error) {
	var f models.File
	if err := d.get(fileKey(id), &f); err != nil {
		return nil, err
	}
	return &f, nil
}
