package binance

import "exchange-sync/pkg/logger"

var logBinance = logger.Module("binance")

const (
	SpotWSEndpoint    = "wss://stream.binance.com:9443/stream"
	FuturesWSEndpoint = "wss://fstream.binance.com/stream"
	SpotRESTEndpoint  = "https://api.binance.com"
	FuturesRESTBase   = "https://fapi.binance.com"
)
