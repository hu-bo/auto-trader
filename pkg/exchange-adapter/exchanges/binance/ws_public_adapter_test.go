package binance

import (
	"testing"

	md "github.com/pkg/exchange-adapter/marketdata"
)

func TestCanonicalSymbolSetMatchesUnifiedAndRaw(t *testing.T) {
	set := buildCanonicalSymbolSet([]string{"BTC-USDT-SWAP", "ethusdt"})

	if !inCanonicalSymbolSet(set, "BTCUSDT") {
		t.Fatal("expected BTCUSDT to match BTC-USDT-SWAP blacklist entry")
	}
	if !inCanonicalSymbolSet(set, "ETH-USDT") {
		t.Fatal("expected ETH-USDT to match ethusdt blacklist entry")
	}
	if inCanonicalSymbolSet(set, "SOL-USDT") {
		t.Fatal("did not expect SOL-USDT to match blacklist")
	}
}

func TestHandle24hrTicker_OnlyActiveSymbolsPass(t *testing.T) {
	a := NewWsPublicAdapter(WsPublicAdapterOptions{})
	a.activeSymbolsMu.Lock()
	a.activeSymbolSet[md.Futures] = map[string]struct{}{
		"BTC-USDT": {},
	}
	a.activeSymbolsMu.Unlock()

	var updates []md.TickerUpdate
	a.OnTickerAll(func(update md.TickerUpdate) {
		updates = append(updates, update)
	})

	a.handle24hrTicker(map[string]interface{}{
		"s": "BTCUSDT",
		"c": "50000",
		"Q": "1.5",
		"E": float64(1609459200000),
	}, md.Futures)

	a.handle24hrTicker(map[string]interface{}{
		"s": "ETHUSDT",
		"c": "3000",
		"Q": "2.0",
		"E": float64(1609459201000),
	}, md.Futures)

	if len(updates) != 1 {
		t.Fatalf("expected exactly 1 ticker update, got %d", len(updates))
	}
	if updates[0].Symbol != "BTC-USDT" {
		t.Fatalf("expected BTC-USDT, got %s", updates[0].Symbol)
	}
}
