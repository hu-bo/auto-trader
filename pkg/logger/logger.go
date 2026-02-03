package logger

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

type Config struct {
	Level  string
	Format string // json|console
	Output string // stdout|file
	File   string // base file path when output=file, e.g. ./logs/app.log
}

var (
	L           zerolog.Logger
	initialized bool
	closer      io.Closer
)

func Init(cfg Config) error {
	level, err := zerolog.ParseLevel(strings.ToLower(cfg.Level))
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)
	zerolog.TimeFieldFormat = time.RFC3339Nano

	if closer != nil {
		_ = closer.Close()
		closer = nil
	}

	out := io.Writer(os.Stdout)
	fileOutput := false
	switch strings.ToLower(strings.TrimSpace(cfg.Output)) {
	case "", "stdout":
	case "file":
		if strings.TrimSpace(cfg.File) == "" {
			return fmt.Errorf("log output=file requires log file path")
		}
		w, err := newDailyFileWriter(cfg.File)
		if err != nil {
			return err
		}
		out = w
		closer = w
		fileOutput = true
	default:
		return fmt.Errorf("unsupported log output: %s", cfg.Output)
	}

	var w io.Writer = out
	if strings.ToLower(cfg.Format) == "console" {
		w = zerolog.ConsoleWriter{Out: out, TimeFormat: "2006-01-02 15:04:05", NoColor: fileOutput}
	}

	L = zerolog.New(w).With().Timestamp().Logger()
	initialized = true
	return nil
}

func InitDefault() {
	if initialized {
		return
	}
	_ = Init(Config{Level: "info", Format: "console", Output: "stdout"})
}

type ModuleLogger struct {
	name string
}

func Module(name string) *ModuleLogger {
	return &ModuleLogger{name: name}
}

func (m *ModuleLogger) base() zerolog.Logger {
	if !initialized {
		InitDefault()
	}
	return L.With().Str("module", m.name).Logger()
}

func (m *ModuleLogger) Debug() *zerolog.Event { l := m.base(); return l.Debug() }
func (m *ModuleLogger) Info() *zerolog.Event  { l := m.base(); return l.Info() }
func (m *ModuleLogger) Warn() *zerolog.Event  { l := m.base(); return l.Warn() }
func (m *ModuleLogger) Error() *zerolog.Event { l := m.base(); return l.Error() }
func (m *ModuleLogger) Fatal() *zerolog.Event { l := m.base(); return l.Fatal() }
