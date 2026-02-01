package wsconn

import (
	"sync"
)

// Subscription 订阅管理器 (线程安全)
type Subscription struct {
	items map[string]struct{}
	mu    sync.RWMutex
}

// NewSubscription 创建订阅管理器
func NewSubscription() *Subscription {
	return &Subscription{
		items: make(map[string]struct{}),
	}
}

// Add 添加订阅项，返回新增的项
func (s *Subscription) Add(keys ...string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	added := make([]string, 0, len(keys))
	for _, key := range keys {
		if _, exists := s.items[key]; !exists {
			s.items[key] = struct{}{}
			added = append(added, key)
		}
	}
	return added
}

// Remove 移除订阅项
func (s *Subscription) Remove(keys ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, key := range keys {
		delete(s.items, key)
	}
}

// Has 检查是否已订阅
func (s *Subscription) Has(key string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, exists := s.items[key]
	return exists
}

// List 获取所有订阅项
func (s *Subscription) List() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]string, 0, len(s.items))
	for key := range s.items {
		result = append(result, key)
	}
	return result
}
