package api

import (
	"sort"

	"exchange-sync/internal/exchange"
)

// sortSymbolsInPlace sorts symbols according to orderBy/order.
//
// Supported orderBy values:
//   - amount / amount24h / quoteVolume / quoteVolume24h / turnover
//   - change / change24h / pct / pct24h / priceChange / priceChangePct24h
//
// order: "asc" or "desc" (defaults to "desc").
// Symbols with missing values are always placed last.
func sortSymbolsInPlace(symbols []exchange.SymbolInfo, orderBy string, order string) {
	if orderBy == "" {
		return
	}

	desc := true
	if order == "asc" {
		desc = false
	} else if order == "desc" {
		desc = true
	}

	getVal := func(si exchange.SymbolInfo) (*float64, bool) {
		switch orderBy {
		case "amount", "amount24h", "quoteVolume", "quoteVolume24h", "turnover":
			if si.QuoteVolume24h == nil {
				return nil, false
			}
			return si.QuoteVolume24h, true
		case "change", "change24h", "pct", "pct24h", "priceChange", "priceChangePct24h":
			if si.PriceChangePct24h == nil {
				return nil, false
			}
			return si.PriceChangePct24h, true
		default:
			return nil, false
		}
	}

	sort.SliceStable(symbols, func(i, j int) bool {
		vi, okI := getVal(symbols[i])
		vj, okJ := getVal(symbols[j])

		// Missing values always go last
		if !okI && !okJ {
			return symbols[i].Symbol < symbols[j].Symbol
		}
		if !okI {
			return false
		}
		if !okJ {
			return true
		}

		if desc {
			return *vi > *vj
		}
		return *vi < *vj
	})
}
