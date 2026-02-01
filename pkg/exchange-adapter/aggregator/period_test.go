package aggregator

import (
	"testing"

	md "github.com/pkg/exchange-adapter/marketdata"
)

// TestBinanceAggregation_15m 测试 Binance 15m → 4h 周期聚合
// Binance: kline 包含 BuyVolume，不需要 trade，计数器=1
func TestBinanceAggregation_15m(t *testing.T) {
	// needTrade=false: Binance 只需要 kline
	// 现在订阅 15m K线，聚合到 4h
	agg := NewSinglePeriodAggregatorWithConfig("binance", md.Period4h, false)

	// 模拟 4h 周期内的 16 个 15m K线 (4h = 16 * 15m)
	// baseTime = 2021-01-01 00:00:00 UTC = 1609459200000
	baseTime := int64(1609459200000)
	klines := []md.Kline{
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime, Open: 100.0, High: 110.0, Low: 95.0, Close: 105.0, Volume: 1000.0, BuyVolume: 600.0, Closed: false, TradeType: md.Spot},                             // 00:00
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 15*60*1000, Open: 105.0, High: 115.0, Low: 100.0, Close: 108.0, Volume: 1500.0, BuyVolume: 800.0, Closed: false, TradeType: md.Spot},               // 00:15
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 30*60*1000, Open: 108.0, High: 120.0, Low: 88.0, Close: 112.0, Volume: 2000.0, BuyVolume: 1200.0, Closed: true, TradeType: md.Spot},                // 00:30
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 3*60*60*1000 + 45*60*1000, Open: 112.0, High: 125.0, Low: 110.0, Close: 120.0, Volume: 1800.0, BuyVolume: 900.0, Closed: true, TradeType: md.Spot}, // 03:45 (最后一个 15m)
	}

	for _, kline := range klines {
		agg.PushKline(kline)
	}

	candle := agg.GetCurrentCandle("BTC-USDT")
	if candle == nil {
		t.Fatal("expected candle to exist")
	}

	// 验证 Open = 第一个 15m 的 Open
	if candle.Open != 100.0 {
		t.Errorf("Open: expected 100.0, got %f", candle.Open)
	}
	// 验证 High = 所有 15m 的最高值
	if candle.High != 125.0 {
		t.Errorf("High: expected 125.0, got %f", candle.High)
	}
	// 验证 Low = 所有 15m 的最低值
	if candle.Low != 88.0 {
		t.Errorf("Low: expected 88.0, got %f", candle.Low)
	}
	// 验证 Close = 最后一个 15m 的 Close
	if candle.Close != 120.0 {
		t.Errorf("Close: expected 120.0, got %f", candle.Close)
	}
	// 验证 Volume = 所有 15m 的 Volume 总和
	expectedVolume := 1000.0 + 1500.0 + 2000.0 + 1800.0
	if candle.Volume != expectedVolume {
		t.Errorf("Volume: expected %f, got %f", expectedVolume, candle.Volume)
	}

	// Binance: BuyVolume 从 kline 累加
	expectedBuyVolume := 600.0 + 800.0 + 1200.0 + 900.0
	if candle.BuyVolume != expectedBuyVolume {
		t.Errorf("BuyVolume: expected %f, got %f", expectedBuyVolume, candle.BuyVolume)
	}

	// 验证 BuyVolume 在合理范围: 0 < BuyVolume <= Volume
	if candle.BuyVolume <= 0 || candle.BuyVolume > candle.Volume {
		t.Errorf("BuyVolume should be in range (0, Volume], got %f (Volume=%f)", candle.BuyVolume, candle.Volume)
	}

	// 推送下一个 4h 周期的第一个 15m kline，触发上一周期完成
	nextKline := md.Kline{
		Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 4*60*60*1000, // 04:00
		Open: 120.0, High: 128.0, Low: 118.0, Close: 125.0, Volume: 800.0, BuyVolume: 400.0,
		TradeType: md.Spot,
	}
	result := agg.PushKline(nextKline)

	// Binance needTrade=false，klineReady 后立即完成
	if result == nil || !result.Closed {
		t.Error("expected period to close when next period starts")
	}
	if result != nil && result.Candle != nil {
		if result.Candle.Open != 100.0 || result.Candle.Close != 120.0 {
			t.Errorf("closed candle: expected Open=100.0/Close=120.0, got Open=%f/Close=%f",
				result.Candle.Open, result.Candle.Close)
		}
	}
}

// TestOKXAggregation_15m 测试 OKX 15m → 4h 周期聚合
// OKX: kline 不包含 BuyVolume，需要 kline + trade，计数器=2
func TestOKXAggregation_15m(t *testing.T) {
	// needTrade=true: OKX 需要 kline + trade
	// 现在订阅 15m K线，聚合到 4h
	agg := NewSinglePeriodAggregatorWithConfig("okx", md.Period4h, true)

	// 模拟 4h 周期内的几个 15m K线
	baseTime := int64(1609459200000)
	klines := []md.Kline{
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime, Open: 100.0, High: 110.0, Low: 95.0, Close: 105.0, Volume: 1000.0, BuyVolume: 0, Closed: false, TradeType: md.Futures},               // 00:00
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 15*60*1000, Open: 105.0, High: 115.0, Low: 100.0, Close: 108.0, Volume: 1500.0, BuyVolume: 0, Closed: false, TradeType: md.Futures}, // 00:15
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 30*60*1000, Open: 108.0, High: 120.0, Low: 88.0, Close: 112.0, Volume: 2000.0, BuyVolume: 0, Closed: true, TradeType: md.Futures},   // 00:30
	}

	for _, kline := range klines {
		agg.PushKline(kline)
	}

	// 模拟 trade 数据累加 BuyVolume
	trades := []md.Trade{
		{Symbol: "BTC-USDT", Timestamp: baseTime + 1000, Quantity: 50.0, IsBuy: true},
		{Symbol: "BTC-USDT", Timestamp: baseTime + 16*60*1000, Quantity: 80.0, IsBuy: true},
		{Symbol: "BTC-USDT", Timestamp: baseTime + 31*60*1000, Quantity: 120.0, IsBuy: true},
		{Symbol: "BTC-USDT", Timestamp: baseTime + 20*60*1000, Quantity: 30.0, IsBuy: false}, // 卖出，应被忽略
	}

	for _, trade := range trades {
		agg.PushTrade(trade)
	}

	candle := agg.GetCurrentCandle("BTC-USDT")
	if candle == nil {
		t.Fatal("expected candle to exist")
	}

	// OKX: BuyVolume 从 trade 累加（只累加 IsBuy=true）
	expectedBuyVolume := 50.0 + 80.0 + 120.0
	if candle.BuyVolume != expectedBuyVolume {
		t.Errorf("BuyVolume: expected %f, got %f", expectedBuyVolume, candle.BuyVolume)
	}

	// 验证 BuyVolume 在合理范围
	if candle.BuyVolume <= 0 || candle.BuyVolume > candle.Volume {
		t.Errorf("BuyVolume should be in range (0, Volume], got %f (Volume=%f)", candle.BuyVolume, candle.Volume)
	}

	// 推送下一个 4h 周期的第一个 15m kline
	nextKline := md.Kline{
		Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 4*60*60*1000,
		Open: 112.0, High: 118.0, Low: 110.0, Close: 115.0, Volume: 800.0,
		TradeType: md.Futures,
	}
	result := agg.PushKline(nextKline)

	// OKX needTrade=true，需要 kline + trade 都 ready 才能完成
	// 由于 tradeReady 未设置，不应该立即完成
	if result != nil && result.Closed {
		t.Error("OKX: period should not close without tradeReady")
	}

	// 手动设置 tradeReady，模拟 trade 处理完成
	agg.SetTradeReady("BTC-USDT", baseTime)

	// 检查历史周期是否就绪
	readyCandles := agg.CheckHistoryReady()
	if len(readyCandles) != 1 {
		t.Errorf("expected 1 ready candle, got %d", len(readyCandles))
	}
}

// TestCrossPeriod_4h 测试 4h 周期跨越
// 验证多个 15m K线能正确聚合成 4h
func TestCrossPeriod_4h(t *testing.T) {
	agg := NewSinglePeriodAggregatorWithConfig("binance", md.Period4h, false)

	// 4h = 16 个 15m，模拟完整周期
	baseTime := int64(1609459200000) // 2021-01-01 00:00:00 UTC

	// 推送 16 个 15m K线（完整 4h 周期）
	for i := 0; i < 16; i++ {
		closed := (i == 15) // 最后一个 Closed=true
		kline := md.Kline{
			Symbol:    "BTC-USDT",
			Period:    md.Period15m,
			Timestamp: baseTime + int64(i)*15*60*1000,
			Open:      100.0 + float64(i),
			High:      110.0 + float64(i),
			Low:       90.0 + float64(i),
			Close:     105.0 + float64(i),
			Volume:    100.0,
			BuyVolume: 50.0,
			Closed:    closed,
			TradeType: md.Spot,
		}
		agg.PushKline(kline)
	}

	candle := agg.GetCurrentCandle("BTC-USDT")
	if candle == nil {
		t.Fatal("expected candle to exist")
	}

	// Open = 第一个 15m 的 Open
	if candle.Open != 100.0 {
		t.Errorf("Open: expected 100.0, got %f", candle.Open)
	}

	// Close = 最后一个 15m 的 Close
	expectedClose := 105.0 + 15.0
	if candle.Close != expectedClose {
		t.Errorf("Close: expected %f, got %f", expectedClose, candle.Close)
	}

	// Volume = 所有 15m 的 Volume 总和
	expectedVolume := 100.0 * 16
	if candle.Volume != expectedVolume {
		t.Errorf("Volume: expected %f, got %f", expectedVolume, candle.Volume)
	}

	// BuyVolume = 所有 15m 的 BuyVolume 总和
	expectedBuyVolume := 50.0 * 16
	if candle.BuyVolume != expectedBuyVolume {
		t.Errorf("BuyVolume: expected %f, got %f", expectedBuyVolume, candle.BuyVolume)
	}

	// 推送下一个 4h 周期的第一个 15m，触发当前周期完成
	nextKline := md.Kline{
		Symbol:    "BTC-USDT",
		Period:    md.Period15m,
		Timestamp: baseTime + 4*60*60*1000, // 04:00
		Open:      200.0,
		High:      210.0,
		Low:       190.0,
		Close:     205.0,
		Volume:    500.0,
		BuyVolume: 250.0,
		TradeType: md.Spot,
	}
	result := agg.PushKline(nextKline)

	if result == nil || !result.Closed {
		t.Error("expected 4h period to close")
	}
	if result != nil && result.Candle != nil {
		if result.Candle.Period != string(md.Period4h) {
			t.Errorf("expected period 4h, got %s", result.Candle.Period)
		}
	}

	// 验证当前周期已切换到新的 4h
	newCandle := agg.GetCurrentCandle("BTC-USDT")
	if newCandle == nil {
		t.Fatal("expected new candle to exist")
	}
	if newCandle.Open != 200.0 {
		t.Errorf("new period Open: expected 200.0, got %f", newCandle.Open)
	}
}
