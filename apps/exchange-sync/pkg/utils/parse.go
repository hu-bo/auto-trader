package utils

import (
	"strconv"
	"strings"
	"time"
)

// ParseFloat 安全解析浮点数
func ParseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

// ParseInt 安全解析整数
func ParseInt(s string) int64 {
	i, _ := strconv.ParseInt(s, 10, 64)
	return i
}

// FormatFloat 格式化浮点数
func FormatFloat(f float64, precision int) string {
	return strconv.FormatFloat(f, 'f', precision, 64)
}

// TimeRange 时间范围
type TimeRange struct {
	Start int64
	End   int64
}

// Deprecated: 使用 Period.RoundToInterval 代替
func AlignTimestamp(ts int64, periodMinutes int) int64 {
	periodMs := int64(periodMinutes) * 60 * 1000
	return (ts / periodMs) * periodMs
}

// ChunkSlice 将切片分割成指定大小的块
func ChunkSlice[T any](slice []T, chunkSize int) [][]T {
	if chunkSize <= 0 {
		return nil
	}

	var chunks [][]T
	for i := 0; i < len(slice); i += chunkSize {
		end := i + chunkSize
		if end > len(slice) {
			end = len(slice)
		}
		chunks = append(chunks, slice[i:end])
	}

	return chunks
}

// MonthRange 月份范围
type MonthRange struct {
	Year  int
	Month int
}

// GetMonthTimestamp 获取指定年月第一天的时间戳(毫秒)
func GetMonthTimestamp(year, month int) int64 {
	t := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	return t.UnixMilli()
}

// GetMonthsBetween 获取两个时间戳之间的所有月份
func GetMonthsBetween(startTs, endTs int64) []MonthRange {
	start := time.UnixMilli(startTs).UTC()
	end := time.UnixMilli(endTs).UTC()

	var months []MonthRange
	current := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
	endMonth := time.Date(end.Year(), end.Month(), 1, 0, 0, 0, 0, time.UTC)

	for !current.After(endMonth) {
		months = append(months, MonthRange{
			Year:  current.Year(),
			Month: int(current.Month()),
		})
		current = current.AddDate(0, 1, 0)
	}

	return months
}

// BinarySearchMonth 二分查找有数据的最早月份
type DataChecker func(year, month int) (bool, error)

func BinarySearchEarliestMonth(startYear, endYear int, checker DataChecker) (*MonthRange, error) {
	startTs := GetMonthTimestamp(startYear, 1)
	endTs := GetMonthTimestamp(endYear, 12)

	months := GetMonthsBetween(startTs, endTs)
	if len(months) == 0 {
		return nil, nil
	}

	left, right := 0, len(months)-1
	result := -1

	for left <= right {
		mid := (left + right) / 2
		m := months[mid]

		hasData, err := checker(m.Year, m.Month)
		if err != nil {
			return nil, err
		}

		if hasData {
			result = mid
			right = mid - 1
		} else {
			left = mid + 1
		}
	}

	if result == -1 {
		return nil, nil
	}

	return &months[result], nil
}

// ExtractBaseCurrency 从交易对中提取基础货币
func ExtractBaseCurrency(symbol string) string {
	parts := strings.Split(symbol, "-")
	if len(parts) > 0 {
		return parts[0]
	}
	// 处理 BTCUSDT 格式
	suffixes := []string{"USDT", "BUSD", "USDC", "BTC", "ETH"}
	for _, suffix := range suffixes {
		if strings.HasSuffix(symbol, suffix) {
			return strings.TrimSuffix(symbol, suffix)
		}
	}
	return symbol
}

// ExtractQuoteCurrency 从交易对中提取计价货币
func ExtractQuoteCurrency(symbol string) string {
	parts := strings.Split(symbol, "-")
	if len(parts) > 1 {
		return parts[1]
	}
	// 处理 BTCUSDT 格式
	suffixes := []string{"USDT", "BUSD", "USDC", "BTC", "ETH"}
	for _, suffix := range suffixes {
		if strings.HasSuffix(symbol, suffix) {
			return suffix
		}
	}
	return ""
}

// RetryWithBackoff 带退避的重试
type RetryConfig struct {
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
	Multiplier     float64
}

func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:     3,
		InitialBackoff: time.Second,
		MaxBackoff:     time.Minute,
		Multiplier:     2.0,
	}
}

func RetryWithBackoff[T any](cfg RetryConfig, fn func() (T, error)) (T, error) {
	var result T
	var err error
	backoff := cfg.InitialBackoff

	for i := 0; i <= cfg.MaxRetries; i++ {
		result, err = fn()
		if err == nil {
			return result, nil
		}

		if i < cfg.MaxRetries {
			time.Sleep(backoff)
			backoff = time.Duration(float64(backoff) * cfg.Multiplier)
			if backoff > cfg.MaxBackoff {
				backoff = cfg.MaxBackoff
			}
		}
	}

	return result, err
}
