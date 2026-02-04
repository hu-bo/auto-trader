package cron

import (
	"context"
	"fmt"
	"sync"

	robcron "github.com/robfig/cron/v3"
)

type Starter func(parent context.Context, c *robcron.Cron) error

type Runner struct {
	c *robcron.Cron

	mu      sync.Mutex
	started bool
}

func New(opts ...robcron.Option) *Runner {
	return &Runner{c: robcron.New(opts...)}
}

func (r *Runner) Start(ctx context.Context, starters ...Starter) error {
	if r == nil || r.c == nil {
		return fmt.Errorf("cron runner not initialized")
	}

	r.mu.Lock()
	if r.started {
		r.mu.Unlock()
		return fmt.Errorf("cron runner already started")
	}
	r.mu.Unlock()

	for _, s := range starters {
		if s == nil {
			continue
		}
		if err := s(ctx, r.c); err != nil {
			return err
		}
	}

	r.mu.Lock()
	if r.started {
		r.mu.Unlock()
		return fmt.Errorf("cron runner already started")
	}
	r.started = true
	r.mu.Unlock()

	r.c.Start()
	return nil
}

func (r *Runner) Stop(ctx context.Context) error {
	if r == nil || r.c == nil {
		return nil
	}

	r.mu.Lock()
	if !r.started {
		r.mu.Unlock()
		return nil
	}
	r.started = false
	r.mu.Unlock()

	done := r.c.Stop()
	if ctx == nil {
		<-done.Done()
		return nil
	}

	select {
	case <-done.Done():
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
