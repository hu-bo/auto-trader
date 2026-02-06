package okx

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/marketdata"
	okxapi "github.com/pkg/okx-api"
	okxtypes "github.com/pkg/okx-api/types"
	okxws "github.com/pkg/okx-api/types/websockets"
)

type WsPublicAdapterOptions struct {
	SocksProxy        string
	ReconnectInterval time.Duration
	DemoTrading       bool
}

type WsPublicAdapter struct {
	proxy string
	ctx   context.Context

	ws *okxapi.WebsocketClient

	mu         sync.Mutex
	subscribed map[string]struct{} // key: symbol:tradeType

	onKline      func(marketdata.Kline)
	onTrade      func(marketdata.Trade)
	onDepth      func(marketdata.DepthUpdate)
	onMiniTicker func(marketdata.MiniTicker)
	onError      func(error)
}

func NewWsPublicAdapter(opts WsPublicAdapterOptions) *WsPublicAdapter {
	reconnect := opts.ReconnectInterval
	if reconnect <= 0 {
		reconnect = 5 * time.Second
	}

	ws := okxapi.NewWebsocketClient(okxws.WSClientConfig{
		Market:           okxtypes.APIMarketGLOBAL,
		DemoTrading:      opts.DemoTrading,
		ReconnectTimeout: reconnect,
		SocksProxy:       opts.SocksProxy,
	})

	a := &WsPublicAdapter{
		proxy:      opts.SocksProxy,
		ws:         ws,
		subscribed: make(map[string]struct{}),
	}
	a.setupHandlers()
	return a
}

func (a *WsPublicAdapter) Name() marketdata.ExchangeName { return marketdata.OKX }

func (a *WsPublicAdapter) Connect(ctx context.Context) error {
	a.ctx = ctx
	return nil
}

func (a *WsPublicAdapter) Subscribe(symbols []marketdata.SubscribeRequest) error {
	for _, s := range symbols {
		if err := marketdata.ValidateSubscribeRequest(s); err != nil {
			return err
		}
	}

	newSubs := make([]marketdata.SubscribeRequest, 0)
	a.mu.Lock()
	for _, s := range symbols {
		key := s.Symbol + ":" + string(s.TradeType)
		if _, ok := a.subscribed[key]; ok {
			continue
		}
		a.subscribed[key] = struct{}{}
		newSubs = append(newSubs, s)
	}
	a.mu.Unlock()

	if len(newSubs) == 0 {
		return nil
	}

	args := buildOKXPublicArgs(newSubs)
	return a.ws.Subscribe(a.ctx, args, nil)
}

func (a *WsPublicAdapter) Unsubscribe(symbols []string) error {
	unsubItems := make([]marketdata.SubscribeRequest, 0)
	a.mu.Lock()
	for _, s := range symbols {
		for _, tt := range []marketdata.TradeType{marketdata.Spot, marketdata.Futures} {
			key := s + ":" + string(tt)
			if _, ok := a.subscribed[key]; !ok {
				continue
			}
			delete(a.subscribed, key)
			unsubItems = append(unsubItems, marketdata.SubscribeRequest{Symbol: s, TradeType: tt})
		}
	}
	a.mu.Unlock()

	if len(unsubItems) == 0 {
		return nil
	}

	args := buildOKXPublicArgs(unsubItems)
	return a.ws.Unsubscribe(a.ctx, args, nil)
}

func (a *WsPublicAdapter) Close() error {
	a.ws.CloseAll()
	return nil
}

func (a *WsPublicAdapter) OnKline(handler func(marketdata.Kline))           { a.onKline = handler }
func (a *WsPublicAdapter) OnTrade(handler func(marketdata.Trade))           { a.onTrade = handler }
func (a *WsPublicAdapter) OnDepth(handler func(marketdata.DepthUpdate))     { a.onDepth = handler }
func (a *WsPublicAdapter) OnMiniTicker(handler func(marketdata.MiniTicker)) { a.onMiniTicker = handler }
func (a *WsPublicAdapter) OnError(handler func(error))                      { a.onError = handler }

func buildOKXPublicArgs(symbols []marketdata.SubscribeRequest) []map[string]any {
	channels := []string{"candle15m", "trades", "books", "tickers"}
	args := make([]map[string]any, 0, len(symbols)*len(channels))
	for _, s := range symbols {
		instID := marketdata.ToExchangeSymbol(marketdata.OKX, s.Symbol, s.TradeType)
		for _, ch := range channels {
			args = append(args, map[string]any{"channel": ch, "instId": instID})
		}
	}
	return args
}

func (a *WsPublicAdapter) setupHandlers() {
	a.ws.OnError(func(err error) {
		if err == nil {
			return
		}
		if a.onError != nil {
			a.onError(err)
		}
	})

	a.ws.On("exception", func(event any) {
		if a.onError == nil {
			return
		}
		msg := ""
		switch v := event.(type) {
		case okxapi.WsEvent:
			msg = v.Message.Msg
			if msg == "" {
				msg = string(v.Raw)
			}
		case okxapi.WsRawMessage:
			msg = string(v.Raw)
		default:
			msg = fmt.Sprintf("%v", v)
		}
		a.onError(fmt.Errorf("okx ws exception: %s", msg))
	})

	a.ws.On("update", func(event any) {
		upd, ok := event.(okxapi.WsDataEvent)
		if !ok {
			return
		}
		a.handleUpdate(upd)
	})
}

type okxWsArgPublic struct {
	Channel string `json:"channel"`
	InstID  string `json:"instId"`
}

func (a *WsPublicAdapter) handleUpdate(upd okxapi.WsDataEvent) {
	var arg okxWsArgPublic
	if err := json.Unmarshal(upd.Message.Arg, &arg); err != nil {
		return
	}
	if arg.Channel == "" || arg.InstID == "" {
		return
	}

	tradeType := marketdata.Spot
	if strings.HasSuffix(arg.InstID, "-SWAP") {
		tradeType = marketdata.Futures
	}

	switch {
	case strings.HasPrefix(arg.Channel, "candle"):
		a.handleCandle15m(arg.InstID, tradeType, upd.Message.Data)
	case arg.Channel == "trades":
		a.handleTrades(arg.InstID, tradeType, upd.Message.Data)
	case strings.HasPrefix(arg.Channel, "books"):
		a.handleBooks(arg.InstID, tradeType, upd.Message.Data)
	case arg.Channel == "tickers":
		a.handleTickers(arg.InstID, tradeType, upd.Message.Data)
	}
}

func (a *WsPublicAdapter) handleCandle15m(instID string, tradeType marketdata.TradeType, data json.RawMessage) {
	if a.onKline == nil {
		return
	}

	symbol := marketdata.NormalizeSymbol(marketdata.OKX, instID, tradeType)

	var rows [][]string
	if err := json.Unmarshal(data, &rows); err != nil {
		// OKX sometimes returns an array of mixed types; fallback.
		var anyRows [][]any
		if err2 := json.Unmarshal(data, &anyRows); err2 != nil {
			return
		}
		rows = make([][]string, 0, len(anyRows))
		for _, r := range anyRows {
			ss := make([]string, 0, len(r))
			for _, v := range r {
				ss = append(ss, fmt.Sprintf("%v", v))
			}
			rows = append(rows, ss)
		}
	}

	for _, row := range rows {
		if len(row) < 6 {
			continue
		}
		closed := len(row) > 8 && row[8] == "1"

		a.onKline(marketdata.Kline{
			Symbol:    symbol,
			Exchange:  string(marketdata.OKX),
			TradeType: tradeType,
			Period:    marketdata.Period15m,
			Timestamp: core.ParseInt64(row[0]),
			Open:      core.ParseFloat(row[1]),
			High:      core.ParseFloat(row[2]),
			Low:       core.ParseFloat(row[3]),
			Close:     core.ParseFloat(row[4]),
			Volume:    core.ParseFloat(row[5]),
			BuyVolume: 0,
			Closed:    closed,
		})
	}
}

type okxWsTrade struct {
	Px   string `json:"px"`
	Sz   string `json:"sz"`
	Ts   string `json:"ts"`
	Side string `json:"side"`
}

func (a *WsPublicAdapter) handleTrades(instID string, tradeType marketdata.TradeType, data json.RawMessage) {
	if a.onTrade == nil {
		return
	}
	symbol := marketdata.NormalizeSymbol(marketdata.OKX, instID, tradeType)

	var rows []okxWsTrade
	if err := json.Unmarshal(data, &rows); err != nil {
		return
	}
	for _, t := range rows {
		a.onTrade(marketdata.Trade{
			Symbol:    symbol,
			Exchange:  string(marketdata.OKX),
			TradeType: tradeType,
			Price:     core.ParseFloat(t.Px),
			Quantity:  core.ParseFloat(t.Sz),
			Timestamp: core.ParseInt64(t.Ts),
			IsBuy:     strings.EqualFold(t.Side, "buy"),
		})
	}
}

type okxWsBook struct {
	Bids [][]string `json:"bids"`
	Asks [][]string `json:"asks"`
	Ts   string     `json:"ts"`
}

func (a *WsPublicAdapter) handleBooks(instID string, tradeType marketdata.TradeType, data json.RawMessage) {
	if a.onDepth == nil {
		return
	}
	symbol := marketdata.NormalizeSymbol(marketdata.OKX, instID, tradeType)

	var books []okxWsBook
	if err := json.Unmarshal(data, &books); err != nil {
		return
	}
	for _, book := range books {
		a.onDepth(marketdata.DepthUpdate{
			Symbol:    symbol,
			Exchange:  string(marketdata.OKX),
			TradeType: tradeType,
			Bids:      parseOKXDepth(book.Bids),
			Asks:      parseOKXDepth(book.Asks),
			Timestamp: core.ParseInt64(book.Ts),
		})
	}
}

func parseOKXDepth(levels [][]string) []marketdata.DepthEntry {
	if len(levels) == 0 {
		return nil
	}
	out := make([]marketdata.DepthEntry, 0, len(levels))
	for _, l := range levels {
		if len(l) < 2 {
			continue
		}
		out = append(out, marketdata.DepthEntry{
			Price:    core.ParseFloat(l[0]),
			Quantity: core.ParseFloat(l[1]),
		})
	}
	return out
}

type okxWsTicker struct {
	Last      string `json:"last"`
	Open24h   string `json:"open24h"`
	VolCcy24h string `json:"volCcy24h"`
	Ts        string `json:"ts"`
}

func (a *WsPublicAdapter) handleTickers(instID string, tradeType marketdata.TradeType, data json.RawMessage) {
	if a.onMiniTicker == nil {
		return
	}
	symbol := marketdata.NormalizeSymbol(marketdata.OKX, instID, tradeType)

	var rows []okxWsTicker
	if err := json.Unmarshal(data, &rows); err != nil {
		return
	}

	for _, t := range rows {
		a.onMiniTicker(marketdata.MiniTicker{
			Symbol:         symbol,
			Exchange:       string(marketdata.OKX),
			TradeType:      tradeType,
			EventTimeMs:    core.ParseInt64(t.Ts),
			OpenPrice24h:   core.ParseFloat(t.Open24h),
			LastPrice:      core.ParseFloat(t.Last),
			QuoteVolume24h: core.ParseFloat(t.VolCcy24h),
		})
	}
}
