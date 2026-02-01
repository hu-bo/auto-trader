package okx

import (
	"strconv"
	"strings"
	"time"

	"github.com/pkg/exchange-adapter/core"
)

func tradeTypeToInstType(tradeType core.TradeType) string {
	switch tradeType {
	case core.TradeTypeSpot:
		return "SPOT"
	case core.TradeTypeFutures:
		return "SWAP"
	case core.TradeTypeDelivery:
		return "FUTURES"
	default:
		return "SWAP"
	}
}

func instTypeToTradeType(instType string) core.TradeType {
	switch strings.ToUpper(strings.TrimSpace(instType)) {
	case "SPOT":
		return core.TradeTypeSpot
	case "SWAP":
		return core.TradeTypeFutures
	case "FUTURES":
		return core.TradeTypeDelivery
	default:
		return core.TradeTypeFutures
	}
}

func detectTradeTypeFromInstID(instID string) core.TradeType {
	if strings.HasSuffix(instID, "-SWAP") {
		return core.TradeTypeFutures
	}
	parts := strings.Split(instID, "-")
	if len(parts) == 3 && isDigits(parts[2]) {
		return core.TradeTypeDelivery
	}
	return core.TradeTypeSpot
}

func rawToUnifiedSymbol(instID string) string {
	parts := strings.Split(instID, "-")
	if len(parts) < 2 {
		return instID
	}
	return strings.ToUpper(parts[0]) + "-" + strings.ToUpper(parts[1])
}

func unifiedToRawSymbol(symbol string, tradeType core.TradeType) string {
	switch tradeType {
	case core.TradeTypeSpot:
		return symbol
	case core.TradeTypeFutures:
		if strings.HasSuffix(symbol, "-SWAP") {
			return symbol
		}
		return symbol + "-SWAP"
	case core.TradeTypeDelivery:
		// Delivery requires an expiry suffix (e.g. BTC-USD-240329). The unified symbol does not include it.
		// Callers should resolve via PublicAdapter.GetSymbolInfo(...) to obtain SymbolInfo.RawSymbol.
		return symbol
	default:
		return symbol
	}
}

func tdMode(tradeType core.TradeType, marginMode core.MarginMode) string {
	if tradeType == core.TradeTypeSpot {
		return "cash"
	}
	if marginMode == "" {
		marginMode = core.MarginModeCross
	}
	return string(marginMode)
}

func toRawOrderType(orderType core.OrderType) string {
	switch orderType {
	case core.OrderTypeMarket:
		return "market"
	case core.OrderTypeMakerOnly:
		return "post_only"
	case core.OrderTypeLimit:
		fallthrough
	default:
		return "limit"
	}
}

func toCoreOrderType(raw string) core.OrderType {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "market":
		return core.OrderTypeMarket
	case "post_only":
		return core.OrderTypeMakerOnly
	case "fok", "ioc":
		return core.OrderTypeLimit
	case "limit":
		fallthrough
	default:
		return core.OrderTypeLimit
	}
}

func toCoreOrderStatus(state string) core.OrderStatus {
	switch strings.ToLower(strings.TrimSpace(state)) {
	case "live":
		return core.OrderStatusOpen
	case "partially_filled":
		return core.OrderStatusPartial
	case "filled":
		return core.OrderStatusFilled
	case "canceled", "cancelled":
		return core.OrderStatusCanceled
	default:
		return core.OrderStatusOpen
	}
}

func toRawStrategyOrderType(strategyType core.StrategyOrderType) string {
	switch strategyType {
	case core.StrategyOrderTypeTrigger:
		return "trigger"
	case core.StrategyOrderTypeTrailingStop:
		return "move_order_stop"
	case core.StrategyOrderTypeStopLoss, core.StrategyOrderTypeTakeProfit:
		fallthrough
	default:
		return "conditional"
	}
}

func toCoreStrategyOrderType(ordType string, hasTP bool) core.StrategyOrderType {
	switch strings.ToLower(strings.TrimSpace(ordType)) {
	case "conditional":
		if hasTP {
			return core.StrategyOrderTypeTakeProfit
		}
		return core.StrategyOrderTypeStopLoss
	case "oco":
		return core.StrategyOrderTypeTakeProfit
	case "move_order_stop":
		return core.StrategyOrderTypeTrailingStop
	case "trigger":
		fallthrough
	default:
		return core.StrategyOrderTypeTrigger
	}
}

func toCoreStrategyOrderStatus(state string) core.StrategyOrderStatus {
	switch strings.ToLower(strings.TrimSpace(state)) {
	case "live":
		return core.StrategyOrderStatusLive
	case "effective":
		return core.StrategyOrderStatusEffective
	case "canceled", "cancelled":
		return core.StrategyOrderStatusCanceled
	case "order_failed", "partially_failed":
		return core.StrategyOrderStatusFailed
	case "partially_effective":
		return core.StrategyOrderStatusPartiallyEffective
	default:
		return core.StrategyOrderStatusLive
	}
}

func toCoreSide(side string) core.OrderSide {
	switch strings.ToLower(strings.TrimSpace(side)) {
	case "sell":
		return core.OrderSideSell
	default:
		return core.OrderSideBuy
	}
}

func toCorePositionSide(posSide string) *core.PositionSide {
	s := strings.ToLower(strings.TrimSpace(posSide))
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

func msStringToTimePtr(ms string) *time.Time {
	ms = strings.TrimSpace(ms)
	if ms == "" {
		return nil
	}
	v, err := strconv.ParseInt(ms, 10, 64)
	if err != nil || v <= 0 {
		return nil
	}
	t := time.UnixMilli(v)
	return &t
}

func msStringToInt64(ms string) int64 {
	ms = strings.TrimSpace(ms)
	if ms == "" {
		return 0
	}
	v, err := strconv.ParseInt(ms, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
