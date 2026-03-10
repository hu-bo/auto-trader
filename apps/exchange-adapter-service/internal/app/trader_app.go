package app

import (
	"context"
	"fmt"
	"os/signal"
	"syscall"
	"time"

	httpapi "exchange-adapter-service/internal/api"
	"exchange-adapter-service/internal/config"
	grpcserver "exchange-adapter-service/internal/grpc"
	"exchange-adapter-service/internal/publisher"
	"exchange-adapter-service/internal/session"
	"exchange-adapter-service/internal/trading"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/logger"
)

var log = logger.Module("app")

type App struct {
	cfg *config.Config

	store    *session.Store
	manager  *trading.Manager
	orderIdx *trading.OrderIndex
	hub      *trading.OrderUpdateHub

	grpcSvc *grpcserver.ExchangeService
	grpcServer    *grpcserver.Server
	httpServer    *httpapi.Server
	natsPublisher *publisher.Publisher

	marketApp *MarketApp
}

func New(cfg *config.Config) (*App, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config is nil")
	}

	orderIdx := trading.NewOrderIndex()
	hub := trading.NewOrderUpdateHub(256)
	manager := trading.NewManager(trading.ManagerOptions{
		WS:                   trading.WSConfig{AutoReconnect: true, ReconnectIntervalSec: 5, MaxReconnectAttempts: 10},
		AutoSubscribeOnOrder: true,
	}, orderIdx, hub)

	store := session.NewStore(cfg.Session.TokenTTL(), cfg.Session.CleanupInterval())
	store.SetOnDelete(func(token string, _ session.AccountConfig) {
		// Do not block the cleanup goroutine on slow network/WS teardown.
		go func() {
			cctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			manager.CloseSession(cctx, token)
		}()
	})

	// NATS publisher for order update forwarding (separate from MarketApp's publisher).
	var natsPub *publisher.Publisher
	if cfg.NATS.IsEnabled() {
		pub, err := publisher.New(&cfg.NATS)
		if err != nil {
			log.Warn().Err(err).Msg("failed to create NATS publisher for order updates, continuing without it")
		} else {
			natsPub = pub
			manager.SetOnOrderUpdate(func(accountID string, upd trading.OrderUpdate) {
				posSide := ""
				if upd.PositionSide != nil {
					posSide = string(*upd.PositionSide)
				}
				pub.PublishOrderUpdate(accountID, publisher.OrderUpdateMessage{
					OrderID:        upd.OrderID,
					ClientOrderID:  upd.ClientOrderID,
					Symbol:         upd.Symbol,
					TradeType:      string(upd.TradeType),
					Side:           string(upd.Side),
					PositionSide:   posSide,
					OrderType:      string(upd.OrderType),
					Status:         string(upd.Status),
					Price:          upd.Price,
					Quantity:       upd.Quantity,
					FilledQuantity: upd.FilledQuantity,
					AvgPrice:       upd.AvgPrice,
					Fee:            upd.Fee,
					FeeAsset:       upd.FeeAsset,
					ReduceOnly:     upd.ReduceOnly,
					UpdateTime:     upd.UpdateTime,
				})
			})
			manager.SetOnOrderUpdateToken(func(token string, ex core.Exchange, upd trading.OrderUpdate) {
				posSide := ""
				if upd.PositionSide != nil {
					posSide = string(*upd.PositionSide)
				}
				pub.PublishOrderUpdateByToken(string(ex), token, publisher.OrderUpdateMessage{
					OrderID:        upd.OrderID,
					ClientOrderID:  upd.ClientOrderID,
					Symbol:         upd.Symbol,
					TradeType:      string(upd.TradeType),
					Side:           string(upd.Side),
					PositionSide:   posSide,
					OrderType:      string(upd.OrderType),
					Status:         string(upd.Status),
					Price:          upd.Price,
					Quantity:       upd.Quantity,
					FilledQuantity: upd.FilledQuantity,
					AvgPrice:       upd.AvgPrice,
					Fee:            upd.Fee,
					FeeAsset:       upd.FeeAsset,
					ReduceOnly:     upd.ReduceOnly,
					UpdateTime:     upd.UpdateTime,
				})
			})
			manager.SetOnStrategyOrderUpdate(func(accountID string, upd trading.StrategyOrderUpdate) {
				posSide := ""
				if upd.PositionSide != nil {
					posSide = string(*upd.PositionSide)
				}
				pub.PublishStrategyOrderUpdate(accountID, publisher.StrategyOrderUpdateMessage{
					AlgoID:       upd.AlgoID,
					ClientAlgoID: upd.ClientAlgoID,
					Symbol:       upd.Symbol,
					TradeType:    string(upd.TradeType),
					Side:         string(upd.Side),
					PositionSide: posSide,
					StrategyType: string(upd.StrategyType),
					Status:       string(upd.Status),
					TriggerPrice: upd.TriggerPrice,
					OrderPrice:   upd.OrderPrice,
					Quantity:     upd.Quantity,
					TriggerTime:  upd.TriggerTime,
					UpdateTime:   upd.UpdateTime,
				})
			})
			manager.SetOnStrategyOrderUpdateToken(func(token string, ex core.Exchange, upd trading.StrategyOrderUpdate) {
				posSide := ""
				if upd.PositionSide != nil {
					posSide = string(*upd.PositionSide)
				}
				pub.PublishStrategyOrderUpdateByToken(string(ex), token, publisher.StrategyOrderUpdateMessage{
					AlgoID:       upd.AlgoID,
					ClientAlgoID: upd.ClientAlgoID,
					Symbol:       upd.Symbol,
					TradeType:    string(upd.TradeType),
					Side:         string(upd.Side),
					PositionSide: posSide,
					StrategyType: string(upd.StrategyType),
					Status:       string(upd.Status),
					TriggerPrice: upd.TriggerPrice,
					OrderPrice:   upd.OrderPrice,
					Quantity:     upd.Quantity,
					TriggerTime:  upd.TriggerTime,
					UpdateTime:   upd.UpdateTime,
				})
			})
			log.Info().Msg("NATS order update publisher wired")
		}
	}

	svc := grpcserver.NewExchangeService(cfg, store, manager, orderIdx, hub)
	srv, err := grpcserver.New(cfg, svc)
	if err != nil {
		return nil, err
	}

	marketApp, err := NewMarketApp(cfg)
	if err != nil {
		return nil, err
	}

	return &App{
		cfg:           cfg,
		store:         store,
		manager:       manager,
		orderIdx:      orderIdx,
		hub:           hub,
		grpcSvc:       svc,
		grpcServer:    srv,
		natsPublisher: natsPub,
		marketApp:     marketApp,
	}, nil
}

func (a *App) Run() error {
	if a == nil || a.cfg == nil {
		return fmt.Errorf("app not initialized")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if a.store != nil {
		a.store.StartCleanup(ctx)
	}

	if a.marketApp != nil {
		if err := a.marketApp.Start(ctx); err != nil {
			return err
		}
	}

	if a.grpcSvc != nil && a.marketApp != nil {
		if repo := a.marketApp.Repo(); repo != nil {
			if err := a.grpcSvc.LoadSymbolPrecisionCache(ctx, repo); err != nil {
				log.Warn().Err(err).Msg("failed to load symbol precision cache")
			}
		}
	}

	httpSrv, err := httpapi.NewServer(a.cfg, a.marketApp.WsSync(), a.marketApp.HistorySync(), a.marketApp.Verify(), a.marketApp.TickerSync(), a.marketApp.Repo())
	if err != nil {
		return err
	}
	a.httpServer = httpSrv

	errCh := make(chan error, 2)
	go func() {
		errCh <- a.grpcServer.Start()
	}()
	go func() {
		errCh <- a.httpServer.Start()
	}()

	log.Info().
		Int("grpc_port", a.cfg.Server.GRPCPort).
		Int("http_port", a.cfg.Server.HTTPPort).
		Bool("tls", a.cfg.Security.TLSEnabled).
		Msg("exchange-adapter-service started")

	select {
	case <-ctx.Done():
	case err := <-errCh:
		if err != nil {
			log.Error().Err(err).Msg("server stopped with error")
		}
	}

	log.Info().Msg("shutting down...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if a.grpcServer != nil {
		_ = a.grpcServer.Stop(shutdownCtx)
	}
	if a.httpServer != nil {
		_ = a.httpServer.Stop(shutdownCtx)
	}
	if a.marketApp != nil {
		a.marketApp.Stop(shutdownCtx)
	}
	if a.manager != nil {
		a.manager.CloseAll(shutdownCtx)
	}
	if a.natsPublisher != nil {
		_ = a.natsPublisher.Close()
	}

	log.Info().Msg("shutdown complete")
	return nil
}
