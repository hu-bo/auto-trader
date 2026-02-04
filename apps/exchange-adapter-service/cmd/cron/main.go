package main

import (
	"context"
	"os/signal"
	"syscall"
	"time"

	"exchange-adapter-service/internal/config"
	cronrunner "exchange-adapter-service/internal/cron"
	"exchange-adapter-service/internal/marketjobs"
	"exchange-adapter-service/internal/service"
	"exchange-adapter-service/internal/storage"

	"github.com/pkg/logger"
)

var log = logger.Module("cron.main")

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

	if !cfg.Market.Enabled {
		log.Info().Msg("market module disabled; cron exiting")
		return
	}

	if !cfg.Database.IsEnabled() {
		log.Fatal().Msg("database not configured; cron requires database")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	repo, err := storage.NewPostgresRepository(ctx, &cfg.Database)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init database")
	}
	defer repo.Close()

	if err := repo.InitSchema(ctx); err != nil {
		log.Fatal().Err(err).Msg("failed to init schema")
	}

	historySync, err := service.NewHistorySyncService(cfg, repo)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create history sync service")
	}

	runner := cronrunner.New()
	if err := runner.Start(ctx,
		marketjobs.StartPartitionPreCreate(repo.GetPartitionManager(), ""),
		marketjobs.StartSymbolsSync(historySync, ""),
	); err != nil {
		log.Fatal().Err(err).Msg("failed to start cron runner")
	}

	log.Info().Msg("cron started")
	<-ctx.Done()

	log.Info().Msg("shutting down cron...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	_ = runner.Stop(shutdownCtx)
	log.Info().Msg("cron shutdown complete")
}
