package binance

import (
	"context"

	"exchange-sync/internal/exchange"

	exbinance "github.com/pkg/exchange-adapter/exchanges/binance"
)

// RESTClient Binance REST API 客户端 (wrapper around pkg/exchange-adapter)
type RESTClient struct {
	impl *exbinance.MarketDataRESTClient
}

// NewRESTClient 创建 REST 客户端
func NewRESTClient(proxy string) *RESTClient {
	return &RESTClient{
		impl: exbinance.NewMarketDataRESTClient(exbinance.MarketDataRESTClientOptions{
			HTTPSProxy: proxy,
		}),
	}
}

func (c *RESTClient) Name() exchange.ExchangeName { return exchange.Binance }

func (c *RESTClient) GetSymbols(ctx context.Context, tradeType exchange.TradeType) ([]exchange.SymbolInfo, error) {
	return c.impl.GetSymbols(ctx, tradeType)
}

func (c *RESTClient) GetCandles(ctx context.Context, symbol string, tradeType exchange.TradeType, period exchange.Period, startTime, endTime int64, limit int) ([]exchange.NormalizedCandle, error) {
	return c.impl.GetCandles(ctx, symbol, tradeType, period, startTime, endTime, limit)
}
