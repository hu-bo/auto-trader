package exampleutil

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

type Logger struct {
	scope string
}

func NewLogger(scope string) Logger {
	return Logger{scope: scope}
}

func (l Logger) Banner(title string) {
	lineLen := max(32, utf8.RuneCountInString(title)+8)
	line := strings.Repeat("=", lineLen)
	fmt.Println(line)
	fmt.Printf("===  %s  ===\n", title)
	fmt.Println(line)
}

func (l Logger) Section(title string) {
	dashes := strings.Repeat("-", max(0, 60-utf8.RuneCountInString(title)))
	fmt.Printf("--- %s %s\n", title, dashes)
}

func (l Logger) Divider() {
	fmt.Println("+" + strings.Repeat("-", 79))
}

func (l Logger) base(message string, params ...any) {
	if l.scope != "" {
		message = "[" + l.scope + "] " + message
	}
	if len(params) == 0 {
		fmt.Println(message)
		return
	}
	formatted := make([]any, 0, len(params)+1)
	formatted = append(formatted, message)
	for _, p := range params {
		formatted = append(formatted, formatValue(p))
	}
	fmt.Println(formatted...)
}

func (l Logger) Info(message string, params ...any)    { l.base(message, params...) }
func (l Logger) Success(message string, params ...any) { l.base(message, params...) }
func (l Logger) Warn(message string, params ...any)    { l.base("警告 "+message, params...) }
func (l Logger) Error(message string, params ...any)   { l.base("错误 "+message, params...) }

func formatValue(v any) any {
	switch vv := v.(type) {
	case nil:
		return nil
	case string, bool,
		int, int8, int16, int32, int64,
		uint, uint8, uint16, uint32, uint64, uintptr,
		float32, float64,
		complex64, complex128:
		return v
	case error:
		return vv.Error()
	case json.RawMessage:
		return formatBytes([]byte(vv))
	case []byte:
		return formatBytes(vv)
	case fmt.Stringer:
		return vv.String()
	default:
		// Prefer JSON for structured objects so logs don't show pointer addresses or byte slices.
		b, err := json.Marshal(v)
		if err == nil {
			return string(b)
		}
		return fmt.Sprintf("%v", v)
	}
}

func formatBytes(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	if utf8.Valid(b) {
		return string(b)
	}
	return fmt.Sprintf("%x", b)
}

func (l Logger) KV(label string, value any) {
	padded := padRightWithDots(label, 24)
	l.Info(fmt.Sprintf("%s %v", padded, value))
}

func (l Logger) JSON(label string, payload any) {
	l.Section(label)
	pretty, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		l.Error("JSON 序列化失败", err)
		return
	}
	fmt.Println(string(pretty))
	l.Divider()
}

func (l Logger) Timed(title string, fn func() error) error {
	start := time.Now()
	l.Info(title + " [开始]")
	err := fn()
	elapsed := time.Since(start)
	if err != nil {
		l.Error(fmt.Sprintf("%s (%s) [失败]", title, formatDuration(elapsed)), "err", err)
		return err
	}
	l.Success(fmt.Sprintf("%s (%s) [完成]", title, formatDuration(elapsed)))
	return nil
}

type ListItem struct {
	Key   string
	Value string
}

func FormatList(items []ListItem) string {
	lines := make([]string, 0, len(items))
	for _, it := range items {
		lines = append(lines, padRightWithDots(it.Key, 24)+" "+it.Value)
	}
	return strings.Join(lines, "\n")
}

func padRightWithDots(s string, width int) string {
	n := utf8.RuneCountInString(s)
	if n >= width {
		return s
	}
	return s + strings.Repeat(".", width-n)
}

func formatDuration(d time.Duration) string {
	if d < time.Second {
		return fmt.Sprintf("%.0fms", float64(d)/float64(time.Millisecond))
	}
	return fmt.Sprintf("%.2fs", d.Seconds())
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
