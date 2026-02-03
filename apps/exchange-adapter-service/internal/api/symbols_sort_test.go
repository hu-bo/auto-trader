package api

import (
	"testing"

	exchange "github.com/pkg/exchange-adapter/marketdata"
)

func fptr(v float64) *float64 { return &v }

func TestSortSymbolsInPlace_AmountDesc_NilLast(t *testing.T) {
	symbols := []exchange.SymbolInfo{
		{Symbol: "B", QuoteVolume24h: nil},
		{Symbol: "A", QuoteVolume24h: fptr(10)},
		{Symbol: "C", QuoteVolume24h: fptr(5)},
		{Symbol: "D", QuoteVolume24h: nil},
	}

	sortSymbolsInPlace(symbols, "amount24h", "desc")

	want := []string{"A", "C", "B", "D"}
	for i := range want {
		if symbols[i].Symbol != want[i] {
			t.Fatalf("idx %d: got %s want %s", i, symbols[i].Symbol, want[i])
		}
	}
}

func TestSortSymbolsInPlace_ChangeAsc(t *testing.T) {
	symbols := []exchange.SymbolInfo{
		{Symbol: "A", PriceChangePct24h: fptr(10)},
		{Symbol: "B", PriceChangePct24h: fptr(-1)},
		{Symbol: "C", PriceChangePct24h: fptr(0)},
	}

	sortSymbolsInPlace(symbols, "change24h", "asc")

	want := []string{"B", "C", "A"}
	for i := range want {
		if symbols[i].Symbol != want[i] {
			t.Fatalf("idx %d: got %s want %s", i, symbols[i].Symbol, want[i])
		}
	}
}

func TestSortSymbolsInPlace_UnknownOrderBy_NoChange(t *testing.T) {
	symbols := []exchange.SymbolInfo{
		{Symbol: "B"},
		{Symbol: "A"},
	}

	sortSymbolsInPlace(symbols, "unknown", "desc")

	// unknown orderBy -> treated as no value for all -> falls back to Symbol asc
	if symbols[0].Symbol != "A" || symbols[1].Symbol != "B" {
		t.Fatalf("got %v", []string{symbols[0].Symbol, symbols[1].Symbol})
	}
}
