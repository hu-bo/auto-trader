package binance

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	binanceapi "github.com/pkg/binance-api"
	binancetypes "github.com/pkg/binance-api/types"
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

	// REST client options for InitSymbols
	APIKey    string
	APISecret string
	Proxy     string
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

	spotTickerAll    atomic.Bool
	futuresTickerAll atomic.Bool

	// Active symbols management (for SubMultiPeriodCandles)
	activeSymbolsMu sync.RWMutex
	activeSymbols   map[marketdata.TradeType][]string
	activeSymbolSet map[marketdata.TradeType]map[string]struct{}

	// REST clients for InitSymbols
	spotClient    *binanceapi.MainClient
	futuresClient *binanceapi.USDMClient

	onKline      func(marketdata.Kline)
	onTrade      func(marketdata.Trade)
	onDepth      func(marketdata.DepthUpdate)
	onMiniTicker func(marketdata.MiniTicker)
	onTickerAll  func(marketdata.TickerUpdate)
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

	a := &WsPublicAdapter{
		proxy:             opts.SocksProxy,
		testnet:           opts.Testnet,
		heartbeatInterval: heartbeat,
		reconnectInterval: reconnect,
		subAggTrades:      opts.SubscribeAggTrades,
		conns:             make(map[marketdata.TradeType]*binancePublicConn),
		subscribed:        make(map[string]struct{}),
		activeSymbols:     make(map[marketdata.TradeType][]string),
		activeSymbolSet:   make(map[marketdata.TradeType]map[string]struct{}),
	}

	// Initialize REST clients
	proxy := opts.Proxy
	if proxy == "" {
		proxy = opts.SocksProxy
	}
	a.spotClient = binanceapi.NewMainClient(binanceapi.MainClientOptions{
		APIKey:    opts.APIKey,
		APISecret: opts.APISecret,
		Testnet:   opts.Testnet,
		Proxy:     proxy,
	})
	a.futuresClient = binanceapi.NewUSDMClient(binanceapi.USDMClientOptions{
		APIKey:    opts.APIKey,
		APISecret: opts.APISecret,
		Testnet:   opts.Testnet,
		Proxy:     proxy,
	})

	return a
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

		topics := make([]string, 0, len(batch)*3)
		for _, raw := range batch {
			rawLower := strings.ToLower(raw)
			topics = append(topics, rawLower+"@kline_15m", rawLower+"@depth")
			if a.subAggTrades {
				topics = append(topics, rawLower+"@aggTrade")
			}
		}
		if err := conn.ws.Subscribe(conn.wsKey, topics...); err != nil {
			return err
		}

		// Add delay between batches to respect rate limits
		if end < len(rawSymbols) {
			time.Sleep(batchDelay)
		}
	}

	if tradeType == marketdata.Futures && a.futuresTickerAll.Load() {
		_ = conn.ws.Subscribe(conn.wsKey, "!ticker@arr")
	}
	if tradeType == marketdata.Spot && a.spotTickerAll.Load() {
		_ = conn.ws.Subscribe(conn.wsKey, "!ticker@arr")
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

// SubFuturesTicker subscribes Binance futures `!ticker@arr` (24hrTicker).
func (a *WsPublicAdapter) SubFuturesTicker() error {
	a.futuresTickerAll.Store(true)
	conn, err := a.ensureConn(marketdata.Futures)
	if err != nil {
		return err
	}
	return conn.ws.Subscribe(conn.wsKey, "!ticker@arr")
}

// SubSpotTicker subscribes Binance spot `!ticker@arr` (24hrTicker).
func (a *WsPublicAdapter) SubSpotTicker() error {
	a.spotTickerAll.Store(true)
	conn, err := a.ensureConn(marketdata.Spot)
	if err != nil {
		return err
	}
	return conn.ws.Subscribe(conn.wsKey, "!ticker@arr")
}

func (a *WsPublicAdapter) subTickersByTradeTypes(tradeTypes []marketdata.TradeType) error {
	for _, tt := range tradeTypes {
		switch tt {
		case marketdata.Spot:
			if err := a.SubSpotTicker(); err != nil {
				return err
			}
		case marketdata.Futures:
			if err := a.SubFuturesTicker(); err != nil {
				return err
			}
		}
	}
	return nil
}

func (a *WsPublicAdapter) OnKline(handler func(marketdata.Kline))            { a.onKline = handler }
func (a *WsPublicAdapter) OnTrade(handler func(marketdata.Trade))            { a.onTrade = handler }
func (a *WsPublicAdapter) OnDepth(handler func(marketdata.DepthUpdate))      { a.onDepth = handler }
func (a *WsPublicAdapter) OnMiniTicker(handler func(marketdata.MiniTicker))  { a.onMiniTicker = handler }
func (a *WsPublicAdapter) OnTickerAll(handler func(marketdata.TickerUpdate)) { a.onTickerAll = handler }
func (a *WsPublicAdapter) OnError(handler func(error))                       { a.onError = handler }

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

	if err := a.connectWithRetry(ws, wsKey); err != nil {
		return nil, err
	}

	a.conns[tradeType] = conn

	go a.reconnectLoop(conn)
	return conn, nil
}

func (a *WsPublicAdapter) connectWithRetry(ws *binanceapi.WebsocketClient, wsKey bws.WsKey) error {
	const maxAttempts = 3
	delay := a.reconnectInterval
	if delay <= 0 {
		delay = 2 * time.Second
	}
	if delay > 10*time.Second {
		delay = 10 * time.Second
	}

	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if err := ws.Connect(wsKey); err == nil {
			return nil
		} else {
			lastErr = err
		}

		if a.ctx != nil {
			select {
			case <-a.ctx.Done():
				return a.ctx.Err()
			default:
			}
		}

		if attempt < maxAttempts {
			time.Sleep(delay)
			if delay < 10*time.Second {
				delay *= 2
				if delay > 10*time.Second {
					delay = 10 * time.Second
				}
			}
		}
	}
	return lastErr
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

		topics := make([]string, 0, len(batch)*3)
		for _, raw := range batch {
			rawLower := strings.ToLower(raw)
			topics = append(topics, rawLower+"@kline_15m", rawLower+"@depth")
			if a.subAggTrades {
				topics = append(topics, rawLower+"@aggTrade")
			}
		}
		_ = conn.ws.Subscribe(conn.wsKey, topics...)

		if end < len(rawSymbols) {
			time.Sleep(batchDelay)
		}
	}

	if tradeType == marketdata.Futures && a.futuresTickerAll.Load() {
		_ = conn.ws.Subscribe(conn.wsKey, "!ticker@arr")
	}
	if tradeType == marketdata.Spot && a.spotTickerAll.Load() {
		_ = conn.ws.Subscribe(conn.wsKey, "!ticker@arr")
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

	// 24hrTicker (spot !ticker@arr)
	conn.ws.OnMessage("24hrTicker", func(event interface{}) {
		if a.onTickerAll == nil {
			return
		}
		switch v := event.(type) {
		case []interface{}:
			for _, item := range v {
				if msg, ok := item.(map[string]interface{}); ok {
					a.handle24hrTicker(msg, tradeType)
				}
			}
		case map[string]interface{}:
			a.handle24hrTicker(v, tradeType)
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

// handle24hrTicker 处理 24hrTicker (spot !ticker@arr)
// 字段: E=事件时间, s=交易对, c=最新价, Q=最新成交量, p=价格变化, P=价格变化百分比
// h=24h最高价, l=24h最低价, v=24h成交量, q=24h成交额
func (a *WsPublicAdapter) handle24hrTicker(msg map[string]interface{}, tradeType marketdata.TradeType) {
	rawSymbol, _ := msg["s"].(string)
	symbol := marketdata.NormalizeSymbol(marketdata.Binance, rawSymbol, tradeType)
	if !a.isAllowedTickerSymbol(tradeType, symbol) {
		return
	}

	lastStr, _ := msg["c"].(string)
	lastSzStr, _ := msg["Q"].(string)
	priceChangeStr, _ := msg["p"].(string)
	priceChangePctStr, _ := msg["P"].(string)
	high24hStr, _ := msg["h"].(string)
	low24hStr, _ := msg["l"].(string)
	volume24hStr, _ := msg["v"].(string)
	quoteVolume24hStr, _ := msg["q"].(string)
	eventTimeMs := core.Int64FromAny(msg["E"])

	a.onTickerAll(marketdata.TickerUpdate{
		Symbol:         symbol,
		Exchange:       string(marketdata.Binance),
		TradeType:      tradeType,
		LastPrice:      core.ParseFloat(lastStr),
		LastSz:         core.ParseFloat(lastSzStr),
		PriceChange:    core.ParseFloat(priceChangeStr),
		PriceChangePct: core.ParseFloat(priceChangePctStr),
		High24h:        core.ParseFloat(high24hStr),
		Low24h:         core.ParseFloat(low24hStr),
		Volume24h:      core.ParseFloat(volume24hStr),
		QuoteVolume24h: core.ParseFloat(quoteVolume24hStr),
		Timestamp:      eventTimeMs,
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

// InitSymbols initializes active symbols by fetching 24hr tickers and filtering by volume
// blacklist: symbols to exclude
// volumeFilterPct: percentage of low-volume symbols to exclude (e.g., 0.3 = bottom 30%)
func (a *WsPublicAdapter) InitSymbols(ctx context.Context, tradeTypes []marketdata.TradeType, blacklist []string, volumeFilterPct float64) error {
	blacklistSet := buildCanonicalSymbolSet(blacklist)

	for _, tt := range tradeTypes {
		var tickers []binancetypes.ChangeStats24hr
		var err error

		switch tt {
		case marketdata.Spot:
			tickers, err = a.spotClient.GetAll24hrTickers(ctx)
		case marketdata.Futures:
			tickers, err = a.futuresClient.GetAll24hrTickers(ctx)
		default:
			continue
		}
		if err != nil {
			return fmt.Errorf("failed to get 24hr tickers for %s: %w", tt, err)
		}

		fmt.Printf("[binance] InitSymbols: tradeType=%s, totalTickers=%d, volumeFilterPct=%.2f\n", tt, len(tickers), volumeFilterPct)

		// Sort by quoteVolume descending
		sort.Slice(tickers, func(i, j int) bool {
			vi := core.ParseFloat(tickers[i].QuoteVolume)
			vj := core.ParseFloat(tickers[j].QuoteVolume)
			return vi > vj
		})

		// Take top (1 - volumeFilterPct) symbols
		cutoff := int(float64(len(tickers)) * (1 - volumeFilterPct))
		if cutoff <= 0 {
			cutoff = len(tickers)
		}

		fmt.Printf("[binance] InitSymbols: cutoff=%d (top %.0f%%)\n", cutoff, (1-volumeFilterPct)*100)

		activeSymbols := make([]string, 0, cutoff)
		activeSet := make(map[string]struct{}, cutoff)
		for i := 0; i < cutoff && i < len(tickers); i++ {
			rawSymbol := tickers[i].Symbol
			// Only include USDT pairs
			if !strings.HasSuffix(rawSymbol, "USDT") {
				continue
			}
			// Convert to unified format
			symbol := rawToUnifiedSymbol(rawSymbol, toCoreTradeType(tt))
			if inCanonicalSymbolSet(blacklistSet, rawSymbol, symbol) {
				continue
			}
			if _, exists := activeSet[symbol]; exists {
				continue
			}
			activeSet[symbol] = struct{}{}
			activeSymbols = append(activeSymbols, symbol)
		}

		fmt.Printf("[binance] InitSymbols: activeSymbols=%d (USDT pairs only)\n", len(activeSymbols))

		a.activeSymbolsMu.Lock()
		a.activeSymbols[tt] = activeSymbols
		a.activeSymbolSet[tt] = activeSet
		a.activeSymbolsMu.Unlock()
	}
	return nil
}

func (a *WsPublicAdapter) isAllowedTickerSymbol(tradeType marketdata.TradeType, symbol string) bool {
	a.activeSymbolsMu.RLock()
	set := a.activeSymbolSet[tradeType]
	a.activeSymbolsMu.RUnlock()
	if len(set) == 0 {
		return true
	}
	_, ok := set[symbol]
	return ok
}

func buildCanonicalSymbolSet(symbols []string) map[string]struct{} {
	set := make(map[string]struct{}, len(symbols))
	for _, symbol := range symbols {
		key := canonicalSymbolKey(symbol)
		if key == "" {
			continue
		}
		set[key] = struct{}{}
	}
	return set
}

func inCanonicalSymbolSet(set map[string]struct{}, candidates ...string) bool {
	for _, candidate := range candidates {
		key := canonicalSymbolKey(candidate)
		if key == "" {
			continue
		}
		if _, ok := set[key]; ok {
			return true
		}
	}
	return false
}

func canonicalSymbolKey(symbol string) string {
	s := strings.ToUpper(strings.TrimSpace(symbol))
	if s == "" {
		return ""
	}
	s = strings.TrimSuffix(s, "-SWAP")
	s = strings.TrimSuffix(s, "_SWAP")
	s = strings.ReplaceAll(s, "-", "")
	s = strings.ReplaceAll(s, "_", "")
	return s
}

// GetActiveSymbols returns the list of active symbols for a trade type
func (a *WsPublicAdapter) GetActiveSymbols(tradeType marketdata.TradeType) []string {
	a.activeSymbolsMu.RLock()
	defer a.activeSymbolsMu.RUnlock()
	symbols := a.activeSymbols[tradeType]
	result := make([]string, len(symbols))
	copy(result, symbols)
	return result
}

// SubMultiPeriodCandles subscribes only ticker streams used to aggregate 15m/4h/1d candles.
// It intentionally does not subscribe depth to reduce subscription pressure.
func (a *WsPublicAdapter) SubMultiPeriodCandles(tradeTypes []marketdata.TradeType) error {
	return a.subTickersByTradeTypes(tradeTypes)
}

// SubSymbolDepth subscribes to depth updates for a single symbol
func (a *WsPublicAdapter) SubSymbolDepth(symbol string, tradeType marketdata.TradeType) error {
	conn, err := a.ensureConn(tradeType)
	if err != nil {
		return err
	}
	rawSymbol := unifiedToRawSymbol(symbol, toCoreTradeType(tradeType))
	rawLower := strings.ToLower(rawSymbol)
	return conn.ws.Subscribe(conn.wsKey, rawLower+"@depth")
}

// UnsubSymbolDepth unsubscribes from depth updates for a single symbol
func (a *WsPublicAdapter) UnsubSymbolDepth(symbol string, tradeType marketdata.TradeType) error {
	a.mu.Lock()
	conn := a.conns[tradeType]
	a.mu.Unlock()

	if conn == nil || conn.ws == nil || !conn.ws.IsConnected(conn.wsKey) {
		return nil
	}

	rawSymbol := unifiedToRawSymbol(symbol, toCoreTradeType(tradeType))
	rawLower := strings.ToLower(rawSymbol)
	return conn.ws.Unsubscribe(conn.wsKey, rawLower+"@depth")
}

// SubKline subscribes to kline data for symbols with specified periods
// Supports 15m, 4h, 1d periods
func (a *WsPublicAdapter) SubKline(symbols []marketdata.SubscribeRequest, periods []marketdata.Period) error {
	spotSymbols := make([]string, 0)
	futuresSymbols := make([]string, 0)

	for _, s := range symbols {
		raw := unifiedToRawSymbol(s.Symbol, toCoreTradeType(s.TradeType))
		if s.TradeType == marketdata.Futures {
			futuresSymbols = append(futuresSymbols, raw)
		} else {
			spotSymbols = append(spotSymbols, raw)
		}
	}

	// Build topics for each period
	buildTopics := func(rawSymbols []string) []string {
		topics := make([]string, 0, len(rawSymbols)*len(periods))
		for _, raw := range rawSymbols {
			rawLower := strings.ToLower(raw)
			for _, p := range periods {
				topics = append(topics, rawLower+"@kline_"+string(p))
			}
		}
		return topics
	}

	if len(spotSymbols) > 0 {
		conn, err := a.ensureConn(marketdata.Spot)
		if err != nil {
			return err
		}
		topics := buildTopics(spotSymbols)
		if err := conn.ws.Subscribe(conn.wsKey, topics...); err != nil {
			return err
		}
	}

	if len(futuresSymbols) > 0 {
		conn, err := a.ensureConn(marketdata.Futures)
		if err != nil {
			return err
		}
		topics := buildTopics(futuresSymbols)
		if err := conn.ws.Subscribe(conn.wsKey, topics...); err != nil {
			return err
		}
	}

	return nil
}

// UnsubKline unsubscribes from kline data for symbols with specified periods
func (a *WsPublicAdapter) UnsubKline(symbols []marketdata.SubscribeRequest, periods []marketdata.Period) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, s := range symbols {
		conn := a.conns[s.TradeType]
		if conn == nil || conn.ws == nil || !conn.ws.IsConnected(conn.wsKey) {
			continue
		}

		raw := unifiedToRawSymbol(s.Symbol, toCoreTradeType(s.TradeType))
		rawLower := strings.ToLower(raw)

		topics := make([]string, 0, len(periods))
		for _, p := range periods {
			topics = append(topics, rawLower+"@kline_"+string(p))
		}

		_ = conn.ws.Unsubscribe(conn.wsKey, topics...)
	}
	return nil
}

// helper to check if slice contains string
func containsString(slice []string, s string) bool {
	for _, v := range slice {
		if strings.EqualFold(v, s) {
			return true
		}
	}
	return false
}
