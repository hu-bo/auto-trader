package aggregator

import (
	"context"
	"testing"
	"time"

	md "github.com/pkg/exchange-adapter/marketdata"
)

type fakeExchange struct {
	name md.ExchangeName

	onKline      func(md.Kline)
	onTrade      func(md.Trade)
	onDepth      func(md.DepthUpdate)
	onMiniTicker func(md.MiniTicker)
	onTickerAll  func(md.TickerUpdate)
	onError      func(error)

	subscribeCalls [][]md.SubscribeRequest
	unsubscribeAll [][]string
	activeSymbols  map[md.TradeType][]string

	subFuturesTickerCalls int
	subMultiPeriodCalls   int
}

func (f *fakeExchange) Name() md.ExchangeName { return f.name }
func (f *fakeExchange) Connect(ctx context.Context) error {
	_ = ctx
	return nil
}
func (f *fakeExchange) Subscribe(symbols []md.SubscribeRequest) error {
	copied := make([]md.SubscribeRequest, len(symbols))
	copy(copied, symbols)
	f.subscribeCalls = append(f.subscribeCalls, copied)
	return nil
}
func (f *fakeExchange) Unsubscribe(symbols []string) error {
	copied := make([]string, len(symbols))
	copy(copied, symbols)
	f.unsubscribeAll = append(f.unsubscribeAll, copied)
	return nil
}
func (f *fakeExchange) Close() error { return nil }
func (f *fakeExchange) OnKline(handler func(md.Kline)) {
	f.onKline = handler
}
func (f *fakeExchange) OnTrade(handler func(md.Trade)) {
	f.onTrade = handler
}
func (f *fakeExchange) OnDepth(handler func(md.DepthUpdate)) {
	f.onDepth = handler
}
func (f *fakeExchange) OnMiniTicker(handler func(md.MiniTicker)) {
	f.onMiniTicker = handler
}
func (f *fakeExchange) OnTickerAll(handler func(md.TickerUpdate)) {
	f.onTickerAll = handler
}
func (f *fakeExchange) OnError(handler func(error)) {
	f.onError = handler
}
func (f *fakeExchange) SubFuturesTicker() error {
	f.subFuturesTickerCalls++
	return nil
}
func (f *fakeExchange) SubMultiPeriodCandles(tradeTypes []md.TradeType) error {
	_ = tradeTypes
	f.subMultiPeriodCalls++
	return nil
}
func (f *fakeExchange) GetActiveSymbols(tradeType md.TradeType) []string {
	symbols := f.activeSymbols[tradeType]
	out := make([]string, len(symbols))
	copy(out, symbols)
	return out
}

func TestWSAggregator_SubscribeAndDispatch(t *testing.T) {
	client := &fakeExchange{name: md.Binance}
	hub := NewWSAggregator(client, WSAggregatorOptions{})
	defer hub.Close()

	var candleEvents []Candle15mEvent
	var orderbookEvents []OrderBookEvent
	var miniTickers []md.MiniTicker

	symbols := []md.SubscribeRequest{{Symbol: "BTC-USDT", TradeType: md.Spot}}
	if err := hub.SubCandle15m(symbols, func(event Candle15mEvent) {
		candleEvents = append(candleEvents, event)
	}); err != nil {
		t.Fatalf("sub candle failed: %v", err)
	}
	if err := hub.SubOrderbooks(symbols, func(event OrderBookEvent) {
		orderbookEvents = append(orderbookEvents, event)
	}); err != nil {
		t.Fatalf("sub orderbooks failed: %v", err)
	}
	if err := hub.SubMiniTicker(symbols, func(ticker md.MiniTicker) {
		miniTickers = append(miniTickers, ticker)
	}); err != nil {
		t.Fatalf("sub mini ticker failed: %v", err)
	}

	if got := len(client.subscribeCalls); got != 1 {
		t.Fatalf("expected 1 subscribe call, got %d", got)
	}

	baseTime := int64(1609459200000)
	client.onKline(md.Kline{
		Symbol: "BTC-USDT", Exchange: "binance", TradeType: md.Spot,
		Period: md.Period15m, Timestamp: baseTime,
		Open: 100, High: 110, Low: 95, Close: 105, Volume: 1000, BuyVolume: 600, Closed: true,
	})
	client.onKline(md.Kline{
		Symbol: "BTC-USDT", Exchange: "binance", TradeType: md.Spot,
		Period: md.Period15m, Timestamp: baseTime + 15*60*1000,
		Open: 105, High: 115, Low: 102, Close: 112, Volume: 900, BuyVolume: 500, Closed: true,
	})

	if !waitUntil(time.Second, func() bool {
		for _, event := range candleEvents {
			if event.Closed && event.Candle.Period == string(md.Period15m) {
				return true
			}
		}
		return false
	}) {
		t.Fatalf("expected at least one closed 15m candle event, got %+v", candleEvents)
	}

	client.onDepth(md.DepthUpdate{
		Symbol: "BTC-USDT", Exchange: "binance", TradeType: md.Spot, Timestamp: baseTime,
		Bids: []md.DepthEntry{{Price: 100, Quantity: 100}},
		Asks: []md.DepthEntry{{Price: 101, Quantity: 100}},
	})
	if len(orderbookEvents) != 1 {
		t.Fatalf("expected 1 orderbook event, got %d", len(orderbookEvents))
	}
	if orderbookEvents[0].TradeType != md.Spot {
		t.Fatalf("expected trade type spot, got %s", orderbookEvents[0].TradeType)
	}

	ticker := md.MiniTicker{Symbol: "BTC-USDT", Exchange: "binance", TradeType: md.Spot}
	client.onMiniTicker(ticker)
	if len(miniTickers) != 1 {
		t.Fatalf("expected 1 mini ticker event, got %d", len(miniTickers))
	}
}

func waitUntil(timeout time.Duration, cond func() bool) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return cond()
}

func TestWSAggregator_BinanceMiniTickerAndDedup(t *testing.T) {
	client := &fakeExchange{name: md.Binance}
	hub := NewWSAggregator(client, WSAggregatorOptions{})
	defer hub.Close()

	symbols := []md.SubscribeRequest{{Symbol: "BTC-USDT", TradeType: md.Futures}}
	if err := hub.SubMiniTicker(symbols, func(md.MiniTicker) {}); err != nil {
		t.Fatalf("sub mini ticker failed: %v", err)
	}
	if err := hub.SubMiniTicker(symbols, nil); err != nil {
		t.Fatalf("repeat sub mini ticker failed: %v", err)
	}
	if err := hub.SubCandle15m(symbols, func(Candle15mEvent) {}); err != nil {
		t.Fatalf("sub candle failed: %v", err)
	}

	if got := len(client.subscribeCalls); got != 1 {
		t.Fatalf("expected deduped subscribe call count 1, got %d", got)
	}
	if got := client.subFuturesTickerCalls; got != 1 {
		t.Fatalf("expected SubFuturesTicker to be called once, got %d", got)
	}

	if err := hub.Unsubscribe([]string{"BTC-USDT"}); err != nil {
		t.Fatalf("unsubscribe failed: %v", err)
	}
	if got := len(client.unsubscribeAll); got != 1 {
		t.Fatalf("expected 1 unsubscribe call, got %d", got)
	}
}

func TestWSAggregator_SubMultiPeriodCandlesSkipsUnsubscribedTicker(t *testing.T) {
	client := &fakeExchange{
		name: md.Binance,
		activeSymbols: map[md.TradeType][]string{
			md.Futures: []string{"BTC-USDT"},
		},
	}
	hub := NewWSAggregator(client, WSAggregatorOptions{})
	defer hub.Close()

	if err := hub.SubMultiPeriodCandles([]md.TradeType{md.Futures}, func(Candle15mEvent) {}); err != nil {
		t.Fatalf("sub multi period candles failed: %v", err)
	}

	if client.onTickerAll == nil {
		t.Fatal("expected OnTickerAll handler to be registered")
	}

	baseTime := int64(1609459200000)
	client.onTickerAll(md.TickerUpdate{
		Symbol:    "ETH-USDT",
		TradeType: md.Futures,
		LastPrice: 3000,
		Timestamp: baseTime,
	})

	hub.tickerAggMu.Lock()
	tickerAgg := hub.tickerAgg
	hub.tickerAggMu.Unlock()
	if tickerAgg == nil {
		t.Fatal("expected ticker aggregator to be initialized")
	}
	if candle := tickerAgg.GetCurrentCandle("ETH-USDT", md.Futures, md.Period15m); candle != nil {
		t.Fatalf("expected ETH-USDT ticker to be ignored, got %+v", *candle)
	}

	client.onTickerAll(md.TickerUpdate{
		Symbol:    "BTC-USDT",
		TradeType: md.Futures,
		LastPrice: 50000,
		Timestamp: baseTime,
	})
	if candle := tickerAgg.GetCurrentCandle("BTC-USDT", md.Futures, md.Period15m); candle == nil {
		t.Fatal("expected BTC-USDT ticker to be processed")
	}
}
