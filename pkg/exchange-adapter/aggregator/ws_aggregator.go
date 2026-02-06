package aggregator

import (
	"sync"

	md "github.com/pkg/exchange-adapter/marketdata"
)

const (
	defaultOrderBookThresholdUSD = 5000
	defaultOrderBookExpireHours  = 48
)

// Candle15mEvent combines real-time candle updates and period-close events.
type Candle15mEvent struct {
	Candle md.NormalizedCandle
	Closed bool
}

// OrderBookEvent carries orderbook updates with trade type context.
type OrderBookEvent struct {
	Exchange  md.ExchangeName
	TradeType md.TradeType
	OrderBook md.OrderBook
}

// WSAggregatorOptions configures orderbook filtering behavior.
type WSAggregatorOptions struct {
	BigOrderThresholdUSD float64
	BigOrderExpireHours  int
}

// WSAggregator manages kline/trade/depth aggregation and exposes high-level subscriptions.
type WSAggregator struct {
	client   md.Exchange
	exchange md.ExchangeName

	aggMu         sync.RWMutex
	aggregators   map[md.TradeType]*PeriodAggregator
	orderBookMgrs map[md.TradeType]*OrderBookManager

	subMu          sync.RWMutex
	subscribed     map[string]struct{}
	candleSubs     map[string]struct{}
	orderBookSubs  map[string]struct{}
	miniTickerSubs map[string]struct{}

	handlerMu         sync.RWMutex
	candleHandler     func(Candle15mEvent)
	orderBookHandler  func(OrderBookEvent)
	miniTickerHandler func(md.MiniTicker)
	errorHandler      func(error)

	bigOrderThresholdUSD float64
	bigOrderExpireHours  int

	miniTickerMu             sync.Mutex
	futuresMiniTickerEnabled bool
}

type futuresMiniTickerSubscriber interface {
	SubFuturesMiniTicker() error
}

func NewWSAggregator(client md.Exchange, opts WSAggregatorOptions) *WSAggregator {
	threshold := opts.BigOrderThresholdUSD
	if threshold <= 0 {
		threshold = defaultOrderBookThresholdUSD
	}
	expireHours := opts.BigOrderExpireHours
	if expireHours <= 0 {
		expireHours = defaultOrderBookExpireHours
	}

	a := &WSAggregator{
		client:               client,
		exchange:             client.Name(),
		aggregators:          make(map[md.TradeType]*PeriodAggregator),
		orderBookMgrs:        make(map[md.TradeType]*OrderBookManager),
		subscribed:           make(map[string]struct{}),
		candleSubs:           make(map[string]struct{}),
		orderBookSubs:        make(map[string]struct{}),
		miniTickerSubs:       make(map[string]struct{}),
		bigOrderThresholdUSD: threshold,
		bigOrderExpireHours:  expireHours,
	}
	a.bindCallbacks()
	return a
}

func (a *WSAggregator) SubCandle15m(symbols []md.SubscribeRequest, handler func(Candle15mEvent)) error {
	if handler != nil {
		a.handlerMu.Lock()
		a.candleHandler = handler
		a.handlerMu.Unlock()
	}
	return a.subscribeForChannel(symbols, a.candleSubs)
}

func (a *WSAggregator) SubOrderbooks(symbols []md.SubscribeRequest, handler func(OrderBookEvent)) error {
	if handler != nil {
		a.handlerMu.Lock()
		a.orderBookHandler = handler
		a.handlerMu.Unlock()
	}
	return a.subscribeForChannel(symbols, a.orderBookSubs)
}

func (a *WSAggregator) SubMiniTicker(symbols []md.SubscribeRequest, handler func(md.MiniTicker)) error {
	if handler != nil {
		a.handlerMu.Lock()
		a.miniTickerHandler = handler
		a.handlerMu.Unlock()
	}

	if err := a.subscribeForChannel(symbols, a.miniTickerSubs); err != nil {
		return err
	}
	return a.ensureFuturesMiniTicker(symbols)
}

func (a *WSAggregator) OnError(handler func(error)) {
	a.handlerMu.Lock()
	a.errorHandler = handler
	a.handlerMu.Unlock()
}

func (a *WSAggregator) Unsubscribe(symbols []string) error {
	a.subMu.Lock()
	for _, symbol := range symbols {
		for _, tt := range []md.TradeType{md.Spot, md.Futures} {
			key := streamSubKey(symbol, tt)
			delete(a.subscribed, key)
			delete(a.candleSubs, key)
			delete(a.orderBookSubs, key)
			delete(a.miniTickerSubs, key)
		}
	}
	a.subMu.Unlock()

	return a.client.Unsubscribe(symbols)
}

func (a *WSAggregator) GetCurrentCandle(tradeType md.TradeType, symbol string, period md.Period) *md.NormalizedCandle {
	a.aggMu.RLock()
	agg, ok := a.aggregators[tradeType]
	a.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return agg.GetCurrentCandle(symbol, period)
}

func (a *WSAggregator) GetOrderBook(tradeType md.TradeType, symbol string) *md.OrderBook {
	a.aggMu.RLock()
	mgr, ok := a.orderBookMgrs[tradeType]
	a.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return mgr.GetOrderBook(symbol)
}

func (a *WSAggregator) GetFilteredOrderBook(tradeType md.TradeType, symbol string, priceRange float64) *md.OrderBook {
	a.aggMu.RLock()
	mgr, ok := a.orderBookMgrs[tradeType]
	a.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return mgr.GetFilteredBook(symbol, priceRange)
}

func (a *WSAggregator) GetTracePrice(tradeType md.TradeType, symbol string, distance float64) *TracePriceResult {
	a.aggMu.RLock()
	mgr, ok := a.orderBookMgrs[tradeType]
	a.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return mgr.GetTracePrice(symbol, distance)
}

func (a *WSAggregator) Close() {
	a.aggMu.Lock()
	aggregators := make([]*PeriodAggregator, 0, len(a.aggregators))
	for _, agg := range a.aggregators {
		aggregators = append(aggregators, agg)
	}
	a.aggregators = make(map[md.TradeType]*PeriodAggregator)

	managers := make([]*OrderBookManager, 0, len(a.orderBookMgrs))
	for _, mgr := range a.orderBookMgrs {
		managers = append(managers, mgr)
	}
	a.orderBookMgrs = make(map[md.TradeType]*OrderBookManager)
	a.aggMu.Unlock()

	for _, agg := range aggregators {
		agg.Close()
	}
	for _, mgr := range managers {
		mgr.Close()
	}
}

func (a *WSAggregator) bindCallbacks() {
	a.client.OnKline(func(kline md.Kline) {
		if !a.isSubscribedTo(a.candleSubs, kline.Symbol, kline.TradeType) {
			return
		}
		agg := a.getOrCreateAggregator(kline.TradeType)
		agg.ProcessKline(kline)
	})

	a.client.OnTrade(func(trade md.Trade) {
		if !a.isSubscribedTo(a.candleSubs, trade.Symbol, trade.TradeType) {
			return
		}
		agg := a.getOrCreateAggregator(trade.TradeType)
		agg.ProcessTrade(trade)
	})

	a.client.OnDepth(func(depth md.DepthUpdate) {
		if !a.isSubscribedTo(a.orderBookSubs, depth.Symbol, depth.TradeType) {
			return
		}
		mgr := a.getOrCreateOrderBookManager(depth.TradeType)
		mgr.ProcessDepth(depth)
	})

	a.client.OnMiniTicker(func(ticker md.MiniTicker) {
		if !a.isSubscribedTo(a.miniTickerSubs, ticker.Symbol, ticker.TradeType) {
			return
		}
		a.emitMiniTicker(ticker)
	})

	a.client.OnError(func(err error) {
		a.emitError(err)
	})
}

func (a *WSAggregator) subscribeForChannel(symbols []md.SubscribeRequest, channelSubs map[string]struct{}) error {
	if len(symbols) == 0 {
		return nil
	}

	newSymbols := make([]md.SubscribeRequest, 0, len(symbols))
	newKeys := make([]string, 0, len(symbols))
	a.subMu.Lock()
	for _, symbol := range symbols {
		key := streamSubKey(symbol.Symbol, symbol.TradeType)
		channelSubs[key] = struct{}{}
		if _, ok := a.subscribed[key]; ok {
			continue
		}
		a.subscribed[key] = struct{}{}
		newSymbols = append(newSymbols, symbol)
		newKeys = append(newKeys, key)
	}
	a.subMu.Unlock()

	if len(newSymbols) == 0 {
		return nil
	}

	if err := a.client.Subscribe(newSymbols); err != nil {
		a.subMu.Lock()
		for _, key := range newKeys {
			delete(a.subscribed, key)
		}
		a.subMu.Unlock()
		return err
	}

	return nil
}

func (a *WSAggregator) ensureFuturesMiniTicker(symbols []md.SubscribeRequest) error {
	if a.exchange != md.Binance {
		return nil
	}

	hasFutures := false
	for _, symbol := range symbols {
		if symbol.TradeType == md.Futures {
			hasFutures = true
			break
		}
	}
	if !hasFutures {
		return nil
	}

	subscriber, ok := a.client.(futuresMiniTickerSubscriber)
	if !ok {
		return nil
	}

	a.miniTickerMu.Lock()
	defer a.miniTickerMu.Unlock()
	if a.futuresMiniTickerEnabled {
		return nil
	}
	if err := subscriber.SubFuturesMiniTicker(); err != nil {
		return err
	}
	a.futuresMiniTickerEnabled = true
	return nil
}

func (a *WSAggregator) getOrCreateAggregator(tradeType md.TradeType) *PeriodAggregator {
	a.aggMu.RLock()
	agg, ok := a.aggregators[tradeType]
	a.aggMu.RUnlock()
	if ok {
		return agg
	}

	a.aggMu.Lock()
	defer a.aggMu.Unlock()
	if agg, ok = a.aggregators[tradeType]; ok {
		return agg
	}

	cfg := DefaultMultiPeriodConfig(string(a.exchange))
	switch a.exchange {
	case md.Binance:
		cfg = BinanceMultiPeriodConfig()
	case md.OKX:
		cfg = OKXMultiPeriodConfig()
	}

	agg = NewMultiPeriodAggregator(cfg)
	agg.OnPeriodComplete(func(candle md.NormalizedCandle) {
		a.emitCandle(candle, true)
	})
	agg.OnUpdate(func(candle md.NormalizedCandle) {
		a.emitCandle(candle, false)
	})
	a.aggregators[tradeType] = agg
	return agg
}

func (a *WSAggregator) getOrCreateOrderBookManager(tradeType md.TradeType) *OrderBookManager {
	a.aggMu.RLock()
	mgr, ok := a.orderBookMgrs[tradeType]
	a.aggMu.RUnlock()
	if ok {
		return mgr
	}

	a.aggMu.Lock()
	defer a.aggMu.Unlock()
	if mgr, ok = a.orderBookMgrs[tradeType]; ok {
		return mgr
	}

	mgr = NewOrderBookManager(a.bigOrderThresholdUSD, a.bigOrderExpireHours)
	mgr.OnUpdate(func(ob md.OrderBook) {
		a.emitOrderBook(tradeType, ob)
	})
	a.orderBookMgrs[tradeType] = mgr
	return mgr
}

func (a *WSAggregator) emitCandle(candle md.NormalizedCandle, closed bool) {
	if !a.isSubscribedTo(a.candleSubs, candle.Symbol, md.TradeType(candle.TradeType)) {
		return
	}

	a.handlerMu.RLock()
	handler := a.candleHandler
	a.handlerMu.RUnlock()
	if handler != nil {
		handler(Candle15mEvent{Candle: candle, Closed: closed})
	}
}

func (a *WSAggregator) emitOrderBook(tradeType md.TradeType, book md.OrderBook) {
	if !a.isSubscribedTo(a.orderBookSubs, book.Symbol, tradeType) {
		return
	}

	a.handlerMu.RLock()
	handler := a.orderBookHandler
	a.handlerMu.RUnlock()
	if handler != nil {
		handler(OrderBookEvent{Exchange: a.exchange, TradeType: tradeType, OrderBook: book})
	}
}

func (a *WSAggregator) emitMiniTicker(ticker md.MiniTicker) {
	a.handlerMu.RLock()
	handler := a.miniTickerHandler
	a.handlerMu.RUnlock()
	if handler != nil {
		handler(ticker)
	}
}

func (a *WSAggregator) emitError(err error) {
	a.handlerMu.RLock()
	handler := a.errorHandler
	a.handlerMu.RUnlock()
	if handler != nil {
		handler(err)
	}
}

func (a *WSAggregator) isSubscribedTo(channelSubs map[string]struct{}, symbol string, tradeType md.TradeType) bool {
	key := streamSubKey(symbol, tradeType)
	a.subMu.RLock()
	_, ok := channelSubs[key]
	a.subMu.RUnlock()
	return ok
}

func streamSubKey(symbol string, tradeType md.TradeType) string {
	return symbol + ":" + string(tradeType)
}
