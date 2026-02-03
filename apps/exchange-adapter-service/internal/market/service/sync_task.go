package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	exchange "github.com/pkg/exchange-adapter/marketdata"
	"github.com/pkg/logger"
)

var logTask = logger.Module("sync-task")

// TaskStatus 任务状态
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusCancelled TaskStatus = "cancelled"
)

// SyncTask 同步任务
type SyncTask struct {
	ID          string // 任务ID: exchange:symbol:tradeType
	Exchange    exchange.ExchangeName
	Symbol      string
	TradeType   exchange.TradeType
	SymbolInfo  exchange.SymbolInfo
	Status      TaskStatus
	Error       error
	CreatedAt   time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
	CancelFunc  context.CancelFunc
}

// TaskKey 生成任务唯一标识
func TaskKey(exchangeName exchange.ExchangeName, symbol string, tradeType exchange.TradeType) string {
	return fmt.Sprintf("%s:%s:%s", exchangeName, symbol, tradeType)
}

// SyncTaskCallback 任务完成回调
type SyncTaskCallback func(task *SyncTask)

// SyncTaskManager 同步任务管理器
// 统一管理历史数据同步任务，支持批量添加、动态取消、完成回调
type SyncTaskManager struct {
	// 同步执行器 (由 HistorySyncService 提供)
	syncExecutor func(ctx context.Context, exchangeName exchange.ExchangeName, info exchange.SymbolInfo) error

	// 任务完成回调
	onTaskComplete SyncTaskCallback

	// 任务存储
	tasks   map[string]*SyncTask
	tasksMu sync.RWMutex

	// 任务队列
	taskQueue chan *SyncTask

	// 并发控制
	concurrency int
	workerWg    sync.WaitGroup

	// 生命周期
	ctx    context.Context
	cancel context.CancelFunc
	closed bool
}

// SyncTaskManagerConfig 配置
type SyncTaskManagerConfig struct {
	Concurrency int // 并发数，默认 5
	QueueSize   int // 队列大小，默认 1000
}

// NewSyncTaskManager 创建同步任务管理器
func NewSyncTaskManager(
	syncExecutor func(ctx context.Context, exchangeName exchange.ExchangeName, info exchange.SymbolInfo) error,
	onTaskComplete SyncTaskCallback,
	cfg *SyncTaskManagerConfig,
) *SyncTaskManager {
	if cfg == nil {
		cfg = &SyncTaskManagerConfig{}
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 5
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 1000
	}

	ctx, cancel := context.WithCancel(context.Background())

	m := &SyncTaskManager{
		syncExecutor:   syncExecutor,
		onTaskComplete: onTaskComplete,
		tasks:          make(map[string]*SyncTask),
		taskQueue:      make(chan *SyncTask, cfg.QueueSize),
		concurrency:    cfg.Concurrency,
		ctx:            ctx,
		cancel:         cancel,
	}

	// 启动工作协程
	m.startWorkers()

	return m
}

// startWorkers 启动工作协程池
func (m *SyncTaskManager) startWorkers() {
	for i := 0; i < m.concurrency; i++ {
		m.workerWg.Add(1)
		go m.worker(i)
	}
	logTask.Info().Int("concurrency", m.concurrency).Msg("Sync task workers started")
}

// worker 工作协程
func (m *SyncTaskManager) worker(id int) {
	defer m.workerWg.Done()

	for {
		select {
		case <-m.ctx.Done():
			logTask.Debug().Int("worker", id).Msg("Worker shutting down")
			return
		case task, ok := <-m.taskQueue:
			if !ok {
				return
			}
			m.executeTask(task)
		}
	}
}

// executeTask 执行单个任务
func (m *SyncTaskManager) executeTask(task *SyncTask) {
	// 检查任务是否已被取消
	m.tasksMu.RLock()
	currentTask, exists := m.tasks[task.ID]
	m.tasksMu.RUnlock()

	if !exists || currentTask.Status == TaskStatusCancelled {
		logTask.Debug().Str("task_id", task.ID).Msg("Task cancelled before execution")
		return
	}

	// 创建带取消的 context
	taskCtx, taskCancel := context.WithCancel(m.ctx)

	// 更新任务状态
	m.tasksMu.Lock()
	now := time.Now()
	task.Status = TaskStatusRunning
	task.StartedAt = &now
	task.CancelFunc = taskCancel
	m.tasksMu.Unlock()

	logTask.Info().
		Str("exchange", string(task.Exchange)).
		Str("symbol", task.Symbol).
		Str("trade_type", string(task.TradeType)).
		Msg("Task started")

	// 执行同步
	err := m.syncExecutor(taskCtx, task.Exchange, task.SymbolInfo)

	// 更新任务状态
	m.tasksMu.Lock()
	completedAt := time.Now()
	task.CompletedAt = &completedAt

	if taskCtx.Err() == context.Canceled {
		task.Status = TaskStatusCancelled
		logTask.Info().Str("task_id", task.ID).Msg("Task cancelled")
	} else if err != nil {
		task.Status = TaskStatusFailed
		task.Error = err
		logTask.Warn().Err(err).Str("task_id", task.ID).Msg("Task failed")
	} else {
		task.Status = TaskStatusCompleted
		logTask.Info().
			Str("exchange", string(task.Exchange)).
			Str("symbol", task.Symbol).
			Dur("duration", completedAt.Sub(*task.StartedAt)).
			Msg("Task completed")
	}
	m.tasksMu.Unlock()

	// 触发回调 (仅成功时)
	if task.Status == TaskStatusCompleted && m.onTaskComplete != nil {
		m.onTaskComplete(task)
	}
}

// AddTask 添加单个任务
func (m *SyncTaskManager) AddTask(exchangeName exchange.ExchangeName, info exchange.SymbolInfo) error {
	return m.AddTasks(exchangeName, []exchange.SymbolInfo{info})
}

// AddTasks 批量添加任务
func (m *SyncTaskManager) AddTasks(exchangeName exchange.ExchangeName, infos []exchange.SymbolInfo) error {
	if m.closed {
		return fmt.Errorf("task manager is closed")
	}

	m.tasksMu.Lock()
	defer m.tasksMu.Unlock()

	addedCount := 0
	for _, info := range infos {
		tradeType := exchange.TradeType(info.TradeType)
		taskID := TaskKey(exchangeName, info.Symbol, tradeType)

		// 检查是否已存在
		if existing, ok := m.tasks[taskID]; ok {
			// 如果任务正在运行或等待中，跳过
			if existing.Status == TaskStatusPending || existing.Status == TaskStatusRunning {
				logTask.Debug().Str("task_id", taskID).Msg("Task already exists, skipping")
				continue
			}
		}

		task := &SyncTask{
			ID:         taskID,
			Exchange:   exchangeName,
			Symbol:     info.Symbol,
			TradeType:  tradeType,
			SymbolInfo: info,
			Status:     TaskStatusPending,
			CreatedAt:  time.Now(),
		}

		m.tasks[taskID] = task

		// 发送到队列 (非阻塞)
		select {
		case m.taskQueue <- task:
			addedCount++
		default:
			logTask.Warn().Str("task_id", taskID).Msg("Task queue full, dropping task")
			task.Status = TaskStatusFailed
			task.Error = fmt.Errorf("queue full")
		}
	}

	if addedCount > 0 {
		logTask.Info().
			Str("exchange", string(exchangeName)).
			Int("added", addedCount).
			Int("total", len(infos)).
			Msg("Tasks added")
	}

	return nil
}

// CancelTask 取消单个任务
func (m *SyncTaskManager) CancelTask(exchangeName exchange.ExchangeName, symbol string, tradeType exchange.TradeType) bool {
	taskID := TaskKey(exchangeName, symbol, tradeType)

	m.tasksMu.Lock()
	defer m.tasksMu.Unlock()

	task, exists := m.tasks[taskID]
	if !exists {
		return false
	}

	if task.Status == TaskStatusRunning && task.CancelFunc != nil {
		task.CancelFunc()
	}
	task.Status = TaskStatusCancelled

	logTask.Info().Str("task_id", taskID).Msg("Task cancelled")
	return true
}

// GetTask 获取任务状态
func (m *SyncTaskManager) GetTask(exchangeName exchange.ExchangeName, symbol string, tradeType exchange.TradeType) *SyncTask {
	taskID := TaskKey(exchangeName, symbol, tradeType)

	m.tasksMu.RLock()
	defer m.tasksMu.RUnlock()

	if task, ok := m.tasks[taskID]; ok {
		// 返回副本
		taskCopy := *task
		return &taskCopy
	}
	return nil
}

// GetAllTasks 获取所有任务
func (m *SyncTaskManager) GetAllTasks() []*SyncTask {
	m.tasksMu.RLock()
	defer m.tasksMu.RUnlock()

	result := make([]*SyncTask, 0, len(m.tasks))
	for _, task := range m.tasks {
		taskCopy := *task
		result = append(result, &taskCopy)
	}
	return result
}

// GetTasksByStatus 按状态获取任务
func (m *SyncTaskManager) GetTasksByStatus(status TaskStatus) []*SyncTask {
	m.tasksMu.RLock()
	defer m.tasksMu.RUnlock()

	result := make([]*SyncTask, 0)
	for _, task := range m.tasks {
		if task.Status == status {
			taskCopy := *task
			result = append(result, &taskCopy)
		}
	}
	return result
}

// GetStats 获取统计信息
func (m *SyncTaskManager) GetStats() map[TaskStatus]int {
	m.tasksMu.RLock()
	defer m.tasksMu.RUnlock()

	stats := make(map[TaskStatus]int)
	for _, task := range m.tasks {
		stats[task.Status]++
	}
	return stats
}

// WaitAll 等待所有任务完成
func (m *SyncTaskManager) WaitAll(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timeout waiting for tasks to complete")
		}

		stats := m.GetStats()
		pending := stats[TaskStatusPending]
		running := stats[TaskStatusRunning]

		if pending == 0 && running == 0 {
			return nil
		}

		logTask.Debug().
			Int("pending", pending).
			Int("running", running).
			Msg("Waiting for tasks...")

		time.Sleep(500 * time.Millisecond)
	}
}

// ClearCompleted 清理已完成的任务记录
func (m *SyncTaskManager) ClearCompleted() int {
	m.tasksMu.Lock()
	defer m.tasksMu.Unlock()

	count := 0
	for id, task := range m.tasks {
		if task.Status == TaskStatusCompleted || task.Status == TaskStatusFailed || task.Status == TaskStatusCancelled {
			delete(m.tasks, id)
			count++
		}
	}

	if count > 0 {
		logTask.Info().Int("cleared", count).Msg("Cleared completed tasks")
	}
	return count
}

// Stop 停止任务管理器
func (m *SyncTaskManager) Stop() {
	if m.closed {
		return
	}
	m.closed = true

	logTask.Info().Msg("Stopping sync task manager...")

	// 取消所有运行中的任务
	m.tasksMu.Lock()
	for _, task := range m.tasks {
		if task.Status == TaskStatusRunning && task.CancelFunc != nil {
			task.CancelFunc()
		}
		if task.Status == TaskStatusPending {
			task.Status = TaskStatusCancelled
		}
	}
	m.tasksMu.Unlock()

	// 取消上下文
	m.cancel()

	// 关闭队列
	close(m.taskQueue)

	// 等待工作协程退出
	m.workerWg.Wait()

	logTask.Info().Msg("Sync task manager stopped")
}
