package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"exchange-sync/internal/api"
	"exchange-sync/internal/config"
	"exchange-sync/internal/publisher"
	"exchange-sync/internal/service"
	"exchange-sync/internal/storage"
	"exchange-sync/pkg/logger"

	exchange "github.com/pkg/exchange-adapter/marketdata"
)

var log = logger.Module("main")

func main() {
	// 1. 加载配置
	cfg, err := config.Load()
	if err != nil {
		// 配置加载失败时使用默认 logger
		logger.InitDefault()
		logger.Fatal().Err(err).Msg("Failed to load config")
	}

	// 2. 初始化日志
	if err := logger.Init(logger.Config{
		Level:      cfg.Log.Level,
		Format:     cfg.Log.Format,
		Output:     cfg.Log.Output,
		Dir:        cfg.Log.Dir,
		Filename:   cfg.Log.Filename,
		MaxSize:    cfg.Log.MaxSize,
		MaxAge:     cfg.Log.MaxAge,
		MaxBackups: cfg.Log.MaxBackups,
		Compress:   cfg.Log.Compress,
	}); err != nil {
		logger.InitDefault()
		logger.Error().Err(err).Msg("Failed to init logger, using default")
	}

	log.Info().
		Int("http_port", cfg.Server.HTTPPort).
		Bool("nats_enabled", cfg.NATS.IsEnabled()).
		Msg("Starting Exchange Sync Service")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 3. 初始化数据库
	var repo storage.Repository
	if cfg.Database.IsEnabled() {
		log.Info().Msg("Initializing database...")
		pgRepo, err := storage.NewPostgresRepository(ctx, &cfg.Database)
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to connect database")
		}
		defer pgRepo.Close()

		if err := pgRepo.InitSchema(ctx); err != nil {
			log.Fatal().Err(err).Msg("Failed to init schema")
		}
		repo = pgRepo
		log.Info().Msg("Database initialized")
	} else {
		log.Warn().Msg("Database not configured, running without persistence")
	}

	// 4. 初始化 NATS 发布器
	var natsPublisher *publisher.Publisher
	if cfg.NATS.IsEnabled() {
		log.Info().Str("url", cfg.NATS.URL).Msg("Initializing NATS publisher...")
		var err error
		natsPublisher, err = publisher.New(&cfg.NATS)
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to create NATS publisher")
		}
		log.Info().Msg("NATS publisher initialized")
	} else {
		log.Warn().Msg("NATS not configured, running without message publishing")
	}

	// 5. 创建 WebSocket 同步服务 (先创建，供历史同步完成回调使用)
	log.Info().Msg("Creating WebSocket sync service...")
	wsSyncService := service.NewWsSyncService(cfg, repo, natsPublisher)

	// 6. 启动 WebSocket 服务
	log.Info().Msg("Starting WebSocket connections...")
	if err := wsSyncService.Start(); err != nil {
		log.Fatal().Err(err).Msg("Failed to start WebSocket sync")
	}

	// 等待就绪
	if err := wsSyncService.WaitReady(15 * time.Second); err != nil {
		log.Warn().Err(err).Msg("WebSocket service ready timeout")
	}
	log.Info().Msg("WebSocket sync service started")

	// 7. 创建历史同步服务
	var historySyncService *service.HistorySyncService
	if repo != nil {
			historySyncService, err = service.NewHistorySyncService(cfg, repo)
			if err != nil {
				log.Fatal().Err(err).Msg("Failed to create history sync service")
			}

			// 设置同步完成回调：每个交易对同步完成后自动订阅 WS
			historySyncService.OnSyncComplete(func(exchangeName exchange.ExchangeName, info exchange.SymbolInfo) {
				subscribeReq := []exchange.SubscribeRequest{{
				Symbol:    info.Symbol,
				TradeType: exchange.TradeType(info.TradeType),
			}}
			if err := wsSyncService.Subscribe(exchangeName, subscribeReq); err != nil {
				log.Error().Err(err).
					Str("exchange", string(exchangeName)).
					Str("symbol", info.Symbol).
					Msg("Failed to subscribe after sync complete")
			} else {
				log.Info().
					Str("exchange", string(exchangeName)).
					Str("symbol", info.Symbol).
					Msg("WS subscribed after sync complete")
			}
		})

		// 初始化任务管理器
		historySyncService.InitTaskManager(cfg.Sync.SyncConcurrency)

		// 同步交易对信息
		log.Info().Msg("Syncing symbols...")
		if err := historySyncService.SyncSymbols(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to sync symbols")
		}

		// 添加所有启用交易对的同步任务 (异步执行，完成后自动订阅 WS)
		log.Info().Msg("Adding sync tasks for enabled symbols...")
		if err := historySyncService.SyncAllEnabledSymbols(ctx); err != nil {
			log.Error().Err(err).Msg("Failed to add sync tasks")
		}

		// 启动每日 symbols 同步定时任务
		if err := historySyncService.StartCronSyncSymbols(); err != nil {
			log.Error().Err(err).Msg("Failed to start symbols sync cron")
		}
	} else {
		// 如果没有数据库，订阅默认交易对
		// defaultSymbols := []exchange.SubscribeRequest{
		// 	{Symbol: "BTC-USDT", TradeType: exchange.Spot},
		// 	{Symbol: "ETH-USDT", TradeType: exchange.Spot},
		// }

		// for _, exchangeName := range []exchange.ExchangeName{exchange.Binance, exchange.OKX} {
		// 	if err := wsSyncService.Subscribe(exchangeName, defaultSymbols); err != nil {
		// 		log.Error().Err(err).Str("exchange", string(exchangeName)).Msg("Failed to subscribe")
		// 	}
		// }
		log.Info().Msg("Default symbols subscribed (no database)")
	}

	// 8. 创建并启动 API 服务器
	log.Info().Msg("Starting API server...")
	apiServer, err := api.NewServer(cfg, wsSyncService, historySyncService, repo)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create API server")
	}

	if err := apiServer.Start(); err != nil {
		log.Fatal().Err(err).Msg("Failed to start API server")
	}
	log.Info().
		Int("http_port", cfg.Server.HTTPPort).
		Msg("API server started")

	// 9. 等待关闭信号
	log.Info().Msg("Service is running. Press Ctrl+C to stop.")
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down...")

	// 10. 优雅关闭
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// 停止 API 服务器
	if err := apiServer.Stop(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("API server stop error")
	}

	// 停止 WebSocket 同步服务
	if err := wsSyncService.Stop(); err != nil {
		log.Error().Err(err).Msg("WebSocket sync service stop error")
	}

	// 停止历史同步服务的定时任务
	if historySyncService != nil {
		historySyncService.Stop()
	}

	// 停止 NATS 发布器
	if natsPublisher != nil {
		if err := natsPublisher.Close(); err != nil {
			log.Error().Err(err).Msg("NATS publisher close error")
		}
	}

	log.Info().Msg("Service stopped")
}
