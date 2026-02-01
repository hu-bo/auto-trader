package binance

import (
	"strings"

	"github.com/pkg/exchange-adapter/core"
)

var quoteCurrencies = []string{"USDT", "USDC", "BUSD", "BTC", "ETH", "BNB"}

func parseRawSymbol(rawSymbol string) (base string, quote string) {
	for _, q := range quoteCurrencies {
		if strings.HasSuffix(rawSymbol, q) {
			return strings.TrimSuffix(rawSymbol, q), q
		}
	}
	return rawSymbol, ""
}

func rawToUnifiedSymbol(rawSymbol string, tradeType core.TradeType) string {
	switch tradeType {
	case core.TradeTypeDelivery:
		// BTCUSD_PERP / BTCUSD_240329 -> BTC-USD
		pair := strings.Split(rawSymbol, "_")[0]
		base := strings.TrimSuffix(pair, "USD")
		return base + "-USD"
	default:
		base, quote := parseRawSymbol(rawSymbol)
		if quote == "" {
			return rawSymbol
		}
		return base + "-" + quote
	}
}

func unifiedToRawSymbol(symbol string, tradeType core.TradeType) string {
	base, quote, err := core.ParseUnifiedSymbol(symbol)
	if err != nil {
		return symbol
	}

	switch tradeType {
	case core.TradeTypeSpot, core.TradeTypeFutures:
		return strings.ToUpper(base) + strings.ToUpper(quote)
	case core.TradeTypeDelivery:
		// Default to perpetual.
		return strings.ToUpper(base) + "USD_PERP"
	default:
		return symbol
	}
}

func toCoreOrderType(binanceType string) core.OrderType {
	switch strings.ToUpper(binanceType) {
	case "MARKET":
		return core.OrderTypeMarket
	case "LIMIT_MAKER":
		return core.OrderTypeMakerOnly
	case "LIMIT":
		return core.OrderTypeLimit
	case "STOP", "STOP_MARKET", "TAKE_PROFIT", "TAKE_PROFIT_MARKET":
		// Treat as limit-like for unified view.
		return core.OrderTypeLimit
	default:
		return core.OrderTypeLimit
	}
}

func toCoreOrderStatus(binanceStatus string) core.OrderStatus {
	switch strings.ToUpper(binanceStatus) {
	case "NEW":
		return core.OrderStatusOpen
	case "PARTIALLY_FILLED":
		return core.OrderStatusPartial
	case "FILLED":
		return core.OrderStatusFilled
	case "CANCELED", "CANCELLED":
		return core.OrderStatusCanceled
	case "REJECTED":
		return core.OrderStatusRejected
	case "EXPIRED":
		return core.OrderStatusExpired
	default:
		return core.OrderStatusOpen
	}
}

func toCoreSide(binanceSide string) core.OrderSide {
	switch strings.ToUpper(binanceSide) {
	case "SELL":
		return core.OrderSideSell
	default:
		return core.OrderSideBuy
	}
}

func toCorePositionSide(binancePosSide string) *core.PositionSide {
	s := strings.ToLower(strings.TrimSpace(binancePosSide))
	switch s {
	case string(core.PositionSideLong):
		v := core.PositionSideLong
		return &v
	case string(core.PositionSideShort):
		v := core.PositionSideShort
		return &v
	default:
		return nil
	}
}
