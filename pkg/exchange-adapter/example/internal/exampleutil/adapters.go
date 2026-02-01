package exampleutil

import (
	"fmt"
	"strings"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/exchanges/binance"
	"github.com/pkg/exchange-adapter/exchanges/okx"
)

func NewPublicAdapters(opts *core.AdapterOptions) map[core.Exchange]core.PublicAdapter {
	return map[core.Exchange]core.PublicAdapter{
		core.ExchangeBinance: binance.NewPublicAdapter(opts),
		core.ExchangeOKX:     okx.NewPublicAdapter(opts),
	}
}

func NewTradeAdapters(env Env, exchanges []core.Exchange, opts *core.AdapterOptions) (map[core.Exchange]core.TradeAdapter, error) {
	if err := RequireCredsForExchanges(env, exchanges); err != nil {
		return nil, err
	}

	out := make(map[core.Exchange]core.TradeAdapter, len(exchanges))
	for _, exchange := range exchanges {
		switch exchange {
		case core.ExchangeBinance:
			out[exchange] = binance.NewTradeAdapter(binance.TradeAdapterOptions{
				APIKey:    env.BinanceAPIKey,
				APISecret: env.BinanceAPISecret,
				Options:   opts,
			})
		case core.ExchangeOKX:
			out[exchange] = okx.NewTradeAdapter(okx.TradeAdapterOptions{
				APIKey:    env.OKXAPIKey,
				APISecret: env.OKXAPISecret,
				APIPass:   env.OKXPassphrase,
				Options:   opts,
			})
		default:
			return nil, fmt.Errorf("unsupported exchange: %s", exchange)
		}
	}
	return out, nil
}

func NewWsUserDataAdapters(env Env, exchanges []core.Exchange, opts *core.AdapterOptions) (map[core.Exchange]core.WsUserDataAdapter, error) {
	if err := RequireCredsForExchanges(env, exchanges); err != nil {
		return nil, err
	}

	out := make(map[core.Exchange]core.WsUserDataAdapter, len(exchanges))
	for _, exchange := range exchanges {
		switch exchange {
		case core.ExchangeBinance:
			out[exchange] = binance.NewWsUserDataAdapter(binance.WsUserDataAdapterOptions{
				APIKey:    env.BinanceAPIKey,
				APISecret: env.BinanceAPISecret,
				Options:   opts,
			})
		case core.ExchangeOKX:
			out[exchange] = okx.NewWsUserDataAdapter(okx.WsUserDataAdapterOptions{
				APIKey:    env.OKXAPIKey,
				APISecret: env.OKXAPISecret,
				APIPass:   env.OKXPassphrase,
				Options:   opts,
			})
		default:
			return nil, fmt.Errorf("unsupported exchange: %s", exchange)
		}
	}
	return out, nil
}

func ParseTradeType(v string) (core.TradeType, error) {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case string(core.TradeTypeSpot):
		return core.TradeTypeSpot, nil
	case string(core.TradeTypeFutures):
		return core.TradeTypeFutures, nil
	case string(core.TradeTypeDelivery):
		return core.TradeTypeDelivery, nil
	default:
		return "", fmt.Errorf("invalid tradeType: %s", v)
	}
}

func ParseExchange(v string) (core.Exchange, error) {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case string(core.ExchangeBinance):
		return core.ExchangeBinance, nil
	case string(core.ExchangeOKX):
		return core.ExchangeOKX, nil
	default:
		return "", fmt.Errorf("invalid exchange: %s", v)
	}
}
