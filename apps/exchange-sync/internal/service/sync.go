package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"exchange-sync/internal/config"
	"exchange-sync/internal/storage"
	"exchange-sync/pkg/logger"
	"exchange-sync/pkg/utils"

	exbinance "github.com/pkg/exchange-adapter/exchanges/binance"
	exokx "github.com/pkg/exchange-adapter/exchanges/okx"
	exchange "github.com/pkg/exchange-adapter/marketdata"

	"github.com/robfig/cron/v3"
)

var logSync = logger.Module("history-sync")

// SyncCompleteCallback 同步完成回调 (单个交易对完成时触发)
type SyncCompleteCallback func(exchangeName exchange.ExchangeName, info exchange.SymbolInfo)

// HistorySyncService 历史数据同步服务
type HistorySyncService struct {
	cfg         *config.Config
	repo        storage.Repository
	clients     map[exchange.ExchangeName]exchange.RESTClient
	rateLimiter *utils.RateLimiter
	cron        *cron.Cron
	mu          sync.Mutex

	// 任务管理器
	taskManager *SyncTaskManager

	// 同步完成回调
	onSyncComplete SyncCompleteCallback
}

// NewHistorySyncService 创建历史同步服务
func NewHistorySyncService(cfg *config.Config, repo storage.Repository) (*HistorySyncService, error) {
	// 速率限制: 每秒最多一次请求
	rateLimiter := utils.NewRateLimiter(time.Second)

	clients := make(map[exchange.ExchangeName]exchange.RESTClient)
	clients[exchange.Binance] = exbinance.NewMarketDataRESTClient(exbinance.MarketDataRESTClientOptions{
		HTTPSProxy: cfg.Proxy.HTTP,
	})
	okxClient, err := exokx.NewMarketDataRESTClient(exokx.MarketDataRESTClientOptions{
		HTTPSProxy: cfg.Proxy.HTTP,
	})
	if err != nil {
		return nil, fmt.Errorf("init okx rest client: %w", err)
	}
	clients[exchange.OKX] = okxClient

	s := &HistorySyncService{
		cfg:         cfg,
		repo:        repo,
		clients:     clients,
		rateLimiter: rateLimiter,
	}

	return s, nil
}

// InitTaskManager 初始化任务管理器 (需要在设置回调后调用)
func (s *HistorySyncService) InitTaskManager(concurrency int) {
	if concurrency <= 0 {
		concurrency = s.cfg.Sync.SyncConcurrency
	}
	if concurrency <= 0 {
		concurrency = 5
	}

	s.taskManager = NewSyncTaskManager(
		s.SyncSymbolHistoryData, // 同步执行器
		func(task *SyncTask) { // 任务完成回调
			if s.onSyncComplete != nil {
				s.onSyncComplete(task.Exchange, task.SymbolInfo)
			}
		},
		&SyncTaskManagerConfig{
			Concurrency: concurrency,
			QueueSize:   1000,
		},
	)
}

// OnSyncComplete 设置同步完成回调
func (s *HistorySyncService) OnSyncComplete(callback SyncCompleteCallback) {
	s.onSyncComplete = callback
}

// GetTaskManager 获取任务管理器
func (s *HistorySyncService) GetTaskManager() *SyncTaskManager {
	return s.taskManager
}

// StartCronSyncSymbols 启动定时同步 symbols 任务
func (s *HistorySyncService) StartCronSyncSymbols() error {
	if !s.cfg.Sync.SymbolsSyncEnabled {
		logSync.Info().Msg("Symbols sync cron disabled")
		return nil
	}

	cronExpr := s.cfg.Sync.SymbolsSyncCron
	if cronExpr == "" {
		cronExpr = "0 6 * * *" // 默认每天早上6点
	}

	s.cron = cron.New()

	_, err := s.cron.AddFunc(cronExpr, func() {
		logSync.Info().Msg("Cron: Starting daily symbols sync...")
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		if err := s.SyncSymbols(ctx); err != nil {
			logSync.Error().Err(err).Msg("Cron: Failed to sync symbols")
		} else {
			logSync.Info().Msg("Cron: Daily symbols sync completed")
		}
	})
	if err != nil {
		return fmt.Errorf("add cron job: %w", err)
	}

	s.cron.Start()
	logSync.Info().Str("cron", cronExpr).Msg("Symbols sync cron started")

	return nil
}

// Stop 停止服务
func (s *HistorySyncService) Stop() {
	if s.cron != nil {
		s.cron.Stop()
		logSync.Info().Msg("Cron stopped")
	}
	if s.taskManager != nil {
		s.taskManager.Stop()
	}
}

// SyncSymbols 同步交易对信息
func (s *HistorySyncService) SyncSymbols(ctx context.Context) error {
	for name, client := range s.clients {
		for _, tradeType := range []exchange.TradeType{exchange.Spot, exchange.Futures} {
			logSync.Info().
				Str("exchange", string(name)).
				Str("trade_type", string(tradeType)).
				Msg("Fetching symbols...")

			if err := s.rateLimiter.Wait(ctx); err != nil {
				return err
			}

			symbols, err := client.GetSymbols(ctx, tradeType)
			if err != nil {
				logSync.Error().Err(err).
					Str("exchange", string(name)).
					Str("trade_type", string(tradeType)).
					Msg("Failed to get symbols")
				continue
			}

			logSync.Info().
				Str("exchange", string(name)).
				Str("trade_type", string(tradeType)).
				Int("count", len(symbols)).
				Msg("Got symbols")

			for _, info := range symbols {
				if err := s.repo.SaveSymbolInfo(ctx, string(name), info); err != nil {
					logSync.Error().Err(err).
						Str("symbol", info.Symbol).
						Msg("Failed to save symbol")
				}
			}
		}
	}

	return nil
}

// SyncSymbolHistoryData 同步单个交易对的历史数据 (根据 symbol_sync_status 是否存在决定全量或增量)
func (s *HistorySyncService) SyncSymbolHistoryData(ctx context.Context, exchangeName exchange.ExchangeName, info exchange.SymbolInfo) error {
	client, ok := s.clients[exchangeName]
	if !ok {
		return fmt.Errorf("unknown exchange: %s", exchangeName)
	}

	return s.syncSymbolHistory(ctx, client, exchangeName, info)
}

// SyncHistoryData 同步历史K线数据
func (s *HistorySyncService) SyncHistoryData(ctx context.Context, exchangeName exchange.ExchangeName, symbols []exchange.SymbolInfo) error {
	client, ok := s.clients[exchangeName]
	if !ok {
		return fmt.Errorf("unknown exchange: %s", exchangeName)
	}

	// 分批处理
	batches := utils.ChunkSlice(symbols, s.cfg.Sync.SubscribeBatchSize)

	for batchIdx, batch := range batches {
		logSync.Info().
			Int("batch", batchIdx+1).
			Int("total_batches", len(batches)).
			Int("symbols", len(batch)).
			Msg("Processing batch")

		var wg sync.WaitGroup
		for _, info := range batch {
			wg.Add(1)
			go func(info exchange.SymbolInfo) {
				defer wg.Done()
				if err := s.syncSymbolHistory(ctx, client, exchangeName, info); err != nil {
					logSync.Error().Err(err).
						Str("symbol", info.Symbol).
						Msg("Failed to sync")
				}
			}(info)
		}
		wg.Wait()
	}

	return nil
}

func (s *HistorySyncService) syncSymbolHistory(ctx context.Context, client exchange.RESTClient, exchangeName exchange.ExchangeName, info exchange.SymbolInfo) error {
	tradeType := exchange.TradeType(info.TradeType)

	// 获取同步状态
	status, err := s.repo.GetSymbolSyncStatus(ctx, string(exchangeName), info.Symbol, info.TradeType)
	if err != nil {
		return err
	}

	var startTime int64
	var earliestDataTs int64

	if status == nil {
		// 首次同步：二分查找最早有数据的时间
		logSync.Info().
			Str("exchange", string(exchangeName)).
			Str("symbol", info.Symbol).
			Msg("First sync, searching earliest data...")

		earliest, err := s.findEarliestDataTime(ctx, client, info.Symbol, tradeType)
		if err != nil {
			return err
		}

		if earliest == nil {
			logSync.Info().
				Str("exchange", string(exchangeName)).
				Str("symbol", info.Symbol).
				Msg("No historical data found")
			return nil
		}

		startTime = *earliest
		earliestDataTs = startTime
		logSync.Info().
			Str("exchange", string(exchangeName)).
			Str("symbol", info.Symbol).
			Time("earliest", time.UnixMilli(startTime)).
			Msg("Found earliest data, starting full sync")

		// 保存 earliest_data_ts
		if err := s.repo.UpdateSymbolSyncStatus(ctx, &storage.SymbolSyncStatus{
			Exchange:       string(exchangeName),
			Symbol:         info.Symbol,
			TradeType:      info.TradeType,
			EarliestDataTs: earliestDataTs,
			LatestSyncTs:   0,
		}); err != nil {
			logSync.Warn().Err(err).Str("symbol", info.Symbol).Msg("Failed to save earliest_data_ts")
		}
	} else {
		// 非首次同步：从 latest_sync_ts - 8h 开始
		earliestDataTs = status.EarliestDataTs
		// 减去 8 小时避免边界遗漏
		startTime = status.LatestSyncTs - 8*utils.Hour
		if startTime < earliestDataTs {
			startTime = earliestDataTs
		}
		logSync.Info().
			Str("exchange", string(exchangeName)).
			Str("symbol", info.Symbol).
			Time("from", time.UnixMilli(startTime)).
			Msg("Incremental sync from latest_sync_ts - 8h")
	}

	// 增量同步直到没有更多数据
	return s.syncUntilComplete(ctx, client, exchangeName, info, tradeType, startTime, earliestDataTs)
}

func (s *HistorySyncService) findEarliestDataTime(ctx context.Context, client exchange.RESTClient, symbol string, tradeType exchange.TradeType) (*int64, error) {
	currentYear := time.Now().Year()
	startYear := s.cfg.Sync.HistoryStartYear

	// 二分查找有数据的最早月份
	checker := func(year, month int) (bool, error) {
		if err := s.rateLimiter.Wait(ctx); err != nil {
			return false, err
		}

		monthStart := utils.GetMonthTimestamp(year, month)
		monthEnd := utils.GetMonthTimestamp(year, month+1)
		if month == 12 {
			monthEnd = utils.GetMonthTimestamp(year+1, 1)
		}

		candles, err := client.GetCandles(ctx, symbol, tradeType, exchange.Period15m, monthStart, monthEnd, 1)
		if err != nil {
			// API 错误可能是因为交易对在那个时候不存在
			return false, nil
		}

		return len(candles) > 0, nil
	}

	result, err := utils.BinarySearchEarliestMonth(startYear, currentYear, checker)
	if err != nil {
		return nil, err
	}

	if result == nil {
		return nil, nil
	}

	ts := utils.GetMonthTimestamp(result.Year, result.Month)
	return &ts, nil
}

// syncUntilComplete 从 startTime 开始同步，直到返回数据为空或 < limit
func (s *HistorySyncService) syncUntilComplete(ctx context.Context, client exchange.RESTClient, exchangeName exchange.ExchangeName, info exchange.SymbolInfo, tradeType exchange.TradeType, startTime, earliestDataTs int64) error {
	period := exchange.Period15m
	limit := s.cfg.Sync.QueryLimit
	totalCandles := 0
	currentStart := startTime

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := s.rateLimiter.Wait(ctx); err != nil {
			return err
		}

		// 请求从 currentStart 开始的数据
		candles, err := client.GetCandles(ctx, info.Symbol, tradeType, period, currentStart, 0, limit)
		if err != nil {
			logSync.Warn().Err(err).
				Str("symbol", info.Symbol).
				Time("from", time.UnixMilli(currentStart)).
				Msg("Failed to get candles")
			break
		}

		if len(candles) == 0 {
			// 没有更多数据，同步完成
			logSync.Debug().
				Str("symbol", info.Symbol).
				Msg("No more candles, sync complete")
			break
		}

		// 保存数据
		if err := s.repo.SaveCandles(ctx, candles); err != nil {
			logSync.Warn().Err(err).
				Str("symbol", info.Symbol).
				Msg("Failed to save candles")
		}
		totalCandles += len(candles)

		// 找到本批次最后一条数据的时间戳，作为下次请求的起点
		lastCandle := candles[len(candles)-1]
		latestTs := lastCandle.Timestamp

		// 更新 latest_sync_ts
		if err := s.repo.UpdateSymbolSyncStatus(ctx, &storage.SymbolSyncStatus{
			Exchange:       string(exchangeName),
			Symbol:         info.Symbol,
			TradeType:      info.TradeType,
			EarliestDataTs: earliestDataTs,
			LatestSyncTs:   latestTs,
		}); err != nil {
			logSync.Warn().Err(err).
				Str("symbol", info.Symbol).
				Msg("Failed to update latest_sync_ts")
		}

		// 如果返回数据 < limit，说明已经到最新了
		if len(candles) < limit {
			logSync.Debug().
				Str("symbol", info.Symbol).
				Int("count", len(candles)).
				Msg("Received less than limit, sync complete")
			break
		}

		// 下一次从最后一条数据的下一个周期开始
		currentStart = period.NextInterval(latestTs)

		logSync.Debug().
			Str("symbol", info.Symbol).
			Int("batch_count", len(candles)).
			Int("total", totalCandles).
			Time("next_start", time.UnixMilli(currentStart)).
			Msg("Batch synced")
	}

	logSync.Info().
		Str("exchange", string(exchangeName)).
		Str("symbol", info.Symbol).
		Int("total_candles", totalCandles).
		Msg("Sync completed")
	return nil
}

// FillMissingData 填充缺失数据
func (s *HistorySyncService) FillMissingData(ctx context.Context, exchangeName exchange.ExchangeName, symbol, tradeType string, startTime, endTime int64) error {
	client, ok := s.clients[exchangeName]
	if !ok {
		return fmt.Errorf("unknown exchange: %s", exchangeName)
	}

	// 获取缺失的时间戳
	missing, err := s.repo.GetMissingPeriods(ctx, string(exchangeName), symbol, tradeType, "15m", startTime, endTime)
	if err != nil {
		return err
	}

	if len(missing) == 0 {
		return nil
	}

	logSync.Info().
		Str("exchange", string(exchangeName)).
		Str("symbol", symbol).
		Int("missing", len(missing)).
		Msg("Found missing periods")

	// 分批填充
	period := exchange.Period15m
	limit := s.cfg.Sync.QueryLimit

	// 将缺失的时间戳分批
	batches := utils.ChunkSlice(missing, limit)

	for _, batch := range batches {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := s.rateLimiter.Wait(ctx); err != nil {
			return err
		}

		batchStart := batch[0]
		batchEnd := period.NextInterval(batch[len(batch)-1])

		candles, err := client.GetCandles(ctx, symbol, exchange.TradeType(tradeType), period, batchStart, batchEnd, limit)
		if err != nil {
			logSync.Warn().Err(err).
				Str("symbol", symbol).
				Msg("Failed to fill missing data")
			continue
		}

		if len(candles) > 0 {
			if err := s.repo.SaveCandles(ctx, candles); err != nil {
				logSync.Warn().Err(err).
					Str("symbol", symbol).
					Msg("Failed to save filled candles")
			}
		}
	}

	return nil
}

// SyncAllEnabledSymbols 同步所有开启同步的交易对历史数据
// 使用任务管理器异步执行，每个任务完成后会触发 onSyncComplete 回调
func (s *HistorySyncService) SyncAllEnabledSymbols(ctx context.Context) error {
	if s.taskManager == nil {
		return fmt.Errorf("task manager not initialized, call InitTaskManager first")
	}

	for exchangeName := range s.clients {
		symbols, err := s.repo.GetSyncEnabledSymbolInfos(ctx, string(exchangeName))
		if err != nil {
			logSync.Error().Err(err).
				Str("exchange", string(exchangeName)).
				Msg("Failed to get sync enabled symbols")
			continue
		}

		if len(symbols) == 0 {
			logSync.Info().
				Str("exchange", string(exchangeName)).
				Msg("No sync enabled symbols found")
			continue
		}

		logSync.Info().
			Str("exchange", string(exchangeName)).
			Int("count", len(symbols)).
			Msg("Adding sync tasks for enabled symbols")

		// 添加到任务管理器
		if err := s.taskManager.AddTasks(exchangeName, symbols); err != nil {
			logSync.Error().Err(err).
				Str("exchange", string(exchangeName)).
				Msg("Failed to add sync tasks")
		}
	}

	return nil
}

// SyncAllEnabledSymbolsAndWait 同步所有启用的交易对并等待完成
// 这是一个阻塞方法，适用于启动时的初始同步
func (s *HistorySyncService) SyncAllEnabledSymbolsAndWait(ctx context.Context, timeout time.Duration) error {
	if err := s.SyncAllEnabledSymbols(ctx); err != nil {
		return err
	}

	// 等待所有任务完成
	return s.taskManager.WaitAll(timeout)
}

// AddSyncTask 添加单个同步任务 (用于 API 动态开启同步)
func (s *HistorySyncService) AddSyncTask(exchangeName exchange.ExchangeName, info exchange.SymbolInfo) error {
	if s.taskManager == nil {
		return fmt.Errorf("task manager not initialized")
	}
	return s.taskManager.AddTask(exchangeName, info)
}

// CancelSyncTask 取消同步任务
func (s *HistorySyncService) CancelSyncTask(exchangeName exchange.ExchangeName, symbol string, tradeType exchange.TradeType) bool {
	if s.taskManager == nil {
		return false
	}
	return s.taskManager.CancelTask(exchangeName, symbol, tradeType)
}

// GetSyncTaskStatus 获取同步任务状态
func (s *HistorySyncService) GetSyncTaskStatus(exchangeName exchange.ExchangeName, symbol string, tradeType exchange.TradeType) *SyncTask {
	if s.taskManager == nil {
		return nil
	}
	return s.taskManager.GetTask(exchangeName, symbol, tradeType)
}
