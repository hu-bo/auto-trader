package core

import (
	"sync"
	"time"
)

type cacheItem[T any] struct {
	value      T
	expiryTime time.Time
}

type Cache[T any] struct {
	mu                sync.Mutex
	data              map[string]cacheItem[T]
	defaultExpiryTime time.Duration
}

func NewCache[T any](defaultExpiry time.Duration) *Cache[T] {
	if defaultExpiry <= 0 {
		defaultExpiry = time.Minute
	}
	return &Cache[T]{
		data:              make(map[string]cacheItem[T]),
		defaultExpiryTime: defaultExpiry,
	}
}

func (c *Cache[T]) Set(key string, value T, expiry time.Duration) {
	if expiry <= 0 {
		expiry = c.defaultExpiryTime
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[key] = cacheItem[T]{value: value, expiryTime: time.Now().Add(expiry)}
}

func (c *Cache[T]) Get(key string) (T, bool) {
	var zero T

	c.mu.Lock()
	defer c.mu.Unlock()

	c.cleanupLocked()

	item, ok := c.data[key]
	if !ok {
		return zero, false
	}
	return item.value, true
}

func (c *Cache[T]) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data = make(map[string]cacheItem[T])
}

func (c *Cache[T]) cleanupLocked() {
	now := time.Now()
	for k, item := range c.data {
		if !item.expiryTime.After(now) {
			delete(c.data, k)
		}
	}
}
