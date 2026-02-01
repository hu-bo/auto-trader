// Package websockets provides websocket utilities for Binance API.
package websockets

import (
	"github.com/pkg/binance-api/types/websockets"
)

// WsURLMap contains WebSocket URLs for different markets.
var WsURLMap = map[websockets.WsKey]string{
	websockets.WsKeyMain:                    "wss://stream.binance.com:9443",
	websockets.WsKeyMain2:                   "wss://stream.binance.com:443",
	websockets.WsKeyMain3:                   "wss://ws-api.binance.com:9443",
	websockets.WsKeyMain4:                   "wss://ws-api.binance.com:443",
	websockets.WsKeyMainTestnet:             "wss://testnet.binance.vision",
	websockets.WsKeyUSDM:                    "wss://fstream.binance.com",
	websockets.WsKeyUSDMTestnet:             "wss://stream.binancefuture.com",
	websockets.WsKeyCOINM:                   "wss://dstream.binance.com",
	websockets.WsKeyCOINMTestnet:            "wss://dstream.binancefuture.com",
	websockets.WsKeyEOptions:                "wss://vstream.binance.com",
	websockets.WsKeyEOptionsTestnet:         "wss://testnetws.binanceops.com",
	websockets.WsKeyMainWSAPI:               "wss://ws-api.binance.com:9443/ws-api/v3",
	websockets.WsKeyMainWSAPITestnet:        "wss://testnet.binance.vision/ws-api/v3",
	websockets.WsKeyUSDMWSAPI:               "wss://ws-fapi.binance.com/ws-fapi/v1",
	websockets.WsKeyUSDMWSAPITestnet:        "wss://testnet.binancefuture.com/ws-fapi/v1",
	websockets.WsKeyCOINMWSAPI:              "wss://ws-dapi.binance.com/ws-dapi/v1",
	websockets.WsKeyCOINMWSAPITestnet:       "wss://testnet.binancefuture.com/ws-dapi/v1",
	websockets.WsKeyPortfolioMarginUserData: "wss://fstream.binance.com",
}

// GetWsURL returns the WebSocket URL for a given key.
func GetWsURL(key websockets.WsKey, testnet bool) string {
	if testnet {
		switch key {
		case websockets.WsKeyMain:
			return WsURLMap[websockets.WsKeyMainTestnet]
		case websockets.WsKeyUSDM:
			return WsURLMap[websockets.WsKeyUSDMTestnet]
		case websockets.WsKeyCOINM:
			return WsURLMap[websockets.WsKeyCOINMTestnet]
		case websockets.WsKeyEOptions:
			return WsURLMap[websockets.WsKeyEOptionsTestnet]
		case websockets.WsKeyMainWSAPI:
			return WsURLMap[websockets.WsKeyMainWSAPITestnet]
		case websockets.WsKeyUSDMWSAPI:
			return WsURLMap[websockets.WsKeyUSDMWSAPITestnet]
		case websockets.WsKeyCOINMWSAPI:
			return WsURLMap[websockets.WsKeyCOINMWSAPITestnet]
		}
	}
	return WsURLMap[key]
}

// GetWsURLSuffix returns the WebSocket URL suffix.
func GetWsURLSuffix(key websockets.WsKey, connectionType string) string {
	switch key {
	case websockets.WsKeyMainWSAPI, websockets.WsKeyMainWSAPITestnet,
		websockets.WsKeyUSDMWSAPI, websockets.WsKeyUSDMWSAPITestnet,
		websockets.WsKeyCOINMWSAPI, websockets.WsKeyCOINMWSAPITestnet:
		return ""
	}

	if connectionType == "userData" {
		return "/ws"
	}
	return "/stream"
}

// IsWSAPIKey checks if a key is a WS API key.
func IsWSAPIKey(key websockets.WsKey) bool {
	switch key {
	case websockets.WsKeyMainWSAPI, websockets.WsKeyMainWSAPITestnet,
		websockets.WsKeyUSDMWSAPI, websockets.WsKeyUSDMWSAPITestnet,
		websockets.WsKeyCOINMWSAPI, websockets.WsKeyCOINMWSAPITestnet:
		return true
	}
	return false
}

// GetMarketFromWsKey returns the market from a websocket key.
func GetMarketFromWsKey(key websockets.WsKey) websockets.WsMarket {
	switch key {
	case websockets.WsKeyMain, websockets.WsKeyMain2, websockets.WsKeyMain3, websockets.WsKeyMain4:
		return websockets.WsMarketSpot
	case websockets.WsKeyMainTestnet:
		return websockets.WsMarketSpotTestnet
	case websockets.WsKeyUSDM, websockets.WsKeyUSDMWSAPI:
		return websockets.WsMarketUSDM
	case websockets.WsKeyUSDMTestnet, websockets.WsKeyUSDMWSAPITestnet:
		return websockets.WsMarketUSDMTestnet
	case websockets.WsKeyCOINM, websockets.WsKeyCOINMWSAPI:
		return websockets.WsMarketCOINM
	case websockets.WsKeyCOINMTestnet, websockets.WsKeyCOINMWSAPITestnet:
		return websockets.WsMarketCOINMTestnet
	case websockets.WsKeyEOptions:
		return websockets.WsMarketOptions
	case websockets.WsKeyEOptionsTestnet:
		return websockets.WsMarketOptionsTestnet
	case websockets.WsKeyPortfolioMarginUserData:
		return websockets.WsMarketPortfolio
	default:
		return websockets.WsMarketSpot
	}
}

// Private stream topics
var privateTopics = []string{
	"outboundAccountPosition",
	"outboundAccountInfo",
	"balanceUpdate",
	"executionReport",
	"ORDER_TRADE_UPDATE",
	"ACCOUNT_UPDATE",
	"ACCOUNT_CONFIG_UPDATE",
	"MARGIN_CALL",
	"listenKeyExpired",
}

// IsPrivateTopic checks if a topic is private.
func IsPrivateTopic(topic string) bool {
	for _, t := range privateTopics {
		if t == topic {
			return true
		}
	}
	return false
}
