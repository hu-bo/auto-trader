package utils

import (
	"context"
	"sync"
	"time"
)

// BatchProcessor 批量处理器
type BatchProcessor[T any] struct {
	batchSize int
	interval  time.Duration
	handler   func([]T) error
	buffer    []T
	mu        sync.Mutex
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	flushCh   chan struct{}
}

// NewBatchProcessor 创建批量处理器
func NewBatchProcessor[T any](batchSize int, interval time.Duration, handler func([]T) error) *BatchProcessor[T] {
	ctx, cancel := context.WithCancel(context.Background())
	bp := &BatchProcessor[T]{
		batchSize: batchSize,
		interval:  interval,
		handler:   handler,
		buffer:    make([]T, 0, batchSize),
		ctx:       ctx,
		cancel:    cancel,
		flushCh:   make(chan struct{}, 1),
	}

	bp.wg.Add(1)
	go bp.runFlusher()

	return bp
}

// Add 添加数据到批量缓冲区
func (bp *BatchProcessor[T]) Add(item T) {
	bp.mu.Lock()
	bp.buffer = append(bp.buffer, item)
	shouldFlush := len(bp.buffer) >= bp.batchSize
	bp.mu.Unlock()

	if shouldFlush {
		select {
		case bp.flushCh <- struct{}{}:
		default:
		}
	}
}

// AddBatch 批量添加数据
func (bp *BatchProcessor[T]) AddBatch(items []T) {
	bp.mu.Lock()
	bp.buffer = append(bp.buffer, items...)
	shouldFlush := len(bp.buffer) >= bp.batchSize
	bp.mu.Unlock()

	if shouldFlush {
		select {
		case bp.flushCh <- struct{}{}:
		default:
		}
	}
}

// Flush 立即刷新缓冲区
func (bp *BatchProcessor[T]) Flush() error {
	bp.mu.Lock()
	if len(bp.buffer) == 0 {
		bp.mu.Unlock()
		return nil
	}
	items := bp.buffer
	bp.buffer = make([]T, 0, bp.batchSize)
	bp.mu.Unlock()

	return bp.handler(items)
}

// Stop 停止处理器并刷新剩余数据
func (bp *BatchProcessor[T]) Stop() error {
	bp.cancel()
	bp.wg.Wait()
	return bp.Flush()
}

func (bp *BatchProcessor[T]) runFlusher() {
	defer bp.wg.Done()

	ticker := time.NewTicker(bp.interval)
	defer ticker.Stop()

	for {
		select {
		case <-bp.ctx.Done():
			return
		case <-ticker.C:
			_ = bp.Flush()
		case <-bp.flushCh:
			_ = bp.Flush()
		}
	}
}

// RateLimiter 速率限制器
type RateLimiter struct {
	interval time.Duration
	lastTime time.Time
	mu       sync.Mutex
}

// NewRateLimiter 创建速率限制器
func NewRateLimiter(interval time.Duration) *RateLimiter {
	return &RateLimiter{
		interval: interval,
	}
}

// Wait 等待直到可以执行
func (rl *RateLimiter) Wait(ctx context.Context) error {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	if rl.lastTime.IsZero() {
		rl.lastTime = now
		return nil
	}

	elapsed := now.Sub(rl.lastTime)
	if elapsed < rl.interval {
		waitTime := rl.interval - elapsed
		select {
		case <-time.After(waitTime):
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	rl.lastTime = time.Now()
	return nil
}

// Throttler 节流器：在指定时间间隔内只执行一次
// 非阻塞，超过频率的调用会被丢弃
type Throttler struct {
	interval time.Duration
	lastTime time.Time
	mu       sync.Mutex
}

// NewThrottler 创建节流器
func NewThrottler(interval time.Duration) *Throttler {
	return &Throttler{
		interval: interval,
	}
}

// TryExecute 尝试执行函数，如果距离上次执行未超过 interval 则跳过
// 返回 true 表示函数被执行，false 表示被节流跳过
func (t *Throttler) TryExecute(fn func()) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	if now.Sub(t.lastTime) < t.interval {
		return false
	}

	t.lastTime = now
	fn()
	return true
}

// KeyedThrottler 带 key 的节流器：每个 key 独立计时
type KeyedThrottler struct {
	interval time.Duration
	lastTime map[string]time.Time
	mu       sync.Mutex
}

// NewKeyedThrottler 创建带 key 的节流器
func NewKeyedThrottler(interval time.Duration) *KeyedThrottler {
	return &KeyedThrottler{
		interval: interval,
		lastTime: make(map[string]time.Time),
	}
}

// TryExecute 尝试执行函数，如果该 key 距离上次执行未超过 interval 则跳过
func (t *KeyedThrottler) TryExecute(key string, fn func()) bool {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	if now.Sub(t.lastTime[key]) < t.interval {
		return false
	}

	t.lastTime[key] = now
	fn()
	return true
}
