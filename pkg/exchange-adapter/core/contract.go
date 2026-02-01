package core

import (
	"math"
	"strings"
)

// NOTE: This file mirrors the TS helper semantics used for coin-m delivery conversions.
// For Bybit inverse/delivery, use exchange-specific instrument metadata for accurate conversions.

func GetContractValue(symbol string) float64 {
	base, _, err := ParseUnifiedSymbol(symbol)
	if err != nil {
		return 10
	}
	if strings.EqualFold(base, "BTC") {
		return 100
	}
	return 10
}

func UsdtToContracts(symbol string, usdt float64) int64 {
	contractValue := GetContractValue(symbol)
	if contractValue <= 0 {
		return 0
	}
	return int64(math.Floor(usdt / contractValue))
}

func CoinToContracts(symbol string, coinAmount float64, price float64) int64 {
	contractValue := GetContractValue(symbol)
	if contractValue <= 0 || price <= 0 {
		return 0
	}
	return int64(math.Floor(coinAmount * price / contractValue))
}

func ContractsToCoin(symbol string, contracts int64, price float64) float64 {
	contractValue := GetContractValue(symbol)
	if contractValue <= 0 || price <= 0 {
		return 0
	}
	return float64(contracts) * contractValue / price
}
