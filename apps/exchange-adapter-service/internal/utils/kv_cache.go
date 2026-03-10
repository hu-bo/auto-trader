package utils

import (
	"strings"
	"sync"
	"time"
)

type cacheItem[T any] struct {
	value     T
	expiresAt time.Time
}

// Cache is a small in-memory KV store with optional TTL.
// ttl == 0 means permanent.
type Cache[T any] struct {
	mu    sync.RWMutex
	items map[string]cacheItem[T]
}

func NewCache[T any]() *Cache[T] {
	return &Cache[T]{items: make(map[string]cacheItem[T])}
}

func JoinKey(prefix, key string) string {
	p := strings.TrimSpace(prefix)
	k := strings.TrimSpace(key)
	if p == "" {
		return k
	}
	if k == "" {
		return p
	}
	return p + ":" + k
}

func (c *Cache[T]) Set(key string, value T, ttl time.Duration) {
	if c == nil {
		return
	}
	exp := time.Time{}
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}
	c.mu.Lock()
	if c.items == nil {
		c.items = make(map[string]cacheItem[T])
	}
	c.items[key] = cacheItem[T]{value: value, expiresAt: exp}
	c.mu.Unlock()
}

func (c *Cache[T]) SetWithPrefix(prefix, key string, value T, ttl time.Duration) {
	c.Set(JoinKey(prefix, key), value, ttl)
}

func (c *Cache[T]) SetIfAbsent(key string, value T, ttl time.Duration) bool {
	if c == nil {
		return false
	}
	now := time.Now()
	exp := time.Time{}
	if ttl > 0 {
		exp = now.Add(ttl)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.items == nil {
		c.items = make(map[string]cacheItem[T])
	}
	if existing, ok := c.items[key]; ok && !existing.isExpired(now) {
		return false
	}
	c.items[key] = cacheItem[T]{value: value, expiresAt: exp}
	return true
}

func (c *Cache[T]) Get(key string) (T, bool) {
	var zero T
	if c == nil {
		return zero, false
	}
	c.mu.RLock()
	item, ok := c.items[key]
	c.mu.RUnlock()
	if !ok {
		return zero, false
	}
	if item.isExpired(time.Now()) {
		c.mu.Lock()
		item, ok = c.items[key]
		if ok && item.isExpired(time.Now()) {
			delete(c.items, key)
			c.mu.Unlock()
			return zero, false
		}
		c.mu.Unlock()
	}
	return item.value, true
}

func (c *Cache[T]) GetWithPrefix(prefix, key string) (T, bool) {
	return c.Get(JoinKey(prefix, key))
}

func (c *Cache[T]) Delete(key string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	delete(c.items, key)
	c.mu.Unlock()
}

func (c *Cache[T]) Replace(items map[string]T, ttl time.Duration) {
	if c == nil {
		return
	}
	exp := time.Time{}
	if ttl > 0 {
		exp = time.Now().Add(ttl)
	}
	next := make(map[string]cacheItem[T], len(items))
	for k, v := range items {
		next[k] = cacheItem[T]{value: v, expiresAt: exp}
	}
	c.mu.Lock()
	c.items = next
	c.mu.Unlock()
}

func (c *Cache[T]) Snapshot() map[string]T {
	if c == nil {
		return map[string]T{}
	}
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make(map[string]T, len(c.items))
	for k, v := range c.items {
		if v.isExpired(now) {
			delete(c.items, k)
			continue
		}
		out[k] = v.value
	}
	return out
}

func (c *Cache[T]) Range(fn func(key string, value T) bool) {
	if fn == nil {
		return
	}
	for k, v := range c.Snapshot() {
		if !fn(k, v) {
			return
		}
	}
}

func (i cacheItem[T]) isExpired(now time.Time) bool {
	if i.expiresAt.IsZero() {
		return false
	}
	return now.After(i.expiresAt)
}
