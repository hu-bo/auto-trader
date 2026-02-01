package websockets

import "github.com/pkg/binance-api/types"

// WsAggTradeEvent represents aggregate trade event.
type WsAggTradeEvent struct {
	Event        string `json:"e"` // "aggTrade"
	Time         int64  `json:"E"` // Event time
	Symbol       string `json:"s"` // Symbol
	AggTradeID   int64  `json:"a"` // Aggregate trade ID
	Price        string `json:"p"` // Price
	Quantity     string `json:"q"` // Quantity
	FirstTradeID int64  `json:"f"` // First trade ID
	LastTradeID  int64  `json:"l"` // Last trade ID
	TradeTime    int64  `json:"T"` // Trade time
	IsBuyerMaker bool   `json:"m"` // Is the buyer the market maker?
	Ignore       bool   `json:"M"` // Ignore
}

// WsTradeEvent represents trade event.
type WsTradeEvent struct {
	Event         string `json:"e"` // "trade"
	Time          int64  `json:"E"` // Event time
	Symbol        string `json:"s"` // Symbol
	TradeID       int64  `json:"t"` // Trade ID
	Price         string `json:"p"` // Price
	Quantity      string `json:"q"` // Quantity
	BuyerOrderID  int64  `json:"b"` // Buyer order ID
	SellerOrderID int64  `json:"a"` // Seller order ID
	TradeTime     int64  `json:"T"` // Trade time
	IsBuyerMaker  bool   `json:"m"` // Is the buyer the market maker?
	Ignore        bool   `json:"M"` // Ignore
}

// WsKlineEvent represents kline event.
type WsKlineEvent struct {
	Event  string  `json:"e"` // "kline"
	Time   int64   `json:"E"` // Event time
	Symbol string  `json:"s"` // Symbol
	Kline  WsKline `json:"k"` // Kline data
}

// WsKline represents websocket kline data.
type WsKline struct {
	StartTime           int64  `json:"t"` // Kline start time
	CloseTime           int64  `json:"T"` // Kline close time
	Symbol              string `json:"s"` // Symbol
	Interval            string `json:"i"` // Interval
	FirstTradeID        int64  `json:"f"` // First trade ID
	LastTradeID         int64  `json:"L"` // Last trade ID
	Open                string `json:"o"` // Open price
	Close               string `json:"c"` // Close price
	High                string `json:"h"` // High price
	Low                 string `json:"l"` // Low price
	Volume              string `json:"v"` // Base asset volume
	NumberOfTrades      int64  `json:"n"` // Number of trades
	IsClosed            bool   `json:"x"` // Is this kline closed?
	QuoteAssetVolume    string `json:"q"` // Quote asset volume
	TakerBuyBaseVolume  string `json:"V"` // Taker buy base asset volume
	TakerBuyQuoteVolume string `json:"Q"` // Taker buy quote asset volume
	Ignore              string `json:"B"` // Ignore
}

// WsMiniTickerEvent represents 24hr mini ticker event.
type WsMiniTickerEvent struct {
	Event       string `json:"e"` // "24hrMiniTicker"
	Time        int64  `json:"E"` // Event time
	Symbol      string `json:"s"` // Symbol
	Close       string `json:"c"` // Close price
	Open        string `json:"o"` // Open price
	High        string `json:"h"` // High price
	Low         string `json:"l"` // Low price
	Volume      string `json:"v"` // Total traded base asset volume
	QuoteVolume string `json:"q"` // Total traded quote asset volume
}

// WsTickerEvent represents 24hr ticker event.
type WsTickerEvent struct {
	Event              string `json:"e"` // "24hrTicker"
	Time               int64  `json:"E"` // Event time
	Symbol             string `json:"s"` // Symbol
	PriceChange        string `json:"p"` // Price change
	PriceChangePercent string `json:"P"` // Price change percent
	WeightedAvgPrice   string `json:"w"` // Weighted average price
	PrevClosePrice     string `json:"x"` // Previous day's close price
	LastPrice          string `json:"c"` // Last price
	LastQty            string `json:"Q"` // Last quantity
	BidPrice           string `json:"b"` // Best bid price
	BidQty             string `json:"B"` // Best bid quantity
	AskPrice           string `json:"a"` // Best ask price
	AskQty             string `json:"A"` // Best ask quantity
	OpenPrice          string `json:"o"` // Open price
	HighPrice          string `json:"h"` // High price
	LowPrice           string `json:"l"` // Low price
	Volume             string `json:"v"` // Total traded base asset volume
	QuoteVolume        string `json:"q"` // Total traded quote asset volume
	OpenTime           int64  `json:"O"` // Statistics open time
	CloseTime          int64  `json:"C"` // Statistics close time
	FirstTradeID       int64  `json:"F"` // First trade ID
	LastTradeID        int64  `json:"L"` // Last trade Id
	Count              int64  `json:"n"` // Total number of trades
}

// WsBookTickerEvent represents book ticker event.
type WsBookTickerEvent struct {
	Event     string `json:"e,omitempty"` // "bookTicker" (only in futures)
	UpdateID  int64  `json:"u"`           // order book updateId
	Symbol    string `json:"s"`           // Symbol
	BidPrice  string `json:"b"`           // Best bid price
	BidQty    string `json:"B"`           // Best bid qty
	AskPrice  string `json:"a"`           // Best ask price
	AskQty    string `json:"A"`           // Best ask qty
	Time      int64  `json:"T,omitempty"` // Transaction time (futures only)
	EventTime int64  `json:"E,omitempty"` // Event time (futures only)
}

// WsDepthEvent represents depth update event.
type WsDepthEvent struct {
	Event         string               `json:"e"` // "depthUpdate"
	Time          int64                `json:"E"` // Event time
	Symbol        string               `json:"s"` // Symbol
	FirstUpdateID int64                `json:"U"` // First update ID in event
	FinalUpdateID int64                `json:"u"` // Final update ID in event
	Bids          []types.OrderBookRow `json:"b"` // Bids to be updated
	Asks          []types.OrderBookRow `json:"a"` // Asks to be updated
}

// WsPartialDepthEvent represents partial depth event.
type WsPartialDepthEvent struct {
	LastUpdateID int64                `json:"lastUpdateId"`
	Bids         []types.OrderBookRow `json:"bids"`
	Asks         []types.OrderBookRow `json:"asks"`
}

// WsMarkPriceEvent represents mark price event (futures).
type WsMarkPriceEvent struct {
	Event           string `json:"e"` // "markPriceUpdate"
	Time            int64  `json:"E"` // Event time
	Symbol          string `json:"s"` // Symbol
	MarkPrice       string `json:"p"` // Mark price
	IndexPrice      string `json:"i"` // Index price
	EstSettlePrice  string `json:"P"` // Estimated Settle Price
	FundingRate     string `json:"r"` // Funding rate
	NextFundingTime int64  `json:"T"` // Next funding time
}

// WsForceOrderEvent represents liquidation order event (futures).
type WsForceOrderEvent struct {
	Event string             `json:"e"` // "forceOrder"
	Time  int64              `json:"E"` // Event time
	Order WsLiquidationOrder `json:"o"` // Order data
}

// WsLiquidationOrder represents liquidation order data.
type WsLiquidationOrder struct {
	Symbol         string `json:"s"`  // Symbol
	Side           string `json:"S"`  // Side
	OrderType      string `json:"o"`  // Order Type
	TimeInForce    string `json:"f"`  // Time in Force
	OrigQty        string `json:"q"`  // Original Quantity
	Price          string `json:"p"`  // Price
	AvgPrice       string `json:"ap"` // Average Price
	Status         string `json:"X"`  // Order Status
	LastFilledQty  string `json:"l"`  // Order Last Filled Quantity
	AccumulatedQty string `json:"z"`  // Order Filled Accumulated Quantity
	TradeTime      int64  `json:"T"`  // Order Trade Time
}

// User Data Stream Events

// WsAccountUpdateEvent represents account update event.
type WsAccountUpdateEvent struct {
	Event             string             `json:"e"` // "outboundAccountPosition"
	Time              int64              `json:"E"` // Event time
	LastAccountUpdate int64              `json:"u"` // Time of last account update
	Balances          []WsAccountBalance `json:"B"` // Balances
}

// WsAccountBalance represents account balance in websocket.
type WsAccountBalance struct {
	Asset  string `json:"a"` // Asset
	Free   string `json:"f"` // Free amount
	Locked string `json:"l"` // Locked amount
}

// WsOrderUpdateEvent represents order update event.
type WsOrderUpdateEvent struct {
	Event                   string `json:"e"` // "executionReport"
	Time                    int64  `json:"E"` // Event time
	Symbol                  string `json:"s"` // Symbol
	ClientOrderID           string `json:"c"` // Client order ID
	Side                    string `json:"S"` // Side
	OrderType               string `json:"o"` // Order type
	TimeInForce             string `json:"f"` // Time in force
	Quantity                string `json:"q"` // Order quantity
	Price                   string `json:"p"` // Order price
	StopPrice               string `json:"P"` // Stop price
	IcebergQty              string `json:"F"` // Iceberg quantity
	OrderListID             int64  `json:"g"` // OrderListId
	OrigClientOrderID       string `json:"C"` // Original client order ID
	ExecutionType           string `json:"x"` // Current execution type
	Status                  string `json:"X"` // Current order status
	RejectReason            string `json:"r"` // Order reject reason
	OrderID                 int64  `json:"i"` // Order ID
	LastExecutedQty         string `json:"l"` // Last executed quantity
	CumulativeFilledQty     string `json:"z"` // Cumulative filled quantity
	LastExecutedPrice       string `json:"L"` // Last executed price
	CommissionAmount        string `json:"n"` // Commission amount
	CommissionAsset         string `json:"N"` // Commission asset
	TransactionTime         int64  `json:"T"` // Transaction time
	TradeID                 int64  `json:"t"` // Trade ID
	Ignore1                 int64  `json:"I"` // Ignore
	IsOnBook                bool   `json:"w"` // Is the order on the book?
	IsMaker                 bool   `json:"m"` // Is this trade the maker side?
	Ignore2                 bool   `json:"M"` // Ignore
	OrderCreationTime       int64  `json:"O"` // Order creation time
	CumulativeQuoteQty      string `json:"Z"` // Cumulative quote asset transacted quantity
	LastQuoteQty            string `json:"Y"` // Last quote asset transacted quantity
	QuoteOrderQty           string `json:"Q"` // Quote Order Qty
	WorkingTime             int64  `json:"W"` // Working Time
	SelfTradePreventionMode string `json:"V"` // SelfTradePreventionMode
}

// Futures User Data Stream Events

// WsFuturesAccountUpdateEvent represents futures account update event.
type WsFuturesAccountUpdateEvent struct {
	Event           string                 `json:"e"` // "ACCOUNT_UPDATE"
	Time            int64                  `json:"E"` // Event time
	TransactionTime int64                  `json:"T"` // Transaction time
	AccountUpdate   WsFuturesAccountUpdate `json:"a"` // Account update data
}

// WsFuturesAccountUpdate represents futures account update data.
type WsFuturesAccountUpdate struct {
	EventReasonType string                    `json:"m"` // Event reason type
	Balances        []WsFuturesBalance        `json:"B"` // Balances
	Positions       []WsFuturesPositionUpdate `json:"P"` // Positions
}

// WsFuturesBalance represents futures balance.
type WsFuturesBalance struct {
	Asset              string `json:"a"`  // Asset
	WalletBalance      string `json:"wb"` // Wallet Balance
	CrossWalletBalance string `json:"cw"` // Cross Wallet Balance
	BalanceChange      string `json:"bc"` // Balance Change except PnL and Commission
}

// WsFuturesPositionUpdate represents futures position update.
type WsFuturesPositionUpdate struct {
	Symbol              string `json:"s"`   // Symbol
	PositionAmount      string `json:"pa"`  // Position Amount
	EntryPrice          string `json:"ep"`  // Entry Price
	BreakEvenPrice      string `json:"bep"` // (Breakeven Price)
	AccumulatedRealized string `json:"cr"`  // (Pre-fee) Accumulated Realized
	UnrealizedPnL       string `json:"up"`  // Unrealized PnL
	MarginType          string `json:"mt"`  // Margin Type
	IsolatedWallet      string `json:"iw"`  // Isolated Wallet (if isolated position)
	PositionSide        string `json:"ps"`  // Position Side
}

// WsFuturesOrderUpdateEvent represents futures order update event.
type WsFuturesOrderUpdateEvent struct {
	Event           string               `json:"e"` // "ORDER_TRADE_UPDATE"
	Time            int64                `json:"E"` // Event time
	TransactionTime int64                `json:"T"` // Transaction time
	Order           WsFuturesOrderUpdate `json:"o"` // Order data
}

// WsFuturesOrderUpdate represents futures order update data.
type WsFuturesOrderUpdate struct {
	Symbol               string `json:"s"`   // Symbol
	ClientOrderID        string `json:"c"`   // Client Order Id
	Side                 string `json:"S"`   // Side
	OrderType            string `json:"o"`   // Order Type
	TimeInForce          string `json:"f"`   // Time in Force
	OrigQty              string `json:"q"`   // Original Quantity
	OrigPrice            string `json:"p"`   // Original Price
	AvgPrice             string `json:"ap"`  // Average Price
	StopPrice            string `json:"sp"`  // Stop Price
	ExecutionType        string `json:"x"`   // Execution Type
	Status               string `json:"X"`   // Order Status
	OrderID              int64  `json:"i"`   // Order Id
	LastFilledQty        string `json:"l"`   // Order Last Filled Quantity
	FilledAccumulatedQty string `json:"z"`   // Order Filled Accumulated Quantity
	LastFilledPrice      string `json:"L"`   // Last Filled Price
	CommissionAsset      string `json:"N"`   // Commission Asset
	Commission           string `json:"n"`   // Commission
	TradeTime            int64  `json:"T"`   // Order Trade Time
	TradeID              int64  `json:"t"`   // Trade Id
	BidsNotional         string `json:"b"`   // Bids Notional
	AsksNotional         string `json:"a"`   // Asks Notional
	IsMaker              bool   `json:"m"`   // Is this trade the maker side?
	IsReduceOnly         bool   `json:"R"`   // Is this reduce only
	WorkingType          string `json:"wt"`  // Stop Price Working Type
	OrigOrderType        string `json:"ot"`  // Original Order Type
	PositionSide         string `json:"ps"`  // Position Side
	IsCloseAll           bool   `json:"cp"`  // If Close-All
	ActivationPrice      string `json:"AP"`  // Activation Price
	CallbackRate         string `json:"cr"`  // Callback Rate
	PriceProtect         bool   `json:"pP"`  // If price protection is turned on
	RealizedProfit       string `json:"rp"`  // Realized Profit of the trade
	STPMode              string `json:"V"`   // STP mode
	PriceMatch           string `json:"pm"`  // Price match mode
	GTD                  int64  `json:"gtd"` // TIF GTD order auto cancel time
}

// WsListenKeyExpiredEvent represents listen key expired event.
type WsListenKeyExpiredEvent struct {
	Event string `json:"e"` // "listenKeyExpired"
	Time  int64  `json:"E"` // Event time
}
