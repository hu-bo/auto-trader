package core

import (
	"context"
	"time"
)

// PublicAdapter provides unauthenticated market data access with unified types.
type PublicAdapter interface {
	Exchange() Exchange

	GetSymbolInfo(ctx context.Context, symbol string, tradeType TradeType) Result[SymbolInfo]
	GetAllSymbols(ctx context.Context, tradeType TradeType) Result[[]SymbolInfo]

	GetPrice(ctx context.Context, symbol string, tradeType TradeType) Result[string]
	GetMarkPrice(ctx context.Context, symbol string, tradeType TradeType) Result[string]
	GetTicker(ctx context.Context, symbol string, tradeType TradeType) Result[Ticker]
	GetOrderBook(ctx context.Context, symbol string, tradeType TradeType, limit int) Result[OrderBook]

	ToRawSymbol(symbol string, tradeType TradeType) string
	FromRawSymbol(rawSymbol string, tradeType TradeType) string
}

type BasePublicAdapter struct {
	exchange    Exchange
	symbolCache *Cache[SymbolInfo]
	cacheExpiry time.Duration
}

func NewBasePublicAdapter(exchange Exchange, cacheExpiry time.Duration) BasePublicAdapter {
	if cacheExpiry <= 0 {
		cacheExpiry = time.Hour
	}
	return BasePublicAdapter{
		exchange:    exchange,
		symbolCache: NewCache[SymbolInfo](cacheExpiry),
		cacheExpiry: cacheExpiry,
	}
}

func (b *BasePublicAdapter) Exchange() Exchange {
	return b.exchange
}

func (b *BasePublicAdapter) cacheKey(symbol string, tradeType TradeType) string {
	return string(b.exchange) + ":" + string(tradeType) + ":" + symbol
}

func (b *BasePublicAdapter) GetCachedSymbol(symbol string, tradeType TradeType) (SymbolInfo, bool) {
	return b.symbolCache.Get(b.cacheKey(symbol, tradeType))
}

func (b *BasePublicAdapter) SetCachedSymbol(symbol string, tradeType TradeType, info SymbolInfo) {
	b.symbolCache.Set(b.cacheKey(symbol, tradeType), info, b.cacheExpiry)
}

func (b *BasePublicAdapter) SetCachedSymbols(tradeType TradeType, symbols []SymbolInfo) {
	for _, info := range symbols {
		b.symbolCache.Set(b.cacheKey(info.Symbol, tradeType), info, b.cacheExpiry)
	}
}
