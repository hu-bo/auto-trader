package okx

import (
	"testing"

	md "github.com/pkg/exchange-adapter/marketdata"
)

func TestCanonicalSymbolSetMatchesUnifiedAndRaw(t *testing.T) {
	set := buildCanonicalSymbolSet([]string{"BTC-USDT-SWAP", "ethusdt"})

	if !inCanonicalSymbolSet(set, "BTC-USDT", "BTC-USDT-SWAP") {
		t.Fatal("expected BTC-USDT to match BTC-USDT-SWAP blacklist entry")
	}
	if !inCanonicalSymbolSet(set, "ETH-USDT") {
		t.Fatal("expected ETH-USDT to match ethusdt blacklist entry")
	}
	if inCanonicalSymbolSet(set, "SOL-USDT") {
		t.Fatal("did not expect SOL-USDT to match blacklist")
	}
}

func TestHandleIndexTickers_OnlyActiveSymbolsPass(t *testing.T) {
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

	a.handleIndexTickers("BTC-USDT", md.Futures, []byte(`[
		{"instId":"BTC-USDT","idxPx":"50000","ts":"1609459200000"},
		{"instId":"ETH-USDT","idxPx":"3000","ts":"1609459201000"}
	]`))

	if len(updates) != 1 {
		t.Fatalf("expected exactly 1 ticker update, got %d", len(updates))
	}
	if updates[0].Symbol != "BTC-USDT" {
		t.Fatalf("expected BTC-USDT, got %s", updates[0].Symbol)
	}
}
