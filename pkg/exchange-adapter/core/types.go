package core

import "time"

// ============================================================================
// Result
// ============================================================================

type Result[T any] struct {
	Ok    bool       `json:"ok"`
	Data  T          `json:"data,omitempty"`
	Error *ErrorInfo `json:"error,omitempty"`
}

type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Raw     any    `json:"raw,omitempty"`
}

func Ok[T any](data T) Result[T] {
	return Result[T]{Ok: true, Data: data}
}

func Err[T any](err ErrorInfo) Result[T] {
	return Result[T]{Ok: false, Error: &err}
}

// ============================================================================
// Exchange & TradeType
// ============================================================================

type Exchange string

const (
	ExchangeOKX     Exchange = "okx"
	ExchangeBinance Exchange = "binance"
	ExchangeBybit   Exchange = "bybit"
)

// TradeType:
// - spot: spot
// - futures: USDT-margined perpetual
// - delivery: coin-margined delivery (inverse)
type TradeType string

const (
	TradeTypeSpot     TradeType = "spot"
	TradeTypeFutures  TradeType = "futures"
	TradeTypeDelivery TradeType = "delivery"
)

type SymbolStatus int

const (
	SymbolStatusDisabled SymbolStatus = 0
	SymbolStatusEnabled  SymbolStatus = 1
)

// ============================================================================
// Symbol Info
// ============================================================================

type SymbolInfo struct {
	Symbol            string       `json:"symbol"`
	RawSymbol         string       `json:"rawSymbol"`
	BaseCurrency      string       `json:"baseCurrency"`
	QuoteCurrency     string       `json:"quoteCurrency"`
	TradeType         TradeType    `json:"tradeType"`
	TickSize          string       `json:"tickSize"`
	StepSize          string       `json:"stepSize"`
	MinQty            string       `json:"minQty"`
	MaxQty            string       `json:"maxQty"`
	QuantityPrecision int          `json:"quantityPrecision"`
	PricePrecision    int          `json:"pricePrecision"`
	Status            SymbolStatus `json:"status"`
	ContractValue     *float64     `json:"contractValue,omitempty"`
	MaxLeverage       *float64     `json:"maxLeverage,omitempty"`
	Raw               string       `json:"raw,omitempty"`
}

// ============================================================================
// Account
// ============================================================================

type Balance struct {
	Asset  string `json:"asset"`
	Free   string `json:"free"`
	Locked string `json:"locked"`
	Total  string `json:"total"`
}

type FuturesBalance struct {
	Balance
	UnrealizedPnl     string `json:"unrealizedPnl"`
	MarginBalance     string `json:"marginBalance"`
	WithdrawAvailable string `json:"withdrawAvailable"`
}

type MarginMode string

const (
	MarginModeCross    MarginMode = "cross"
	MarginModeIsolated MarginMode = "isolated"
)

type Position struct {
	Symbol           string       `json:"symbol"`
	PositionSide     PositionSide `json:"positionSide"`
	PositionAmt      string       `json:"positionAmt"`
	EntryPrice       string       `json:"entryPrice"`
	UnrealizedPnl    string       `json:"unrealizedPnl"`
	Leverage         float64      `json:"leverage"`
	MarginMode       MarginMode   `json:"marginMode"`
	LiquidationPrice string       `json:"liquidationPrice"`
}

// ============================================================================
// Order
// ============================================================================

type OrderSide string

const (
	OrderSideBuy  OrderSide = "buy"
	OrderSideSell OrderSide = "sell"
)

type PositionSide string

const (
	PositionSideLong  PositionSide = "long"
	PositionSideShort PositionSide = "short"
)

type OrderType string

const (
	OrderTypeLimit     OrderType = "limit"
	OrderTypeMarket    OrderType = "market"
	OrderTypeMakerOnly OrderType = "maker-only"
)

type TimeInForce string

const (
	TimeInForceGTC TimeInForce = "GTC"
	TimeInForceIOC TimeInForce = "IOC"
	TimeInForceFOK TimeInForce = "FOK"
	TimeInForceGTX TimeInForce = "GTX"
)

type OrderStatus string

const (
	OrderStatusPending  OrderStatus = "pending"
	OrderStatusOpen     OrderStatus = "open"
	OrderStatusPartial  OrderStatus = "partial"
	OrderStatusFilled   OrderStatus = "filled"
	OrderStatusCanceled OrderStatus = "canceled"
	OrderStatusRejected OrderStatus = "rejected"
	OrderStatusExpired  OrderStatus = "expired"
)

// PlaceOrderParams is the user-facing order request (quantity/price use float64).
// The adapter will validate and format it into exchange-specific precision strings.
type PlaceOrderParams struct {
	Symbol        string        `json:"symbol"`
	TradeType     TradeType     `json:"tradeType"`
	Side          OrderSide     `json:"side"`
	OrderType     OrderType     `json:"orderType"`
	Quantity      float64       `json:"quantity"`
	Price         *float64      `json:"price,omitempty"`
	PositionSide  *PositionSide `json:"positionSide,omitempty"`
	Leverage      *float64      `json:"leverage,omitempty"`
	ClientOrderID string        `json:"clientOrderId,omitempty"`
	TimeInForce   *TimeInForce  `json:"timeInForce,omitempty"`
	ReduceOnly    bool          `json:"reduceOnly,omitempty"`
}

// PlaceOrderParamsFormatted is the internal formatted order request (quantity/price are strings).
type PlaceOrderParamsFormatted struct {
	Symbol        string        `json:"symbol"`
	TradeType     TradeType     `json:"tradeType"`
	Side          OrderSide     `json:"side"`
	OrderType     OrderType     `json:"orderType"`
	Quantity      string        `json:"quantity"`
	Price         *string       `json:"price,omitempty"`
	PositionSide  *PositionSide `json:"positionSide,omitempty"`
	Leverage      *float64      `json:"leverage,omitempty"`
	ClientOrderID string        `json:"clientOrderId,omitempty"`
	TimeInForce   *TimeInForce  `json:"timeInForce,omitempty"`
	ReduceOnly    bool          `json:"reduceOnly,omitempty"`
}

type Order struct {
	OrderID       string        `json:"orderId"`
	ClientOrderID string        `json:"clientOrderId,omitempty"`
	Symbol        string        `json:"symbol"`
	TradeType     TradeType     `json:"tradeType"`
	Side          OrderSide     `json:"side"`
	PositionSide  *PositionSide `json:"positionSide,omitempty"`
	OrderType     OrderType     `json:"orderType"`
	Status        OrderStatus   `json:"status"`
	Price         string        `json:"price"`
	AvgPrice      string        `json:"avgPrice"`
	Quantity      string        `json:"quantity"`
	FilledQty     string        `json:"filledQty"`
	Fee           string        `json:"fee,omitempty"`
	FeeAsset      string        `json:"feeAsset,omitempty"`
	ReduceOnly    bool          `json:"reduceOnly,omitempty"`
	CreateTime    *time.Time    `json:"createTime,omitempty"`
	UpdateTime    *time.Time    `json:"updateTime,omitempty"`
	Raw           any           `json:"raw,omitempty"`
}

// ============================================================================
// Strategy Orders (Algo)
// ============================================================================

type StrategyOrderType string

const (
	StrategyOrderTypeStopLoss     StrategyOrderType = "stop-loss"
	StrategyOrderTypeTakeProfit   StrategyOrderType = "take-profit"
	StrategyOrderTypeTrigger      StrategyOrderType = "trigger"
	StrategyOrderTypeTrailingStop StrategyOrderType = "trailing-stop"
)

type StrategyTriggerPriceType string

const (
	TriggerPriceTypeLast  StrategyTriggerPriceType = "last"
	TriggerPriceTypeMark  StrategyTriggerPriceType = "mark"
	TriggerPriceTypeIndex StrategyTriggerPriceType = "index"
)

type StrategyAttachedOrder struct {
	TPTriggerPrice     *float64                  `json:"tpTriggerPrice,omitempty"`
	TPOrderPrice       *float64                  `json:"tpOrderPrice,omitempty"`
	TPTriggerPriceType *StrategyTriggerPriceType `json:"tpTriggerPriceType,omitempty"`
	SLTriggerPrice     *float64                  `json:"slTriggerPrice,omitempty"`
	SLOrderPrice       *float64                  `json:"slOrderPrice,omitempty"`
	SLTriggerPriceType *StrategyTriggerPriceType `json:"slTriggerPriceType,omitempty"`
}

type StrategyOrderParams struct {
	Symbol           string                    `json:"symbol"`
	TradeType        TradeType                 `json:"tradeType"`
	Side             OrderSide                 `json:"side"`
	StrategyType     StrategyOrderType         `json:"strategyType"`
	Quantity         float64                   `json:"quantity"`
	PositionSide     *PositionSide             `json:"positionSide,omitempty"`
	TriggerPrice     float64                   `json:"triggerPrice"`
	TriggerPriceType *StrategyTriggerPriceType `json:"triggerPriceType,omitempty"`
	OrderPrice       *float64                  `json:"orderPrice,omitempty"`
	ReduceOnly       bool                      `json:"reduceOnly,omitempty"`
	ClientAlgoID     string                    `json:"clientAlgoId,omitempty"`
	AttachedOrders   []StrategyAttachedOrder   `json:"attachedOrders,omitempty"`
	CallbackRatio    *float64                  `json:"callbackRatio,omitempty"`
	CallbackSpread   *float64                  `json:"callbackSpread,omitempty"`
	ActivationPrice  *float64                  `json:"activationPrice,omitempty"`
}

type StrategyOrderStatus string

const (
	StrategyOrderStatusLive               StrategyOrderStatus = "live"
	StrategyOrderStatusEffective          StrategyOrderStatus = "effective"
	StrategyOrderStatusCanceled           StrategyOrderStatus = "canceled"
	StrategyOrderStatusFailed             StrategyOrderStatus = "failed"
	StrategyOrderStatusPartiallyEffective StrategyOrderStatus = "partially_effective"
)

type StrategyOrder struct {
	AlgoID           string                    `json:"algoId"`
	ClientAlgoID     string                    `json:"clientAlgoId,omitempty"`
	Symbol           string                    `json:"symbol"`
	TradeType        TradeType                 `json:"tradeType"`
	Side             OrderSide                 `json:"side"`
	PositionSide     *PositionSide             `json:"positionSide,omitempty"`
	StrategyType     StrategyOrderType         `json:"strategyType"`
	Status           StrategyOrderStatus       `json:"status"`
	TriggerPrice     string                    `json:"triggerPrice"`
	TriggerPriceType *StrategyTriggerPriceType `json:"triggerPriceType,omitempty"`
	OrderPrice       string                    `json:"orderPrice,omitempty"`
	Quantity         string                    `json:"quantity"`
	TPTriggerPrice   string                    `json:"tpTriggerPrice,omitempty"`
	TPOrderPrice     string                    `json:"tpOrderPrice,omitempty"`
	SLTriggerPrice   string                    `json:"slTriggerPrice,omitempty"`
	SLOrderPrice     string                    `json:"slOrderPrice,omitempty"`
	CreateTime       *time.Time                `json:"createTime,omitempty"`
	UpdateTime       *time.Time                `json:"updateTime,omitempty"`
	TriggerTime      *time.Time                `json:"triggerTime,omitempty"`
	Raw              any                       `json:"raw,omitempty"`
}

// ============================================================================
// Market Data
// ============================================================================

type Ticker struct {
	Symbol      string `json:"symbol"`
	Last        string `json:"last"`
	High        string `json:"high"`
	Low         string `json:"low"`
	Volume      string `json:"volume"`
	QuoteVolume string `json:"quoteVolume"`
	Timestamp   int64  `json:"timestamp"`
	Raw         any    `json:"raw,omitempty"`
}

type OrderBook struct {
	Symbol    string      `json:"symbol"`
	Bids      [][2]string `json:"bids"`
	Asks      [][2]string `json:"asks"`
	Timestamp int64       `json:"timestamp"`
	Raw       any         `json:"raw,omitempty"`
}

// ============================================================================
// Adapter Options
// ============================================================================

type AdapterOptions struct {
	HTTPSProxy string `json:"httpsProxy,omitempty"`
	SOCKSProxy string `json:"socksProxy,omitempty"`
	Demonet    *bool  `json:"demonet,omitempty"`
}

// ============================================================================
// Batch Orders
// ============================================================================

type BatchPlaceOrderResult struct {
	SuccessCount int             `json:"successCount"`
	FailedCount  int             `json:"failedCount"`
	Results      []Result[Order] `json:"results"`
}

type BatchOrderLimits struct {
	MaxBatchSize        int         `json:"maxBatchSize"`
	SupportedTradeTypes []TradeType `json:"supportedTradeTypes"`
}

type ValidationResult struct {
	Valid bool       `json:"valid"`
	Error *ErrorInfo `json:"error,omitempty"`
}

// ============================================================================
// WebSocket User Data Events
// ============================================================================

type WsUserDataEventType string

const (
	WsEventOrder         WsUserDataEventType = "order"
	WsEventPosition      WsUserDataEventType = "position"
	WsEventBalance       WsUserDataEventType = "balance"
	WsEventStrategyOrder WsUserDataEventType = "strategyOrder"
	WsEventAccount       WsUserDataEventType = "account"
	WsEventConnected     WsUserDataEventType = "connected"
	WsEventDisconnected  WsUserDataEventType = "disconnected"
	WsEventError         WsUserDataEventType = "error"
)

type WsUserDataEvent interface {
	EventType() WsUserDataEventType
}

type WsOrderUpdate struct {
	Symbol         string        `json:"symbol"`
	TradeType      TradeType     `json:"tradeType"`
	OrderID        string        `json:"orderId"`
	ClientOrderID  string        `json:"clientOrderId,omitempty"`
	Side           OrderSide     `json:"side"`
	PositionSide   *PositionSide `json:"positionSide,omitempty"`
	OrderType      OrderType     `json:"orderType"`
	Status         OrderStatus   `json:"status"`
	Price          string        `json:"price"`
	Quantity       string        `json:"quantity"`
	FilledQuantity string        `json:"filledQuantity"`
	AvgPrice       string        `json:"avgPrice,omitempty"`
	Fee            string        `json:"fee,omitempty"`
	FeeAsset       string        `json:"feeAsset,omitempty"`
	ReduceOnly     bool          `json:"reduceOnly,omitempty"`
	UpdateTime     int64         `json:"updateTime"`
	Raw            any           `json:"raw"`
}

func (WsOrderUpdate) EventType() WsUserDataEventType { return WsEventOrder }

type WsStrategyOrderUpdate struct {
	Symbol       string              `json:"symbol"`
	TradeType    TradeType           `json:"tradeType"`
	AlgoID       string              `json:"algoId"`
	ClientAlgoID string              `json:"clientAlgoId,omitempty"`
	Side         OrderSide           `json:"side"`
	PositionSide *PositionSide       `json:"positionSide,omitempty"`
	StrategyType StrategyOrderType   `json:"strategyType"`
	Status       StrategyOrderStatus `json:"status"`
	TriggerPrice string              `json:"triggerPrice"`
	OrderPrice   string              `json:"orderPrice,omitempty"`
	Quantity     string              `json:"quantity"`
	TriggerTime  *int64              `json:"triggerTime,omitempty"`
	UpdateTime   int64               `json:"updateTime"`
	Raw          any                 `json:"raw"`
}

func (WsStrategyOrderUpdate) EventType() WsUserDataEventType { return WsEventStrategyOrder }

type WsPositionUpdate struct {
	Symbol           string       `json:"symbol"`
	TradeType        TradeType    `json:"tradeType"`
	PositionSide     PositionSide `json:"positionSide"`
	Quantity         string       `json:"quantity"`
	EntryPrice       string       `json:"entryPrice"`
	UnrealizedPnl    string       `json:"unrealizedPnl"`
	Leverage         string       `json:"leverage,omitempty"`
	MarginType       MarginMode   `json:"marginType,omitempty"`
	LiquidationPrice string       `json:"liquidationPrice,omitempty"`
	UpdateTime       int64        `json:"updateTime"`
	Raw              any          `json:"raw"`
}

func (WsPositionUpdate) EventType() WsUserDataEventType { return WsEventPosition }

type WsBalanceUpdate struct {
	Asset         string    `json:"asset"`
	TradeType     TradeType `json:"tradeType"`
	Available     string    `json:"available"`
	Total         string    `json:"total,omitempty"`
	Frozen        string    `json:"frozen,omitempty"`
	UnrealizedPnl string    `json:"unrealizedPnl,omitempty"`
	UpdateTime    int64     `json:"updateTime"`
	Raw           any       `json:"raw"`
}

func (WsBalanceUpdate) EventType() WsUserDataEventType { return WsEventBalance }

type WsAccountUpdate struct {
	TradeType  TradeType          `json:"tradeType"`
	Balances   []WsBalanceUpdate  `json:"balances"`
	Positions  []WsPositionUpdate `json:"positions"`
	UpdateTime int64              `json:"updateTime"`
	Raw        any                `json:"raw"`
}

func (WsAccountUpdate) EventType() WsUserDataEventType { return WsEventAccount }

type WsConnectionEvent struct {
	Type      WsUserDataEventType `json:"eventType"`
	TradeType *TradeType          `json:"tradeType,omitempty"`
	Timestamp int64               `json:"timestamp"`
	Reason    string              `json:"reason,omitempty"`
}

func (e WsConnectionEvent) EventType() WsUserDataEventType { return e.Type }

type WsErrorEvent struct {
	Code      string     `json:"code"`
	Message   string     `json:"message"`
	TradeType *TradeType `json:"tradeType,omitempty"`
	Timestamp int64      `json:"timestamp"`
	Raw       any        `json:"raw,omitempty"`
}

func (WsErrorEvent) EventType() WsUserDataEventType { return WsEventError }

type WsSubscribeOptions struct {
	TradeType            TradeType      `json:"tradeType"`
	AutoReconnect        *bool          `json:"autoReconnect,omitempty"`
	ReconnectInterval    *time.Duration `json:"reconnectInterval,omitempty"`
	MaxReconnectAttempts *int           `json:"maxReconnectAttempts,omitempty"`
}
