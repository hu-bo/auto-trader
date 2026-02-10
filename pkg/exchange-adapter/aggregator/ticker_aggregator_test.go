package aggregator

import (
	"testing"

	md "github.com/pkg/exchange-adapter/marketdata"
)

func TestTickerAggregator_IgnoresOutOfOrderTicker(t *testing.T) {
	agg := NewTickerAggregator("binance")

	var closed15m []md.NormalizedCandle
	agg.OnCandle(func(candle md.NormalizedCandle, closed bool) {
		if closed && candle.Period == string(md.Period15m) {
			closed15m = append(closed15m, candle)
		}
	})

	const symbol = "BTC-USDT"
	const tradeType = md.Futures
	base := int64(1609459200000) // 2021-01-01 00:00:00 UTC

	// 周期 00:00
	agg.ProcessTicker(md.TickerUpdate{
		Symbol:    symbol,
		TradeType: tradeType,
		LastPrice: 100,
		Timestamp: base + 60_000,
	})

	// 进入下一周期 00:15，触发 00:00 周期闭合
	agg.ProcessTicker(md.TickerUpdate{
		Symbol:    symbol,
		TradeType: tradeType,
		LastPrice: 110,
		Timestamp: base + 16*60_000,
	})

	// 乱序：回到上一周期（00:14）
	agg.ProcessTicker(md.TickerUpdate{
		Symbol:    symbol,
		TradeType: tradeType,
		LastPrice: 105,
		Timestamp: base + 14*60_000,
	})

	// 当前周期继续更新
	agg.ProcessTicker(md.TickerUpdate{
		Symbol:    symbol,
		TradeType: tradeType,
		LastPrice: 120,
		Timestamp: base + 17*60_000,
	})

	if len(closed15m) != 1 {
		t.Fatalf("expected exactly 1 closed 15m candle, got %d", len(closed15m))
	}

	current := agg.GetCurrentCandle(symbol, tradeType, md.Period15m)
	if current == nil {
		t.Fatal("expected current 15m candle to exist")
	}

	expectedStart := base + 15*60_000
	if current.Timestamp != expectedStart {
		t.Fatalf("expected current candle start %d, got %d", expectedStart, current.Timestamp)
	}
	if current.Open != 110 || current.High != 120 || current.Low != 110 || current.Close != 120 {
		t.Fatalf("unexpected OHLC, got O=%v H=%v L=%v C=%v", current.Open, current.High, current.Low, current.Close)
	}
}

func TestTickerAggregator_ClosesPreviousPeriodOnce(t *testing.T) {
	agg := NewTickerAggregator("binance")

	var closed15m []md.NormalizedCandle
	agg.OnCandle(func(candle md.NormalizedCandle, closed bool) {
		if closed && candle.Period == string(md.Period15m) {
			closed15m = append(closed15m, candle)
		}
	})

	const symbol = "ETH-USDT"
	const tradeType = md.Futures
	base := int64(1609459200000)

	agg.ProcessTicker(md.TickerUpdate{
		Symbol:    symbol,
		TradeType: tradeType,
		LastPrice: 2000,
		Timestamp: base + 1*60_000,
	})
	agg.ProcessTicker(md.TickerUpdate{
		Symbol:    symbol,
		TradeType: tradeType,
		LastPrice: 2010,
		Timestamp: base + 14*60_000,
	})
	agg.ProcessTicker(md.TickerUpdate{
		Symbol:    symbol,
		TradeType: tradeType,
		LastPrice: 2020,
		Timestamp: base + 16*60_000,
	})

	if len(closed15m) != 1 {
		t.Fatalf("expected exactly 1 closed 15m candle, got %d", len(closed15m))
	}

	closed := closed15m[0]
	if closed.Timestamp != base || closed.Open != 2000 || closed.High != 2010 || closed.Low != 2000 || closed.Close != 2010 {
		t.Fatalf("unexpected closed candle, got ts=%d O=%v H=%v L=%v C=%v", closed.Timestamp, closed.Open, closed.High, closed.Low, closed.Close)
	}
}
