package marketjobs

import (
	"context"
	"fmt"
	"time"

	"exchange-adapter-service/internal/storage"

	"github.com/pkg/logger"
	robcron "github.com/robfig/cron/v3"
)

var logPartition = logger.Module("marketjobs.partition")

const (
	defaultPartitionPreCreateCron    = "0 1 * * *"
	defaultPartitionPreCreateTimeout = 30 * time.Second
)

func StartPartitionPreCreate(pm *storage.PartitionManager, cronExpr string) func(parent context.Context, c *robcron.Cron) error {
	if cronExpr == "" {
		cronExpr = defaultPartitionPreCreateCron
	}

	return func(parent context.Context, c *robcron.Cron) error {
		if pm == nil {
			return fmt.Errorf("partition manager is nil")
		}
		if c == nil {
			return fmt.Errorf("cron is nil")
		}

		_, err := c.AddFunc(cronExpr, func() {
			if parent.Err() != nil {
				return
			}

			ctx, cancel := context.WithTimeout(parent, defaultPartitionPreCreateTimeout)
			defer cancel()

			if err := pm.CheckAndPreCreate(ctx); err != nil {
				logPartition.Error().Err(err).Msg("Cron: partition pre-create failed")
				return
			}
			logPartition.Info().Msg("Cron: partition pre-create completed")
		})
		if err != nil {
			return fmt.Errorf("add partition pre-create cron job: %w", err)
		}

		logPartition.Info().
			Str("cron", cronExpr).
			Int("pre_create_days", pm.GetPreCreateDays()).
			Msg("Cron: partition pre-create scheduled")

		go func() {
			ctx, cancel := context.WithTimeout(parent, defaultPartitionPreCreateTimeout)
			defer cancel()

			if err := pm.CheckAndPreCreate(ctx); err != nil {
				logPartition.Warn().Err(err).Msg("Cron: initial partition pre-create failed")
			}
		}()

		return nil
	}
}
