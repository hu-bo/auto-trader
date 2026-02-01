package core

const (
	// General
	ErrorInvalidParams      = "INVALID_PARAMS"
	ErrorSymbolNotAvailable = "SYMBOL_NOT_AVAILABLE"
	ErrorInvalidTradeType   = "INVALID_TRADE_TYPE"

	// Balance & Position
	ErrorInsufficientBalance  = "INSUFFICIENT_BALANCE"
	ErrorInsufficientPosition = "INSUFFICIENT_POSITION"

	// Quantity
	ErrorQuantityTooSmall = "QUANTITY_TOO_SMALL"
	ErrorQuantityTooLarge = "QUANTITY_TOO_LARGE"

	// Orders
	ErrorPlaceOrder           = "PLACE_ORDER_ERROR"
	ErrorCancelOrder          = "CANCEL_ORDER_ERROR"
	ErrorOrderNotFound        = "ORDER_NOT_FOUND"
	ErrorInvalidOrderResponse = "INVALID_ORDER_RESPONSE"
	ErrorBatchPlaceOrder      = "BATCH_PLACE_ORDER_ERROR"

	// Strategy Orders
	ErrorPlaceStrategyOrder       = "PLACE_STRATEGY_ORDER_ERROR"
	ErrorCancelStrategyOrder      = "CANCEL_STRATEGY_ORDER_ERROR"
	ErrorStrategyOrderNotFound    = "STRATEGY_ORDER_NOT_FOUND"
	ErrorGetStrategyOrder         = "GET_STRATEGY_ORDER_ERROR"
	ErrorGetOpenStrategyOrders    = "GET_OPEN_STRATEGY_ORDERS_ERROR"
	ErrorInvalidStrategyOrderType = "INVALID_STRATEGY_ORDER_TYPE"
	ErrorTriggerPriceInvalid      = "TRIGGER_PRICE_INVALID"

	// Market Data
	ErrorSymbolNotFound    = "SYMBOL_NOT_FOUND"
	ErrorPriceNotFound     = "PRICE_NOT_FOUND"
	ErrorTickerNotFound    = "TICKER_NOT_FOUND"
	ErrorOrderBookNotFound = "ORDERBOOK_NOT_FOUND"
	ErrorMarkPriceNotFound = "MARK_PRICE_NOT_FOUND"

	// WebSocket
	ErrorWsConnection     = "WS_CONNECTION_ERROR"
	ErrorWsAuthentication = "WS_AUTHENTICATION_ERROR"
	ErrorWsSubscription   = "WS_SUBSCRIPTION_ERROR"
)
