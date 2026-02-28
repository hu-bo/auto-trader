package binance

import (
	"fmt"
	"strconv"
	"strings"

	btypes "github.com/pkg/binance-api/types"
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

// ============================================================================//
// Strategy / Algo Order Mappers
// ============================================================================//

// strategyOrderTypeToBinance maps core StrategyOrderType + presence of orderPrice
// to the Binance algo conditional order type.
func strategyOrderTypeToBinance(st core.StrategyOrderType, hasOrderPrice bool) (btypes.AlgoConditionalOrderType, error) {
	switch st {
	case core.StrategyOrderTypeStopLoss:
		if hasOrderPrice {
			return btypes.AlgoOrderStop, nil
		}
		return btypes.AlgoOrderStopMarket, nil
	case core.StrategyOrderTypeTakeProfit:
		if hasOrderPrice {
			return btypes.AlgoOrderTakeProfit, nil
		}
		return btypes.AlgoOrderTakeProfitMarket, nil
	case core.StrategyOrderTypeTrigger:
		if hasOrderPrice {
			return btypes.AlgoOrderStop, nil
		}
		return btypes.AlgoOrderStopMarket, nil
	case core.StrategyOrderTypeTrailingStop:
		return btypes.AlgoOrderTrailingStopMarket, nil
	default:
		return "", fmt.Errorf("unsupported strategy order type: %s", st)
	}
}

// triggerPriceTypeToBinance maps core trigger price type to Binance WorkingType.
func triggerPriceTypeToBinance(tpt *core.StrategyTriggerPriceType) btypes.WorkingType {
	if tpt == nil {
		return btypes.WorkingTypeContractPrice
	}
	switch *tpt {
	case core.TriggerPriceTypeMark:
		return btypes.WorkingTypeMarkPrice
	case core.TriggerPriceTypeLast:
		return btypes.WorkingTypeContractPrice
	default:
		return btypes.WorkingTypeContractPrice
	}
}

// toCoreAlgoOrderStatus maps Binance AlgoOrderStatus to core StrategyOrderStatus.
func toCoreAlgoOrderStatus(status btypes.AlgoOrderStatus) core.StrategyOrderStatus {
	switch status {
	case btypes.AlgoStatusNew:
		return core.StrategyOrderStatusLive
	case btypes.AlgoStatusCanceled:
		return core.StrategyOrderStatusCanceled
	case btypes.AlgoStatusTriggering:
		return core.StrategyOrderStatusLive
	case btypes.AlgoStatusTriggered:
		return core.StrategyOrderStatusEffective
	case btypes.AlgoStatusFinished:
		return core.StrategyOrderStatusEffective
	case btypes.AlgoStatusRejected:
		return core.StrategyOrderStatusFailed
	case btypes.AlgoStatusExpired:
		return core.StrategyOrderStatusCanceled
	default:
		return core.StrategyOrderStatusLive
	}
}

// toCoreStrategyOrderType maps Binance AlgoConditionalOrderType to core StrategyOrderType.
func toCoreStrategyOrderType(ot btypes.AlgoConditionalOrderType) core.StrategyOrderType {
	switch ot {
	case btypes.AlgoOrderStopMarket, btypes.AlgoOrderStop:
		return core.StrategyOrderTypeStopLoss
	case btypes.AlgoOrderTakeProfitMarket, btypes.AlgoOrderTakeProfit:
		return core.StrategyOrderTypeTakeProfit
	case btypes.AlgoOrderTrailingStopMarket:
		return core.StrategyOrderTypeTrailingStop
	default:
		return core.StrategyOrderTypeTrigger
	}
}

// transformAlgoOrder transforms a Binance AlgoOrderResponse to a core StrategyOrder.
func transformAlgoOrder(o btypes.AlgoOrderResponse, tradeType core.TradeType) core.StrategyOrder {
	return core.StrategyOrder{
		AlgoID:           strconv.FormatInt(o.AlgoID, 10),
		ClientAlgoID:     o.ClientAlgoID,
		Symbol:           rawToUnifiedSymbol(o.Symbol, tradeType),
		TradeType:        tradeType,
		Side:             toCoreSide(string(o.Side)),
		PositionSide:     toCorePositionSide(string(o.PositionSide)),
		StrategyType:     toCoreStrategyOrderType(o.OrderType),
		Status:           toCoreAlgoOrderStatus(o.AlgoStatus),
		TriggerPrice:     o.TriggerPrice,
		TriggerPriceType: triggerPriceTypeFromWorkingType(o.WorkingType),
		OrderPrice:       o.Price,
		Quantity:         o.Quantity,
		CreateTime:       unixMsToTimePtr(o.CreateTime),
		UpdateTime:       unixMsToTimePtr(o.UpdateTime),
		TriggerTime:      unixMsToTimePtr(o.TriggerTime),
		Raw:              o,
	}
}

// transformQueryAlgoOrder transforms a Binance QueryAlgoOrderResponse to a core StrategyOrder.
func transformQueryAlgoOrder(o btypes.QueryAlgoOrderResponse, tradeType core.TradeType) core.StrategyOrder {
	so := transformAlgoOrder(o.AlgoOrderResponse, tradeType)
	so.Raw = o
	return so
}

// triggerPriceTypeFromWorkingType converts Binance WorkingType back to core trigger price type.
func triggerPriceTypeFromWorkingType(wt btypes.WorkingType) *core.StrategyTriggerPriceType {
	switch wt {
	case btypes.WorkingTypeMarkPrice:
		v := core.TriggerPriceTypeMark
		return &v
	case btypes.WorkingTypeContractPrice:
		v := core.TriggerPriceTypeLast
		return &v
	default:
		return nil
	}
}
