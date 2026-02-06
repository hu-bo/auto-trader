package session

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"
	"time"
)

const (
	ErrCodeTokenNotFound = "TOKEN_NOT_FOUND"
	ErrCodeTokenExpired  = "TOKEN_EXPIRED"
)

type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func IsErrorCode(err error, code string) bool {
	var e *Error
	if !errors.As(err, &e) {
		return false
	}
	return e.Code == code
}

type entry struct {
	cfg       AccountConfig
	createdAt time.Time
	expiresAt time.Time
}

type Store struct {
	mu sync.RWMutex
	m  map[string]entry

	ttl             time.Duration
	cleanupInterval time.Duration

	onDelete func(token string, cfg AccountConfig)
}

func NewStore(ttl, cleanupInterval time.Duration) *Store {
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	if cleanupInterval <= 0 {
		cleanupInterval = 60 * time.Minute
	}
	return &Store{
		m:               make(map[string]entry),
		ttl:             ttl,
		cleanupInterval: cleanupInterval,
	}
}

func (s *Store) SetOnDelete(fn func(token string, cfg AccountConfig)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.onDelete = fn
}

func (s *Store) Create(cfg AccountConfig) (string, error) {
	token := s.newToken()
	now := time.Now()

	s.mu.Lock()
	// Extremely unlikely collision; retry a few times.
	for i := 0; i < 3; i++ {
		if _, ok := s.m[token]; !ok {
			break
		}
		token = s.newToken()
	}
	if _, ok := s.m[token]; ok {
		s.mu.Unlock()
		return "", &Error{Code: "TOKEN_COLLISION", Message: "failed to generate unique token"}
	}
	s.m[token] = entry{
		cfg:       cfg,
		createdAt: now,
		expiresAt: now.Add(s.ttl),
	}
	s.mu.Unlock()

	return token, nil
}

func (s *Store) Get(token string) (AccountConfig, error) {
	if token == "" {
		return AccountConfig{}, &Error{Code: ErrCodeTokenNotFound, Message: "token is empty"}
	}

	s.mu.RLock()
	ent, ok := s.m[token]
	s.mu.RUnlock()
	if !ok {
		return AccountConfig{}, &Error{Code: ErrCodeTokenNotFound, Message: "token not found"}
	}
	if time.Now().After(ent.expiresAt) {
		_ = s.Delete(token)
		return AccountConfig{}, &Error{Code: ErrCodeTokenExpired, Message: "token expired"}
	}
	return ent.cfg, nil
}

func (s *Store) Delete(token string) bool {
	if token == "" {
		return false
	}

	var (
		cfg      AccountConfig
		deleted  bool
		onDelete func(string, AccountConfig)
	)

	s.mu.Lock()
	ent, ok := s.m[token]
	if ok {
		delete(s.m, token)
		cfg = ent.cfg
		deleted = true
	}
	onDelete = s.onDelete
	s.mu.Unlock()

	if deleted && onDelete != nil {
		onDelete(token, cfg)
	}
	return deleted
}

func (s *Store) Validate(token string) (AccountConfig, bool) {
	cfg, err := s.Get(token)
	if err != nil {
		return AccountConfig{}, false
	}
	return cfg, true
}

func (s *Store) StartCleanup(ctx context.Context) {
	t := time.NewTicker(s.cleanupInterval)
	go func() {
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				s.cleanupExpired()
			}
		}
	}()
}

func (s *Store) cleanupExpired() {
	now := time.Now()

	type deletedEntry struct {
		token string
		cfg   AccountConfig
	}
	var deleted []deletedEntry

	s.mu.Lock()
	for token, ent := range s.m {
		if now.After(ent.expiresAt) {
			delete(s.m, token)
			deleted = append(deleted, deletedEntry{token: token, cfg: ent.cfg})
		}
	}
	onDelete := s.onDelete
	s.mu.Unlock()

	if onDelete == nil {
		return
	}
	for _, d := range deleted {
		onDelete(d.token, d.cfg)
	}
}

func (s *Store) newToken() string {
	// 32 bytes => 43 chars base64url (no padding). Enough for session keying.
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// Extremely unlikely; fallback to time-based token.
		now := time.Now().UnixNano()
		return fmt.Sprintf("t_%d", now)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
