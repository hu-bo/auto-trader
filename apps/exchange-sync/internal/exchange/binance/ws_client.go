package binance

import (
	"context"
	"time"

	"exchange-sync/internal/exchange"

	exbinance "github.com/pkg/exchange-adapter/exchanges/binance"
	"github.com/pkg/exchange-adapter/marketdata"
)

// Client Binance WebSocket 客户端 (wrapper around pkg/exchange-adapter)
type Client struct {
	impl *exbinance.WsPublicAdapter
}

// NewClient 创建 Binance 客户端
func NewClient(proxy string, heartbeatSec, reconnectSec int) *Client {
	impl := exbinance.NewWsPublicAdapter(exbinance.WsPublicAdapterOptions{
		SocksProxy:        proxy,
		HeartbeatInterval: time.Duration(heartbeatSec) * time.Second,
		ReconnectInterval: time.Duration(reconnectSec) * time.Second,
	})
	return &Client{impl: impl}
}

func (c *Client) Name() exchange.ExchangeName { return exchange.Binance }

func (c *Client) Connect(ctx context.Context) error {
	return c.impl.Connect(ctx)
}

func (c *Client) Subscribe(symbols []exchange.SubscribeRequest) error {
	reqs := make([]marketdata.SubscribeRequest, 0, len(symbols))
	for _, s := range symbols {
		reqs = append(reqs, marketdata.SubscribeRequest{Symbol: s.Symbol, TradeType: marketdata.TradeType(s.TradeType)})
	}
	return c.impl.Subscribe(reqs)
}

func (c *Client) Unsubscribe(symbols []string) error {
	return c.impl.Unsubscribe(symbols)
}

func (c *Client) Close() error {
	return c.impl.Close()
}

func (c *Client) OnKline(handler func(exchange.Kline)) {
	if handler == nil {
		c.impl.OnKline(nil)
		return
	}
	c.impl.OnKline(func(k marketdata.Kline) { handler(exchange.Kline(k)) })
}

func (c *Client) OnTrade(handler func(exchange.Trade)) {
	if handler == nil {
		c.impl.OnTrade(nil)
		return
	}
	c.impl.OnTrade(func(t marketdata.Trade) { handler(exchange.Trade(t)) })
}

func (c *Client) OnDepth(handler func(exchange.DepthUpdate)) {
	if handler == nil {
		c.impl.OnDepth(nil)
		return
	}
	c.impl.OnDepth(func(d marketdata.DepthUpdate) { handler(exchange.DepthUpdate(d)) })
}

func (c *Client) OnMiniTicker(handler func(exchange.MiniTicker)) {
	if handler == nil {
		c.impl.OnMiniTicker(nil)
		return
	}
	c.impl.OnMiniTicker(func(t marketdata.MiniTicker) { handler(exchange.MiniTicker(t)) })
}

func (c *Client) OnError(handler func(error)) { c.impl.OnError(handler) }

// SubFuturesMiniTicker 订阅全市场精简 ticker (!miniTicker@arr)
func (c *Client) SubFuturesMiniTicker() error {
	return c.impl.SubFuturesMiniTicker()
}
