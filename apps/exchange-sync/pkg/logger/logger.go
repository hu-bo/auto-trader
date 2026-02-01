package logger

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"gopkg.in/natefinch/lumberjack.v2"
)

// Config 日志配置
type Config struct {
	// Level 日志级别: debug, info, warn, error
	Level string `mapstructure:"level"`
	// Format 输出格式: json, console
	Format string `mapstructure:"format"`
	// Output 输出目标: stdout, file, both
	Output string `mapstructure:"output"`
	// Dir 日志文件目录
	Dir string `mapstructure:"dir"`
	// Filename 日志文件名前缀
	Filename string `mapstructure:"filename"`
	// FilenameTemplate 日志文件名模板, 支持 {{filename}} 和 {{date}}
	FilenameTemplate string `mapstructure:"filename_template"`
	// MaxSize 单个日志文件最大大小 (MB)
	MaxSize int `mapstructure:"max_size"`
	// MaxAge 日志文件最大保留天数
	MaxAge int `mapstructure:"max_age"`
	// MaxBackups 最大保留文件数
	MaxBackups int `mapstructure:"max_backups"`
	// Compress 是否压缩旧日志
	Compress bool `mapstructure:"compress"`
}

// DefaultConfig 默认配置
func DefaultConfig() Config {
	return Config{
		Level:      "info",
		Format:     "console",
		Output:     "both",
		Dir:        "logs",
		Filename:   "exchange-sync",
		MaxSize:    100,
		MaxAge:     30,
		MaxBackups: 10,
		Compress:   true,
	}
}

var (
	// L 全局 logger 实例
	L zerolog.Logger
	// initialized 是否已初始化
	initialized bool
)

// Init 初始化全局 logger
func Init(cfg Config) error {
	level, err := zerolog.ParseLevel(cfg.Level)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	// 设置时间格式
	zerolog.TimeFieldFormat = time.RFC3339

	var writers []io.Writer

	// 控制台输出
	if cfg.Output == "stdout" || cfg.Output == "both" {
		consoleWriter := zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: "2006-01-02 15:04:05",
			NoColor:    false,
		}
		if cfg.Format == "json" {
			writers = append(writers, os.Stdout)
		} else {
			writers = append(writers, consoleWriter)
		}
	}

	// 文件输出 (带日志轮转)
	if cfg.Output == "file" || cfg.Output == "both" {
		if err := os.MkdirAll(cfg.Dir, 0755); err != nil {
			return fmt.Errorf("create log dir: %w", err)
		}

		fileWriter := &lumberjack.Logger{
			Filename:   buildLogFilename(cfg),
			MaxSize:    cfg.MaxSize,
			MaxAge:     cfg.MaxAge,
			MaxBackups: cfg.MaxBackups,
			Compress:   cfg.Compress,
			LocalTime:  true,
		}
		writers = append(writers, fileWriter)
	}

	// 多写入器
	var writer io.Writer
	if len(writers) == 1 {
		writer = writers[0]
	} else {
		writer = zerolog.MultiLevelWriter(writers...)
	}

	L = zerolog.New(writer).With().Timestamp().Logger()
	initialized = true

	return nil
}

// InitDefault 使用默认配置初始化
func InitDefault() {
	if initialized {
		return
	}
	cfg := DefaultConfig()
	cfg.Output = "stdout"
	cfg.Format = "console"
	_ = Init(cfg)
}

// ModuleLogger 延迟绑定的模块 logger
type ModuleLogger struct {
	name string
}

// Module 返回带模块名的子 logger (延迟绑定)
func Module(name string) *ModuleLogger {
	return &ModuleLogger{name: name}
}

func (m *ModuleLogger) getLogger() zerolog.Logger {
	if !initialized {
		InitDefault()
	}
	return L.With().Str("module", m.name).Logger()
}

func (m *ModuleLogger) Debug() *zerolog.Event {
	l := m.getLogger()
	return l.Debug()
}

func (m *ModuleLogger) Info() *zerolog.Event {
	l := m.getLogger()
	return l.Info()
}

func (m *ModuleLogger) Warn() *zerolog.Event {
	l := m.getLogger()
	return l.Warn()
}

func (m *ModuleLogger) Error() *zerolog.Event {
	l := m.getLogger()
	return l.Error()
}

func (m *ModuleLogger) Fatal() *zerolog.Event {
	l := m.getLogger()
	return l.Fatal()
}

func (m *ModuleLogger) Trace() *zerolog.Event {
	l := m.getLogger()
	return l.Trace()
}

func (m *ModuleLogger) Log() *zerolog.Event {
	l := m.getLogger()
	return l.Log()
}

func (m *ModuleLogger) With() zerolog.Context {
	l := m.getLogger()
	return l.With()
}

// Debug 输出 debug 级别日志
func Debug() *zerolog.Event {
	if !initialized {
		InitDefault()
	}
	return L.Debug()
}

// Info 输出 info 级别日志
func Info() *zerolog.Event {
	if !initialized {
		InitDefault()
	}
	return L.Info()
}

// Warn 输出 warn 级别日志
func Warn() *zerolog.Event {
	if !initialized {
		InitDefault()
	}
	return L.Warn()
}

// Error 输出 error 级别日志
func Error() *zerolog.Event {
	if !initialized {
		InitDefault()
	}
	return L.Error()
}

// Fatal 输出 fatal 级别日志并退出
func Fatal() *zerolog.Event {
	if !initialized {
		InitDefault()
	}
	return L.Fatal()
}

// WithError 带 error 的日志
func WithError(err error) *zerolog.Event {
	if !initialized {
		InitDefault()
	}
	return L.Error().Err(err)
}

func buildLogFilename(cfg Config) string {
	name := cfg.Filename
	if tpl := cfg.FilenameTemplate; tpl != "" {
		name = tpl
		name = strings.ReplaceAll(name, "{{filename}}", cfg.Filename)
		name = strings.ReplaceAll(name, "{{date}}", time.Now().Format("2006-01-02"))
	}
	if name == "" {
		name = cfg.Filename
	}
	if filepath.Ext(name) == "" {
		name += ".log"
	}
	return filepath.Join(cfg.Dir, name)
}
