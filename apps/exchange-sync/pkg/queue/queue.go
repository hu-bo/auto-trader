package queue

import (
	"context"
	"sync"
)

// TaskQueue 任务队列
type TaskQueue[T any] struct {
	tasks   chan T
	workers int
	handler func(T) error
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
}

// NewTaskQueue 创建任务队列
func NewTaskQueue[T any](bufferSize, workers int, handler func(T) error) *TaskQueue[T] {
	ctx, cancel := context.WithCancel(context.Background())
	tq := &TaskQueue[T]{
		tasks:   make(chan T, bufferSize),
		workers: workers,
		handler: handler,
		ctx:     ctx,
		cancel:  cancel,
	}

	for i := 0; i < workers; i++ {
		tq.wg.Add(1)
		go tq.worker()
	}

	return tq
}

// Submit 提交任务
func (tq *TaskQueue[T]) Submit(task T) bool {
	select {
	case tq.tasks <- task:
		return true
	case <-tq.ctx.Done():
		return false
	}
}

// Stop 停止任务队列
func (tq *TaskQueue[T]) Stop() {
	tq.cancel()
	close(tq.tasks)
	tq.wg.Wait()
}

func (tq *TaskQueue[T]) worker() {
	defer tq.wg.Done()

	for {
		select {
		case task, ok := <-tq.tasks:
			if !ok {
				return
			}
			_ = tq.handler(task)
		case <-tq.ctx.Done():
			// 处理剩余任务
			for task := range tq.tasks {
				_ = tq.handler(task)
			}
			return
		}
	}
}
