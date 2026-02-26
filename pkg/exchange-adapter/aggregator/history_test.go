package aggregator

import (
	"testing"

	md "github.com/pkg/exchange-adapter/marketdata"
)

func TestAggregateCandlesByPeriod_From15mTo4h(t *testing.T) {
	base := int64(1704096000000)
	candles := []md.NormalizedCandle{
		{
			Symbol: "ETH-USDT", Exchange: "binance", TradeType: "spot", Period: string(md.Period15m),
			Timestamp: base, Open: 100, High: 104, Low: 99, Close: 103, Volume: 10, BuyVolume: 4,
		},
		{
			Symbol: "ETH-USDT", Exchange: "binance", TradeType: "spot", Period: string(md.Period15m),
			Timestamp: base + 15*60*1000, Open: 103, High: 108, Low: 102, Close: 106, Volume: 15, BuyVolume: 6,
		},
		{
			Symbol: "ETH-USDT", Exchange: "binance", TradeType: "spot", Period: string(md.Period15m),
			Timestamp: base + 3*60*60*1000 + 45*60*1000, Open: 106, High: 110, Low: 105, Close: 109, Volume: 20, BuyVolume: 8,
		},
		{
			Symbol: "ETH-USDT", Exchange: "binance", TradeType: "spot", Period: string(md.Period15m),
			Timestamp: base + 4*60*60*1000, Open: 109, High: 111, Low: 108, Close: 110, Volume: 12, BuyVolume: 5,
		},
	}

	aggregated, err := AggregateCandlesByPeriod(candles, md.Period15m, md.Period4h)
	if err != nil {
		t.Fatalf("aggregate failed: %v", err)
	}

	if len(aggregated) != 2 {
		t.Fatalf("expected 2 aggregated candles, got %d", len(aggregated))
	}

	latest := aggregated[0]
	if latest.Timestamp != base+4*60*60*1000 {
		t.Fatalf("expected latest timestamp %d, got %d", base+4*60*60*1000, latest.Timestamp)
	}

	first := aggregated[1]
	if first.Timestamp != base {
		t.Fatalf("expected first timestamp %d, got %d", base, first.Timestamp)
	}

	if first.Open != 100 {
		t.Fatalf("expected open 100, got %f", first.Open)
	}
	if first.Close != 109 {
		t.Fatalf("expected close 109, got %f", first.Close)
	}
	if first.High != 110 {
		t.Fatalf("expected high 110, got %f", first.High)
	}
	if first.Low != 99 {
		t.Fatalf("expected low 99, got %f", first.Low)
	}
	if first.Volume != 45 {
		t.Fatalf("expected volume 45, got %f", first.Volume)
	}
	if first.BuyVolume != 18 {
		t.Fatalf("expected buy volume 18, got %f", first.BuyVolume)
	}
	if first.Period != string(md.Period4h) {
		t.Fatalf("expected period 4h, got %s", first.Period)
	}
}

func TestAggregateCandlesByPeriod_InvalidPeriod(t *testing.T) {
	candles := []md.NormalizedCandle{{Timestamp: 1}}
	_, err := AggregateCandlesByPeriod(candles, md.Period15m, md.Period5m)
	if err == nil {
		t.Fatal("expected error when target period is smaller than source period")
	}
}
