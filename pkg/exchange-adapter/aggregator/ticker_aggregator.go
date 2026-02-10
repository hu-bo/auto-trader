package aggregator

import (
	"sync"

	md "github.com/pkg/exchange-adapter/marketdata"
)

// TickerAggregator 将 ticker 数据并行聚合成多周期 K线
// 每次 ticker 更新时，同时更新 15m/4h/1d 三个周期
// 三个周期完全独立，各自拥有独立的锁，无锁竞争
type TickerAggregator struct {
	exchange string

	// 每个周期独立的 map + 独立的锁，避免锁竞争
	candles15m map[string]*periodCandle
	mu15m      sync.RWMutex

	candles4h map[string]*periodCandle
	mu4h      sync.RWMutex

	candles1d map[string]*periodCandle
	mu1d      sync.RWMutex

	onCandle func(candle md.NormalizedCandle, closed bool)
}

// periodCandle 单个周期的 K线状态
type periodCandle struct {
	Symbol      string
	TradeType   md.TradeType
	Period      md.Period
	PeriodStart int64 // 周期开始时间 (ms)
	Open        float64
	High        float64
	Low         float64
	Close       float64
	Volume      float64 // 累计成交量
	BuyVolume   float64 // 固定为 0 (Ticker 数据无法获取交易方向)
}

// NewTickerAggregator 创建 TickerAggregator
func NewTickerAggregator(exchange string) *TickerAggregator {
	return &TickerAggregator{
		exchange:   exchange,
		candles15m: make(map[string]*periodCandle),
		candles4h:  make(map[string]*periodCandle),
		candles1d:  make(map[string]*periodCandle),
	}
}

// OnCandle 设置 K线回调
func (a *TickerAggregator) OnCandle(handler func(candle md.NormalizedCandle, closed bool)) {
	a.onCandle = handler
}

// ProcessTicker 处理单个 ticker - 并行更新所有周期
func (a *TickerAggregator) ProcessTicker(ticker md.TickerUpdate) {
	if ticker.LastPrice <= 0 {
		return
	}

	key := ticker.Symbol + ":" + string(ticker.TradeType)

	// 计算三个周期的边界
	period15m := md.Period15m.RoundToInterval(ticker.Timestamp)
	period4h := md.Period4h.RoundToInterval(ticker.Timestamp)
	period1d := md.Period1d.RoundToInterval(ticker.Timestamp)

	// 并行更新三个周期 (每个周期独立，无依赖)
	var wg sync.WaitGroup
	wg.Add(3)

	go func() {
		defer wg.Done()
		a.updatePeriod(&a.mu15m, a.candles15m, key, ticker, md.Period15m, period15m)
	}()
	go func() {
		defer wg.Done()
		a.updatePeriod(&a.mu4h, a.candles4h, key, ticker, md.Period4h, period4h)
	}()
	go func() {
		defer wg.Done()
		a.updatePeriod(&a.mu1d, a.candles1d, key, ticker, md.Period1d, period1d)
	}()

	wg.Wait()
}

// updatePeriod 更新指定周期的 candle
func (a *TickerAggregator) updatePeriod(
	mu *sync.RWMutex,
	candles map[string]*periodCandle,
	key string,
	ticker md.TickerUpdate,
	period md.Period,
	periodStart int64,
) {
	mu.Lock()
	defer mu.Unlock()

	candle, exists := candles[key]
	if !exists {
		// 新建 candle
		candle = &periodCandle{
			Symbol:      ticker.Symbol,
			TradeType:   ticker.TradeType,
			Period:      period,
			PeriodStart: periodStart,
			Open:        ticker.LastPrice,
			High:        ticker.LastPrice,
			Low:         ticker.LastPrice,
			Close:       ticker.LastPrice,
			BuyVolume:   0, // Ticker 数据无法获取交易方向，固定为 0
		}
		candles[key] = candle
		a.emitUpdate(candle)
		return
	}

	// 忽略乱序/延迟到达的旧数据，避免时间回拨导致重复闭合。
	if periodStart < candle.PeriodStart {
		return
	}

	// 周期切换（仅允许向前推进）
	if periodStart > candle.PeriodStart {
		// 发送闭合的 K线
		a.emitClosed(candle)
		// 重置为新周期
		candle.PeriodStart = periodStart
		candle.Open = ticker.LastPrice
		candle.High = ticker.LastPrice
		candle.Low = ticker.LastPrice
		candle.Close = ticker.LastPrice
		candle.Volume = 0
		candle.BuyVolume = 0 // Ticker 数据无法获取交易方向，固定为 0
		a.emitUpdate(candle)
		return
	}

	// 更新当前周期
	if ticker.LastPrice > candle.High {
		candle.High = ticker.LastPrice
	}
	if ticker.LastPrice < candle.Low {
		candle.Low = ticker.LastPrice
	}
	candle.Close = ticker.LastPrice
	// BuyVolume 保持为 0 (Ticker 数据无法获取交易方向)

	a.emitUpdate(candle)
}

// emitUpdate 发送实时更新
func (a *TickerAggregator) emitUpdate(candle *periodCandle) {
	if a.onCandle == nil {
		return
	}
	a.onCandle(a.toNormalizedCandle(candle), false)
}

// emitClosed 发送周期闭合
func (a *TickerAggregator) emitClosed(candle *periodCandle) {
	if a.onCandle == nil {
		return
	}
	a.onCandle(a.toNormalizedCandle(candle), true)
}

// toNormalizedCandle 转换为 NormalizedCandle
func (a *TickerAggregator) toNormalizedCandle(candle *periodCandle) md.NormalizedCandle {
	return md.NormalizedCandle{
		Symbol:       candle.Symbol,
		Exchange:     a.exchange,
		TradeType:    string(candle.TradeType),
		Period:       string(candle.Period),
		Timestamp:    candle.PeriodStart,
		Open:         candle.Open,
		High:         candle.High,
		Low:          candle.Low,
		Close:        candle.Close,
		Volume:       candle.Volume,
		BuyVolume:    candle.BuyVolume,
		SymbolFamily: md.ExtractSymbolFamily(candle.Symbol),
	}
}

// GetCurrentCandle 获取当前周期的 K线
func (a *TickerAggregator) GetCurrentCandle(symbol string, tradeType md.TradeType, period md.Period) *md.NormalizedCandle {
	key := symbol + ":" + string(tradeType)

	var mu *sync.RWMutex
	var candles map[string]*periodCandle

	switch period {
	case md.Period15m:
		mu = &a.mu15m
		candles = a.candles15m
	case md.Period4h:
		mu = &a.mu4h
		candles = a.candles4h
	case md.Period1d:
		mu = &a.mu1d
		candles = a.candles1d
	default:
		return nil
	}

	mu.RLock()
	candle, ok := candles[key]
	mu.RUnlock()

	if !ok {
		return nil
	}

	nc := a.toNormalizedCandle(candle)
	return &nc
}

// Close 关闭聚合器，发送所有未闭合的 K线
func (a *TickerAggregator) Close() {
	a.flushAll(&a.mu15m, a.candles15m)
	a.flushAll(&a.mu4h, a.candles4h)
	a.flushAll(&a.mu1d, a.candles1d)
}

func (a *TickerAggregator) flushAll(mu *sync.RWMutex, candles map[string]*periodCandle) {
	mu.Lock()
	defer mu.Unlock()

	for _, candle := range candles {
		a.emitClosed(candle)
	}
}
