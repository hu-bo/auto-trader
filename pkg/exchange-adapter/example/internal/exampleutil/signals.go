package exampleutil

import (
	"context"
	"os"
	"os/signal"
	"syscall"
)

func WaitForShutdown(ctx context.Context, log Logger, cleanup func(context.Context) error) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	select {
	case <-ctx.Done():
		_ = cleanup(context.Background())
	case <-sigCh:
		log.Info("正在关闭连接...")
		_ = cleanup(context.Background())
	}
}
