package websockets

// WsAPIRequest represents WS API request.
type WsAPIRequest struct {
	ID     string      `json:"id"`
	Method string      `json:"method"`
	Params interface{} `json:"params,omitempty"`
}

// WsAPIResponse represents WS API response.
type WsAPIResponse struct {
	ID         string        `json:"id"`
	Status     int           `json:"status"`
	Result     interface{}   `json:"result,omitempty"`
	Error      *WsAPIError   `json:"error,omitempty"`
	RateLimits []WsRateLimit `json:"rateLimits,omitempty"`
}

// WsAPIError represents WS API error.
type WsAPIError struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

// WsRateLimit represents rate limit info.
type WsRateLimit struct {
	RateLimitType string `json:"rateLimitType"`
	Interval      string `json:"interval"`
	IntervalNum   int    `json:"intervalNum"`
	Limit         int    `json:"limit"`
	Count         int    `json:"count"`
}

// WS API Methods

// WsAPISessionLogonParams represents session.logon params.
type WsAPISessionLogonParams struct {
	APIKey    string `json:"apiKey"`
	Signature string `json:"signature"`
	Timestamp int64  `json:"timestamp"`
}

// WsAPIOrderParams represents order params for WS API.
type WsAPIOrderParams struct {
	Symbol                  string `json:"symbol"`
	Side                    string `json:"side"`
	Type                    string `json:"type"`
	TimeInForce             string `json:"timeInForce,omitempty"`
	Quantity                string `json:"quantity,omitempty"`
	QuoteOrderQty           string `json:"quoteOrderQty,omitempty"`
	Price                   string `json:"price,omitempty"`
	NewClientOrderID        string `json:"newClientOrderId,omitempty"`
	StopPrice               string `json:"stopPrice,omitempty"`
	TrailingDelta           int64  `json:"trailingDelta,omitempty"`
	IcebergQty              string `json:"icebergQty,omitempty"`
	NewOrderRespType        string `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode string `json:"selfTradePreventionMode,omitempty"`
	RecvWindow              int64  `json:"recvWindow,omitempty"`
	Timestamp               int64  `json:"timestamp"`
}

// WsAPICancelOrderParams represents cancel order params for WS API.
type WsAPICancelOrderParams struct {
	Symbol            string `json:"symbol"`
	OrderID           int64  `json:"orderId,omitempty"`
	OrigClientOrderID string `json:"origClientOrderId,omitempty"`
	NewClientOrderID  string `json:"newClientOrderId,omitempty"`
	RecvWindow        int64  `json:"recvWindow,omitempty"`
	Timestamp         int64  `json:"timestamp"`
}

// WsAPIQueryOrderParams represents query order params for WS API.
type WsAPIQueryOrderParams struct {
	Symbol            string `json:"symbol"`
	OrderID           int64  `json:"orderId,omitempty"`
	OrigClientOrderID string `json:"origClientOrderId,omitempty"`
	RecvWindow        int64  `json:"recvWindow,omitempty"`
	Timestamp         int64  `json:"timestamp"`
}

// WsAPIAccountInfoParams represents account info params for WS API.
type WsAPIAccountInfoParams struct {
	RecvWindow int64 `json:"recvWindow,omitempty"`
	Timestamp  int64 `json:"timestamp"`
}

// WsAPIOpenOrdersParams represents open orders params for WS API.
type WsAPIOpenOrdersParams struct {
	Symbol     string `json:"symbol,omitempty"`
	RecvWindow int64  `json:"recvWindow,omitempty"`
	Timestamp  int64  `json:"timestamp"`
}

// WS API Operation names

const (
	// Session operations
	WsOpSessionLogon  = "session.logon"
	WsOpSessionLogout = "session.logout"
	WsOpSessionStatus = "session.status"

	// Trading operations
	WsOpOrderPlace         = "order.place"
	WsOpOrderStatus        = "order.status"
	WsOpOrderCancel        = "order.cancel"
	WsOpOrderCancelReplace = "order.cancelReplace"
	WsOpOpenOrders         = "openOrders.status"
	WsOpOpenOrdersCancel   = "openOrders.cancelAll"
	WsOpOrderHistory       = "allOrders"
	WsOpOrderOCOPlace      = "orderList.place"
	WsOpOrderOCOStatus     = "orderList.status"
	WsOpOrderOCOCancel     = "orderList.cancel"
	WsOpOrderOCOOpenStatus = "openOrderLists.status"

	// Account operations
	WsOpAccountStatus             = "account.status"
	WsOpAccountRateLimits         = "account.rateLimits.orders"
	WsOpAccountMyTrades           = "myTrades"
	WsOpAccountMyAllocations      = "myAllocations"
	WsOpAccountMyPreventedMatches = "myPreventedMatches"

	// User data stream operations
	WsOpUserDataStreamStart = "userDataStream.start"
	WsOpUserDataStreamPing  = "userDataStream.ping"
	WsOpUserDataStreamStop  = "userDataStream.stop"

	// General operations
	WsOpPing         = "ping"
	WsOpTime         = "time"
	WsOpExchangeInfo = "exchangeInfo"

	// Market operations
	WsOpDepth            = "depth"
	WsOpTrades           = "trades"
	WsOpHistoricalTrades = "trades.historical"
	WsOpAggTrades        = "trades.aggregate"
	WsOpKlines           = "klines"
	WsOpUIKlines         = "uiKlines"
	WsOpAvgPrice         = "avgPrice"
	WsOpTicker24hr       = "ticker.24hr"
	WsOpTickerPrice      = "ticker.price"
	WsOpTickerBook       = "ticker.book"
	WsOpTicker           = "ticker"
)

// Futures WS API Operations

const (
	// Futures Trading operations
	WsFuturesOpOrderPlace    = "order.place"
	WsFuturesOpOrderModify   = "order.modify"
	WsFuturesOpOrderCancel   = "order.cancel"
	WsFuturesOpOrderStatus   = "order.status"
	WsFuturesOpOpenOrders    = "openOrders.status"
	WsFuturesOpAllOrders     = "allOrders"
	WsFuturesOpCancelAll     = "openOrders.cancelAll"
	WsFuturesOpPositionV2    = "v2/account.position"
	WsFuturesOpBalance       = "v2/account.balance"
	WsFuturesOpAccountStatus = "v2/account.status"
	WsFuturesOpAccountConfig = "account.config"

	// Futures User data stream operations
	WsFuturesOpUserDataStart = "userDataStream.start"
	WsFuturesOpUserDataPing  = "userDataStream.ping"
	WsFuturesOpUserDataStop  = "userDataStream.stop"
)
