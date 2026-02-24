package app

import (
	"context"
	"fmt"
	"time"

	"exchange-adapter-service/internal/config"
	"exchange-adapter-service/internal/publisher"
	"exchange-adapter-service/internal/service"
	"exchange-adapter-service/internal/storage"

	exchange "github.com/pkg/exchange-adapter/marketdata"
	"github.com/pkg/logger"
)

var marketLog = logger.Module("market.app")

// MarketApp embeds the core of apps/exchange-sync (ws/db/nats/cron) into this service.
type MarketApp struct {
	cfg *config.Config

	repo   storage.Repository
	pgRepo *storage.PostgresRepository
	redis  *storage.RedisClient

	natsPublisher *publisher.Publisher

	wsSync      *service.WsSyncService
	historySync *service.HistorySyncService
	verify      *service.VerifyService
	tickerSync  *service.TickerSyncService
}

func NewMarketApp(cfg *config.Config) (*MarketApp, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is nil")
	}

	return &MarketApp{cfg: cfg}, nil
}

func (a *MarketApp) Start(ctx context.Context) error {
	if a == nil || a.cfg == nil {
		return fmt.Errorf("market app not initialized")
	}
	if !a.cfg.Market.Enabled {
		marketLog.Info().Msg("market module disabled")
		return nil
	}

	// Database (optional).
	if a.cfg.Database.IsEnabled() {
		marketLog.Info().Msg("market: initializing database...")
		pgRepo, err := storage.NewPostgresRepository(ctx, &a.cfg.Database)
		if err != nil {
			return err
		}
		if err := pgRepo.InitSchema(ctx); err != nil {
			_ = pgRepo.Close()
			return err
		}
		a.pgRepo = pgRepo
		a.repo = pgRepo
		marketLog.Info().Msg("market: database initialized")
	} else {
		marketLog.Warn().Msg("market: database not configured, running without persistence")
	}

	// Redis (optional, for ticker caching).
	if a.cfg.Redis.IsEnabled() {
		marketLog.Info().Str("host", a.cfg.Redis.Host).Int("port", a.cfg.Redis.Port).Msg("market: initializing Redis...")
		redis, err := storage.NewRedisClient(a.cfg.Redis.Host, a.cfg.Redis.Port, a.cfg.Redis.Password, a.cfg.Redis.DB)
		if err != nil {
			marketLog.Warn().Err(err).Msg("market: failed to connect to Redis, ticker sync disabled")
		} else {
			a.redis = redis
			marketLog.Info().Msg("market: Redis initialized")
		}
	} else {
		marketLog.Warn().Msg("market: Redis not configured, ticker sync disabled")
	}

	// NATS publisher (optional).
	if a.cfg.NATS.IsEnabled() {
		marketLog.Info().Str("url", a.cfg.NATS.URL).Msg("market: initializing NATS publisher...")
		pub, err := publisher.New(&a.cfg.NATS)
		if err != nil {
			_ = a.closeRepo()
			return err
		}
		a.natsPublisher = pub
		marketLog.Info().Msg("market: NATS publisher initialized")
	} else {
		marketLog.Warn().Msg("market: NATS not configured, running without message publishing")
	}

	// WebSocket market-data sync (required when market is enabled).
	a.wsSync = service.NewWsSyncService(a.cfg, a.repo, a.natsPublisher)
	if err := a.wsSync.Start(); err != nil {
		a.Stop(context.Background())
		return err
	}
	if err := a.wsSync.WaitReady(15 * time.Second); err != nil {
		marketLog.Warn().Err(err).Msg("market: ws sync ready timeout")
	}
	marketLog.Info().Msg("market: ws sync started")

	// History sync + verify depend on DB.
	if a.repo != nil {
		history, err := service.NewHistorySyncService(a.cfg, a.repo)
		if err != nil {
			a.Stop(context.Background())
			return err
		}
		a.historySync = history

		verify, err := service.NewVerifyService(a.cfg, a.repo)
		if err != nil {
			a.Stop(context.Background())
			return err
		}
		a.verify = verify

		// Subscribe WS after each symbol completes initial history sync.
		a.historySync.OnSyncComplete(func(exchangeName exchange.ExchangeName, info exchange.SymbolInfo) {
			if a.wsSync == nil {
				return
			}
			req := []exchange.SubscribeRequest{{
				Symbol:    info.Symbol,
				TradeType: exchange.TradeType(info.TradeType),
			}}
			if err := a.wsSync.Subscribe(exchangeName, req); err != nil {
				marketLog.Error().Err(err).
					Str("exchange", string(exchangeName)).
					Str("symbol", info.Symbol).
					Msg("market: subscribe after sync complete failed")
			}
		})

		a.historySync.InitTaskManager(0)

		marketLog.Info().Msg("market: syncing symbols...")
		if err := a.historySync.SyncSymbols(ctx); err != nil {
			marketLog.Error().Err(err).Msg("market: sync symbols failed")
		}

		marketLog.Info().Msg("market: adding sync tasks for enabled symbols...")
		if err := a.historySync.SyncAllEnabledSymbols(ctx); err != nil {
			marketLog.Error().Err(err).Msg("market: add sync tasks failed")
		}
	} else {
		marketLog.Info().Msg("market: history/verify disabled (no database)")
	}

	// Ticker sync service (requires Redis).
	if a.redis != nil {
		a.tickerSync = service.NewTickerSyncService(a.redis, a.cfg.Proxy.HTTP, a.cfg.Proxy.Socks5)
		if err := a.tickerSync.Start(ctx); err != nil {
			marketLog.Error().Err(err).Msg("market: ticker sync start failed")
		} else {
			marketLog.Info().Msg("market: ticker sync started")
		}
	}

	return nil
}

func (a *MarketApp) Stop(ctx context.Context) {
	if a == nil {
		return
	}

	if a.tickerSync != nil {
		a.tickerSync.Stop()
	}
	if a.historySync != nil {
		a.historySync.Stop()
	}
	if a.wsSync != nil {
		_ = a.wsSync.Stop()
	}
	if a.natsPublisher != nil {
		_ = a.natsPublisher.Close()
	}
	if a.redis != nil {
		_ = a.redis.Close()
	}
	_ = ctx // reserved for future use (e.g., db close deadline)
	_ = a.closeRepo()
}

func (a *MarketApp) Repo() storage.Repository                 { return a.repo }
func (a *MarketApp) WsSync() *service.WsSyncService           { return a.wsSync }
func (a *MarketApp) HistorySync() *service.HistorySyncService { return a.historySync }
func (a *MarketApp) Verify() *service.VerifyService           { return a.verify }
func (a *MarketApp) TickerSync() *service.TickerSyncService   { return a.tickerSync }

func (a *MarketApp) closeRepo() error {
	if a.pgRepo != nil {
		err := a.pgRepo.Close()
		a.pgRepo = nil
		a.repo = nil
		return err
	}
	a.repo = nil
	return nil
}
