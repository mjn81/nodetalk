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

// ListAllChannels scans and returns all channels in the database.
func (d *DB) ListAllChannels() ([]*models.Channel, error) {
	var channels []*models.Channel
	err := d.bdb.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.Prefix = []byte(prefixChannel)
		it := txn.NewIterator(opts)
		defer it.Close()
		for it.Rewind(); it.Valid(); it.Next() {
			var ch models.Channel
			if err := it.Item().Value(func(val []byte) error {
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

// SetUserChannel writes the junction index entry for a user↔channel mapping.
func (d *DB) SetUserChannel(userID, channelID string) error {
	uc := models.UserChannel{JoinedAt: time.Now().UTC()}
	return d.set(ucKey(userID, channelID), uc)
}

// DeleteUserChannel removes the junction index entry for a user↔channel mapping.
func (d *DB) DeleteUserChannel(userID, channelID string) error {
	return d.bdb.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte(ucKey(userID, channelID)))
	})
}

// UpdateUserChannelReadTime updates the last read timestamp for a user in a channel.
func (d *DB) UpdateUserChannelReadTime(userID, channelID string, t time.Time) error {
	var uc models.UserChannel
	err := d.get(ucKey(userID, channelID), &uc)
	if err != nil {
		uc = models.UserChannel{JoinedAt: time.Now().UTC()}
	}
	uc.LastReadAt = t
	return d.set(ucKey(userID, channelID), uc)
}

// CountUnreadMessages counts how many messages in a channel are strictly newer than the user's LastReadAt.
func (d *DB) CountUnreadMessages(userID, channelID string) (int, error) {
	var uc models.UserChannel
	if err := d.get(ucKey(userID, channelID), &uc); err != nil {
		return 0, nil // If no index exists, 0 unread.
	}
	// If never read, consider all as unread, but we only scan up to what Badger finds.
	var lastReadUnix int64 = 0
	if !uc.LastReadAt.IsZero() {
		lastReadUnix = uc.LastReadAt.UnixNano()
	}

	count := 0
	prefix := []byte(fmt.Sprintf("%s%s:", prefixMessage, channelID))
	err := d.bdb.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.Prefix = prefix
		it := txn.NewIterator(opts)
		defer it.Close()

		seekKey := []byte(fmt.Sprintf("%s%s:%019d", prefixMessage, channelID, lastReadUnix+1))
		for it.Seek(seekKey); it.Valid(); it.Next() {
			count++
		}
		return nil
	})
	return count, err
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
// If before > 0, it strictly returns messages older than that Unix timestamp.
func (d *DB) ListMessages(channelID string, before int64, limit int) ([]*models.Message, error) {
	prefix := []byte(fmt.Sprintf("%s%s:", prefixMessage, channelID))
	var msgs []*models.Message

	err := d.bdb.View(func(txn *badger.Txn) error {
		opts := badger.DefaultIteratorOptions
		opts.Reverse = true
		opts.Prefix = prefix
		it := txn.NewIterator(opts)
		defer it.Close()

		var seekKey []byte
		if before > 0 {
			// To get messages strictly older than 'before', we seek to before-1
			seekKey = []byte(fmt.Sprintf("%s%s:%019d", prefixMessage, channelID, before-1))
		} else {
			// Seed with the lexicographically largest key in this prefix range
			seekKey = append(append([]byte{}, prefix...), 0xFF)
		}

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

// DeletePresence deletes a Presence record.
func (d *DB) DeletePresence(userID string) error {
	return d.bdb.Update(func(txn *badger.Txn) error {
		return txn.Delete([]byte(presenceKey(userID)))
	})
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
