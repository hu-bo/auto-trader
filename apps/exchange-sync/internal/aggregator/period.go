package aggregator

import (
	"exchange-sync/internal/exchange"
)

// PeriodData 单周期聚合数据
type PeriodData struct {
	Symbol       string
	Exchange     string
	TradeType    string
	Period       exchange.Period
	PeriodTime   int64 // 周期起始时间 (ms)
	Open         float64
	High         float64
	Low          float64
	Close        float64
	Volume       float64 // 聚合后的总成交量（所有源 K线的 Volume 总和）
	BuyVolume    float64 // 通过 Trade 累加（OKX）或 Kline 累加（Binance）
	SymbolFamily string

	// 已处理的源 K线时间戳 -> 该 K线是否设置过 Open
	processedKlines map[int64]bool

	// 每个源 K线的 Volume（用于正确累加，同一个 K线多次更新时取最新值）
	processedVolume map[int64]float64

	// 完成计数器：用于判断周期是否可以写入
	// Binance: requiredCount=1 (只需要 kline)
	// OKX: requiredCount=2 (需要 kline + trade)
	klineReady bool // kline 已收到 Closed=true 或通过时间兜底
	tradeReady bool // trade 已累加完成（OKX 需要，Binance 不需要）
}

// NewPeriodData 创建新的周期数据
func NewPeriodData(symbol, exchangeName, tradeType string, period exchange.Period, periodTime int64) *PeriodData {
	return &PeriodData{
		Symbol:          symbol,
		Exchange:        exchangeName,
		TradeType:       tradeType,
		Period:          period,
		PeriodTime:      periodTime,
		SymbolFamily:    exchange.ExtractSymbolFamily(symbol),
		processedKlines: make(map[int64]bool),
		processedVolume: make(map[int64]float64),
	}
}

// UpdateVolume 更新指定源 K线的 Volume 并重新计算总 Volume
func (d *PeriodData) UpdateVolume(timestamp int64, volume float64) {
	d.processedVolume[timestamp] = volume
	// 重新计算总 Volume
	var total float64
	for _, v := range d.processedVolume {
		total += v
	}
	d.Volume = total
}

// ToNormalizedCandle 转换为标准化K线
func (d *PeriodData) ToNormalizedCandle() exchange.NormalizedCandle {
	return exchange.NormalizedCandle{
		Symbol:       d.Symbol,
		Exchange:     d.Exchange,
		TradeType:    d.TradeType,
		Period:       string(d.Period),
		Timestamp:    d.PeriodTime,
		Open:         d.Open,
		High:         d.High,
		Low:          d.Low,
		Close:        d.Close,
		Volume:       d.Volume,
		BuyVolume:    d.BuyVolume,
		SymbolFamily: d.SymbolFamily,
	}
}

// SinglePeriodAggregator 单周期聚合器
// 只负责一个周期（如 15m）的聚合逻辑，无锁设计
type SinglePeriodAggregator struct {
	exchange string
	period   exchange.Period

	// symbol -> PeriodData
	dataMap map[string]*PeriodData

	// 是否需要 Trade 来更新 BuyVolume
	// Binance: false (kline 已包含 BuyVolume)
	// OKX: true (需要通过 trade 累加)
	needTrade bool

	// 历史周期数据：用于延迟清空（支持延迟到达的 trade）
	// symbol -> periodTime -> PeriodData
	historyMap map[string]map[int64]*PeriodData
}

// NewSinglePeriodAggregator 创建单周期聚合器
// Deprecated: 使用 NewSinglePeriodAggregatorWithConfig
func NewSinglePeriodAggregator(exchangeName string, period exchange.Period) *SinglePeriodAggregator {
	return NewSinglePeriodAggregatorWithConfig(exchangeName, period, false)
}

// NewSinglePeriodAggregatorWithConfig 创建单周期聚合器（带配置）
func NewSinglePeriodAggregatorWithConfig(exchangeName string, period exchange.Period, needTrade bool) *SinglePeriodAggregator {
	return &SinglePeriodAggregator{
		exchange:   exchangeName,
		period:     period,
		dataMap:    make(map[string]*PeriodData),
		needTrade:  needTrade,
		historyMap: make(map[string]map[int64]*PeriodData),
	}
}

// AggResult 聚合结果
type AggResult struct {
	Candle *exchange.NormalizedCandle
	Closed bool // 是否为周期关闭产生的结果
}

// PushKline 处理 15m K线，返回聚合结果
// 同一个 K线会收到多次更新，每次都要处理（OHLCV 会变化）
// 返回值：如果周期完成且满足条件（kline+trade 都 ready），返回完成的 candle
func (a *SinglePeriodAggregator) PushKline(kline exchange.Kline) *AggResult {
	if kline.Period != exchange.Period15m {
		return nil
	}

	// 用目标周期对齐源 K线的时间戳
	periodTime := a.period.RoundToInterval(kline.Timestamp)
	data := a.dataMap[kline.Symbol]

	var result *AggResult

	// 首次创建
	if data == nil {
		data = NewPeriodData(kline.Symbol, a.exchange, string(kline.TradeType), a.period, periodTime)
		a.dataMap[kline.Symbol] = data
	}

	// 新周期开始 - 处理上一周期
	if periodTime > data.PeriodTime {
		// 将旧周期移入历史（用于延迟到达的 trade）
		if len(data.processedKlines) > 0 {
			a.moveToHistory(data)

			// 标记 kline 已就绪（通过时间兜底）
			data.klineReady = true

			// 检查是否可以完成
			if a.isReady(data) {
				candle := data.ToNormalizedCandle()
				result = &AggResult{Candle: &candle, Closed: true}
				a.removeFromHistory(data.Symbol, data.PeriodTime)
			}
		}
		// 创建新周期
		data = NewPeriodData(kline.Symbol, a.exchange, string(kline.TradeType), a.period, periodTime)
		a.dataMap[kline.Symbol] = data
	}

	// 检查这个源 K线是否首次出现
	isFirstKline := !data.processedKlines[kline.Timestamp]

	if isFirstKline {
		// 该源 K线首次出现
		if len(data.processedKlines) == 0 {
			// 周期内第一个源 K线，设置 Open
			data.Open = kline.Open
			data.High = kline.High
			data.Low = kline.Low
		}
		data.processedKlines[kline.Timestamp] = true
		// 首次出现，累加 BuyVolume（仅 Binance，OKX 通过 trade 累加）
		if kline.BuyVolume > 0 {
			data.BuyVolume += kline.BuyVolume
		}
	}

	// 每次更新都处理 High/Low/Close（可能变化）
	if kline.High > data.High {
		data.High = kline.High
	}
	if data.Low == 0 || kline.Low < data.Low {
		data.Low = kline.Low
	}
	data.Close = kline.Close

	// Volume 处理：存储每个源 K线的最新 Volume，聚合时累加
	data.UpdateVolume(kline.Timestamp, kline.Volume)

	// 检查 Closed 标志（交易所发送的周期关闭信号）
	// 仅当收到周期内最后一个源 K线的 Closed=true 时标记
	if kline.Closed {
		lastKlineTime := a.period.NextInterval(periodTime) - 15*60*1000 // 周期内最后一个 15m K线的时间
		if kline.Timestamp == lastKlineTime {
			data.klineReady = true
		}
	}

	return result
}

// moveToHistory 将周期数据移入历史
func (a *SinglePeriodAggregator) moveToHistory(data *PeriodData) {
	if a.historyMap[data.Symbol] == nil {
		a.historyMap[data.Symbol] = make(map[int64]*PeriodData)
	}
	a.historyMap[data.Symbol][data.PeriodTime] = data
}

// removeFromHistory 从历史中移除
func (a *SinglePeriodAggregator) removeFromHistory(symbol string, periodTime int64) {
	if a.historyMap[symbol] != nil {
		delete(a.historyMap[symbol], periodTime)
	}
}

// isReady 检查周期是否满足完成条件
func (a *SinglePeriodAggregator) isReady(data *PeriodData) bool {
	if !data.klineReady {
		return false
	}
	// 如果不需要 trade，kline ready 即可
	if !a.needTrade {
		return true
	}
	// 需要 trade 时，检查 trade 是否 ready
	return data.tradeReady
}

// SetTradeReady 标记 trade 已就绪（用于外部设置）
func (a *SinglePeriodAggregator) SetTradeReady(symbol string, periodTime int64) {
	// 先检查当前周期
	if data := a.dataMap[symbol]; data != nil && data.PeriodTime == periodTime {
		data.tradeReady = true
		return
	}
	// 再检查历史周期
	if history := a.historyMap[symbol]; history != nil {
		if data := history[periodTime]; data != nil {
			data.tradeReady = true
		}
	}
}

// PushTrade 处理成交数据，累计买入量
// 返回 true 表示成功累加
// 支持累加到当前周期或历史周期（延迟到达的 trade）
func (a *SinglePeriodAggregator) PushTrade(trade exchange.Trade) bool {
	if !trade.IsBuy {
		return false
	}

	// 用目标周期对齐 Trade 的时间戳
	tradePeriodTime := a.period.RoundToInterval(trade.Timestamp)

	// 先尝试累加到当前周期
	if data := a.dataMap[trade.Symbol]; data != nil && tradePeriodTime == data.PeriodTime {
		data.BuyVolume += trade.Quantity
		return true
	}

	// 再尝试累加到历史周期（延迟到达的 trade）
	if history := a.historyMap[trade.Symbol]; history != nil {
		if data := history[tradePeriodTime]; data != nil {
			data.BuyVolume += trade.Quantity
			return true
		}
	}

	return false
}

// CheckHistoryReady 检查历史周期是否已就绪，返回就绪的 candles
// 用于周期性检查延迟到达的 trade 是否已完成
func (a *SinglePeriodAggregator) CheckHistoryReady() []exchange.NormalizedCandle {
	var candles []exchange.NormalizedCandle

	for symbol, history := range a.historyMap {
		for periodTime, data := range history {
			if a.isReady(data) {
				candles = append(candles, data.ToNormalizedCandle())
				delete(history, periodTime)
			}
		}
		// 清理空的 symbol 映射
		if len(history) == 0 {
			delete(a.historyMap, symbol)
		}
	}

	return candles
}

// GetCurrentCandle 获取当前周期的K线
func (a *SinglePeriodAggregator) GetCurrentCandle(symbol string) *exchange.NormalizedCandle {
	data := a.dataMap[symbol]
	if data == nil {
		return nil
	}
	candle := data.ToNormalizedCandle()
	return &candle
}

// FlushExpired 刷新过期周期，返回需要完成的K线
// 延迟 1 个周期清空：例如 15m 周期，15:00 时检查清空 14:30-14:45 的数据，不动 14:45 开始的数据
func (a *SinglePeriodAggregator) FlushExpired(nowMs int64) []exchange.NormalizedCandle {
	var candles []exchange.NormalizedCandle

	// 计算需要清空的周期边界
	// 延迟 1 个周期：当前周期 - 1 个周期间隔
	currentPeriodStart := a.period.RoundToInterval(nowMs)
	expiredBefore := currentPeriodStart - a.period.IntervalMs()

	// 处理历史周期
	for symbol, history := range a.historyMap {
		for periodTime, data := range history {
			// 周期已过期超过 1 个周期，强制完成
			if periodTime < expiredBefore && len(data.processedKlines) > 0 {
				// 标记为就绪（兜底）
				data.klineReady = true
				data.tradeReady = true
				candles = append(candles, data.ToNormalizedCandle())
				delete(history, periodTime)
			}
		}
		if len(history) == 0 {
			delete(a.historyMap, symbol)
		}
	}

	// 处理当前周期（向后兼容）
	for _, data := range a.dataMap {
		periodEnd := a.period.NextInterval(data.PeriodTime)
		// 周期已结束超过 1 分钟，强制完成
		if nowMs > periodEnd+60000 && len(data.processedKlines) > 0 {
			data.klineReady = true
			data.tradeReady = true
			candles = append(candles, data.ToNormalizedCandle())
			// 清空已处理，防止重复触发
			data.processedKlines = make(map[int64]bool)
		}
	}

	return candles
}

// FlushAll 刷新所有未完成的周期（包括历史周期）
func (a *SinglePeriodAggregator) FlushAll() []exchange.NormalizedCandle {
	var candles []exchange.NormalizedCandle

	// 刷新历史周期
	for _, history := range a.historyMap {
		for _, data := range history {
			if len(data.processedKlines) > 0 {
				candles = append(candles, data.ToNormalizedCandle())
			}
		}
	}
	a.historyMap = make(map[string]map[int64]*PeriodData)

	// 刷新当前周期
	for _, data := range a.dataMap {
		if len(data.processedKlines) > 0 {
			candles = append(candles, data.ToNormalizedCandle())
		}
	}
	return candles
}

// Period 获取聚合器的周期
func (a *SinglePeriodAggregator) Period() exchange.Period {
	return a.period
}
