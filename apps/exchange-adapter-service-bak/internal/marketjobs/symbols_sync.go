package marketjobs

import (
	"context"
	"fmt"
	"time"

	"exchange-adapter-service/internal/service"

	"github.com/pkg/logger"
	robcron "github.com/robfig/cron/v3"
)

var logSymbols = logger.Module("marketjobs.symbols")

const (
	defaultSymbolsSyncCron    = "0 0 * * *"
	defaultSymbolsSyncTimeout = 30 * time.Minute
)

func StartSymbolsSync(history *service.HistorySyncService, cronExpr string) func(parent context.Context, c *robcron.Cron) error {
	if cronExpr == "" {
		cronExpr = defaultSymbolsSyncCron
	}

	return func(parent context.Context, c *robcron.Cron) error {
		if history == nil {
			return fmt.Errorf("history sync service is nil")
		}
		if c == nil {
			return fmt.Errorf("cron is nil")
		}

		_, err := c.AddFunc(cronExpr, func() {
			if parent.Err() != nil {
				return
			}

			logSymbols.Info().Msg("Cron: starting symbols sync...")
			ctx, cancel := context.WithTimeout(parent, defaultSymbolsSyncTimeout)
			defer cancel()

			if err := history.SyncSymbols(ctx); err != nil {
				logSymbols.Error().Err(err).Msg("Cron: symbols sync failed")
				return
			}
			logSymbols.Info().Msg("Cron: symbols sync completed")
		})
		if err != nil {
			return fmt.Errorf("add symbols sync cron job: %w", err)
		}

		logSymbols.Info().Str("cron", cronExpr).Msg("Cron: symbols sync scheduled")
		return nil
	}
}
