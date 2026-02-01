package risk

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// parseDuration parses a duration string into milliseconds
// Supports: "15m", "1h", "2d", or raw milliseconds
//
// Examples:
//   parseDuration("15m")  => 900000
//   parseDuration("1h")   => 3600000
//   parseDuration(60000)  => 60000
func parseDuration(duration interface{}) (int64, error) {
	switch v := duration.(type) {
	case int64:
		return v, nil
	case int:
		return int64(v), nil
	case float64:
		return int64(v), nil
	case string:
		return parseDurationString(v)
	default:
		return 0, fmt.Errorf("invalid duration type: %T", duration)
	}
}

// parseDurationString parses duration strings like "15m", "1h", "2d"
func parseDurationString(s string) (int64, error) {
	pattern := regexp.MustCompile(`^(\d+(?:\.\d+)?)(ms|s|m|h|d)$`)
	matches := pattern.FindStringSubmatch(s)
	if matches == nil {
		return 0, fmt.Errorf("invalid duration format: %s", s)
	}

	value, err := strconv.ParseFloat(matches[1], 64)
	if err != nil {
		return 0, fmt.Errorf("invalid duration value: %s", matches[1])
	}

	unit := matches[2]
	multipliers := map[string]int64{
		"ms": 1,
		"s":  1000,
		"m":  60 * 1000,
		"h":  60 * 60 * 1000,
		"d":  24 * 60 * 60 * 1000,
	}

	multiplier, ok := multipliers[unit]
	if !ok {
		return 0, fmt.Errorf("unknown duration unit: %s", unit)
	}

	return int64(value * float64(multiplier)), nil
}

// GetPositionKey generates a unique key for a position
func GetPositionKey(symbol string, side PositionSide) string {
	return fmt.Sprintf("%s:%s", symbol, side)
}

// CalculatePnlPct calculates position PnL percentage (based on margin)
func CalculatePnlPct(position PositionSnapshot) float64 {
	if position.MarginUsed == 0 {
		return 0
	}
	return position.UnrealizedPnl / position.MarginUsed
}

// CalculateMarginUsagePct calculates margin usage percentage
func CalculateMarginUsagePct(account AccountSnapshot) float64 {
	if account.Equity == 0 {
		return 0
	}
	return account.MarginUsed / account.Equity
}

// FormatPct formats a number as a percentage string
func FormatPct(value float64, decimals int) string {
	format := fmt.Sprintf("%%.%df%%%%", decimals)
	return fmt.Sprintf(format, value*100)
}

// DeepMerge performs a deep merge of two PositionRiskConfig objects
// The source config overrides the target config for non-nil values
func DeepMerge(target, source PositionRiskConfig) PositionRiskConfig {
	result := target

	// Merge primitive fields - always override if source is non-zero
	if source.StopProfitPct != 0 {
		result.StopProfitPct = source.StopProfitPct
	}
	if source.StopLossPct != 0 {
		result.StopLossPct = source.StopLossPct
	}
	if source.OnBreach != "" {
		result.OnBreach = source.OnBreach
	}
	if source.Cooldown != nil {
		result.Cooldown = source.Cooldown
	}

	// Merge pointer fields - override if not nil
	if source.MaxLossPerPosition != nil {
		result.MaxLossPerPosition = source.MaxLossPerPosition
	}
	if source.ReduceRatio != nil {
		result.ReduceRatio = source.ReduceRatio
	}

	return result
}

// CreateInitialState creates an initial risk state
func CreateInitialState() *RiskState {
	return &RiskState{
		AccountBlocked: false,
		Positions:      make(map[string]*PositionRiskState),
	}
}

// deepCloneRiskContext creates a deep clone of RiskContext for audit logging
func deepCloneRiskContext(ctx RiskContext) (RiskContext, error) {
	// Use JSON marshaling/unmarshaling for deep cloning
	data, err := json.Marshal(ctx)
	if err != nil {
		return RiskContext{}, err
	}

	var cloned RiskContext
	if err := json.Unmarshal(data, &cloned); err != nil {
		return RiskContext{}, err
	}

	return cloned, nil
}

// ParseCooldown parses cooldown duration and returns time.Duration
func ParseCooldown(cooldown interface{}) (time.Duration, error) {
	ms, err := parseDuration(cooldown)
	if err != nil {
		return 0, err
	}
	return time.Duration(ms) * time.Millisecond, nil
}

// StringPtr creates a string pointer
func StringPtr(s string) *string {
	return &s
}

// Float64Ptr creates a float64 pointer
func Float64Ptr(f float64) *float64 {
	return &f
}
