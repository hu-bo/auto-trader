package core

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

func GetDecimalPlaces(value string) int {
	i := strings.IndexByte(value, '.')
	if i < 0 {
		return 0
	}
	return len(value) - i - 1
}

func FormatPrice(price float64, tickSize string) (string, error) {
	return adjustByStepFloat(price, tickSize)
}

func FormatQuantity(quantity float64, stepSize string) (string, error) {
	return adjustByStepFloat(quantity, stepSize)
}

func adjustByStepFloat(value float64, stepSize string) (string, error) {
	// Use a high-precision string to avoid scientific notation for common values.
	// The remaining precision/rounding is handled by truncation against stepSize.
	s := strings.TrimSpace(fmt.Sprintf("%.16f", value))
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	if s == "" || s == "-" {
		s = "0"
	}
	return AdjustByStep(s, stepSize)
}

// AdjustByStep returns floor(value/stepSize)*stepSize, fixed to stepSize's decimal places.
// It mirrors the TS behavior: truncation (no rounding) and fixed precision.
func AdjustByStep(value string, stepSize string) (string, error) {
	stepSize = strings.TrimSpace(stepSize)
	value = strings.TrimSpace(value)
	if stepSize == "" {
		return "", fmt.Errorf("stepSize is required")
	}
	if value == "" {
		return "", fmt.Errorf("value is required")
	}

	scale := GetDecimalPlaces(stepSize)

	stepInt, stepNeg, err := parseDecimalToScaledInt(stepSize, scale)
	if err != nil {
		return "", fmt.Errorf("invalid stepSize: %w", err)
	}
	if stepNeg {
		return "", fmt.Errorf("stepSize must be positive")
	}
	if stepInt.Sign() == 0 {
		return "", fmt.Errorf("stepSize must be > 0")
	}

	valueInt, valueNeg, err := parseDecimalToScaledInt(value, scale)
	if err != nil {
		return "", fmt.Errorf("invalid value: %w", err)
	}

	quotient := new(big.Int).Quo(valueInt, stepInt)
	adjusted := new(big.Int).Mul(quotient, stepInt)

	out := formatScaledIntToDecimal(adjusted, scale)
	if valueNeg && out != "0" && out != "0."+strings.Repeat("0", scale) {
		out = "-" + out
	}
	return out, nil
}

func parseDecimalToScaledInt(s string, scale int) (*big.Int, bool, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, false, fmt.Errorf("empty")
	}

	neg := false
	if strings.HasPrefix(s, "-") {
		neg = true
		s = strings.TrimPrefix(s, "-")
	} else if strings.HasPrefix(s, "+") {
		s = strings.TrimPrefix(s, "+")
	}
	if s == "" {
		return nil, neg, fmt.Errorf("invalid number")
	}

	intPart := s
	fracPart := ""
	if dot := strings.IndexByte(s, '.'); dot >= 0 {
		intPart = s[:dot]
		fracPart = s[dot+1:]
	}

	if intPart == "" {
		intPart = "0"
	}

	if !isDigits(intPart) {
		return nil, neg, fmt.Errorf("invalid integer digits: %q", intPart)
	}
	if fracPart != "" && !isDigits(fracPart) {
		return nil, neg, fmt.Errorf("invalid fractional digits: %q", fracPart)
	}

	if scale < 0 {
		return nil, neg, fmt.Errorf("invalid scale")
	}

	if len(fracPart) > scale {
		fracPart = fracPart[:scale]
	} else if len(fracPart) < scale {
		fracPart = fracPart + strings.Repeat("0", scale-len(fracPart))
	}

	combined := strings.TrimLeft(intPart, "0")
	if combined == "" {
		combined = "0"
	}
	combined = combined + fracPart
	combined = strings.TrimLeft(combined, "0")
	if combined == "" {
		combined = "0"
	}

	n := new(big.Int)
	_, ok := n.SetString(combined, 10)
	if !ok {
		return nil, neg, fmt.Errorf("failed to parse int")
	}
	return n, neg, nil
}

func formatScaledIntToDecimal(n *big.Int, scale int) string {
	if scale <= 0 {
		return n.String()
	}

	s := n.String()
	if s == "0" {
		return "0." + strings.Repeat("0", scale)
	}

	if len(s) <= scale {
		s = strings.Repeat("0", scale-len(s)+1) + s
	}

	dot := len(s) - scale
	return s[:dot] + "." + s[dot:]
}

func isDigits(s string) bool {
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func ParseFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func ParseInt64(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

func Int64FromAny(v any) int64 {
	switch t := v.(type) {
	case float64:
		return int64(t)
	case int64:
		return t
	case int:
		return int64(t)
	case json.Number:
		i, _ := t.Int64()
		return i
	case string:
		return ParseInt64(t)
	default:
		return 0
	}
}

func StringFromAny(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case []byte:
		return string(t)
	case json.Number:
		return t.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}
