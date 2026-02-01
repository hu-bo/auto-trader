package types

// SpotOrderType represents spot order type.
type SpotOrderType string

const (
	SpotOrderTypeLimit           SpotOrderType = "LIMIT"
	SpotOrderTypeLimitMaker      SpotOrderType = "LIMIT_MAKER"
	SpotOrderTypeMarket          SpotOrderType = "MARKET"
	SpotOrderTypeStopLoss        SpotOrderType = "STOP_LOSS"
	SpotOrderTypeStopLossLimit   SpotOrderType = "STOP_LOSS_LIMIT"
	SpotOrderTypeTakeProfit      SpotOrderType = "TAKE_PROFIT"
	SpotOrderTypeTakeProfitLimit SpotOrderType = "TAKE_PROFIT_LIMIT"
)

// NewSpotOrderParams represents new spot order parameters.
type NewSpotOrderParams struct {
	Symbol                  string                  `json:"symbol"`
	Side                    OrderSide               `json:"side"`
	Type                    SpotOrderType           `json:"type"`
	TimeInForce             OrderTimeInForce        `json:"timeInForce,omitempty"`
	Quantity                string                  `json:"quantity,omitempty"`
	QuoteOrderQty           string                  `json:"quoteOrderQty,omitempty"`
	Price                   string                  `json:"price,omitempty"`
	NewClientOrderID        string                  `json:"newClientOrderId,omitempty"`
	StrategyID              int64                   `json:"strategyId,omitempty"`
	StrategyType            int                     `json:"strategyType,omitempty"`
	StopPrice               string                  `json:"stopPrice,omitempty"`
	TrailingDelta           int64                   `json:"trailingDelta,omitempty"`
	IcebergQty              string                  `json:"icebergQty,omitempty"`
	NewOrderRespType        OrderResponseType       `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode SelfTradePreventionMode `json:"selfTradePreventionMode,omitempty"`
}

// SpotOrderResult represents spot order result.
type SpotOrderResult struct {
	Symbol                  string                  `json:"symbol"`
	OrderID                 int64                   `json:"orderId"`
	OrderListID             int64                   `json:"orderListId"`
	ClientOrderID           string                  `json:"clientOrderId"`
	TransactTime            int64                   `json:"transactTime"`
	Price                   string                  `json:"price"`
	OrigQty                 string                  `json:"origQty"`
	ExecutedQty             string                  `json:"executedQty"`
	CumulativeQuoteQty      string                  `json:"cumulativeQuoteQty"`
	Status                  OrderStatus             `json:"status"`
	TimeInForce             OrderTimeInForce        `json:"timeInForce"`
	Type                    SpotOrderType           `json:"type"`
	Side                    OrderSide               `json:"side"`
	WorkingTime             int64                   `json:"workingTime"`
	SelfTradePreventionMode SelfTradePreventionMode `json:"selfTradePreventionMode"`
	Fills                   []SpotOrderFill         `json:"fills,omitempty"`
}

// SpotOrderFill represents spot order fill.
type SpotOrderFill struct {
	Price           string `json:"price"`
	Qty             string `json:"qty"`
	Commission      string `json:"commission"`
	CommissionAsset string `json:"commissionAsset"`
	TradeID         int64  `json:"tradeId"`
}

// SpotAccountInfo represents spot account info.
type SpotAccountInfo struct {
	MakerCommission            int             `json:"makerCommission"`
	TakerCommission            int             `json:"takerCommission"`
	BuyerCommission            int             `json:"buyerCommission"`
	SellerCommission           int             `json:"sellerCommission"`
	CommissionRates            CommissionRates `json:"commissionRates"`
	CanTrade                   bool            `json:"canTrade"`
	CanWithdraw                bool            `json:"canWithdraw"`
	CanDeposit                 bool            `json:"canDeposit"`
	Brokered                   bool            `json:"brokered"`
	RequireSelfTradePrevention bool            `json:"requireSelfTradePrevention"`
	PreventSor                 bool            `json:"preventSor"`
	UpdateTime                 int64           `json:"updateTime"`
	AccountType                string          `json:"accountType"`
	Balances                   []SpotBalance   `json:"balances"`
	Permissions                []string        `json:"permissions"`
	UID                        int64           `json:"uid"`
}

// CommissionRates represents commission rates.
type CommissionRates struct {
	Maker  string `json:"maker"`
	Taker  string `json:"taker"`
	Buyer  string `json:"buyer"`
	Seller string `json:"seller"`
}

// SpotBalance represents spot balance.
type SpotBalance struct {
	Asset  string `json:"asset"`
	Free   string `json:"free"`
	Locked string `json:"locked"`
}

// SpotExchangeInfo represents spot exchange info.
type SpotExchangeInfo struct {
	Timezone        string           `json:"timezone"`
	ServerTime      int64            `json:"serverTime"`
	RateLimits      []RateLimiter    `json:"rateLimits"`
	ExchangeFilters []interface{}    `json:"exchangeFilters"`
	Symbols         []SpotSymbolInfo `json:"symbols"`
}

// SpotSymbolInfo represents spot symbol info.
type SpotSymbolInfo struct {
	Symbol                          string        `json:"symbol"`
	Status                          string        `json:"status"`
	BaseAsset                       string        `json:"baseAsset"`
	BaseAssetPrecision              int           `json:"baseAssetPrecision"`
	QuoteAsset                      string        `json:"quoteAsset"`
	QuotePrecision                  int           `json:"quotePrecision"`
	QuoteAssetPrecision             int           `json:"quoteAssetPrecision"`
	BaseCommissionPrecision         int           `json:"baseCommissionPrecision"`
	QuoteCommissionPrecision        int           `json:"quoteCommissionPrecision"`
	OrderTypes                      []string      `json:"orderTypes"`
	IcebergAllowed                  bool          `json:"icebergAllowed"`
	OcoAllowed                      bool          `json:"ocoAllowed"`
	QuoteOrderQtyMarketAllowed      bool          `json:"quoteOrderQtyMarketAllowed"`
	AllowTrailingStop               bool          `json:"allowTrailingStop"`
	CancelReplaceAllowed            bool          `json:"cancelReplaceAllowed"`
	IsSpotTradingAllowed            bool          `json:"isSpotTradingAllowed"`
	IsMarginTradingAllowed          bool          `json:"isMarginTradingAllowed"`
	Filters                         []interface{} `json:"filters"`
	Permissions                     []string      `json:"permissions"`
	DefaultSelfTradePreventionMode  string        `json:"defaultSelfTradePreventionMode"`
	AllowedSelfTradePreventionModes []string      `json:"allowedSelfTradePreventionModes"`
}

// SpotTrade represents spot trade.
type SpotTrade struct {
	ID           int64  `json:"id"`
	Price        string `json:"price"`
	Qty          string `json:"qty"`
	QuoteQty     string `json:"quoteQty"`
	Time         int64  `json:"time"`
	IsBuyerMaker bool   `json:"isBuyerMaker"`
	IsBestMatch  bool   `json:"isBestMatch"`
}

// SpotOrderBook represents spot order book.
type SpotOrderBook struct {
	LastUpdateID int64          `json:"lastUpdateId"`
	Bids         []OrderBookRow `json:"bids"`
	Asks         []OrderBookRow `json:"asks"`
}

// OrderListOrderType represents order list order type.
type OrderListOrderType string

const (
	OrderListOrderTypeStopLossLimit   OrderListOrderType = "STOP_LOSS_LIMIT"
	OrderListOrderTypeStopLoss        OrderListOrderType = "STOP_LOSS"
	OrderListOrderTypeLimitMaker      OrderListOrderType = "LIMIT_MAKER"
	OrderListOrderTypeTakeProfit      OrderListOrderType = "TAKE_PROFIT"
	OrderListOrderTypeTakeProfitLimit OrderListOrderType = "TAKE_PROFIT_LIMIT"
)

// OCOStatus represents OCO status.
type OCOStatus string

const (
	OCOStatusResponse    OCOStatus = "RESPONSE"
	OCOStatusExecStarted OCOStatus = "EXEC_STARTED"
	OCOStatusAllDone     OCOStatus = "ALL_DONE"
)

// OCOOrderStatus represents OCO order status.
type OCOOrderStatus string

const (
	OCOOrderStatusExecuting OCOOrderStatus = "EXECUTING"
	OCOOrderStatusAllDone   OCOOrderStatus = "ALL_DONE"
	OCOOrderStatusReject    OCOOrderStatus = "REJECT"
)

// NewOCOParams represents new OCO order parameters.
type NewOCOParams struct {
	Symbol               string            `json:"symbol"`
	ListClientOrderID    string            `json:"listClientOrderId,omitempty"`
	Side                 OrderSide         `json:"side"`
	Quantity             string            `json:"quantity"`
	LimitClientOrderID   string            `json:"limitClientOrderId,omitempty"`
	LimitStrategyID      int64             `json:"limitStrategyId,omitempty"`
	LimitStrategyType    int               `json:"limitStrategyType,omitempty"`
	Price                string            `json:"price"`
	LimitIcebergQty      string            `json:"limitIcebergQty,omitempty"`
	TrailingDelta        int64             `json:"trailingDelta,omitempty"`
	StopClientOrderID    string            `json:"stopClientOrderId,omitempty"`
	StopPrice            string            `json:"stopPrice"`
	StopStrategyID       int64             `json:"stopStrategyId,omitempty"`
	StopStrategyType     int               `json:"stopStrategyType,omitempty"`
	StopLimitPrice       string            `json:"stopLimitPrice,omitempty"`
	StopIcebergQty       string            `json:"stopIcebergQty,omitempty"`
	StopLimitTimeInForce OrderTimeInForce  `json:"stopLimitTimeInForce,omitempty"`
	NewOrderRespType     OrderResponseType `json:"newOrderRespType,omitempty"`
	IsIsolated           string            `json:"isIsolated,omitempty"`
	SideEffectType       SideEffects       `json:"sideEffectType,omitempty"`
}

// CancelOCOParams represents cancel OCO parameters.
type CancelOCOParams struct {
	Symbol            string `json:"symbol"`
	OrderListID       int64  `json:"orderListId,omitempty"`
	ListClientOrderID string `json:"listClientOrderId,omitempty"`
	NewClientOrderID  string `json:"newClientOrderId,omitempty"`
}

// GetOCOParams represents get OCO parameters.
type GetOCOParams struct {
	Symbol            string `json:"symbol,omitempty"`
	OrderListID       int64  `json:"orderListId,omitempty"`
	OrigClientOrderID string `json:"origClientOrderId,omitempty"`
}

// OrderListOrder represents order list order.
type OrderListOrder struct {
	Symbol        string `json:"symbol"`
	OrderID       int64  `json:"orderId"`
	ClientOrderID string `json:"clientOrderId"`
}

// OrderList represents order list.
type OrderList struct {
	OrderListID       int64            `json:"orderListId"`
	ContingencyType   string           `json:"contingencyType"`
	ListStatusType    OCOStatus        `json:"listStatusType"`
	ListOrderStatus   OCOOrderStatus   `json:"listOrderStatus"`
	ListClientOrderID string           `json:"listClientOrderId"`
	TransactionTime   int64            `json:"transactionTime"`
	Symbol            string           `json:"symbol"`
	Orders            []OrderListOrder `json:"orders"`
}

// CancelOrderListResult represents cancel order list result.
type CancelOrderListResult struct {
	OrderList
	OrderReports []SpotOrderResult `json:"orderReports"`
}

// NewOrderListOTOParams represents new OTO order list parameters.
type NewOrderListOTOParams struct {
	Symbol                  string `json:"symbol"`
	ListClientOrderID       string `json:"listClientOrderId,omitempty"`
	NewOrderRespType        string `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode string `json:"selfTradePreventionMode,omitempty"`
	WorkingType             string `json:"workingType"`
	WorkingSide             string `json:"workingSide"`
	WorkingClientOrderID    string `json:"workingClientOrderId,omitempty"`
	WorkingPrice            string `json:"workingPrice"`
	WorkingQuantity         string `json:"workingQuantity"`
	WorkingIcebergQty       string `json:"workingIcebergQty,omitempty"`
	WorkingTimeInForce      string `json:"workingTimeInForce,omitempty"`
	WorkingStrategyID       int64  `json:"workingStrategyId,omitempty"`
	WorkingStrategyType     int    `json:"workingStrategyType,omitempty"`
	PendingType             string `json:"pendingType"`
	PendingSide             string `json:"pendingSide"`
	PendingClientOrderID    string `json:"pendingClientOrderId,omitempty"`
	PendingPrice            string `json:"pendingPrice,omitempty"`
	PendingStopPrice        string `json:"pendingStopPrice,omitempty"`
	PendingTrailingDelta    string `json:"pendingTrailingDelta,omitempty"`
	PendingQuantity         string `json:"pendingQuantity"`
	PendingIcebergQty       string `json:"pendingIcebergQty,omitempty"`
	PendingTimeInForce      string `json:"pendingTimeInForce,omitempty"`
	PendingStrategyID       int64  `json:"pendingStrategyId,omitempty"`
	PendingStrategyType     int    `json:"pendingStrategyType,omitempty"`
}

// OrderListOrderReport represents order list order report.
type OrderListOrderReport struct {
	Symbol                  string `json:"symbol"`
	OrderID                 int64  `json:"orderId"`
	OrderListID             int64  `json:"orderListId"`
	ClientOrderID           string `json:"clientOrderId"`
	TransactTime            int64  `json:"transactTime"`
	Price                   string `json:"price"`
	OrigQty                 string `json:"origQty"`
	ExecutedQty             string `json:"executedQty"`
	CummulativeQuoteQty     string `json:"cummulativeQuoteQty"`
	Status                  string `json:"status"`
	TimeInForce             string `json:"timeInForce"`
	Type                    string `json:"type"`
	Side                    string `json:"side"`
	StopPrice               string `json:"stopPrice,omitempty"`
	WorkingTime             int64  `json:"workingTime"`
	SelfTradePreventionMode string `json:"selfTradePreventionMode"`
}

// NewOrderListOTOResponse represents new OTO order list response.
type NewOrderListOTOResponse struct {
	OrderList
	OrderReports []OrderListOrderReport `json:"orderReports"`
}

// NewOrderListOTOCOParams represents new OTOCO order list parameters.
type NewOrderListOTOCOParams struct {
	Symbol                    string `json:"symbol"`
	ListClientOrderID         string `json:"listClientOrderId,omitempty"`
	NewOrderRespType          string `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode   string `json:"selfTradePreventionMode,omitempty"`
	WorkingType               string `json:"workingType"`
	WorkingSide               string `json:"workingSide"`
	WorkingClientOrderID      string `json:"workingClientOrderId,omitempty"`
	WorkingPrice              string `json:"workingPrice"`
	WorkingQuantity           string `json:"workingQuantity"`
	WorkingIcebergQty         string `json:"workingIcebergQty,omitempty"`
	WorkingTimeInForce        string `json:"workingTimeInForce,omitempty"`
	WorkingStrategyID         int64  `json:"workingStrategyId,omitempty"`
	WorkingStrategyType       int    `json:"workingStrategyType,omitempty"`
	PendingSide               string `json:"pendingSide"`
	PendingQuantity           string `json:"pendingQuantity"`
	PendingAboveType          string `json:"pendingAboveType"`
	PendingAboveClientOrderID string `json:"pendingAboveClientOrderId,omitempty"`
	PendingAbovePrice         string `json:"pendingAbovePrice,omitempty"`
	PendingAboveStopPrice     string `json:"pendingAboveStopPrice,omitempty"`
	PendingAboveTrailingDelta string `json:"pendingAboveTrailingDelta,omitempty"`
	PendingAboveIcebergQty    string `json:"pendingAboveIcebergQty,omitempty"`
	PendingAboveTimeInForce   string `json:"pendingAboveTimeInForce,omitempty"`
	PendingAboveStrategyID    int64  `json:"pendingAboveStrategyId,omitempty"`
	PendingAboveStrategyType  int    `json:"pendingAboveStrategyType,omitempty"`
	PendingBelowType          string `json:"pendingBelowType"`
	PendingBelowClientOrderID string `json:"pendingBelowClientOrderId,omitempty"`
	PendingBelowPrice         string `json:"pendingBelowPrice,omitempty"`
	PendingBelowStopPrice     string `json:"pendingBelowStopPrice,omitempty"`
	PendingBelowTrailingDelta string `json:"pendingBelowTrailingDelta,omitempty"`
	PendingBelowIcebergQty    string `json:"pendingBelowIcebergQty,omitempty"`
	PendingBelowTimeInForce   string `json:"pendingBelowTimeInForce,omitempty"`
	PendingBelowStrategyID    int64  `json:"pendingBelowStrategyId,omitempty"`
	PendingBelowStrategyType  int    `json:"pendingBelowStrategyType,omitempty"`
}

// NewOrderListOTOCOResponse represents new OTOCO order list response.
type NewOrderListOTOCOResponse struct {
	OrderList
	OrderReports []OrderListOrderReport `json:"orderReports"`
}

// NewOrderListOPOParams represents new OPO order list parameters.
type NewOrderListOPOParams struct {
	Symbol                  string `json:"symbol"`
	ListClientOrderID       string `json:"listClientOrderId,omitempty"`
	NewOrderRespType        string `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode string `json:"selfTradePreventionMode,omitempty"`
	WorkingType             string `json:"workingType"`
	WorkingSide             string `json:"workingSide"`
	WorkingClientOrderID    string `json:"workingClientOrderId,omitempty"`
	WorkingPrice            string `json:"workingPrice"`
	WorkingQuantity         string `json:"workingQuantity"`
	WorkingIcebergQty       string `json:"workingIcebergQty,omitempty"`
	WorkingTimeInForce      string `json:"workingTimeInForce,omitempty"`
	WorkingStrategyID       int64  `json:"workingStrategyId,omitempty"`
	WorkingStrategyType     int    `json:"workingStrategyType,omitempty"`
	PendingType             string `json:"pendingType"`
	PendingSide             string `json:"pendingSide"`
	PendingClientOrderID    string `json:"pendingClientOrderId,omitempty"`
	PendingPrice            string `json:"pendingPrice,omitempty"`
	PendingStopPrice        string `json:"pendingStopPrice,omitempty"`
	PendingTrailingDelta    string `json:"pendingTrailingDelta,omitempty"`
	PendingIcebergQty       string `json:"pendingIcebergQty,omitempty"`
	PendingTimeInForce      string `json:"pendingTimeInForce,omitempty"`
	PendingStrategyID       int64  `json:"pendingStrategyId,omitempty"`
	PendingStrategyType     int    `json:"pendingStrategyType,omitempty"`
}

// NewOrderListOPOResponse represents new OPO order list response.
type NewOrderListOPOResponse struct {
	OrderList
	OrderReports []OrderListOrderReport `json:"orderReports"`
}

// NewOrderListOPOCOParams represents new OPOCO order list parameters.
type NewOrderListOPOCOParams struct {
	Symbol                    string `json:"symbol"`
	ListClientOrderID         string `json:"listClientOrderId,omitempty"`
	NewOrderRespType          string `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode   string `json:"selfTradePreventionMode,omitempty"`
	WorkingType               string `json:"workingType"`
	WorkingSide               string `json:"workingSide"`
	WorkingClientOrderID      string `json:"workingClientOrderId,omitempty"`
	WorkingPrice              string `json:"workingPrice"`
	WorkingQuantity           string `json:"workingQuantity"`
	WorkingIcebergQty         string `json:"workingIcebergQty,omitempty"`
	WorkingTimeInForce        string `json:"workingTimeInForce,omitempty"`
	WorkingStrategyID         int64  `json:"workingStrategyId,omitempty"`
	WorkingStrategyType       int    `json:"workingStrategyType,omitempty"`
	PendingSide               string `json:"pendingSide"`
	PendingAboveType          string `json:"pendingAboveType"`
	PendingAboveClientOrderID string `json:"pendingAboveClientOrderId,omitempty"`
	PendingAbovePrice         string `json:"pendingAbovePrice,omitempty"`
	PendingAboveStopPrice     string `json:"pendingAboveStopPrice,omitempty"`
	PendingAboveTrailingDelta string `json:"pendingAboveTrailingDelta,omitempty"`
	PendingAboveIcebergQty    string `json:"pendingAboveIcebergQty,omitempty"`
	PendingAboveTimeInForce   string `json:"pendingAboveTimeInForce,omitempty"`
	PendingAboveStrategyID    int64  `json:"pendingAboveStrategyId,omitempty"`
	PendingAboveStrategyType  int    `json:"pendingAboveStrategyType,omitempty"`
	PendingBelowType          string `json:"pendingBelowType,omitempty"`
	PendingBelowClientOrderID string `json:"pendingBelowClientOrderId,omitempty"`
	PendingBelowPrice         string `json:"pendingBelowPrice,omitempty"`
	PendingBelowStopPrice     string `json:"pendingBelowStopPrice,omitempty"`
	PendingBelowTrailingDelta string `json:"pendingBelowTrailingDelta,omitempty"`
	PendingBelowIcebergQty    string `json:"pendingBelowIcebergQty,omitempty"`
	PendingBelowTimeInForce   string `json:"pendingBelowTimeInForce,omitempty"`
	PendingBelowStrategyID    int64  `json:"pendingBelowStrategyId,omitempty"`
	PendingBelowStrategyType  int    `json:"pendingStrategyType,omitempty"`
}

// NewOrderListOPOCOResponse represents new OPOCO order list response.
type NewOrderListOPOCOResponse struct {
	OrderList
	OrderReports []OrderListOrderReport `json:"orderReports"`
}

// NewSpotSOROrderParams represents SOR order parameters.
type NewSpotSOROrderParams struct {
	Symbol                  string                  `json:"symbol"`
	Side                    OrderSide               `json:"side"`
	Type                    SpotOrderType           `json:"type"`
	TimeInForce             OrderTimeInForce        `json:"timeInForce,omitempty"`
	Quantity                string                  `json:"quantity"`
	Price                   string                  `json:"price,omitempty"`
	NewClientOrderID        string                  `json:"newClientOrderId,omitempty"`
	StrategyID              int64                   `json:"strategyId,omitempty"`
	StrategyType            int                     `json:"strategyType,omitempty"`
	IcebergQty              string                  `json:"icebergQty,omitempty"`
	NewOrderRespType        OrderResponseType       `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode SelfTradePreventionMode `json:"selfTradePreventionMode,omitempty"`
}

// SOROrderFill represents SOR order fill.
type SOROrderFill struct {
	MatchType       string `json:"matchType"`
	Price           string `json:"price"`
	Qty             string `json:"qty"`
	Commission      string `json:"commission"`
	CommissionAsset string `json:"commissionAsset"`
	TradeID         int64  `json:"tradeId"`
	AllocID         int64  `json:"allocId"`
}

// SOROrderResponseFull represents SOR order full response.
type SOROrderResponseFull struct {
	SpotOrderResult
	WorkingTime             int64          `json:"workingTime"`
	Fills                   []SOROrderFill `json:"fills"`
	WorkingFloor            string         `json:"workingFloor"`
	SelfTradePreventionMode string         `json:"selfTradePreventionMode"`
	UsedSOR                 bool           `json:"usedSor"`
}

// AccountTradeList represents account trade list.
type AccountTradeList struct {
	Symbol          string `json:"symbol"`
	ID              int64  `json:"id"`
	OrderID         int64  `json:"orderId"`
	OrderListID     int64  `json:"orderListId"`
	Price           string `json:"price"`
	Qty             string `json:"qty"`
	QuoteQty        string `json:"quoteQty"`
	Commission      string `json:"commission"`
	CommissionAsset string `json:"commissionAsset"`
	Time            int64  `json:"time"`
	IsBuyer         bool   `json:"isBuyer"`
	IsMaker         bool   `json:"isMaker"`
	IsBestMatch     bool   `json:"isBestMatch"`
}

// OrderRateLimitUsage represents order rate limit usage.
type OrderRateLimitUsage struct {
	RateLimitType string `json:"rateLimitType"`
	Interval      string `json:"interval"`
	IntervalNum   int    `json:"intervalNum"`
	Limit         int    `json:"limit"`
	Count         int    `json:"count"`
}

// PreventedMatch represents prevented match.
type PreventedMatch struct {
	Symbol                  string `json:"symbol"`
	PreventedMatchID        int64  `json:"preventedMatchId"`
	TakerOrderID            int64  `json:"takerOrderId"`
	MakerOrderID            int64  `json:"makerOrderId"`
	TradeGroupID            int64  `json:"tradeGroupId"`
	SelfTradePreventionMode string `json:"selfTradePreventionMode"`
	Price                   string `json:"price"`
	MakerPreventedQuantity  string `json:"makerPreventedQuantity"`
	TransactTime            int64  `json:"transactTime"`
}
