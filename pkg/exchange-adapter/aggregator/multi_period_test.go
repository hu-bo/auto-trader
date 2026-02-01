package aggregator

import (
	"sync"
	"testing"
	"time"

	md "github.com/pkg/exchange-adapter/marketdata"
)

// TestBinanceMultiPeriodAggregator 测试 Binance 多周期聚合
// Binance: kline 包含 BuyVolume，skipTrade=true，needTrade=false
// 源数据为 15m K线，输出 15m/4h/1d
func TestBinanceMultiPeriodAggregator(t *testing.T) {
	cfg := BinanceMultiPeriodConfig()
	cfg.BufferSize = 100

	agg := NewMultiPeriodAggregator(cfg)
	defer agg.Close()

	var completedCandles []md.NormalizedCandle
	var mu sync.Mutex

	agg.OnPeriodComplete(func(candle md.NormalizedCandle) {
		mu.Lock()
		completedCandles = append(completedCandles, candle)
		mu.Unlock()
	})

	// baseTime = 2021-01-01 00:00:00 UTC = 1609459200000
	baseTime := int64(1609459200000)

	// 第一个 15m K线 (00:00-00:15)，Closed=true 触发 15m 周期完成
	kline1 := md.Kline{
		Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime,
		Open: 100.0, High: 110.0, Low: 95.0, Close: 105.0, Volume: 1000.0, BuyVolume: 600.0,
		Closed: true, TradeType: md.Spot,
	}
	agg.ProcessKline(kline1)
	time.Sleep(50 * time.Millisecond)

	// 第二个 15m K线 (00:15-00:30)，触发上一个 15m 周期输出
	kline2 := md.Kline{
		Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 15*60*1000,
		Open: 105.0, High: 115.0, Low: 100.0, Close: 108.0, Volume: 1500.0, BuyVolume: 800.0,
		Closed: true, TradeType: md.Spot,
	}
	agg.ProcessKline(kline2)
	time.Sleep(50 * time.Millisecond)

	mu.Lock()
	// 应该有 15m 周期完成
	has15m := false
	for _, c := range completedCandles {
		if c.Period == string(md.Period15m) {
			has15m = true
			if c.Open != 100.0 || c.Close != 105.0 {
				t.Errorf("15m completed candle: expected Open=100.0/Close=105.0, got Open=%f/Close=%f", c.Open, c.Close)
			}
		}
	}
	mu.Unlock()

	if !has15m {
		t.Error("expected 15m period to complete")
	}

	// 验证 4h 和 1d 周期有数据（还在进行中）
	for _, period := range []md.Period{md.Period4h, md.Period1d} {
		candle := agg.GetCurrentCandle("BTC-USDT", period)
		if candle == nil {
			t.Errorf("expected candle for period %s", period)
			continue
		}
		if candle.Open != 100.0 {
			t.Errorf("period %s: expected Open 100.0, got %f", period, candle.Open)
		}
	}

	// 推送下一个 4h 周期的第一个 15m，触发 4h 周期完成
	nextKline := md.Kline{
		Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 4*60*60*1000,
		Open: 112.0, High: 118.0, Low: 110.0, Close: 115.0, Volume: 800.0, BuyVolume: 400.0,
		TradeType: md.Spot,
	}
	agg.ProcessKline(nextKline)
	time.Sleep(100 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()

	// 应该有 4h 周期完成
	has4h := false
	for _, c := range completedCandles {
		if c.Period == string(md.Period4h) {
			has4h = true
		}
	}
	if !has4h {
		t.Error("expected 4h period to complete")
	}
}

// TestOKXMultiPeriodAggregator 测试 OKX 多周期聚合
// OKX: skipTrade=false，needTrade=true（需要 kline + trade）
// 源数据为 15m K线，输出 15m/4h/1d
func TestOKXMultiPeriodAggregator(t *testing.T) {
	cfg := OKXMultiPeriodConfig()
	cfg.Periods = []md.Period{md.Period15m, md.Period4h} // 简化测试
	cfg.BufferSize = 100

	agg := NewMultiPeriodAggregator(cfg)
	defer agg.Close()

	baseTime := int64(1609459200000)

	// 推送 15m kline
	klines := []md.Kline{
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime, Open: 100.0, High: 110.0, Low: 95.0, Close: 105.0, Volume: 1000.0, BuyVolume: 0, TradeType: md.Futures},
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 15*60*1000, Open: 105.0, High: 115.0, Low: 100.0, Close: 108.0, Volume: 1500.0, BuyVolume: 0, TradeType: md.Futures},
		{Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime + 30*60*1000, Open: 108.0, High: 120.0, Low: 88.0, Close: 112.0, Volume: 2000.0, BuyVolume: 0, Closed: true, TradeType: md.Futures},
	}
	for _, kline := range klines {
		agg.ProcessKline(kline)
	}
	time.Sleep(50 * time.Millisecond)

	// 推送 trade（OKX 通过 trade 累加 BuyVolume）
	trades := []md.Trade{
		{Symbol: "BTC-USDT", Timestamp: baseTime + 1000, Quantity: 50.0, IsBuy: true},
		{Symbol: "BTC-USDT", Timestamp: baseTime + 16*60*1000, Quantity: 80.0, IsBuy: true},
		{Symbol: "BTC-USDT", Timestamp: baseTime + 31*60*1000, Quantity: 120.0, IsBuy: true},
		{Symbol: "BTC-USDT", Timestamp: baseTime + 20*60*1000, Quantity: 30.0, IsBuy: false}, // 卖出，应忽略
	}
	for _, trade := range trades {
		agg.ProcessTrade(trade)
	}
	time.Sleep(50 * time.Millisecond)

	// 验证 15m 和 4h 周期都有数据
	candle15m := agg.GetCurrentCandle("BTC-USDT", md.Period15m)
	if candle15m == nil {
		t.Fatal("expected 15m candle to exist")
	}

	candle4h := agg.GetCurrentCandle("BTC-USDT", md.Period4h)
	if candle4h == nil {
		t.Fatal("expected 4h candle to exist")
	}

	// OKX: BuyVolume 从 trade 累加
	expectedBuyVolume := 50.0 + 80.0 + 120.0
	if candle4h.BuyVolume != expectedBuyVolume {
		t.Errorf("4h BuyVolume: expected %f, got %f", expectedBuyVolume, candle4h.BuyVolume)
	}

	// 验证 BuyVolume 在合理范围
	if candle4h.BuyVolume <= 0 || candle4h.BuyVolume > candle4h.Volume {
		t.Errorf("BuyVolume should be in range (0, Volume], got %f (Volume=%f)", candle4h.BuyVolume, candle4h.Volume)
	}
}

// TestMultiPeriodConcurrency 测试并发安全性
func TestMultiPeriodConcurrency(t *testing.T) {
	cfg := MultiPeriodConfig{
		Exchange:   "binance",
		Periods:    []md.Period{md.Period4h, md.Period1d},
		SkipTrade:  false,
		BufferSize: 10000,
	}

	agg := NewMultiPeriodAggregator(cfg)
	defer agg.Close()

	var wg sync.WaitGroup
	baseTime := int64(1609459200000)

	// 并发推送 15m kline
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				kline := md.Kline{
					Symbol:    "BTC-USDT",
					Period:    md.Period15m,
					Timestamp: baseTime + int64(j)*15*60*1000,
					Open:      100.0 + float64(j),
					High:      110.0 + float64(j),
					Low:       90.0 + float64(j),
					Close:     105.0 + float64(j),
					Volume:    100.0,
					BuyVolume: 50.0,
					TradeType: md.Spot,
				}
				agg.ProcessKline(kline)
			}
		}(i)
	}

	// 并发推送 trade
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				trade := md.Trade{
					Symbol:    "BTC-USDT",
					Timestamp: baseTime + int64(j)*60*1000,
					Quantity:  1.0,
					IsBuy:     true,
				}
				agg.ProcessTrade(trade)
			}
		}()
	}

	wg.Wait()
	time.Sleep(200 * time.Millisecond)

	// 验证没有 panic，数据可以正常读取
	candle4h := agg.GetCurrentCandle("BTC-USDT", md.Period4h)
	candle1d := agg.GetCurrentCandle("BTC-USDT", md.Period1d)

	if candle4h == nil {
		t.Error("expected 4h candle to exist after concurrent writes")
	}
	if candle1d == nil {
		t.Error("expected 1d candle to exist after concurrent writes")
	}

	// 验证 Close 后不 panic
	agg.Close()

	// Close 后推送不应该 panic
	kline := md.Kline{
		Symbol: "BTC-USDT", Period: md.Period15m, Timestamp: baseTime,
		Open: 100.0, High: 110.0, Low: 90.0, Close: 105.0, Volume: 1000.0,
		TradeType: md.Spot,
	}
	agg.ProcessKline(kline) // 不应该 panic
}
