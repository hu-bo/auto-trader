package utils

import "time"

// Period K线周期类型
type Period string

const (
	Period1m  Period = "1m"
	Period5m  Period = "5m"
	Period15m Period = "15m"
	Period30m Period = "30m"
	Period1h  Period = "1h"
	Period4h  Period = "4h"
	Period1d  Period = "1d"
)

// 周期常量 (毫秒)
const (
	Minute = 60 * 1000
	Hour   = 60 * Minute
	Day    = 24 * Hour
)

// PeriodIntervalMs 周期对应的毫秒数
var PeriodIntervalMs = map[Period]int64{
	Period1m:  1 * Minute,
	Period5m:  5 * Minute,
	Period15m: 15 * Minute,
	Period30m: 30 * Minute,
	Period1h:  1 * Hour,
	Period4h:  4 * Hour,
	Period1d:  1 * Day,
}

// PeriodMinutes 周期对应的分钟数
var PeriodMinutes = map[Period]int{
	Period1m:  1,
	Period5m:  5,
	Period15m: 15,
	Period30m: 30,
	Period1h:  60,
	Period4h:  240,
	Period1d:  1440,
}

// AllPeriods 所有支持的周期
var AllPeriods = []Period{Period1m, Period5m, Period15m, Period30m, Period1h, Period4h, Period1d}

// IntervalMs 获取周期的毫秒间隔
func (p Period) IntervalMs() int64 {
	if ms, ok := PeriodIntervalMs[p]; ok {
		return ms
	}
	return 0
}

// Minutes 获取周期的分钟数
func (p Period) Minutes() int {
	if m, ok := PeriodMinutes[p]; ok {
		return m
	}
	return 0
}

// IsValid 检查周期是否有效
func (p Period) IsValid() bool {
	_, ok := PeriodIntervalMs[p]
	return ok
}

// String 返回周期字符串
func (p Period) String() string {
	return string(p)
}

// ParsePeriod 解析周期字符串
func ParsePeriod(s string) (Period, bool) {
	p := Period(s)
	return p, p.IsValid()
}

// RoundToInterval 将时间戳对齐到周期起始时间
// 例如: 10:23 对齐到 15m 周期 -> 10:15
func (p Period) RoundToInterval(ts int64) int64 {
	interval := p.IntervalMs()
	if interval == 0 {
		return ts
	}
	return (ts / interval) * interval
}

// RoundTimeToInterval 将时间对齐到周期起始时间
func (p Period) RoundTimeToInterval(t time.Time) time.Time {
	return time.UnixMilli(p.RoundToInterval(t.UnixMilli()))
}

// NextInterval 获取下一个周期的起始时间戳
func (p Period) NextInterval(ts int64) int64 {
	return p.RoundToInterval(ts) + p.IntervalMs()
}

// PrevInterval 获取上一个周期的起始时间戳
func (p Period) PrevInterval(ts int64) int64 {
	return p.RoundToInterval(ts) - p.IntervalMs()
}

// IsClosed 判断指定时间戳对应的周期是否已结束
func (p Period) IsClosed(ts int64, now time.Time) bool {
	periodEnd := p.RoundToInterval(ts) + p.IntervalMs()
	return now.UnixMilli() >= periodEnd
}

// Interval 获取一段时间范围
// 返回 [now - period*num, now] 的时间范围
func (p Period) Interval(num int) (start, end int64) {
	now := time.Now().UnixMilli()
	return now - p.IntervalMs()*int64(num), now
}

// IntervalFrom 从指定时间往前获取一段时间范围
func (p Period) IntervalFrom(from time.Time, num int) (start, end int64) {
	end = from.UnixMilli()
	start = end - p.IntervalMs()*int64(num)
	return
}

// CountPeriods 计算时间范围内有多少个周期
func (p Period) CountPeriods(startTs, endTs int64) int {
	interval := p.IntervalMs()
	if interval == 0 {
		return 0
	}
	return int((endTs - startTs) / interval)
}

// GenerateTimestamps 生成时间范围内的所有周期时间戳
func (p Period) GenerateTimestamps(startTs, endTs int64) []int64 {
	interval := p.IntervalMs()
	if interval == 0 {
		return nil
	}

	start := p.RoundToInterval(startTs)
	var timestamps []int64
	for ts := start; ts <= endTs; ts += interval {
		timestamps = append(timestamps, ts)
	}
	return timestamps
}

// SplitRange 将时间范围按 limit 分割成多个区间
// 用于分批查询 API
func (p Period) SplitRange(startTs, endTs int64, limit int) []TimeRange {
	interval := p.IntervalMs()
	if interval == 0 || limit <= 0 {
		return nil
	}

	var ranges []TimeRange
	current := p.RoundToInterval(startTs)

	for current < endTs {
		rangeEnd := current + interval*int64(limit)
		if rangeEnd > endTs {
			rangeEnd = endTs
		}
		ranges = append(ranges, TimeRange{Start: current, End: rangeEnd})
		current = rangeEnd
	}

	return ranges
}

// CandleKey 生成 K 线唯一键
func (p Period) CandleKey(exchange, symbol string, ts int64) string {
	return exchange + ":" + symbol + ":" + string(p) + ":" + FormatInt(ts)
}

// FormatInt 格式化整数为字符串
func FormatInt(i int64) string {
	return time.UnixMilli(i).Format("20060102150405")
}

// NowMs 获取当前时间戳(毫秒)
func NowMs() int64 {
	return time.Now().UnixMilli()
}

// DaysAgo 获取 N 天前的时间戳
func DaysAgo(days int) int64 {
	return time.Now().Add(-time.Duration(days) * 24 * time.Hour).UnixMilli()
}

// HoursAgo 获取 N 小时前的时间戳
func HoursAgo(hours int) int64 {
	return time.Now().Add(-time.Duration(hours) * time.Hour).UnixMilli()
}

// MinutesAgo 获取 N 分钟前的时间戳
func MinutesAgo(minutes int) int64 {
	return time.Now().Add(-time.Duration(minutes) * time.Minute).UnixMilli()
}
