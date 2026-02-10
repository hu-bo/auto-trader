package okx

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/marketdata"
	okxapi "github.com/pkg/okx-api"
	okxtypes "github.com/pkg/okx-api/types"
	okxrest "github.com/pkg/okx-api/types/rest"
	okxws "github.com/pkg/okx-api/types/websockets"
)

type WsPublicAdapterOptions struct {
	SocksProxy        string
	ReconnectInterval time.Duration
	DemoTrading       bool
	Proxy             string // HTTP proxy for REST client
}

type WsPublicAdapter struct {
	proxy string
	ctx   context.Context

	ws *okxapi.WebsocketClient

	mu         sync.Mutex
	subscribed map[string]struct{} // key: symbol:tradeType

	// Active symbols management (for SubMultiPeriodCandles)
	activeSymbolsMu sync.RWMutex
	activeSymbols   map[marketdata.TradeType][]string
	activeSymbolSet map[marketdata.TradeType]map[string]struct{}

	indexTickerMu        sync.RWMutex
	indexTickerTradeType map[string]marketdata.TradeType // key: instId(index)

	// REST client for InitSymbols
	restClient *okxapi.RestClient

	onKline      func(marketdata.Kline)
	onTrade      func(marketdata.Trade)
	onDepth      func(marketdata.DepthUpdate)
	onMiniTicker func(marketdata.MiniTicker)
	onTickerAll  func(marketdata.TickerUpdate)
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

	// Create REST client for InitSymbols
	restClient, _ := okxapi.NewRestClient(okxrest.RestClientOptions{
		Market:      okxtypes.APIMarketGLOBAL,
		DemoTrading: opts.DemoTrading,
		Proxy:       opts.Proxy,
		SocksProxy:  opts.SocksProxy,
	})

	a := &WsPublicAdapter{
		proxy:                opts.SocksProxy,
		ws:                   ws,
		subscribed:           make(map[string]struct{}),
		activeSymbols:        make(map[marketdata.TradeType][]string),
		activeSymbolSet:      make(map[marketdata.TradeType]map[string]struct{}),
		indexTickerTradeType: make(map[string]marketdata.TradeType),
		restClient:           restClient,
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

func (a *WsPublicAdapter) OnKline(handler func(marketdata.Kline))            { a.onKline = handler }
func (a *WsPublicAdapter) OnTrade(handler func(marketdata.Trade))            { a.onTrade = handler }
func (a *WsPublicAdapter) OnDepth(handler func(marketdata.DepthUpdate))      { a.onDepth = handler }
func (a *WsPublicAdapter) OnMiniTicker(handler func(marketdata.MiniTicker))  { a.onMiniTicker = handler }
func (a *WsPublicAdapter) OnTickerAll(handler func(marketdata.TickerUpdate)) { a.onTickerAll = handler }
func (a *WsPublicAdapter) OnError(handler func(error))                       { a.onError = handler }

func buildOKXPublicArgs(symbols []marketdata.SubscribeRequest) []map[string]any {
	channels := []string{"candle15m", "trades", "books"}
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
	if arg.Channel == "" {
		return
	}

	if arg.InstID == "" {
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
		tradeType = a.getIndexTickerTradeType(arg.InstID, tradeType)
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
	InstId    string `json:"instId"`
	Last      string `json:"last"`
	LastSz    string `json:"lastSz"` // 最新成交量
	Open24h   string `json:"open24h"`
	VolCcy24h string `json:"volCcy24h"`
	Ts        string `json:"ts"`
}

func (a *WsPublicAdapter) handleTickers(instID string, tradeType marketdata.TradeType, data json.RawMessage) {
	if a.onTickerAll == nil {
		return
	}

	var rows []okxWsTicker
	if err := json.Unmarshal(data, &rows); err != nil {
		return
	}

	for _, t := range rows {
		if t.InstId == "" {
			t.InstId = instID
		}
		if t.InstId == "" {
			continue
		}

		symbol := marketdata.NormalizeSymbol(marketdata.OKX, t.InstId, tradeType)
		if !a.isAllowedTickerSymbol(tradeType, symbol) {
			continue
		}
		lastPrice := core.ParseFloat(t.Last)
		if lastPrice <= 0 {
			continue
		}

		a.onTickerAll(marketdata.TickerUpdate{
			Symbol:    symbol,
			Exchange:  string(marketdata.OKX),
			TradeType: tradeType,
			LastPrice: lastPrice,
			LastSz:    core.ParseFloat(t.LastSz),
			Timestamp: core.ParseInt64(t.Ts),
		})
	}

	// Also call onMiniTicker for backward compatibility
	if a.onMiniTicker != nil {
		for _, t := range rows {
			symbol := marketdata.NormalizeSymbol(marketdata.OKX, t.InstId, tradeType)
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
}

// InitSymbols initializes active symbols by fetching tickers.
// blacklist: symbols to exclude
// volumeFilterPct: filter out symbols with volume below this percentile (0.0-1.0)
//                  e.g., 0.3 means keep top 70% by volume, filter bottom 30%
func (a *WsPublicAdapter) InitSymbols(ctx context.Context, tradeTypes []marketdata.TradeType, blacklist []string, volumeFilterPct float64) error {
	if a.restClient == nil {
		return fmt.Errorf("REST client not initialized")
	}

	blacklistSet := buildCanonicalSymbolSet(blacklist)

	for _, tt := range tradeTypes {
		var instType string
		switch tt {
		case marketdata.Spot:
			instType = "SPOT"
		case marketdata.Futures:
			instType = "SWAP"
		default:
			continue
		}

		tickers, err := a.restClient.GetTickers(ctx, instType)
		if err != nil {
			return fmt.Errorf("failed to get tickers for %s: %w", tt, err)
		}

		// Build candidate list with volume calculation
		type symbolVolume struct {
			symbol     string
			rawInstID  string
			volumeUSDT float64
		}
		candidates := make([]symbolVolume, 0, len(tickers))

		for i := range tickers {
			rawInstID := tickers[i].InstID
			if rawInstID == "" {
				continue
			}
			// Only include USDT pairs
			if !strings.Contains(rawInstID, "-USDT") {
				continue
			}
			// Convert to unified format
			symbol := marketdata.NormalizeSymbol(marketdata.OKX, rawInstID, tt)
			if inCanonicalSymbolSet(blacklistSet, rawInstID, symbol) {
				continue
			}

			// Calculate USDT volume
			// For USDT pairs, volCcy24h is already in USDT (quote currency volume)
			volCcy24h := parseFloat(tickers[i].VolCcy24h)
			volumeUSDT := volCcy24h

			candidates = append(candidates, symbolVolume{
				symbol:     symbol,
				rawInstID:  rawInstID,
				volumeUSDT: volumeUSDT * parseFloat(tickers[i].Last),
			})
		}

		// Apply volume filter if specified
		if volumeFilterPct > 0 && volumeFilterPct < 1 && len(candidates) > 0 {
			// Sort by volume descending
			sort.Slice(candidates, func(i, j int) bool {
				return candidates[i].volumeUSDT > candidates[j].volumeUSDT
			})

			// Calculate cutoff index (keep top (1-volumeFilterPct) symbols)
			keepCount := int(float64(len(candidates)) * (1.0 - volumeFilterPct))
			if keepCount < 1 {
				keepCount = 1
			}
			if keepCount > len(candidates) {
				keepCount = len(candidates)
			}

			// Filter out low volume symbols
			candidates = candidates[:keepCount]

			minVolume := 0.0
			if len(candidates) > 0 {
				minVolume = candidates[len(candidates)-1].volumeUSDT
			}

			fmt.Printf("[DEBUG] Volume filter %.0f%%: kept top %d symbols (min volume: %.2f USDT)\n",
				volumeFilterPct*100, keepCount, minVolume)
		} else if len(candidates) > 0 {
			// Always sort by volume even if no filter is applied
			sort.Slice(candidates, func(i, j int) bool {
				return candidates[i].volumeUSDT > candidates[j].volumeUSDT
			})
		}

		// Build final symbol list (keep volume order)
		activeSymbols := make([]string, 0, len(candidates))
		activeSet := make(map[string]struct{}, len(candidates))
		for _, c := range candidates {
			if _, exists := activeSet[c.symbol]; exists {
				continue
			}
			activeSet[c.symbol] = struct{}{}
			activeSymbols = append(activeSymbols, c.symbol)
		}
		// Keep volume-sorted order (already sorted by volume descending)

		fmt.Printf("[DEBUG] InitSymbols for %s: got %d tickers, filtered to %d symbols\n", tt, len(tickers), len(activeSymbols))
		if len(activeSymbols) > 0 {
			showCount := 10
			if len(activeSymbols) < showCount {
				showCount = len(activeSymbols)
			}
			fmt.Printf("[DEBUG] Top %d symbols by volume:\n", showCount)
			for i := 0; i < showCount; i++ {
				fmt.Printf("  %d. %s (%.2f USDT)\n", i+1, candidates[i].symbol, candidates[i].volumeUSDT)
			}
		}

		a.activeSymbolsMu.Lock()
		a.activeSymbols[tt] = activeSymbols
		a.activeSymbolSet[tt] = activeSet
		a.activeSymbolsMu.Unlock()
	}
	return nil
}

func parseFloat(s string) float64 {
	if s == "" {
		return 0
	}
	v, _ := strconv.ParseFloat(s, 64)
	return v
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
// OKX uses batched args subscriptions to avoid per-symbol request bursts.
func (a *WsPublicAdapter) SubMultiPeriodCandles(tradeTypes []marketdata.TradeType) error {
	args := make([]map[string]any, 0)
	seen := make(map[string]struct{})

	for _, tt := range tradeTypes {
		a.activeSymbolsMu.RLock()
		symbols := a.activeSymbols[tt]
		a.activeSymbolsMu.RUnlock()

		// Subscribe only ticker channel and send in batched args.
		for _, symbol := range symbols {
			instID := marketdata.ToExchangeSymbol(marketdata.OKX, symbol, tt)
			a.setIndexTickerTradeType(instID, tt)

			key := "tickers:" + instID
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}

			args = append(args, map[string]any{
				"channel": "tickers",
				"instId":  instID,
			})
		}
	}

	// Debug: print first few subscriptions
	if len(args) > 0 && len(args) <= 5 {
		fmt.Printf("[DEBUG] Subscribing to tickers: %+v\n", args)
	} else if len(args) > 5 {
		fmt.Printf("[DEBUG] Subscribing to %d tickers, first 5: %+v\n", len(args), args[:5])
	}

	return a.subscribeArgsInBatches(args, 100)
}

// SubSymbolTicker subscribes to ticker for a single symbol
func (a *WsPublicAdapter) SubSymbolTicker(symbol string, tradeType marketdata.TradeType) error {
	rawInstID := marketdata.ToExchangeSymbol(marketdata.OKX, symbol, tradeType)
	a.setIndexTickerTradeType(rawInstID, tradeType)

	args := []map[string]any{{
		"channel": "tickers",
		"instId":  rawInstID,
	}}
	return a.ws.Subscribe(a.ctx, args, nil)
}

func (a *WsPublicAdapter) subscribeArgsInBatches(args []map[string]any, batchSize int) error {
	if len(args) == 0 {
		return nil
	}
	if batchSize <= 0 {
		batchSize = 100
	}

	for i := 0; i < len(args); i += batchSize {
		end := i + batchSize
		if end > len(args) {
			end = len(args)
		}
		if err := a.ws.Subscribe(a.ctx, args[i:end], nil); err != nil {
			return err
		}
	}
	return nil
}

func toOKXIndexInstID(symbol string) string {
	return strings.TrimSuffix(symbol, "-SWAP")
}

func (a *WsPublicAdapter) setIndexTickerTradeType(instID string, tradeType marketdata.TradeType) {
	if instID == "" {
		return
	}
	a.indexTickerMu.Lock()
	a.indexTickerTradeType[instID] = tradeType
	a.indexTickerMu.Unlock()
}

func (a *WsPublicAdapter) getIndexTickerTradeType(instID string, fallback marketdata.TradeType) marketdata.TradeType {
	if instID == "" {
		return fallback
	}
	a.indexTickerMu.RLock()
	tt, ok := a.indexTickerTradeType[instID]
	a.indexTickerMu.RUnlock()
	if ok {
		return tt
	}
	return fallback
}

// SubSymbolDepth subscribes to depth updates for a single symbol
func (a *WsPublicAdapter) SubSymbolDepth(symbol string, tradeType marketdata.TradeType) error {
	rawInstID := marketdata.ToExchangeSymbol(marketdata.OKX, symbol, tradeType)

	args := []map[string]any{{
		"channel": "books5",
		"instId":  rawInstID,
	}}
	return a.ws.Subscribe(a.ctx, args, nil)
}

// UnsubSymbolDepth unsubscribes from depth updates for a single symbol
func (a *WsPublicAdapter) UnsubSymbolDepth(symbol string, tradeType marketdata.TradeType) error {
	rawInstID := marketdata.ToExchangeSymbol(marketdata.OKX, symbol, tradeType)

	args := []map[string]any{{
		"channel": "books5",
		"instId":  rawInstID,
	}}
	return a.ws.Unsubscribe(a.ctx, args, nil)
}

// SubKline subscribes to kline data for symbols with specified periods
// Supports 15m, 4H, 1D periods (OKX uses different format)
func (a *WsPublicAdapter) SubKline(symbols []marketdata.SubscribeRequest, periods []marketdata.Period) error {
	args := make([]map[string]any, 0)
	for _, s := range symbols {
		rawInstID := marketdata.ToExchangeSymbol(marketdata.OKX, s.Symbol, s.TradeType)

		for _, p := range periods {
			channel := okxCandleChannel(p)
			if channel == "" {
				continue
			}
			args = append(args, map[string]any{
				"channel": channel,
				"instId":  rawInstID,
			})
		}
	}
	if len(args) == 0 {
		return nil
	}
	return a.ws.Subscribe(a.ctx, args, nil)
}

// UnsubKline unsubscribes from kline data for symbols with specified periods
func (a *WsPublicAdapter) UnsubKline(symbols []marketdata.SubscribeRequest, periods []marketdata.Period) error {
	args := make([]map[string]any, 0)
	for _, s := range symbols {
		rawInstID := marketdata.ToExchangeSymbol(marketdata.OKX, s.Symbol, s.TradeType)

		for _, p := range periods {
			channel := okxCandleChannel(p)
			if channel == "" {
				continue
			}
			args = append(args, map[string]any{
				"channel": channel,
				"instId":  rawInstID,
			})
		}
	}
	if len(args) == 0 {
		return nil
	}
	return a.ws.Unsubscribe(a.ctx, args, nil)
}

// okxCandleChannel converts marketdata.Period to OKX candle channel name
func okxCandleChannel(p marketdata.Period) string {
	switch p {
	case marketdata.Period15m:
		return "candle15m"
	case marketdata.Period4h:
		return "candle4H"
	case marketdata.Period1d:
		return "candle1D"
	default:
		return ""
	}
}
