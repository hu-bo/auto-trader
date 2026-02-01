package exchange

import (
	"context"

	md "github.com/pkg/exchange-adapter/marketdata"
)

type (
	ExchangeName = md.ExchangeName
	TradeType    = md.TradeType
	Period       = md.Period

	SymbolInfo       = md.SymbolInfo
	MiniTicker       = md.MiniTicker
	SubscribeRequest = md.SubscribeRequest
	NormalizedCandle = md.NormalizedCandle
	Kline            = md.Kline
	Trade            = md.Trade
	DepthUpdate      = md.DepthUpdate
	DepthEntry       = md.DepthEntry
	OrderBook        = md.OrderBook
	OrderBookEntry   = md.OrderBookEntry
)

const (
	Binance ExchangeName = md.Binance
	OKX     ExchangeName = md.OKX
)

const (
	Spot    TradeType = md.Spot
	Futures TradeType = md.Futures
)

const (
	Period1m  Period = md.Period1m
	Period5m  Period = md.Period5m
	Period15m Period = md.Period15m
	Period30m Period = md.Period30m
	Period1h  Period = md.Period1h
	Period4h  Period = md.Period4h
	Period1d  Period = md.Period1d
)

type Exchange interface {
	Name() ExchangeName
	Connect(ctx context.Context) error
	Subscribe(symbols []SubscribeRequest) error
	Unsubscribe(symbols []string) error
	Close() error
	OnKline(handler func(Kline))
	OnTrade(handler func(Trade))
	OnDepth(handler func(DepthUpdate))
	OnMiniTicker(handler func(MiniTicker))
	OnError(handler func(error))
}

type RESTClient interface {
	Name() ExchangeName
	GetSymbols(ctx context.Context, tradeType TradeType) ([]SymbolInfo, error)
	GetCandles(ctx context.Context, symbol string, tradeType TradeType, period Period, startTime, endTime int64, limit int) ([]NormalizedCandle, error)
}

func NormalizeSymbol(exchange ExchangeName, rawSymbol string, tradeType TradeType) string {
	return md.NormalizeSymbol(exchange, rawSymbol, tradeType)
}

func ToExchangeSymbol(exchange ExchangeName, symbol string, tradeType TradeType) string {
	return md.ToExchangeSymbol(exchange, symbol, tradeType)
}

func ExtractSymbolFamily(symbol string) string { return md.ExtractSymbolFamily(symbol) }

func CalculatePrecision(size string) int { return md.CalculatePrecision(size) }
