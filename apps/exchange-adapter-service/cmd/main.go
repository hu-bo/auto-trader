package main

import (
	"exchange-adapter-service/internal/app"
	"exchange-adapter-service/internal/config"

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

	traderApp, err := app.New(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize app")
	}

	if err := traderApp.Run(); err != nil {
		log.Fatal().Err(err).Msg("app exited with error")
	}
}
