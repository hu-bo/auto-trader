// Package websockets provides websocket type definitions for Binance API.
package websockets

// WsMarket represents websocket market type.
type WsMarket string

const (
	WsMarketSpot           WsMarket = "spot"
	WsMarketSpotTestnet    WsMarket = "spotTestnet"
	WsMarketCrossMargin    WsMarket = "crossMargin"
	WsMarketIsolatedMargin WsMarket = "isolatedMargin"
	WsMarketUSDM           WsMarket = "usdm"
	WsMarketUSDMTestnet    WsMarket = "usdmTestnet"
	WsMarketCOINM          WsMarket = "coinm"
	WsMarketCOINMTestnet   WsMarket = "coinmTestnet"
	WsMarketOptions        WsMarket = "options"
	WsMarketOptionsTestnet WsMarket = "optionsTestnet"
	WsMarketPortfolio      WsMarket = "portfoliom"
	WsMarketRiskDataMargin WsMarket = "riskDataMargin"
)

// WsKey represents websocket key type.
type WsKey string

const (
	WsKeyMain                    WsKey = "main"
	WsKeyMain2                   WsKey = "main2"
	WsKeyMain3                   WsKey = "main3"
	WsKeyMain4                   WsKey = "main4"
	WsKeyMainTestnet             WsKey = "mainTestnet"
	WsKeyUSDM                    WsKey = "usdm"
	WsKeyUSDMTestnet             WsKey = "usdmTestnet"
	WsKeyCOINM                   WsKey = "coinm"
	WsKeyCOINMTestnet            WsKey = "coinmTestnet"
	WsKeyEOptions                WsKey = "eoptions"
	WsKeyEOptionsTestnet         WsKey = "eoptionsTestnet"
	WsKeyMainWSAPI               WsKey = "mainWSAPI"
	WsKeyMainWSAPITestnet        WsKey = "mainWSAPITestnet"
	WsKeyUSDMWSAPI               WsKey = "usdmWSAPI"
	WsKeyUSDMWSAPITestnet        WsKey = "usdmWSAPITestnet"
	WsKeyCOINMWSAPI              WsKey = "coinmWSAPI"
	WsKeyCOINMWSAPITestnet       WsKey = "coinmWSAPITestnet"
	WsKeyPortfolioMarginUserData WsKey = "portfolioMarginUserData"
)

// WsConnectionState represents websocket connection state.
type WsConnectionState int

const (
	WsStateInitial WsConnectionState = iota
	WsStateConnecting
	WsStateConnected
	WsStateAuthenticated
	WsStateReconnecting
	WsStateClosing
	WsStateClosed
)

// WsClientConfig represents websocket client configurable options.
type WsClientConfig struct {
	APIKey                string
	APISecret             string
	Testnet               bool
	BeautifyWarnIfMissing bool
	DisableHeartbeat      bool
	PingInterval          int // in milliseconds
	PongTimeout           int // in milliseconds
	ReconnectTimeout      int // in milliseconds
	RecvWindow            int
	// SocksProxy is an optional SOCKS5 proxy URL for WebSocket connections
	// (e.g. "socks5://127.0.0.1:7890").
	SocksProxy string
}

// WsTopicRequest represents websocket topic request.
type WsTopicRequest struct {
	Topic  string
	Params map[string]interface{}
}

// WsMessage represents a websocket message.
type WsMessage struct {
	ID     int64       `json:"id,omitempty"`
	Method string      `json:"method,omitempty"`
	Params interface{} `json:"params,omitempty"`
}

// WsResponse represents a websocket response.
type WsResponse struct {
	ID     int64       `json:"id,omitempty"`
	Result interface{} `json:"result,omitempty"`
	Error  *WsError    `json:"error,omitempty"`
}

// WsError represents a websocket error.
type WsError struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
}

// WsStreamMessage represents a websocket stream message.
type WsStreamMessage struct {
	Stream string      `json:"stream"`
	Data   interface{} `json:"data"`
}

// WsEventHandler is a function that handles websocket events.
type WsEventHandler func(event interface{})

// WsErrorHandler is a function that handles websocket errors.
type WsErrorHandler func(err error)
