package util

import (
	"fmt"
	"log"
	"os"
	"time"
)

// LogLevel represents log level.
type LogLevel int

const (
	LogLevelTrace LogLevel = iota
	LogLevelDebug
	LogLevelInfo
	LogLevelWarn
	LogLevelError
	LogLevelSilent
)

// Logger represents a simple logger.
type Logger struct {
	level  LogLevel
	prefix string
	logger *log.Logger
}

// DefaultLogger is the default logger instance.
var DefaultLogger = NewLogger(LogLevelInfo, "binance")

// NewLogger creates a new logger.
func NewLogger(level LogLevel, prefix string) *Logger {
	return &Logger{
		level:  level,
		prefix: prefix,
		logger: log.New(os.Stdout, "", 0),
	}
}

// SetLevel sets the log level.
func (l *Logger) SetLevel(level LogLevel) {
	l.level = level
}

// GetLevel returns the current log level.
func (l *Logger) GetLevel() LogLevel {
	return l.level
}

func (l *Logger) log(level LogLevel, levelStr string, format string, args ...interface{}) {
	if l.level > level {
		return
	}

	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	message := fmt.Sprintf(format, args...)
	l.logger.Printf("[%s] [%s] [%s] %s", timestamp, levelStr, l.prefix, message)
}

// Trace logs a trace message.
func (l *Logger) Trace(format string, args ...interface{}) {
	l.log(LogLevelTrace, "TRACE", format, args...)
}

// Debug logs a debug message.
func (l *Logger) Debug(format string, args ...interface{}) {
	l.log(LogLevelDebug, "DEBUG", format, args...)
}

// Info logs an info message.
func (l *Logger) Info(format string, args ...interface{}) {
	l.log(LogLevelInfo, "INFO", format, args...)
}

// Warn logs a warning message.
func (l *Logger) Warn(format string, args ...interface{}) {
	l.log(LogLevelWarn, "WARN", format, args...)
}

// Error logs an error message.
func (l *Logger) Error(format string, args ...interface{}) {
	l.log(LogLevelError, "ERROR", format, args...)
}
