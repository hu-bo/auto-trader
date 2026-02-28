package types

// FuturesContractType represents futures contract type.
type FuturesContractType string

const (
	ContractTypePerpetual      FuturesContractType = "PERPETUAL"
	ContractTypeCurrentMonth   FuturesContractType = "CURRENT_MONTH"
	ContractTypeNextMonth      FuturesContractType = "NEXT_MONTH"
	ContractTypeCurrentQuarter FuturesContractType = "CURRENT_QUARTER"
	ContractTypeNextQuarter    FuturesContractType = "NEXT_QUARTER"
)

// PositionSide represents position side.
type PositionSide string

const (
	PositionSideBoth  PositionSide = "BOTH"
	PositionSideLong  PositionSide = "LONG"
	PositionSideShort PositionSide = "SHORT"
)

// MarginType represents margin type.
type MarginType string

const (
	MarginTypeIsolated MarginType = "ISOLATED"
	MarginTypeCrossed  MarginType = "CROSSED"
)

// WorkingType represents working type.
type WorkingType string

const (
	WorkingTypeMarkPrice     WorkingType = "MARK_PRICE"
	WorkingTypeContractPrice WorkingType = "CONTRACT_PRICE"
)

// FuturesOrderType represents futures order type.
type FuturesOrderType string

const (
	FuturesOrderTypeLimit              FuturesOrderType = "LIMIT"
	FuturesOrderTypeMarket             FuturesOrderType = "MARKET"
	FuturesOrderTypeStop               FuturesOrderType = "STOP"
	FuturesOrderTypeStopMarket         FuturesOrderType = "STOP_MARKET"
	FuturesOrderTypeTakeProfit         FuturesOrderType = "TAKE_PROFIT"
	FuturesOrderTypeTakeProfitMarket   FuturesOrderType = "TAKE_PROFIT_MARKET"
	FuturesOrderTypeTrailingStopMarket FuturesOrderType = "TRAILING_STOP_MARKET"
)

// PriceMatchMode represents price match mode.
type PriceMatchMode string

const (
	PriceMatchNone       PriceMatchMode = "NONE"
	PriceMatchOpponent   PriceMatchMode = "OPPONENT"
	PriceMatchOpponent5  PriceMatchMode = "OPPONENT_5"
	PriceMatchOpponent10 PriceMatchMode = "OPPONENT_10"
	PriceMatchOpponent20 PriceMatchMode = "OPPONENT_20"
	PriceMatchQueue      PriceMatchMode = "QUEUE"
	PriceMatchQueue5     PriceMatchMode = "QUEUE_5"
	PriceMatchQueue10    PriceMatchMode = "QUEUE_10"
	PriceMatchQueue20    PriceMatchMode = "QUEUE_20"
)

// IncomeType represents income type.
type IncomeType string

const (
	IncomeTypeTransfer       IncomeType = "TRANSFER"
	IncomeTypeWelcomeBonus   IncomeType = "WELCOME_BONUS"
	IncomeTypeRealizedPNL    IncomeType = "REALIZED_PNL"
	IncomeTypeFundingFee     IncomeType = "FUNDING_FEE"
	IncomeTypeCommission     IncomeType = "COMMISSION"
	IncomeTypeInsuranceClear IncomeType = "INSURANCE_CLEAR"
)

// ContinuousContractKlinesParams represents continuous contract klines parameters.
type ContinuousContractKlinesParams struct {
	Pair         string              `json:"pair"`
	ContractType FuturesContractType `json:"contractType"`
	Interval     KlineInterval       `json:"interval"`
	StartTime    int64               `json:"startTime,omitempty"`
	EndTime      int64               `json:"endTime,omitempty"`
	Limit        int                 `json:"limit,omitempty"`
}

// IndexPriceKlinesParams represents index price klines parameters.
type IndexPriceKlinesParams struct {
	Pair      string        `json:"pair"`
	Interval  KlineInterval `json:"interval"`
	StartTime int64         `json:"startTime,omitempty"`
	EndTime   int64         `json:"endTime,omitempty"`
	Limit     int           `json:"limit,omitempty"`
}

// SymbolKlinePaginatedParams represents symbol kline paginated parameters.
type SymbolKlinePaginatedParams struct {
	Symbol    string        `json:"symbol"`
	Interval  KlineInterval `json:"interval"`
	StartTime int64         `json:"startTime,omitempty"`
	EndTime   int64         `json:"endTime,omitempty"`
	Limit     int           `json:"limit,omitempty"`
}

// FuturesDataPaginatedParams represents futures data paginated parameters.
type FuturesDataPaginatedParams struct {
	Symbol       string `json:"symbol"`
	ContractType string `json:"contractType,omitempty"`
	Period       string `json:"period"` // 5m | 15m | 30m | 1h | 2h | 4h | 6h | 12h | 1d
	Limit        int    `json:"limit,omitempty"`
	StartTime    int64  `json:"startTime,omitempty"`
	EndTime      int64  `json:"endTime,omitempty"`
}

// NewFuturesOrderParams represents new futures order parameters.
type NewFuturesOrderParams struct {
	Symbol                  string                  `json:"symbol"`
	Side                    OrderSide               `json:"side"`
	PositionSide            PositionSide            `json:"positionSide,omitempty"`
	Type                    FuturesOrderType        `json:"type"`
	TimeInForce             OrderTimeInForce        `json:"timeInForce,omitempty"`
	Quantity                string                  `json:"quantity,omitempty"`
	ReduceOnly              string                  `json:"reduceOnly,omitempty"`
	Price                   string                  `json:"price,omitempty"`
	NewClientOrderID        string                  `json:"newClientOrderId,omitempty"`
	StopPrice               string                  `json:"stopPrice,omitempty"`
	ClosePosition           string                  `json:"closePosition,omitempty"`
	ActivationPrice         string                  `json:"activationPrice,omitempty"`
	CallbackRate            string                  `json:"callbackRate,omitempty"`
	WorkingType             WorkingType             `json:"workingType,omitempty"`
	PriceProtect            string                  `json:"priceProtect,omitempty"`
	NewOrderRespType        string                  `json:"newOrderRespType,omitempty"`
	SelfTradePreventionMode SelfTradePreventionMode `json:"selfTradePreventionMode,omitempty"`
	PriceMatch              PriceMatchMode          `json:"priceMatch,omitempty"`
	GoodTillDate            int64                   `json:"goodTillDate,omitempty"`
}

// ModifyFuturesOrderParams represents modify futures order parameters.
type ModifyFuturesOrderParams struct {
	OrderID           int64          `json:"orderId,omitempty"`
	OrigClientOrderID string         `json:"origClientOrderId,omitempty"`
	Symbol            string         `json:"symbol"`
	Side              OrderSide      `json:"side"`
	Quantity          string         `json:"quantity,omitempty"`
	Price             string         `json:"price,omitempty"`
	PriceMatch        PriceMatchMode `json:"priceMatch,omitempty"`
}

// CancelMultipleOrdersParams represents cancel multiple orders parameters.
type CancelMultipleOrdersParams struct {
	Symbol                string   `json:"symbol"`
	OrderIDList           []int64  `json:"orderIdList,omitempty"`
	OrigClientOrderIDList []string `json:"origClientOrderIdList,omitempty"`
}

// CancelOrdersTimeoutParams represents cancel orders timeout parameters.
type CancelOrdersTimeoutParams struct {
	Symbol        string `json:"symbol"`
	CountdownTime int64  `json:"countdownTime,omitempty"`
}

// SetLeverageParams represents set leverage parameters.
type SetLeverageParams struct {
	Symbol   string `json:"symbol"`
	Leverage int    `json:"leverage"`
}

// SetLeverageResult represents set leverage result.
type SetLeverageResult struct {
	Leverage         int    `json:"leverage"`
	MaxNotionalValue string `json:"maxNotionalValue"`
	Symbol           string `json:"symbol"`
}

// SetMarginTypeParams represents set margin type parameters.
type SetMarginTypeParams struct {
	Symbol     string     `json:"symbol"`
	MarginType MarginType `json:"marginType"`
}

// SetIsolatedMarginParams represents set isolated margin parameters.
type SetIsolatedMarginParams struct {
	Symbol       string       `json:"symbol"`
	PositionSide PositionSide `json:"positionSide,omitempty"`
	Amount       float64      `json:"amount"`
	Type         int          `json:"type"` // 1: Add, 2: Reduce
}

// GetPositionMarginChangeHistoryParams represents get position margin change history parameters.
type GetPositionMarginChangeHistoryParams struct {
	Symbol    string `json:"symbol"`
	Type      int    `json:"type,omitempty"`
	StartTime int64  `json:"startTime,omitempty"`
	EndTime   int64  `json:"endTime,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

// GetIncomeHistoryParams represents get income history parameters.
type GetIncomeHistoryParams struct {
	Symbol     string     `json:"symbol,omitempty"`
	IncomeType IncomeType `json:"incomeType,omitempty"`
	StartTime  int64      `json:"startTime,omitempty"`
	EndTime    int64      `json:"endTime,omitempty"`
	Limit      int        `json:"limit,omitempty"`
	Page       int        `json:"page,omitempty"`
}

// GetForceOrdersParams represents get force orders parameters.
type GetForceOrdersParams struct {
	Symbol        string `json:"symbol,omitempty"`
	AutoCloseType string `json:"autoCloseType,omitempty"` // LIQUIDATION | ADL
	StartTime     int64  `json:"startTime,omitempty"`
	EndTime       int64  `json:"endTime,omitempty"`
	Limit         int    `json:"limit,omitempty"`
}

// PositionModeParams represents position mode parameters.
type PositionModeParams struct {
	DualSidePosition string `json:"dualSidePosition"` // "true" or "false"
}

// FuturesExchangeInfo represents futures exchange info.
type FuturesExchangeInfo struct {
	ExchangeFilters []interface{}               `json:"exchangeFilters"`
	RateLimits      []RateLimiter               `json:"rateLimits"`
	ServerTime      int64                       `json:"serverTime"`
	Assets          []interface{}               `json:"assets"`
	Symbols         []FuturesSymbolExchangeInfo `json:"symbols"`
	Timezone        string                      `json:"timezone"`
}

// FuturesSymbolExchangeInfo represents futures symbol exchange info.
type FuturesSymbolExchangeInfo struct {
	Symbol                string              `json:"symbol"`
	Pair                  string              `json:"pair"`
	ContractType          FuturesContractType `json:"contractType"`
	DeliveryDate          int64               `json:"deliveryDate"`
	OnboardDate           int64               `json:"onboardDate"`
	Status                string              `json:"status"`
	MaintMarginPercent    string              `json:"maintMarginPercent"`
	RequiredMarginPercent string              `json:"requiredMarginPercent"`
	BaseAsset             string              `json:"baseAsset"`
	QuoteAsset            string              `json:"quoteAsset"`
	MarginAsset           string              `json:"marginAsset"`
	PricePrecision        int                 `json:"pricePrecision"`
	QuantityPrecision     int                 `json:"quantityPrecision"`
	BaseAssetPrecision    int                 `json:"baseAssetPrecision"`
	QuotePrecision        int                 `json:"quotePrecision"`
	UnderlyingType        string              `json:"underlyingType"`
	UnderlyingSubType     []string            `json:"underlyingSubType"`
	SettlePlan            int                 `json:"settlePlan"`
	TriggerProtect        string              `json:"triggerProtect"`
	Filters               []interface{}       `json:"filters"`
	OrderTypes            []string            `json:"OrderType"`
	TimeInForce           []string            `json:"timeInForce"`
	LiquidationFee        string              `json:"liquidationFee"`
	MarketTakeBound       string              `json:"marketTakeBound"`
}

// FuturesOrderBook represents futures order book.
type FuturesOrderBook struct {
	LastUpdateID int64          `json:"lastUpdateId"`
	E            int64          `json:"E"`
	T            int64          `json:"T"`
	Bids         []OrderBookRow `json:"bids"`
	Asks         []OrderBookRow `json:"asks"`
}

// RawFuturesTrade represents raw futures trade.
type RawFuturesTrade struct {
	ID           int64  `json:"id"`
	Price        string `json:"price"`
	Qty          string `json:"qty"`
	QuoteQty     string `json:"quoteQty"`
	Time         int64  `json:"time"`
	IsBuyerMaker bool   `json:"isBuyerMaker"`
}

// AggregateFuturesTrade represents aggregate futures trade.
type AggregateFuturesTrade struct {
	A int64  `json:"a"`
	P string `json:"p"`
	Q string `json:"q"`
	F int64  `json:"f"`
	L int64  `json:"l"`
	T int64  `json:"T"`
	M bool   `json:"m"`
}

// MarkPrice represents mark price.
type MarkPrice struct {
	Symbol               string `json:"symbol"`
	MarkPrice            string `json:"markPrice"`
	IndexPrice           string `json:"indexPrice"`
	EstimatedSettlePrice string `json:"estimatedSettlePrice"`
	LastFundingRate      string `json:"lastFundingRate"`
	InterestRate         string `json:"interestRate"`
	NextFundingTime      int64  `json:"nextFundingTime"`
	Time                 int64  `json:"time"`
}

// FundingRateHistory represents funding rate history.
type FundingRateHistory struct {
	Symbol      string `json:"symbol"`
	FundingRate string `json:"fundingRate"`
	FundingTime int64  `json:"fundingTime"`
	MarkPrice   string `json:"markPrice"`
}

// FuturesSymbolOrderBookTicker represents futures symbol order book ticker.
type FuturesSymbolOrderBookTicker struct {
	Symbol   string `json:"symbol"`
	BidPrice string `json:"bidPrice"`
	BidQty   string `json:"bidQty"`
	AskPrice string `json:"askPrice"`
	AskQty   string `json:"askQty"`
	Time     int64  `json:"time"`
}

// OpenInterest represents open interest.
type OpenInterest struct {
	OpenInterest string `json:"openInterest"`
	Symbol       string `json:"symbol"`
	Time         int64  `json:"time"`
}

// ModeChangeResult represents mode change result.
type ModeChangeResult struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

// PositionModeResponse represents position mode response.
type PositionModeResponse struct {
	DualSidePosition bool `json:"dualSidePosition"`
}

// MultiAssetModeResponse represents multi asset mode response.
type MultiAssetModeResponse struct {
	MultiAssetsMargin bool `json:"multiAssetsMargin"`
}

// NewOrderResult represents new order result.
type NewOrderResult struct {
	ClientOrderID           string                  `json:"clientOrderId"`
	CumQty                  string                  `json:"cumQty"`
	CumQuote                string                  `json:"cumQuote"`
	ExecutedQty             string                  `json:"executedQty"`
	OrderID                 int64                   `json:"orderId"`
	AvgPrice                string                  `json:"avgPrice"`
	OrigQty                 string                  `json:"origQty"`
	Price                   string                  `json:"price"`
	ReduceOnly              bool                    `json:"reduceOnly"`
	Side                    OrderSide               `json:"side"`
	PositionSide            PositionSide            `json:"positionSide"`
	Status                  OrderStatus             `json:"status"`
	StopPrice               string                  `json:"stopPrice"`
	ClosePosition           bool                    `json:"closePosition"`
	Symbol                  string                  `json:"symbol"`
	TimeInForce             OrderTimeInForce        `json:"timeInForce"`
	Type                    FuturesOrderType        `json:"type"`
	OrigType                FuturesOrderType        `json:"origType"`
	ActivatePrice           string                  `json:"activatePrice"`
	PriceRate               string                  `json:"priceRate"`
	UpdateTime              int64                   `json:"updateTime"`
	WorkingType             WorkingType             `json:"workingType"`
	PriceProtect            bool                    `json:"priceProtect"`
	SelfTradePreventionMode SelfTradePreventionMode `json:"selfTradePreventionMode"`
	PriceMatch              PriceMatchMode          `json:"priceMatch"`
}

// OrderResult represents order result.
type OrderResult struct {
	AvgPrice                string                  `json:"avgPrice"`
	ClientOrderID           string                  `json:"clientOrderId"`
	CumQuote                string                  `json:"cumQuote"`
	ExecutedQty             string                  `json:"executedQty"`
	OrderID                 int64                   `json:"orderId"`
	OrigQty                 string                  `json:"origQty"`
	OrigType                FuturesOrderType        `json:"origType"`
	Price                   string                  `json:"price"`
	ReduceOnly              bool                    `json:"reduceOnly"`
	Side                    OrderSide               `json:"side"`
	PositionSide            PositionSide            `json:"positionSide"`
	Status                  OrderStatus             `json:"status"`
	StopPrice               string                  `json:"stopPrice"`
	ClosePosition           bool                    `json:"closePosition"`
	Symbol                  string                  `json:"symbol"`
	Time                    int64                   `json:"time"`
	TimeInForce             OrderTimeInForce        `json:"timeInForce"`
	Type                    FuturesOrderType        `json:"type"`
	ActivatePrice           string                  `json:"activatePrice"`
	PriceRate               string                  `json:"priceRate"`
	UpdateTime              int64                   `json:"updateTime"`
	WorkingType             WorkingType             `json:"workingType"`
	PriceProtect            bool                    `json:"priceProtect"`
	SelfTradePreventionMode SelfTradePreventionMode `json:"selfTradePreventionMode"`
	PriceMatch              PriceMatchMode          `json:"priceMatch"`
	GoodTillDate            int64                   `json:"goodTillDate"`
}

// CancelFuturesOrderResult represents cancel futures order result.
type CancelFuturesOrderResult struct {
	ClientOrderID           string                  `json:"clientOrderId"`
	CumQty                  string                  `json:"cumQty"`
	CumQuote                string                  `json:"cumQuote"`
	ExecutedQty             string                  `json:"executedQty"`
	OrderID                 int64                   `json:"orderId"`
	OrigQty                 string                  `json:"origQty"`
	OrigType                FuturesOrderType        `json:"origType"`
	Price                   string                  `json:"price"`
	ReduceOnly              bool                    `json:"reduceOnly"`
	Side                    OrderSide               `json:"side"`
	PositionSide            PositionSide            `json:"positionSide"`
	Status                  OrderStatus             `json:"status"`
	StopPrice               string                  `json:"stopPrice"`
	ClosePosition           bool                    `json:"closePosition"`
	Symbol                  string                  `json:"symbol"`
	TimeInForce             OrderTimeInForce        `json:"timeInForce"`
	Type                    FuturesOrderType        `json:"type"`
	ActivatePrice           string                  `json:"activatePrice"`
	PriceRate               string                  `json:"priceRate"`
	UpdateTime              int64                   `json:"updateTime"`
	WorkingType             WorkingType             `json:"workingType"`
	PriceProtect            bool                    `json:"priceProtect"`
	SelfTradePreventionMode SelfTradePreventionMode `json:"selfTradePreventionMode"`
	PriceMatch              PriceMatchMode          `json:"priceMatch"`
}

// CancelAllOpenOrdersResult represents cancel all open orders result.
type CancelAllOpenOrdersResult struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

// FuturesAccountBalance represents futures account balance.
type FuturesAccountBalance struct {
	AccountAlias       string `json:"accountAlias"`
	Asset              string `json:"asset"`
	Balance            string `json:"balance"`
	CrossWalletBalance string `json:"crossWalletBalance"`
	CrossUnPnl         string `json:"crossUnPnl"`
	AvailableBalance   string `json:"availableBalance"`
	MaxWithdrawAmount  string `json:"maxWithdrawAmount"`
	MarginAvailable    bool   `json:"marginAvailable"`
	UpdateTime         int64  `json:"updateTime"`
}

// FuturesAccountInformation represents futures account information.
type FuturesAccountInformation struct {
	FeeTier                     string                   `json:"feeTier"`
	CanTrade                    bool                     `json:"canTrade"`
	CanDeposit                  bool                     `json:"canDeposit"`
	CanWithdraw                 bool                     `json:"canWithdraw"`
	UpdateTime                  string                   `json:"updateTime"`
	MultiAssetsMargin           bool                     `json:"multiAssetsMargin"`
	TotalInitialMargin          string                   `json:"totalInitialMargin"`
	TotalMaintMargin            string                   `json:"totalMaintMargin"`
	TotalWalletBalance          string                   `json:"totalWalletBalance"`
	TotalUnrealizedProfit       string                   `json:"totalUnrealizedProfit"`
	TotalMarginBalance          string                   `json:"totalMarginBalance"`
	TotalPositionInitialMargin  string                   `json:"totalPositionInitialMargin"`
	TotalOpenOrderInitialMargin string                   `json:"totalOpenOrderInitialMargin"`
	TotalCrossWalletBalance     string                   `json:"totalCrossWalletBalance"`
	TotalCrossUnPnl             string                   `json:"totalCrossUnPnl"`
	AvailableBalance            string                   `json:"availableBalance"`
	MaxWithdrawAmount           string                   `json:"maxWithdrawAmount"`
	Assets                      []FuturesAccountAsset    `json:"assets"`
	Positions                   []FuturesAccountPosition `json:"positions"`
}

// FuturesAccountAsset represents futures account asset.
type FuturesAccountAsset struct {
	Asset                  string `json:"asset"`
	WalletBalance          string `json:"walletBalance"`
	UnrealizedProfit       string `json:"unrealizedProfit"`
	MarginBalance          string `json:"marginBalance"`
	MaintMargin            string `json:"maintMargin"`
	InitialMargin          string `json:"initialMargin"`
	PositionInitialMargin  string `json:"positionInitialMargin"`
	OpenOrderInitialMargin string `json:"openOrderInitialMargin"`
	MaxWithdrawAmount      string `json:"maxWithdrawAmount"`
	CrossWalletBalance     string `json:"crossWalletBalance"`
	CrossUnPnl             string `json:"crossUnPnl"`
	AvailableBalance       string `json:"availableBalance"`
	MarginAvailable        bool   `json:"marginAvailable"`
	UpdateTime             int64  `json:"updateTime"`
}

// FuturesAccountPosition represents futures account position.
type FuturesAccountPosition struct {
	Symbol                 string       `json:"symbol"`
	InitialMargin          string       `json:"initialMargin"`
	MaintMargin            string       `json:"maintMargin"`
	UnrealizedProfit       string       `json:"unrealizedProfit"`
	PositionInitialMargin  string       `json:"positionInitialMargin"`
	OpenOrderInitialMargin string       `json:"openOrderInitialMargin"`
	Leverage               string       `json:"leverage"`
	Isolated               bool         `json:"isolated"`
	EntryPrice             string       `json:"entryPrice"`
	MaxNotional            string       `json:"maxNotional"`
	PositionSide           PositionSide `json:"positionSide"`
	PositionAmt            string       `json:"positionAmt"`
	Notional               string       `json:"notional"`
	IsolatedWallet         string       `json:"isolatedWallet"`
	UpdateTime             int64        `json:"updateTime"`
	BidNotional            string       `json:"bidNotional"`
	AskNotional            string       `json:"askNotional"`
}

// FuturesPosition represents futures position.
type FuturesPosition struct {
	EntryPrice       string       `json:"entryPrice"`
	MarginType       string       `json:"marginType"`
	IsAutoAddMargin  string       `json:"isAutoAddMargin"`
	IsolatedMargin   string       `json:"isolatedMargin"`
	Leverage         string       `json:"leverage"`
	LiquidationPrice string       `json:"liquidationPrice"`
	MarkPrice        string       `json:"markPrice"`
	MaxNotionalValue string       `json:"maxNotionalValue"`
	PositionAmt      string       `json:"positionAmt"`
	Notional         string       `json:"notional"`
	IsolatedWallet   string       `json:"isolatedWallet"`
	Symbol           string       `json:"symbol"`
	UnRealizedProfit string       `json:"unRealizedProfit"`
	PositionSide     PositionSide `json:"positionSide"`
	UpdateTime       int64        `json:"updateTime"`
}

// FuturesPositionTrade represents futures position trade.
type FuturesPositionTrade struct {
	Buyer           bool         `json:"buyer"`
	Commission      string       `json:"commission"`
	CommissionAsset string       `json:"commissionAsset"`
	ID              int64        `json:"id"`
	Maker           bool         `json:"maker"`
	OrderID         int64        `json:"orderId"`
	Price           string       `json:"price"`
	Qty             string       `json:"qty"`
	QuoteQty        string       `json:"quoteQty"`
	RealizedPnl     string       `json:"realizedPnl"`
	Side            OrderSide    `json:"side"`
	PositionSide    PositionSide `json:"positionSide"`
	Symbol          string       `json:"symbol"`
	Time            int64        `json:"time"`
}

// IncomeHistory represents income history.
type IncomeHistory struct {
	Symbol     string     `json:"symbol,omitempty"`
	IncomeType IncomeType `json:"incomeType"`
	Income     string     `json:"income"`
	Asset      string     `json:"asset"`
	Time       int64      `json:"time"`
	Info       string     `json:"info"`
	TranID     int64      `json:"tranId"`
	TradeID    string     `json:"tradeId"`
}

// SymbolLeverageBracketsResult represents symbol leverage brackets result.
type SymbolLeverageBracketsResult struct {
	Symbol   string                  `json:"symbol"`
	Brackets []SymbolLeverageBracket `json:"brackets"`
}

// SymbolLeverageBracket represents symbol leverage bracket.
type SymbolLeverageBracket struct {
	Bracket          int     `json:"bracket"`
	InitialLeverage  int     `json:"initialLeverage"`
	NotionalCap      float64 `json:"notionalCap"`
	NotionalFloor    float64 `json:"notionalFloor"`
	MaintMarginRatio float64 `json:"maintMarginRatio"`
	Cum              float64 `json:"cum"`
}

// UserCommissionRate represents user commission rate.
type UserCommissionRate struct {
	Symbol              string `json:"symbol"`
	MakerCommissionRate string `json:"makerCommissionRate"`
	TakerCommissionRate string `json:"takerCommissionRate"`
}

// ============================================================================//
// Algo Order Types (Futures Algo Service - /fapi/v1/algoOrder)
// ============================================================================//

// AlgoOrderType represents algo order type (always CONDITIONAL for futures).
type AlgoOrderType string

const AlgoOrderTypeConditional AlgoOrderType = "CONDITIONAL"

// AlgoConditionalOrderType represents the specific algo order subtype.
type AlgoConditionalOrderType string

const (
	AlgoOrderStopMarket         AlgoConditionalOrderType = "STOP_MARKET"
	AlgoOrderTakeProfitMarket   AlgoConditionalOrderType = "TAKE_PROFIT_MARKET"
	AlgoOrderStop               AlgoConditionalOrderType = "STOP"
	AlgoOrderTakeProfit         AlgoConditionalOrderType = "TAKE_PROFIT"
	AlgoOrderTrailingStopMarket AlgoConditionalOrderType = "TRAILING_STOP_MARKET"
)

// AlgoOrderStatus represents algo order status.
type AlgoOrderStatus string

const (
	AlgoStatusNew        AlgoOrderStatus = "NEW"
	AlgoStatusCanceled   AlgoOrderStatus = "CANCELED"
	AlgoStatusTriggering AlgoOrderStatus = "TRIGGERING"
	AlgoStatusTriggered  AlgoOrderStatus = "TRIGGERED"
	AlgoStatusFinished   AlgoOrderStatus = "FINISHED"
	AlgoStatusRejected   AlgoOrderStatus = "REJECTED"
	AlgoStatusExpired    AlgoOrderStatus = "EXPIRED"
)

// NewAlgoOrderParams represents parameters for POST /fapi/v1/algoOrder.
type NewAlgoOrderParams struct {
	AlgoType        AlgoOrderType            `json:"algoType"`
	Symbol          string                   `json:"symbol"`
	Side            OrderSide                `json:"side"`
	PositionSide    PositionSide             `json:"positionSide,omitempty"`
	Type            AlgoConditionalOrderType `json:"type"`
	TimeInForce     OrderTimeInForce         `json:"timeInForce,omitempty"`
	Quantity        string                   `json:"quantity,omitempty"`
	Price           string                   `json:"price,omitempty"`
	TriggerPrice    string                   `json:"triggerPrice,omitempty"`
	WorkingType     WorkingType              `json:"workingType,omitempty"`
	ClosePosition   string                   `json:"closePosition,omitempty"`
	PriceProtect    string                   `json:"priceProtect,omitempty"`
	ReduceOnly      string                   `json:"reduceOnly,omitempty"`
	ActivationPrice string                   `json:"activationPrice,omitempty"`
	CallbackRate    string                   `json:"callbackRate,omitempty"`
	ClientAlgoID    string                   `json:"clientAlgoId,omitempty"`
}

// AlgoOrderResponse represents response from POST /fapi/v1/algoOrder and GET /fapi/v1/openAlgoOrders.
type AlgoOrderResponse struct {
	AlgoID        int64                    `json:"algoId"`
	ClientAlgoID  string                   `json:"clientAlgoId"`
	AlgoType      AlgoOrderType            `json:"algoType"`
	OrderType     AlgoConditionalOrderType `json:"orderType"`
	Symbol        string                   `json:"symbol"`
	Side          OrderSide                `json:"side"`
	PositionSide  PositionSide             `json:"positionSide"`
	TimeInForce   OrderTimeInForce         `json:"timeInForce"`
	Quantity      string                   `json:"quantity"`
	AlgoStatus    AlgoOrderStatus          `json:"algoStatus"`
	TriggerPrice  string                   `json:"triggerPrice"`
	Price         string                   `json:"price"`
	ReduceOnly    bool                     `json:"reduceOnly"`
	ActivatePrice string                   `json:"activatePrice"`
	CallbackRate  string                   `json:"callbackRate"`
	WorkingType   WorkingType              `json:"workingType"`
	CreateTime    int64                    `json:"createTime"`
	UpdateTime    int64                    `json:"updateTime"`
	TriggerTime   int64                    `json:"triggerTime"`
}

// CancelAlgoOrderParams represents parameters for DELETE /fapi/v1/algoOrder.
type CancelAlgoOrderParams struct {
	AlgoID       int64  `json:"algoId,omitempty"`
	ClientAlgoID string `json:"clientAlgoId,omitempty"`
}

// CancelAlgoOrderResponse represents response from DELETE /fapi/v1/algoOrder.
type CancelAlgoOrderResponse struct {
	AlgoID       int64  `json:"algoId"`
	ClientAlgoID string `json:"clientAlgoId"`
	Code         string `json:"code"`
	Msg          string `json:"msg"`
}

// QueryAlgoOrderParams represents parameters for GET /fapi/v1/algoOrder.
type QueryAlgoOrderParams struct {
	AlgoID       int64  `json:"algoId,omitempty"`
	ClientAlgoID string `json:"clientAlgoId,omitempty"`
}

// QueryAlgoOrderResponse represents response from GET /fapi/v1/algoOrder.
type QueryAlgoOrderResponse struct {
	AlgoOrderResponse
	ActualOrderID string `json:"actualOrderId"`
	ActualPrice   string `json:"actualPrice"`
}

// QueryOpenAlgoOrdersParams represents parameters for GET /fapi/v1/openAlgoOrders.
type QueryOpenAlgoOrdersParams struct {
	AlgoType AlgoOrderType `json:"algoType,omitempty"`
	Symbol   string        `json:"symbol,omitempty"`
	AlgoID   int64         `json:"algoId,omitempty"`
}

// ChangeStats24hr represents 24hr change statistics.
type ChangeStats24hr struct {
	Symbol             string `json:"symbol"`
	PriceChange        string `json:"priceChange"`
	PriceChangePercent string `json:"priceChangePercent"`
	WeightedAvgPrice   string `json:"weightedAvgPrice"`
	LastPrice          string `json:"lastPrice"`
	LastQty            string `json:"lastQty"`
	OpenPrice          string `json:"openPrice"`
	HighPrice          string `json:"highPrice"`
	LowPrice           string `json:"lowPrice"`
	Volume             string `json:"volume"`
	QuoteVolume        string `json:"quoteVolume"`
	OpenTime           int64  `json:"openTime"`
	CloseTime          int64  `json:"closeTime"`
	FirstID            int64  `json:"firstId"`
	LastID             int64  `json:"lastId"`
	Count              int64  `json:"count"`
}
