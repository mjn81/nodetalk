package store

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"nodetalk/internal/crypto"
	"nodetalk/internal/db"
	"nodetalk/internal/models"
)

// Store wraps the DB with all NodeTalk repository logic — users, channels,
// messages, presence, and files.
type Store struct {
	db *db.DB
}

// New creates a Store backed by the given DB.
func New(database *db.DB) *Store {
	return &Store{db: database}
}

// ============================================================
//  Users
// ============================================================

// CreateUser hashes the password and persists a new User record.
// Returns ErrConflict if the user ID already exists.
func (s *Store) CreateUser(username, password, domain string) (*models.User, error) {
	id := uuid.New().String()
	pwdHash, err := crypto.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("store: password hashing failed: %w", err)
	}
	u := &models.User{
		ID:        id,
		Username:  username,
		PwdHash:   pwdHash,
		Domain:    domain,
		Status:    "offline",
		CreatedAt: time.Now().UTC(),
	}
	if err := s.db.SetUser(u); err != nil {
		return nil, err
	}
	return u, nil
}

// GetUser retrieves a user by ID.
func (s *Store) GetUser(id string) (*models.User, error) {
	return s.db.GetUser(id)
}

// GetUserByUsername scans all users to find one with a matching username.
// For production scale, add a username→id secondary index.
func (s *Store) GetUserByUsername(username string) (*models.User, error) {
	users, err := s.db.ListUsers()
	if err != nil {
		return nil, err
	}
	for _, u := range users {
		if u.Username == username {
			return u, nil
		}
	}
	return nil, db.ErrNotFound
}

// AuthenticateUser looks up u by username and verifies the password.
// Returns the user record on success, or an error.
func (s *Store) AuthenticateUser(username, password string) (*models.User, error) {
	u, err := s.GetUserByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("store: user not found")
	}
	ok, err := crypto.VerifyPassword(password, u.PwdHash)
	if err != nil {
		return nil, fmt.Errorf("store: password verification error: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("store: invalid credentials")
	}
	return u, nil
}

// ============================================================
//  Channels
// ============================================================

// CreateChannel creates a new channel (DM or group), generates its AES-256
// channel key, encrypts it with the server KEK, and writes the junction index
// entries for all initial members.
func (s *Store) CreateChannel(name, creatorID string, memberIDs []string, kek []byte) (*models.Channel, error) {
	// Generate a fresh AES-256 key for this channel.
	rawKey, err := crypto.GenerateAES256Key()
	if err != nil {
		return nil, fmt.Errorf("store: channel key generation failed: %w", err)
	}
	encKey, err := crypto.EncryptAES256GCM(kek, rawKey)
	if err != nil {
		return nil, fmt.Errorf("store: channel key encryption failed: %w", err)
	}

	ch := &models.Channel{
		ID:              uuid.New().String(),
		Name:            name,
		CreatorID:       creatorID,
		Members:         memberIDs,
		AESKeyEncrypted: encKey,
		CreatedAt:       time.Now().UTC(),
	}
	if err := s.db.SetChannel(ch); err != nil {
		return nil, err
	}

	// Write junction index entries for every member.
	for _, uid := range memberIDs {
		if err := s.db.SetUserChannel(uid, ch.ID); err != nil {
			return nil, fmt.Errorf("store: failed to index member %s: %w", uid, err)
		}
	}
	return ch, nil
}

// GetChannel retrieves a channel by ID.
func (s *Store) GetChannel(id string) (*models.Channel, error) {
	return s.db.GetChannel(id)
}

// AddMemberToChannel adds a user to an existing channel and updates the index.
func (s *Store) AddMemberToChannel(channelID, userID string) error {
	ch, err := s.db.GetChannel(channelID)
	if err != nil {
		return err
	}
	for _, m := range ch.Members {
		if m == userID {
			return nil // already a member
		}
	}
	ch.Members = append(ch.Members, userID)
	if err := s.db.SetChannel(ch); err != nil {
		return err
	}
	return s.db.SetUserChannel(userID, channelID)
}

// ListUserChannels returns all channels a user belongs to.
func (s *Store) ListUserChannels(userID string) ([]*models.Channel, error) {
	return s.db.ListUserChannels(userID)
}

// DecryptChannelKey decrypts and returns the raw AES key for a channel.
func (s *Store) DecryptChannelKey(ch *models.Channel, kek []byte) ([]byte, error) {
	return crypto.DecryptAES256GCM(kek, ch.AESKeyEncrypted)
}

// ============================================================
//  Messages
// ============================================================

// SaveMessage persists an encrypted message to BadgerDB.
func (s *Store) SaveMessage(msg *models.Message) error {
	return s.db.SetMessage(msg)
}

// ListMessages returns recent messages for a channel, newest-first, up to limit.
func (s *Store) ListMessages(channelID string, limit int) ([]*models.Message, error) {
	return s.db.ListMessages(channelID, limit)
}

// ============================================================
//  Presence
// ============================================================

// SetPresence upserts a presence record for a user.
func (s *Store) SetPresence(userID, status string) error {
	return s.db.SetPresence(userID, &models.Presence{
		LastSeen:      time.Now().UTC(),
		CurrentStatus: status,
	})
}

// GetPresence returns the current presence for a user.
func (s *Store) GetPresence(userID string) (*models.Presence, error) {
	return s.db.GetPresence(userID)
}

// ============================================================
//  Files
// ============================================================

// RegisterFile persists file metadata after a successful upload.
func (s *Store) RegisterFile(ownerID, mime, storagePath string, size int64) (*models.File, error) {
	f := &models.File{
		ID:          uuid.New().String(),
		OwnerID:     ownerID,
		SizeBytes:   size,
		MIMEType:    mime,
		StoragePath: storagePath,
		UploadedAt:  time.Now().UTC(),
	}
	if err := s.db.SetFile(f); err != nil {
		return nil, err
	}
	return f, nil
}
