package contract

import (
	"fmt"
	"time"

	exchangepb "exchange-adapter-service/gen/exchange"
	"exchange-adapter-service/internal/trading"

	"github.com/pkg/exchange-adapter/core"
)

func Error(code, message string) *exchangepb.Error {
	if code == "" && message == "" {
		return nil
	}
	return &exchangepb.Error{Code: code, Message: message}
}

func ProtoExchangeToCore(e exchangepb.Exchange) (core.Exchange, error) {
	switch e {
	case exchangepb.Exchange_EXCHANGE_OKX:
		return core.ExchangeOKX, nil
	case exchangepb.Exchange_EXCHANGE_BINANCE:
		return core.ExchangeBinance, nil
	case exchangepb.Exchange_EXCHANGE_UNSPECIFIED:
		return "", fmt.Errorf("exchange is required")
	default:
		return "", fmt.Errorf("unsupported exchange: %v", e)
	}
}

func CoreExchangeToProto(e core.Exchange) exchangepb.Exchange {
	switch e {
	case core.ExchangeOKX:
		return exchangepb.Exchange_EXCHANGE_OKX
	case core.ExchangeBinance:
		return exchangepb.Exchange_EXCHANGE_BINANCE
	default:
		return exchangepb.Exchange_EXCHANGE_UNSPECIFIED
	}
}

func ProtoTradeTypeToCoreRequired(t exchangepb.TradeType) (core.TradeType, error) {
	out := ProtoTradeTypeToCoreOptional(t)
	if out == "" {
		return "", fmt.Errorf("trade_type is required")
	}
	return out, nil
}

func ProtoTradeTypeToCoreOptional(t exchangepb.TradeType) core.TradeType {
	switch t {
	case exchangepb.TradeType_TRADE_TYPE_SPOT:
		return core.TradeTypeSpot
	case exchangepb.TradeType_TRADE_TYPE_FUTURES:
		return core.TradeTypeFutures
	case exchangepb.TradeType_TRADE_TYPE_DELIVERY:
		return core.TradeTypeDelivery
	default:
		return ""
	}
}

func CoreTradeTypeToProto(t core.TradeType) exchangepb.TradeType {
	switch t {
	case core.TradeTypeSpot:
		return exchangepb.TradeType_TRADE_TYPE_SPOT
	case core.TradeTypeFutures:
		return exchangepb.TradeType_TRADE_TYPE_FUTURES
	case core.TradeTypeDelivery:
		return exchangepb.TradeType_TRADE_TYPE_DELIVERY
	default:
		return exchangepb.TradeType_TRADE_TYPE_UNSPECIFIED
	}
}

func ProtoOrderSideToCoreRequired(s exchangepb.OrderSide) (core.OrderSide, error) {
	switch s {
	case exchangepb.OrderSide_ORDER_SIDE_BUY:
		return core.OrderSideBuy, nil
	case exchangepb.OrderSide_ORDER_SIDE_SELL:
		return core.OrderSideSell, nil
	default:
		return "", fmt.Errorf("side is required")
	}
}

func CoreOrderSideToProto(s core.OrderSide) exchangepb.OrderSide {
	switch s {
	case core.OrderSideBuy:
		return exchangepb.OrderSide_ORDER_SIDE_BUY
	case core.OrderSideSell:
		return exchangepb.OrderSide_ORDER_SIDE_SELL
	default:
		return exchangepb.OrderSide_ORDER_SIDE_UNSPECIFIED
	}
}

func ProtoOrderTypeToCoreRequired(t exchangepb.OrderType) (core.OrderType, error) {
	switch t {
	case exchangepb.OrderType_ORDER_TYPE_LIMIT:
		return core.OrderTypeLimit, nil
	case exchangepb.OrderType_ORDER_TYPE_MARKET:
		return core.OrderTypeMarket, nil
	case exchangepb.OrderType_ORDER_TYPE_MAKER_ONLY:
		return core.OrderTypeMakerOnly, nil
	default:
		return "", fmt.Errorf("order_type is required")
	}
}

func CoreOrderTypeToProto(t core.OrderType) exchangepb.OrderType {
	switch t {
	case core.OrderTypeLimit:
		return exchangepb.OrderType_ORDER_TYPE_LIMIT
	case core.OrderTypeMarket:
		return exchangepb.OrderType_ORDER_TYPE_MARKET
	case core.OrderTypeMakerOnly:
		return exchangepb.OrderType_ORDER_TYPE_MAKER_ONLY
	default:
		return exchangepb.OrderType_ORDER_TYPE_UNSPECIFIED
	}
}

func ProtoPositionSideToCore(t exchangepb.PositionSide) (*core.PositionSide, error) {
	switch t {
	case exchangepb.PositionSide_POSITION_SIDE_LONG:
		out := core.PositionSideLong
		return &out, nil
	case exchangepb.PositionSide_POSITION_SIDE_SHORT:
		out := core.PositionSideShort
		return &out, nil
	case exchangepb.PositionSide_POSITION_SIDE_UNSPECIFIED:
		return nil, nil
	default:
		return nil, fmt.Errorf("invalid position_side: %v", t)
	}
}

func CorePositionSideToProto(t *core.PositionSide) exchangepb.PositionSide {
	if t == nil {
		return exchangepb.PositionSide_POSITION_SIDE_UNSPECIFIED
	}
	switch *t {
	case core.PositionSideLong:
		return exchangepb.PositionSide_POSITION_SIDE_LONG
	case core.PositionSideShort:
		return exchangepb.PositionSide_POSITION_SIDE_SHORT
	default:
		return exchangepb.PositionSide_POSITION_SIDE_UNSPECIFIED
	}
}

func CoreOrderStatusToProto(s core.OrderStatus) exchangepb.OrderStatus {
	switch s {
	case core.OrderStatusPending:
		return exchangepb.OrderStatus_ORDER_STATUS_PENDING
	case core.OrderStatusOpen:
		return exchangepb.OrderStatus_ORDER_STATUS_OPEN
	case core.OrderStatusPartial:
		return exchangepb.OrderStatus_ORDER_STATUS_PARTIAL
	case core.OrderStatusFilled:
		return exchangepb.OrderStatus_ORDER_STATUS_FILLED
	case core.OrderStatusCanceled:
		return exchangepb.OrderStatus_ORDER_STATUS_CANCELED
	case core.OrderStatusRejected:
		return exchangepb.OrderStatus_ORDER_STATUS_REJECTED
	case core.OrderStatusExpired:
		return exchangepb.OrderStatus_ORDER_STATUS_EXPIRED
	default:
		return exchangepb.OrderStatus_ORDER_STATUS_UNSPECIFIED
	}
}

func ProtoOrderStatusToCoreOptional(s exchangepb.OrderStatus) core.OrderStatus {
	switch s {
	case exchangepb.OrderStatus_ORDER_STATUS_PENDING:
		return core.OrderStatusPending
	case exchangepb.OrderStatus_ORDER_STATUS_OPEN:
		return core.OrderStatusOpen
	case exchangepb.OrderStatus_ORDER_STATUS_PARTIAL:
		return core.OrderStatusPartial
	case exchangepb.OrderStatus_ORDER_STATUS_FILLED:
		return core.OrderStatusFilled
	case exchangepb.OrderStatus_ORDER_STATUS_CANCELED:
		return core.OrderStatusCanceled
	case exchangepb.OrderStatus_ORDER_STATUS_REJECTED:
		return core.OrderStatusRejected
	case exchangepb.OrderStatus_ORDER_STATUS_EXPIRED:
		return core.OrderStatusExpired
	default:
		return ""
	}
}

func CoreOrderToProto(o core.Order, leverage int32) *exchangepb.Order {
	createdAt := toMillis(o.CreateTime)
	updatedAt := toMillis(o.UpdateTime)
	filledAt := int64(0)
	if o.Status == core.OrderStatusFilled && updatedAt > 0 {
		filledAt = updatedAt
	}

	return &exchangepb.Order{
		Id:              o.OrderID,
		ExchangeOrderId: o.OrderID,
		ClientOrderId:   o.ClientOrderID,
		Symbol:          o.Symbol,
		TradeType:       CoreTradeTypeToProto(o.TradeType),
		Side:            CoreOrderSideToProto(o.Side),
		PositionSide:    CorePositionSideToProto(o.PositionSide),
		OrderType:       CoreOrderTypeToProto(o.OrderType),
		Status:          CoreOrderStatusToProto(o.Status),
		Quantity:        o.Quantity,
		Price:           o.Price,
		FilledQty:       o.FilledQty,
		AvgPrice:        o.AvgPrice,
		Fee:             o.Fee,
		FeeAsset:        o.FeeAsset,
		Leverage:        leverage,
		ReduceOnly:      o.ReduceOnly,
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
		FilledAt:        filledAt,
	}
}

func OrderUpdateToProto(u trading.OrderUpdate) *exchangepb.OrderUpdate {
	return &exchangepb.OrderUpdate{
		OrderId:        u.OrderID,
		ClientOrderId:  u.ClientOrderID,
		Symbol:         u.Symbol,
		TradeType:      CoreTradeTypeToProto(u.TradeType),
		Side:           CoreOrderSideToProto(u.Side),
		PositionSide:   CorePositionSideToProto(u.PositionSide),
		OrderType:      CoreOrderTypeToProto(u.OrderType),
		Status:         CoreOrderStatusToProto(u.Status),
		Price:          u.Price,
		Quantity:       u.Quantity,
		FilledQuantity: u.FilledQuantity,
		AvgPrice:       u.AvgPrice,
		Fee:            u.Fee,
		FeeAsset:       u.FeeAsset,
		UpdateTime:     u.UpdateTime,
	}
}

func CoreBalanceToProto(b core.Balance) *exchangepb.Balance {
	return &exchangepb.Balance{
		Asset:         b.Asset,
		Free:          b.Free,
		Locked:        b.Locked,
		Total:         b.Total,
		UnrealizedPnl: "",
		MarginBalance: "",
	}
}

func CorePositionToProto(p core.Position, tradeType core.TradeType) *exchangepb.Position {
	posSide := p.PositionSide
	posSidePtr := &posSide
	lev := int32(p.Leverage)
	now := time.Now().UnixMilli()

	return &exchangepb.Position{
		Id:               fmt.Sprintf("%s|%s|%s", p.Symbol, tradeType, p.PositionSide),
		Symbol:           p.Symbol,
		TradeType:        CoreTradeTypeToProto(tradeType),
		PositionSide:     CorePositionSideToProto(posSidePtr),
		PositionAmt:      p.PositionAmt,
		EntryPrice:       p.EntryPrice,
		MarkPrice:        "",
		UnrealizedPnl:    p.UnrealizedPnl,
		RealizedPnl:      "",
		Leverage:         lev,
		MarginMode:       string(p.MarginMode),
		LiquidationPrice: p.LiquidationPrice,
		Margin:           "",
		LastSyncAt:       now,
	}
}

// ============================================================================
// Strategy Order Mappers
// ============================================================================

func ProtoStrategyOrderTypeToCoreRequired(t exchangepb.StrategyOrderType) (core.StrategyOrderType, error) {
	switch t {
	case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_STOP_LOSS:
		return core.StrategyOrderTypeStopLoss, nil
	case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TAKE_PROFIT:
		return core.StrategyOrderTypeTakeProfit, nil
	case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TRIGGER:
		return core.StrategyOrderTypeTrigger, nil
	case exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TRAILING_STOP:
		return core.StrategyOrderTypeTrailingStop, nil
	default:
		return "", fmt.Errorf("strategy_type is required")
	}
}

func CoreStrategyOrderTypeToProto(t core.StrategyOrderType) exchangepb.StrategyOrderType {
	switch t {
	case core.StrategyOrderTypeStopLoss:
		return exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_STOP_LOSS
	case core.StrategyOrderTypeTakeProfit:
		return exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TAKE_PROFIT
	case core.StrategyOrderTypeTrigger:
		return exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TRIGGER
	case core.StrategyOrderTypeTrailingStop:
		return exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_TRAILING_STOP
	default:
		return exchangepb.StrategyOrderType_STRATEGY_ORDER_TYPE_UNSPECIFIED
	}
}

func ProtoStrategyTriggerPriceTypeToCore(t exchangepb.StrategyTriggerPriceType) *core.StrategyTriggerPriceType {
	switch t {
	case exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_LAST:
		v := core.TriggerPriceTypeLast
		return &v
	case exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_MARK:
		v := core.TriggerPriceTypeMark
		return &v
	case exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_INDEX:
		v := core.TriggerPriceTypeIndex
		return &v
	default:
		return nil
	}
}

func CoreStrategyTriggerPriceTypeToProto(t *core.StrategyTriggerPriceType) exchangepb.StrategyTriggerPriceType {
	if t == nil {
		return exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_UNSPECIFIED
	}
	switch *t {
	case core.TriggerPriceTypeLast:
		return exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_LAST
	case core.TriggerPriceTypeMark:
		return exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_MARK
	case core.TriggerPriceTypeIndex:
		return exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_INDEX
	default:
		return exchangepb.StrategyTriggerPriceType_STRATEGY_TRIGGER_PRICE_TYPE_UNSPECIFIED
	}
}

func CoreStrategyOrderStatusToProto(s core.StrategyOrderStatus) exchangepb.StrategyOrderStatus {
	switch s {
	case core.StrategyOrderStatusLive:
		return exchangepb.StrategyOrderStatus_STRATEGY_ORDER_STATUS_LIVE
	case core.StrategyOrderStatusEffective:
		return exchangepb.StrategyOrderStatus_STRATEGY_ORDER_STATUS_EFFECTIVE
	case core.StrategyOrderStatusCanceled:
		return exchangepb.StrategyOrderStatus_STRATEGY_ORDER_STATUS_CANCELED
	case core.StrategyOrderStatusFailed:
		return exchangepb.StrategyOrderStatus_STRATEGY_ORDER_STATUS_FAILED
	case core.StrategyOrderStatusPartiallyEffective:
		return exchangepb.StrategyOrderStatus_STRATEGY_ORDER_STATUS_PARTIALLY_EFFECTIVE
	default:
		return exchangepb.StrategyOrderStatus_STRATEGY_ORDER_STATUS_UNSPECIFIED
	}
}

func CoreStrategyOrderToProto(o core.StrategyOrder) *exchangepb.StrategyOrder {
	triggerPriceType := ""
	if o.TriggerPriceType != nil {
		triggerPriceType = string(*o.TriggerPriceType)
	}

	return &exchangepb.StrategyOrder{
		AlgoId:           o.AlgoID,
		ClientAlgoId:     o.ClientAlgoID,
		Symbol:           o.Symbol,
		TradeType:        CoreTradeTypeToProto(o.TradeType),
		Side:             CoreOrderSideToProto(o.Side),
		PositionSide:     CorePositionSideToProto(o.PositionSide),
		StrategyType:     CoreStrategyOrderTypeToProto(o.StrategyType),
		Status:           CoreStrategyOrderStatusToProto(o.Status),
		TriggerPrice:     o.TriggerPrice,
		TriggerPriceType: triggerPriceType,
		OrderPrice:       o.OrderPrice,
		Quantity:         o.Quantity,
		TpTriggerPrice:   o.TPTriggerPrice,
		TpOrderPrice:     o.TPOrderPrice,
		SlTriggerPrice:   o.SLTriggerPrice,
		SlOrderPrice:     o.SLOrderPrice,
		CreatedAt:        toMillis(o.CreateTime),
		UpdatedAt:        toMillis(o.UpdateTime),
		TriggeredAt:      toMillis(o.TriggerTime),
	}
}

func toMillis(t *time.Time) int64 {
	if t == nil {
		return 0
	}
	return t.UnixMilli()
}
