package okx

import (
	"context"
	"fmt"

	"exchange-sync/internal/exchange"

	exokx "github.com/pkg/exchange-adapter/exchanges/okx"
)

// RESTClient OKX REST API 客户端 (wrapper around pkg/exchange-adapter)
type RESTClient struct {
	impl    *exokx.MarketDataRESTClient
	initErr error
}

// NewRESTClient 创建 REST 客户端
func NewRESTClient(proxy string) *RESTClient {
	impl, err := exokx.NewMarketDataRESTClient(exokx.MarketDataRESTClientOptions{
		HTTPSProxy: proxy,
	})
	return &RESTClient{impl: impl, initErr: err}
}

func (c *RESTClient) Name() exchange.ExchangeName { return exchange.OKX }

func (c *RESTClient) GetSymbols(ctx context.Context, tradeType exchange.TradeType) ([]exchange.SymbolInfo, error) {
	if c.initErr != nil {
		return nil, c.initErr
	}
	if c.impl == nil {
		return nil, fmt.Errorf("nil okx rest client")
	}
	return c.impl.GetSymbols(ctx, tradeType)
}

func (c *RESTClient) GetCandles(ctx context.Context, symbol string, tradeType exchange.TradeType, period exchange.Period, startTime, endTime int64, limit int) ([]exchange.NormalizedCandle, error) {
	if c.initErr != nil {
		return nil, c.initErr
	}
	if c.impl == nil {
		return nil, fmt.Errorf("nil okx rest client")
	}
	return c.impl.GetCandles(ctx, symbol, tradeType, period, startTime, endTime, limit)
}
