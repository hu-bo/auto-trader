package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type dailyFileWriter struct {
	basePath string
	date     string
	f        *os.File
	mu       sync.Mutex
}

func newDailyFileWriter(basePath string) (*dailyFileWriter, error) {
	w := &dailyFileWriter{basePath: strings.TrimSpace(basePath)}
	if w.basePath == "" {
		return nil, fmt.Errorf("log file path is empty")
	}
	if err := w.rotateIfNeeded(time.Now()); err != nil {
		return nil, err
	}
	return w, nil
}

func (w *dailyFileWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if err := w.rotateIfNeeded(time.Now()); err != nil {
		return 0, err
	}
	return w.f.Write(p)
}

func (w *dailyFileWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.f == nil {
		return nil
	}
	err := w.f.Close()
	w.f = nil
	w.date = ""
	return err
}

func (w *dailyFileWriter) rotateIfNeeded(now time.Time) error {
	date := now.Format("2006-01-02")
	if w.f != nil && date == w.date {
		return nil
	}

	if w.f != nil {
		_ = w.f.Close()
		w.f = nil
	}

	path := datedPath(w.basePath, date)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create log dir: %w", err)
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open log file: %w", err)
	}

	w.f = f
	w.date = date
	return nil
}

func datedPath(basePath, date string) string {
	dir := filepath.Dir(basePath)
	base := filepath.Base(basePath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	if name == "" {
		name = "log"
	}
	return filepath.Join(dir, fmt.Sprintf("%s-%s%s", name, date, ext))
}
