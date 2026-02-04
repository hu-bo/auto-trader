package marketapp

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

var log = logger.Module("market.app")

// App embeds the core of apps/exchange-sync (ws/db/nats/cron) into this service.
type App struct {
	cfg *config.Config

	repo   storage.Repository
	pgRepo *storage.PostgresRepository

	natsPublisher *publisher.Publisher

	wsSync      *service.WsSyncService
	historySync *service.HistorySyncService
	verify      *service.VerifyService
}

func New(cfg *config.Config) (*App, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is nil")
	}

	return &App{cfg: cfg}, nil
}

func (a *App) Start(ctx context.Context) error {
	if a == nil || a.cfg == nil {
		return fmt.Errorf("market app not initialized")
	}
	if !a.cfg.Market.Enabled {
		log.Info().Msg("market module disabled")
		return nil
	}

	// Database (optional).
	if a.cfg.Database.IsEnabled() {
		log.Info().Msg("market: initializing database...")
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
		log.Info().Msg("market: database initialized")
	} else {
		log.Warn().Msg("market: database not configured, running without persistence")
	}

	// NATS publisher (optional).
	if a.cfg.NATS.IsEnabled() {
		log.Info().Str("url", a.cfg.NATS.URL).Msg("market: initializing NATS publisher...")
		pub, err := publisher.New(&a.cfg.NATS)
		if err != nil {
			_ = a.closeRepo()
			return err
		}
		a.natsPublisher = pub
		log.Info().Msg("market: NATS publisher initialized")
	} else {
		log.Warn().Msg("market: NATS not configured, running without message publishing")
	}

	// WebSocket market-data sync (required when market is enabled).
	a.wsSync = service.NewWsSyncService(a.cfg, a.repo, a.natsPublisher)
	if err := a.wsSync.Start(); err != nil {
		a.Stop(context.Background())
		return err
	}
	if err := a.wsSync.WaitReady(15 * time.Second); err != nil {
		log.Warn().Err(err).Msg("market: ws sync ready timeout")
	}
	log.Info().Msg("market: ws sync started")

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
				log.Error().Err(err).
					Str("exchange", string(exchangeName)).
					Str("symbol", info.Symbol).
					Msg("market: subscribe after sync complete failed")
			}
		})

		a.historySync.InitTaskManager(0)

		log.Info().Msg("market: syncing symbols...")
		if err := a.historySync.SyncSymbols(ctx); err != nil {
			log.Error().Err(err).Msg("market: sync symbols failed")
		}

		log.Info().Msg("market: adding sync tasks for enabled symbols...")
		if err := a.historySync.SyncAllEnabledSymbols(ctx); err != nil {
			log.Error().Err(err).Msg("market: add sync tasks failed")
		}
	} else {
		log.Info().Msg("market: history/verify disabled (no database)")
	}

	return nil
}

func (a *App) Stop(ctx context.Context) {
	if a == nil {
		return
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
	_ = ctx // reserved for future use (e.g., db close deadline)
	_ = a.closeRepo()
}

func (a *App) Repo() storage.Repository                 { return a.repo }
func (a *App) WsSync() *service.WsSyncService           { return a.wsSync }
func (a *App) HistorySync() *service.HistorySyncService { return a.historySync }
func (a *App) Verify() *service.VerifyService           { return a.verify }

func (a *App) closeRepo() error {
	if a.pgRepo != nil {
		err := a.pgRepo.Close()
		a.pgRepo = nil
		a.repo = nil
		return err
	}
	a.repo = nil
	return nil
}
