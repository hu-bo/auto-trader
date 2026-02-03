package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	httpapi "exchange-adapter-service/internal/api"
	"exchange-adapter-service/internal/config"
	grpcserver "exchange-adapter-service/internal/grpc"
	"exchange-adapter-service/internal/market"
	"exchange-adapter-service/internal/session"
	"exchange-adapter-service/internal/trading"

	"github.com/pkg/logger"
)

var log = logger.Module("main")

func main() {
	cfg, err := config.Load()
	if err != nil {
		logger.InitDefault()
		log.Fatal().Err(err).Msg("failed to load config")
	}

	if err := logger.Init(logger.Config{Level: cfg.Log.Level, Format: cfg.Log.Format, Output: cfg.Log.Output, File: cfg.Log.File}); err != nil {
		logger.InitDefault()
		log.Error().Err(err).Msg("failed to init logger, using default")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

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
	store.StartCleanup(ctx)

	svc := grpcserver.NewExchangeService(cfg, store, manager, orderIdx, hub)
	srv, err := grpcserver.New(cfg, svc)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create gRPC server")
	}

	marketApp, err := market.New(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create market module")
	}
	if err := marketApp.Start(ctx); err != nil {
		log.Fatal().Err(err).Msg("failed to start market module")
	}

	httpSrv, err := httpapi.NewServer(cfg, marketApp.WsSync(), marketApp.HistorySync(), marketApp.Verify(), marketApp.Repo())
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create HTTP server")
	}

	errCh := make(chan error, 2)
	go func() {
		errCh <- srv.Start()
	}()
	go func() {
		errCh <- httpSrv.Start()
	}()

	log.Info().
		Int("grpc_port", cfg.Server.GRPCPort).
		Int("http_port", cfg.Server.HTTPPort).
		Bool("tls", cfg.Security.TLSEnabled).
		Msg("exchange-adapter-service started")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case <-quit:
	case err := <-errCh:
		if err != nil {
			log.Error().Err(err).Msg("server stopped with error")
		}
	}

	log.Info().Msg("shutting down...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	_ = srv.Stop(shutdownCtx)
	_ = httpSrv.Stop(shutdownCtx)
	marketApp.Stop(shutdownCtx)
	manager.CloseAll(shutdownCtx)
	log.Info().Msg("shutdown complete")
}
