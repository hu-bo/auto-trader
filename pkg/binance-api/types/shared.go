// Package types provides shared type definitions for Binance API.
package types

// BinanceBaseURLKey represents the base URL key for different Binance products.
type BinanceBaseURLKey string

const (
	BaseURLSpot         BinanceBaseURLKey = "spot"
	BaseURLSpot1        BinanceBaseURLKey = "spot1"
	BaseURLSpot2        BinanceBaseURLKey = "spot2"
	BaseURLSpot3        BinanceBaseURLKey = "spot3"
	BaseURLSpot4        BinanceBaseURLKey = "spot4"
	BaseURLSpotTest     BinanceBaseURLKey = "spottest"
	BaseURLUSDM         BinanceBaseURLKey = "usdm"
	BaseURLUSDMTest     BinanceBaseURLKey = "usdmtest"
	BaseURLCOINM        BinanceBaseURLKey = "coinm"
	BaseURLCOINMTest    BinanceBaseURLKey = "coinmtest"
	BaseURLVOptions     BinanceBaseURLKey = "voptions"
	BaseURLVOptionsTest BinanceBaseURLKey = "voptionstest"
	BaseURLPAPI         BinanceBaseURLKey = "papi"
	BaseURLWWW          BinanceBaseURLKey = "www"
)

// OrderTimeInForce represents order time in force options.
type OrderTimeInForce string

const (
	TimeInForceGTC    OrderTimeInForce = "GTC"
	TimeInForceIOC    OrderTimeInForce = "IOC"
	TimeInForceFOK    OrderTimeInForce = "FOK"
	TimeInForceGTX    OrderTimeInForce = "GTX"
	TimeInForceGTEGTC OrderTimeInForce = "GTE_GTC"
	TimeInForceGTD    OrderTimeInForce = "GTD"
)

// OrderSide represents order side.
type OrderSide string

const (
	SideBuy  OrderSide = "BUY"
	SideSell OrderSide = "SELL"
)

// OrderStatus represents order status.
type OrderStatus string

const (
	StatusNew             OrderStatus = "NEW"
	StatusPartiallyFilled OrderStatus = "PARTIALLY_FILLED"
	StatusFilled          OrderStatus = "FILLED"
	StatusCanceled        OrderStatus = "CANCELED"
	StatusPendingCancel   OrderStatus = "PENDING_CANCEL"
	StatusRejected        OrderStatus = "REJECTED"
	StatusExpired         OrderStatus = "EXPIRED"
)

// OrderExecutionType represents order execution type.
type OrderExecutionType string

const (
	ExecutionTypeNew      OrderExecutionType = "NEW"
	ExecutionTypeCanceled OrderExecutionType = "CANCELED"
	ExecutionTypeRejected OrderExecutionType = "REJECTED"
	ExecutionTypeTrade    OrderExecutionType = "TRADE"
	ExecutionTypeExpired  OrderExecutionType = "EXPIRED"
)

// OrderType represents order type.
type OrderType string

const (
	OrderTypeLimit           OrderType = "LIMIT"
	OrderTypeLimitMaker      OrderType = "LIMIT_MAKER"
	OrderTypeMarket          OrderType = "MARKET"
	OrderTypeStopLoss        OrderType = "STOP_LOSS"
	OrderTypeStopLossLimit   OrderType = "STOP_LOSS_LIMIT"
	OrderTypeTakeProfit      OrderType = "TAKE_PROFIT"
	OrderTypeTakeProfitLimit OrderType = "TAKE_PROFIT_LIMIT"
)

// SelfTradePreventionMode represents self trade prevention mode.
type SelfTradePreventionMode string

const (
	STPModeExpireTaker SelfTradePreventionMode = "EXPIRE_TAKER"
	STPModeExpireMaker SelfTradePreventionMode = "EXPIRE_MAKER"
	STPModeExpireBoth  SelfTradePreventionMode = "EXPIRE_BOTH"
	STPModeNone        SelfTradePreventionMode = "NONE"
)

// SideEffects represents side effects for margin trading.
type SideEffects string

const (
	SideEffectMarginBuy       SideEffects = "MARGIN_BUY"
	SideEffectAutoRepay       SideEffects = "AUTO_REPAY"
	SideEffectNoSideEffect    SideEffects = "NO_SIDE_EFFECT"
	SideEffectAutoBorrowRepay SideEffects = "AUTO_BORROW_REPAY"
)

// KlineInterval represents kline interval.
type KlineInterval string

const (
	Interval1s  KlineInterval = "1s"
	Interval1m  KlineInterval = "1m"
	Interval3m  KlineInterval = "3m"
	Interval5m  KlineInterval = "5m"
	Interval15m KlineInterval = "15m"
	Interval30m KlineInterval = "30m"
	Interval1h  KlineInterval = "1h"
	Interval2h  KlineInterval = "2h"
	Interval4h  KlineInterval = "4h"
	Interval6h  KlineInterval = "6h"
	Interval8h  KlineInterval = "8h"
	Interval12h KlineInterval = "12h"
	Interval1d  KlineInterval = "1d"
	Interval3d  KlineInterval = "3d"
	Interval1w  KlineInterval = "1w"
	Interval1M  KlineInterval = "1M"
)

// OrderResponseType represents order response type.
type OrderResponseType string

const (
	ResponseTypeACK    OrderResponseType = "ACK"
	ResponseTypeRESULT OrderResponseType = "RESULT"
	ResponseTypeFULL   OrderResponseType = "FULL"
)

// BasicSymbolParam represents basic symbol parameter.
type BasicSymbolParam struct {
	Symbol     string `json:"symbol"`
	IsIsolated string `json:"isIsolated,omitempty"`
}

// BasicAssetPaginatedParams represents basic asset paginated parameters.
type BasicAssetPaginatedParams struct {
	Asset     string `json:"asset,omitempty"`
	StartTime int64  `json:"startTime,omitempty"`
	EndTime   int64  `json:"endTime,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

// BasicSymbolPaginatedParams represents basic symbol paginated parameters.
type BasicSymbolPaginatedParams struct {
	Symbol    string `json:"symbol,omitempty"`
	StartTime int64  `json:"startTime,omitempty"`
	EndTime   int64  `json:"endTime,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

// SymbolPrice represents symbol price.
type SymbolPrice struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
	Time   int64  `json:"time,omitempty"`
}

// OrderBookParams represents order book parameters.
type OrderBookParams struct {
	Symbol string `json:"symbol"`
	Limit  int    `json:"limit,omitempty"` // 5, 10, 20, 50, 100, 500, 1000, 5000
}

// GetOrderParams represents get order parameters.
type GetOrderParams struct {
	Symbol            string `json:"symbol"`
	OrderID           int64  `json:"orderId,omitempty"`
	OrigClientOrderID string `json:"origClientOrderId,omitempty"`
}

// HistoricalTradesParams represents historical trades parameters.
type HistoricalTradesParams struct {
	Symbol string `json:"symbol"`
	Limit  int    `json:"limit,omitempty"`
	FromID int64  `json:"fromId,omitempty"`
}

// KlinesParams represents klines parameters.
type KlinesParams struct {
	Symbol    string        `json:"symbol"`
	Interval  KlineInterval `json:"interval"`
	StartTime int64         `json:"startTime,omitempty"`
	EndTime   int64         `json:"endTime,omitempty"`
	TimeZone  string        `json:"timeZone,omitempty"`
	Limit     int           `json:"limit,omitempty"`
}

// Kline represents kline/candlestick data.
type Kline struct {
	OpenTime         int64
	Open             string
	High             string
	Low              string
	Close            string
	Volume           string
	CloseTime        int64
	QuoteAssetVolume string
	NumberOfTrades   int64
	TakerBuyBaseVol  string
	TakerBuyQuoteVol string
}

// RecentTradesParams represents recent trades parameters.
type RecentTradesParams struct {
	Symbol string `json:"symbol"`
	Limit  int    `json:"limit,omitempty"`
}

// CancelOrderParams represents cancel order parameters.
type CancelOrderParams struct {
	Symbol            string `json:"symbol"`
	OrderID           int64  `json:"orderId,omitempty"`
	OrigClientOrderID string `json:"origClientOrderId,omitempty"`
}

// GetAllOrdersParams represents get all orders parameters.
type GetAllOrdersParams struct {
	Symbol    string `json:"symbol"`
	OrderID   int64  `json:"orderId,omitempty"`
	StartTime int64  `json:"startTime,omitempty"`
	EndTime   int64  `json:"endTime,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

// SymbolFromPaginatedRequestFromId represents symbol from paginated request from id.
type SymbolFromPaginatedRequestFromId struct {
	Symbol    string `json:"symbol"`
	FromID    int64  `json:"fromId,omitempty"`
	StartTime int64  `json:"startTime,omitempty"`
	EndTime   int64  `json:"endTime,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

// RateLimiter represents rate limiter info.
type RateLimiter struct {
	RateLimitType string `json:"rateLimitType"` // REQUEST_WEIGHT | ORDERS | RAW_REQUESTS
	Interval      string `json:"interval"`      // SECOND | MINUTE | DAY
	IntervalNum   int    `json:"intervalNum"`
	Limit         int    `json:"limit"`
}

// OrderBookRow represents a single order book row [price, quantity].
type OrderBookRow [2]string

// GenericCodeMsgError represents a generic error response.
type GenericCodeMsgError struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

// ListenKeyResponse represents listen key response.
type ListenKeyResponse struct {
	ListenKey string `json:"listenKey"`
}

// RowsWithTotal represents a response with rows and total count.
type RowsWithTotal[T any] struct {
	Rows  []T `json:"rows"`
	Total int `json:"total"`
}
