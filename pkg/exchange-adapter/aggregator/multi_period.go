package aggregator

import (
	"context"
	"sync"
	"time"

	md "github.com/pkg/exchange-adapter/marketdata"
)

// Event 聚合事件
type Event struct {
	Kline *md.Kline
	Trade *md.Trade
}

// MultiPeriodAggregator 多周期聚合器 (Actor 模式)
// 使用单线程事件循环处理所有状态变化，消除竞态条件
type MultiPeriodAggregator struct {
	exchange string

	// 各周期的聚合器
	aggregators map[md.Period]*SinglePeriodAggregator

	// 事件通道 - 所有 Kline/Trade 通过此通道串行处理
	eventCh chan Event

	// 回调
	onPeriodComplete func(md.NormalizedCandle)
	onUpdate         func(md.NormalizedCandle)

	// 查询用的读写锁 (仅用于 GetCurrentCandle)
	mu sync.RWMutex

	// 是否跳过 Trade 处理 (Binance 的 Kline 已包含 BuyVolume)
	skipTrade bool

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// MultiPeriodConfig 多周期聚合器配置
type MultiPeriodConfig struct {
	Exchange   string
	Periods    []md.Period // 要聚合的周期列表
	SkipTrade  bool        // 是否跳过 Trade 处理（Binance kline 已包含 BuyVolume）
	NeedTrade  bool        // 是否需要 Trade 来完成周期（OKX 需要 kline+trade）
	BufferSize int         // 事件通道缓冲区大小
}

// DefaultMultiPeriodConfig 默认配置
// 源数据为 15m K线，输出 15m/4h/1d（15m 直接透传，4h/1d 聚合）
func DefaultMultiPeriodConfig(exchangeName string) MultiPeriodConfig {
	return MultiPeriodConfig{
		Exchange:   exchangeName,
		Periods:    []md.Period{md.Period15m, md.Period4h, md.Period1d},
		SkipTrade:  false, // 默认处理 trade
		NeedTrade:  false, // 默认不需要 trade 来完成周期
		BufferSize: 10000,
	}
}

// BinanceMultiPeriodConfig Binance 配置（kline 已包含 BuyVolume，跳过 trade 处理）
// 源数据为 15m K线，输出 15m/4h/1d（15m 直接透传，4h/1d 聚合）
func BinanceMultiPeriodConfig() MultiPeriodConfig {
	return MultiPeriodConfig{
		Exchange:   string(md.Binance),
		Periods:    []md.Period{md.Period15m, md.Period4h, md.Period1d},
		SkipTrade:  true,  // Binance kline 已包含 BuyVolume
		NeedTrade:  false, // 不需要 trade 来完成周期
		BufferSize: 10000,
	}
}

// OKXMultiPeriodConfig OKX 配置（需要 kline+trade 来完成周期）
// 源数据为 15m K线，输出 15m/4h/1d（15m 直接透传，4h/1d 聚合）
func OKXMultiPeriodConfig() MultiPeriodConfig {
	return MultiPeriodConfig{
		Exchange:   string(md.OKX),
		Periods:    []md.Period{md.Period15m, md.Period4h, md.Period1d},
		SkipTrade:  false, // 需要处理 trade
		NeedTrade:  true,  // 需要 trade 来完成周期
		BufferSize: 10000,
	}
}

// NewMultiPeriodAggregator 创建多周期聚合器
func NewMultiPeriodAggregator(cfg MultiPeriodConfig) *MultiPeriodAggregator {
	ctx, cancel := context.WithCancel(context.Background())

	agg := &MultiPeriodAggregator{
		exchange:    cfg.Exchange,
		aggregators: make(map[md.Period]*SinglePeriodAggregator),
		eventCh:     make(chan Event, cfg.BufferSize),
		skipTrade:   cfg.SkipTrade,
		ctx:         ctx,
		cancel:      cancel,
	}

	// 初始化各周期聚合器
	for _, period := range cfg.Periods {
		agg.aggregators[period] = NewSinglePeriodAggregatorWithConfig(cfg.Exchange, period, cfg.NeedTrade)
	}

	// 启动事件循环
	agg.wg.Add(1)
	go agg.eventLoop()

	// 启动周期边界检查
	agg.wg.Add(1)
	go agg.checkPeriodBoundary()

	return agg
}

// NewPeriodAggregator 兼容旧 API 的创建函数
// Deprecated: 使用 NewMultiPeriodAggregator 代替
func NewPeriodAggregator(exchangeName string) *MultiPeriodAggregator {
	cfg := DefaultMultiPeriodConfig(exchangeName)
	return NewMultiPeriodAggregator(cfg)
}

// OnPeriodComplete 设置周期结束回调
func (a *MultiPeriodAggregator) OnPeriodComplete(handler func(md.NormalizedCandle)) {
	a.onPeriodComplete = handler
}

// OnUpdate 设置实时更新回调
func (a *MultiPeriodAggregator) OnUpdate(handler func(md.NormalizedCandle)) {
	a.onUpdate = handler
}

// ProcessKline 处理 5m K线数据 (线程安全)
// 将事件投递到 eventCh，由事件循环串行处理
func (a *MultiPeriodAggregator) ProcessKline(kline md.Kline) {
	select {
	case a.eventCh <- Event{Kline: &kline}:
	case <-a.ctx.Done():
	}
}

// ProcessTrade 处理成交数据 (线程安全)
// 将事件投递到 eventCh，由事件循环串行处理
func (a *MultiPeriodAggregator) ProcessTrade(trade md.Trade) {
	if a.skipTrade {
		return
	}
	select {
	case a.eventCh <- Event{Trade: &trade}:
	case <-a.ctx.Done():
	}
}

// eventLoop 事件循环 - 所有状态变化在此单线程中处理
// 这是 Actor 模式的核心：无锁、顺序确定、无竞态
func (a *MultiPeriodAggregator) eventLoop() {
	defer a.wg.Done()

	for {
		select {
		case <-a.ctx.Done():
			return
		case ev := <-a.eventCh:
			a.handleEvent(ev)
		}
	}
}

// handleEvent 处理单个事件
func (a *MultiPeriodAggregator) handleEvent(ev Event) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if ev.Kline != nil {
		a.handleKline(*ev.Kline)
	}
	if ev.Trade != nil {
		a.handleTrade(*ev.Trade)
	}
}

// handleKline 处理 Kline 事件
func (a *MultiPeriodAggregator) handleKline(kline md.Kline) {
	for _, agg := range a.aggregators {
		result := agg.PushKline(kline)

		// 周期切换，发送完成通知
		if result != nil && result.Closed && result.Candle != nil {
			if a.onPeriodComplete != nil {
				a.onPeriodComplete(*result.Candle)
			}
		}

		// 发送实时更新
		if a.onUpdate != nil {
			candle := agg.GetCurrentCandle(kline.Symbol)
			if candle != nil {
				a.onUpdate(*candle)
			}
		}
	}
}

// handleTrade 处理 Trade 事件
func (a *MultiPeriodAggregator) handleTrade(trade md.Trade) {
	for _, agg := range a.aggregators {
		agg.PushTrade(trade)
	}
}

// checkPeriodBoundary 定期检查周期边界（处理长时间无数据的情况）
func (a *MultiPeriodAggregator) checkPeriodBoundary() {
	defer a.wg.Done()

	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			a.flushExpiredPeriods()
		}
	}
}

// flushExpiredPeriods 刷新过期周期
func (a *MultiPeriodAggregator) flushExpiredPeriods() {
	a.mu.Lock()
	defer a.mu.Unlock()

	nowMs := time.Now().UnixMilli()

	for _, agg := range a.aggregators {
		// 检查历史周期是否已就绪
		readyCandles := agg.CheckHistoryReady()
		for _, candle := range readyCandles {
			if a.onPeriodComplete != nil {
				a.onPeriodComplete(candle)
			}
		}

		// 刷新过期周期（延迟 1 个周期清空）
		expiredCandles := agg.FlushExpired(nowMs)
		for _, candle := range expiredCandles {
			if a.onPeriodComplete != nil {
				a.onPeriodComplete(candle)
			}
		}
	}
}

// GetCurrentCandle 获取当前周期的K线 (线程安全)
func (a *MultiPeriodAggregator) GetCurrentCandle(symbol string, period md.Period) *md.NormalizedCandle {
	a.mu.RLock()
	defer a.mu.RUnlock()

	agg, ok := a.aggregators[period]
	if !ok {
		return nil
	}
	return agg.GetCurrentCandle(symbol)
}

// Close 关闭聚合器
func (a *MultiPeriodAggregator) Close() {
	a.cancel()
	a.wg.Wait()

	// 刷新所有未完成的周期
	a.mu.Lock()
	for _, agg := range a.aggregators {
		candles := agg.FlushAll()
		for _, candle := range candles {
			if a.onPeriodComplete != nil {
				a.onPeriodComplete(candle)
			}
		}
	}
	a.mu.Unlock()
}

// PeriodAggregator 类型别名，保持向后兼容
type PeriodAggregator = MultiPeriodAggregator
