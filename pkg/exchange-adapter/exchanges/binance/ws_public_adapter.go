package binance

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	binanceapi "github.com/pkg/binance-api"
	bws "github.com/pkg/binance-api/types/websockets"
	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/marketdata"
)

type WsPublicAdapterOptions struct {
	SocksProxy        string
	HeartbeatInterval time.Duration
	ReconnectInterval time.Duration
	Testnet           bool

	// SubscribeAggTrades enables `aggTrade` subscriptions per symbol.
	// Default is false (same behavior as exchange-sync's previous Binance WS client).
	SubscribeAggTrades bool
}

type WsPublicAdapter struct {
	proxy             string
	testnet           bool
	heartbeatInterval time.Duration
	reconnectInterval time.Duration
	subAggTrades      bool

	ctx context.Context

	mu         sync.Mutex
	conns      map[marketdata.TradeType]*binancePublicConn
	subscribed map[string]struct{} // key: symbol:tradeType

	futuresMiniTickerAll atomic.Bool

	onKline      func(marketdata.Kline)
	onTrade      func(marketdata.Trade)
	onDepth      func(marketdata.DepthUpdate)
	onMiniTicker func(marketdata.MiniTicker)
	onError      func(error)
}

type binancePublicConn struct {
	tradeType marketdata.TradeType
	wsKey     bws.WsKey
	ws        *binanceapi.WebsocketClient
	stopCh    chan struct{}
}

func NewWsPublicAdapter(opts WsPublicAdapterOptions) *WsPublicAdapter {
	heartbeat := opts.HeartbeatInterval
	if heartbeat <= 0 {
		heartbeat = 30 * time.Second
	}
	reconnect := opts.ReconnectInterval
	if reconnect <= 0 {
		reconnect = 5 * time.Second
	}

	return &WsPublicAdapter{
		proxy:             opts.SocksProxy,
		testnet:           opts.Testnet,
		heartbeatInterval: heartbeat,
		reconnectInterval: reconnect,
		subAggTrades:      opts.SubscribeAggTrades,
		conns:             make(map[marketdata.TradeType]*binancePublicConn),
		subscribed:        make(map[string]struct{}),
	}
}

func (a *WsPublicAdapter) Name() marketdata.ExchangeName { return marketdata.Binance }

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

	spotSymbols := make([]string, 0)
	futuresSymbols := make([]string, 0)

	a.mu.Lock()
	for _, s := range symbols {
		key := s.Symbol + ":" + string(s.TradeType)
		if _, ok := a.subscribed[key]; ok {
			continue
		}
		a.subscribed[key] = struct{}{}

		raw := unifiedToRawSymbol(s.Symbol, toCoreTradeType(s.TradeType))
		raw = strings.ToUpper(raw)
		if s.TradeType == marketdata.Futures {
			futuresSymbols = append(futuresSymbols, raw)
		} else {
			spotSymbols = append(spotSymbols, raw)
		}
	}
	a.mu.Unlock()

	if len(spotSymbols) > 0 {
		if err := a.subscribeSymbols(marketdata.Spot, spotSymbols); err != nil {
			return err
		}
	}
	if len(futuresSymbols) > 0 {
		if err := a.subscribeSymbols(marketdata.Futures, futuresSymbols); err != nil {
			return err
		}
	}
	return nil
}

func (a *WsPublicAdapter) subscribeSymbols(tradeType marketdata.TradeType, rawSymbols []string) error {
	conn, err := a.ensureConn(tradeType)
	if err != nil {
		return err
	}

	// Binance rate limit: max 10 messages per second per connection
	// Batch subscriptions to avoid hitting rate limits
	const batchSize = 5
	const batchDelay = 600 * time.Millisecond // ~8 messages per second to be safe

	for i := 0; i < len(rawSymbols); i += batchSize {
		end := i + batchSize
		if end > len(rawSymbols) {
			end = len(rawSymbols)
		}
		batch := rawSymbols[i:end]

		// Subscribe to each symbol in the batch
		for _, raw := range batch {
			if err := conn.ws.SubscribeKlines(conn.wsKey, raw, "15m"); err != nil {
				return err
			}
			if err := conn.ws.SubscribeDiffDepth(conn.wsKey, raw, ""); err != nil {
				return err
			}
			if a.subAggTrades {
				_ = conn.ws.SubscribeAggregateTrades(conn.wsKey, raw)
			}
		}

		// Add delay between batches to respect rate limits
		if end < len(rawSymbols) {
			time.Sleep(batchDelay)
		}
	}

	if tradeType == marketdata.Futures && a.futuresMiniTickerAll.Load() {
		_ = conn.ws.SubscribeAllMiniTickers(conn.wsKey)
	}

	return nil
}

func (a *WsPublicAdapter) Unsubscribe(symbols []string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, symbol := range symbols {
		for _, tt := range []marketdata.TradeType{marketdata.Spot, marketdata.Futures} {
			key := symbol + ":" + string(tt)
			if _, ok := a.subscribed[key]; !ok {
				continue
			}
			delete(a.subscribed, key)

			conn := a.conns[tt]
			if conn == nil || conn.ws == nil || !conn.ws.IsConnected(conn.wsKey) {
				continue
			}

			raw := unifiedToRawSymbol(symbol, toCoreTradeType(tt))
			rawLower := strings.ToLower(raw)

			topics := []string{
				rawLower + "@kline_15m",
				rawLower + "@depth",
			}
			if a.subAggTrades {
				topics = append(topics, rawLower+"@aggTrade")
			}
			_ = conn.ws.Unsubscribe(conn.wsKey, topics...)
		}
	}
	return nil
}

func (a *WsPublicAdapter) Close() error {
	a.mu.Lock()
	conns := make([]*binancePublicConn, 0, len(a.conns))
	for _, c := range a.conns {
		conns = append(conns, c)
	}
	a.conns = make(map[marketdata.TradeType]*binancePublicConn)
	a.subscribed = make(map[string]struct{})
	a.mu.Unlock()

	for _, c := range conns {
		if c == nil {
			continue
		}
		close(c.stopCh)
		if c.ws != nil {
			_ = c.ws.Close(c.wsKey)
		}
	}
	return nil
}

// SubFuturesMiniTicker subscribes Binance futures `!miniTicker@arr`.
func (a *WsPublicAdapter) SubFuturesMiniTicker() error {
	a.futuresMiniTickerAll.Store(true)
	conn, err := a.ensureConn(marketdata.Futures)
	if err != nil {
		return err
	}
	return conn.ws.SubscribeAllMiniTickers(conn.wsKey)
}

func (a *WsPublicAdapter) OnKline(handler func(marketdata.Kline))           { a.onKline = handler }
func (a *WsPublicAdapter) OnTrade(handler func(marketdata.Trade))           { a.onTrade = handler }
func (a *WsPublicAdapter) OnDepth(handler func(marketdata.DepthUpdate))     { a.onDepth = handler }
func (a *WsPublicAdapter) OnMiniTicker(handler func(marketdata.MiniTicker)) { a.onMiniTicker = handler }
func (a *WsPublicAdapter) OnError(handler func(error))                      { a.onError = handler }

func (a *WsPublicAdapter) ensureConn(tradeType marketdata.TradeType) (*binancePublicConn, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if existing := a.conns[tradeType]; existing != nil && existing.ws != nil && existing.ws.IsConnected(existing.wsKey) {
		return existing, nil
	}

	wsKey := bws.WsKeyMain
	switch tradeType {
	case marketdata.Spot:
		wsKey = bws.WsKeyMain
	case marketdata.Futures:
		wsKey = bws.WsKeyUSDM
	default:
		return nil, fmt.Errorf("unsupported tradeType: %s", tradeType)
	}

	ws := binanceapi.NewWebsocketClient(bws.WsClientConfig{
		Testnet:      a.testnet,
		PingInterval: int(a.heartbeatInterval / time.Millisecond),
		SocksProxy:   a.proxy,
	})

	conn := &binancePublicConn{
		tradeType: tradeType,
		wsKey:     wsKey,
		ws:        ws,
		stopCh:    make(chan struct{}),
	}

	a.registerHandlers(conn)

	if err := ws.Connect(wsKey); err != nil {
		return nil, err
	}

	a.conns[tradeType] = conn

	go a.reconnectLoop(conn)
	return conn, nil
}

func (a *WsPublicAdapter) reconnectLoop(conn *binancePublicConn) {
	ticker := time.NewTicker(a.reconnectInterval)
	defer ticker.Stop()

	for {
		select {
		case <-conn.stopCh:
			return
		case <-ticker.C:
			if conn.ws == nil || conn.ws.IsConnected(conn.wsKey) {
				continue
			}
			_ = conn.ws.Connect(conn.wsKey)
			_ = a.resubscribeLocked(conn.tradeType)
		}
	}
}

func (a *WsPublicAdapter) resubscribeLocked(tradeType marketdata.TradeType) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	conn := a.conns[tradeType]
	if conn == nil || conn.ws == nil || !conn.ws.IsConnected(conn.wsKey) {
		return nil
	}

	rawSymbols := make([]string, 0)
	for key := range a.subscribed {
		parts := strings.Split(key, ":")
		if len(parts) != 2 {
			continue
		}
		if marketdata.TradeType(parts[1]) != tradeType {
			continue
		}
		raw := unifiedToRawSymbol(parts[0], toCoreTradeType(tradeType))
		rawSymbols = append(rawSymbols, strings.ToUpper(raw))
	}

	// Batch resubscriptions to avoid rate limits
	const batchSize = 5
	const batchDelay = 600 * time.Millisecond

	for i := 0; i < len(rawSymbols); i += batchSize {
		end := i + batchSize
		if end > len(rawSymbols) {
			end = len(rawSymbols)
		}
		batch := rawSymbols[i:end]

		for _, raw := range batch {
			_ = conn.ws.SubscribeKlines(conn.wsKey, raw, "15m")
			_ = conn.ws.SubscribeDiffDepth(conn.wsKey, raw, "")
			if a.subAggTrades {
				_ = conn.ws.SubscribeAggregateTrades(conn.wsKey, raw)
			}
		}

		if end < len(rawSymbols) {
			time.Sleep(batchDelay)
		}
	}

	if tradeType == marketdata.Futures && a.futuresMiniTickerAll.Load() {
		_ = conn.ws.SubscribeAllMiniTickers(conn.wsKey)
	}
	return nil
}

func (a *WsPublicAdapter) registerHandlers(conn *binancePublicConn) {
	tradeType := conn.tradeType

	conn.ws.OnMessage("kline", func(event interface{}) {
		if a.onKline == nil {
			return
		}
		msg, ok := event.(map[string]interface{})
		if !ok {
			return
		}
		a.handleKline(msg, tradeType)
	})

	conn.ws.OnMessage("depthUpdate", func(event interface{}) {
		if a.onDepth == nil {
			return
		}
		msg, ok := event.(map[string]interface{})
		if !ok {
			return
		}
		a.handleDepth(msg, tradeType)
	})

	conn.ws.OnMessage("aggTrade", func(event interface{}) {
		if a.onTrade == nil {
			return
		}
		msg, ok := event.(map[string]interface{})
		if !ok {
			return
		}
		a.handleAggTrade(msg, tradeType)
	})

	conn.ws.OnMessage("24hrMiniTicker", func(event interface{}) {
		if a.onMiniTicker == nil {
			return
		}
		switch v := event.(type) {
		case []interface{}:
			for _, item := range v {
				if msg, ok := item.(map[string]interface{}); ok {
					a.handleMiniTicker(msg, tradeType)
				}
			}
		case map[string]interface{}:
			a.handleMiniTicker(v, tradeType)
		}
	})

	conn.ws.OnError(func(err error) {
		if err == nil {
			return
		}
		if a.onError != nil {
			a.onError(err)
		}
	})
}

func (a *WsPublicAdapter) handleMiniTicker(msg map[string]interface{}, tradeType marketdata.TradeType) {
	rawSymbol, _ := msg["s"].(string)
	symbol := marketdata.NormalizeSymbol(marketdata.Binance, rawSymbol, tradeType)

	openStr, _ := msg["o"].(string)
	lastStr, _ := msg["c"].(string)
	quoteVolStr, _ := msg["q"].(string)

	eventTimeMs := core.Int64FromAny(msg["E"])

	a.onMiniTicker(marketdata.MiniTicker{
		Symbol:         symbol,
		Exchange:       string(marketdata.Binance),
		TradeType:      tradeType,
		EventTimeMs:    eventTimeMs,
		OpenPrice24h:   core.ParseFloat(openStr),
		LastPrice:      core.ParseFloat(lastStr),
		QuoteVolume24h: core.ParseFloat(quoteVolStr),
	})
}

func (a *WsPublicAdapter) handleKline(msg map[string]interface{}, tradeType marketdata.TradeType) {
	k, ok := msg["k"].(map[string]interface{})
	if !ok {
		return
	}
	closed, _ := k["x"].(bool)

	rawSymbol, _ := msg["s"].(string)
	symbol := marketdata.NormalizeSymbol(marketdata.Binance, rawSymbol, tradeType)

	a.onKline(marketdata.Kline{
		Symbol:    symbol,
		Exchange:  string(marketdata.Binance),
		TradeType: tradeType,
		Period:    marketdata.Period15m,
		Timestamp: core.Int64FromAny(k["t"]),
		Open:      core.ParseFloat(core.StringFromAny(k["o"])),
		High:      core.ParseFloat(core.StringFromAny(k["h"])),
		Low:       core.ParseFloat(core.StringFromAny(k["l"])),
		Close:     core.ParseFloat(core.StringFromAny(k["c"])),
		Volume:    core.ParseFloat(core.StringFromAny(k["v"])),
		BuyVolume: core.ParseFloat(core.StringFromAny(k["V"])),
		Closed:    closed,
	})
}

func (a *WsPublicAdapter) handleAggTrade(msg map[string]interface{}, tradeType marketdata.TradeType) {
	rawSymbol, _ := msg["s"].(string)
	symbol := marketdata.NormalizeSymbol(marketdata.Binance, rawSymbol, tradeType)

	isBuyerMaker, _ := msg["m"].(bool)

	a.onTrade(marketdata.Trade{
		Symbol:    symbol,
		Exchange:  string(marketdata.Binance),
		TradeType: tradeType,
		Price:     core.ParseFloat(core.StringFromAny(msg["p"])),
		Quantity:  core.ParseFloat(core.StringFromAny(msg["q"])),
		Timestamp: core.Int64FromAny(msg["T"]),
		IsBuy:     !isBuyerMaker,
	})
}

func (a *WsPublicAdapter) handleDepth(msg map[string]interface{}, tradeType marketdata.TradeType) {
	rawSymbol, _ := msg["s"].(string)
	symbol := marketdata.NormalizeSymbol(marketdata.Binance, rawSymbol, tradeType)

	a.onDepth(marketdata.DepthUpdate{
		Symbol:    symbol,
		Exchange:  string(marketdata.Binance),
		TradeType: tradeType,
		Bids:      parseDepthEntries(msg["b"]),
		Asks:      parseDepthEntries(msg["a"]),
		Timestamp: core.Int64FromAny(msg["E"]),
	})
}

func parseDepthEntries(data interface{}) []marketdata.DepthEntry {
	arr, ok := data.([]interface{})
	if !ok {
		return nil
	}
	entries := make([]marketdata.DepthEntry, 0, len(arr))
	for _, item := range arr {
		entry, ok := item.([]interface{})
		if !ok || len(entry) < 2 {
			continue
		}
		entries = append(entries, marketdata.DepthEntry{
			Price:    core.ParseFloat(core.StringFromAny(entry[0])),
			Quantity: core.ParseFloat(core.StringFromAny(entry[1])),
		})
	}
	return entries
}

func toCoreTradeType(tt marketdata.TradeType) core.TradeType {
	switch tt {
	case marketdata.Futures:
		return core.TradeTypeFutures
	default:
		return core.TradeTypeSpot
	}
}
