package core

import (
	"fmt"
	"strings"
)

func ParseUnifiedSymbol(symbol string) (base string, quote string, err error) {
	parts := strings.Split(symbol, "-")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid unified symbol: %q", symbol)
	}
	base = strings.TrimSpace(parts[0])
	quote = strings.TrimSpace(parts[1])
	if base == "" || quote == "" {
		return "", "", fmt.Errorf("invalid unified symbol: %q", symbol)
	}
	return base, quote, nil
}

func CreateUnifiedSymbol(base string, quote string) string {
	return strings.ToUpper(strings.TrimSpace(base)) + "-" + strings.ToUpper(strings.TrimSpace(quote))
}
