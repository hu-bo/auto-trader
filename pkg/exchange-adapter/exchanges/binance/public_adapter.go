package binance

import (
	"context"
	"fmt"
	"time"

	binanceapi "github.com/pkg/binance-api"
	btypes "github.com/pkg/binance-api/types"
	"github.com/pkg/exchange-adapter/core"
)

type PublicAdapter struct {
	core.BasePublicAdapter

	spot     *binanceapi.MainClient
	futures  *binanceapi.USDMClient
	delivery *binanceapi.COINMClient
}

func NewPublicAdapter(options *core.AdapterOptions) *PublicAdapter {
	demonet := true
	if options != nil && options.Demonet != nil {
		demonet = *options.Demonet
	}

	spot := binanceapi.NewMainClient(binanceapi.MainClientOptions{Testnet: demonet})
	futures := binanceapi.NewUSDMClient(binanceapi.USDMClientOptions{Testnet: demonet})
	delivery := binanceapi.NewCOINMClient(binanceapi.COINMClientOptions{Testnet: demonet})

	return &PublicAdapter{
		BasePublicAdapter: core.NewBasePublicAdapter(core.ExchangeBinance, time.Hour),
		spot:              spot,
		futures:           futures,
		delivery:          delivery,
	}
}

func (a *PublicAdapter) ToRawSymbol(symbol string, tradeType core.TradeType) string {
	return unifiedToRawSymbol(symbol, tradeType)
}

func (a *PublicAdapter) FromRawSymbol(rawSymbol string, tradeType core.TradeType) string {
	return rawToUnifiedSymbol(rawSymbol, tradeType)
}

func (a *PublicAdapter) GetSymbolInfo(ctx context.Context, symbol string, tradeType core.TradeType) core.Result[core.SymbolInfo] {
	if cached, ok := a.GetCachedSymbol(symbol, tradeType); ok {
		return core.Ok(cached)
	}
	all := a.GetAllSymbols(ctx, tradeType)
	if !all.Ok {
		return core.Err[core.SymbolInfo](*all.Error)
	}
	for _, info := range all.Data {
		if info.Symbol == symbol {
			return core.Ok(info)
		}
	}
	return core.Err[core.SymbolInfo](core.ErrorInfo{
		Code:    core.ErrorSymbolNotFound,
		Message: fmt.Sprintf("symbol not found: %s (%s)", symbol, tradeType),
	})
}

type exchangeInfoFilter struct {
	FilterType string `json:"filterType"`
	TickSize   string `json:"tickSize,omitempty"`
	StepSize   string `json:"stepSize,omitempty"`
	MinQty     string `json:"minQty,omitempty"`
	MaxQty     string `json:"maxQty,omitempty"`
}

type spotExchangeInfo struct {
	Symbols []struct {
		Symbol             string               `json:"symbol"`
		Status             string               `json:"status"`
		BaseAsset          string               `json:"baseAsset"`
		QuoteAsset         string               `json:"quoteAsset"`
		BaseAssetPrecision int                  `json:"baseAssetPrecision"`
		QuotePrecision     int                  `json:"quotePrecision"`
		Filters            []exchangeInfoFilter `json:"filters"`
	} `json:"symbols"`
}

type futuresExchangeInfo struct {
	Symbols []struct {
		Symbol            string               `json:"symbol"`
		Status            string               `json:"status"`
		BaseAsset         string               `json:"baseAsset"`
		QuoteAsset        string               `json:"quoteAsset"`
		PricePrecision    int                  `json:"pricePrecision"`
		QuantityPrecision int                  `json:"quantityPrecision"`
		ContractType      string               `json:"contractType"`
		Filters           []exchangeInfoFilter `json:"filters"`
	} `json:"symbols"`
}

func (a *PublicAdapter) GetAllSymbols(ctx context.Context, tradeType core.TradeType) core.Result[[]core.SymbolInfo] {
	switch tradeType {
	case core.TradeTypeSpot:
		var raw spotExchangeInfo
		if err := a.spot.Get(ctx, "/api/v3/exchangeInfo", nil, false, &raw); err != nil {
			return core.Err[[]core.SymbolInfo](core.ErrorInfo{Code: core.ErrorSymbolNotFound, Message: err.Error(), Raw: err})
		}
		out := make([]core.SymbolInfo, 0, len(raw.Symbols))
		for _, s := range raw.Symbols {
			tickSize, stepSize, minQty, maxQty := extractFilters(s.Filters)
			enabled := core.SymbolStatusDisabled
			if s.Status == "TRADING" {
				enabled = core.SymbolStatusEnabled
			}
			unified := rawToUnifiedSymbol(s.Symbol, tradeType)
			info := core.SymbolInfo{
				Symbol:            unified,
				RawSymbol:         s.Symbol,
				BaseCurrency:      s.BaseAsset,
				QuoteCurrency:     s.QuoteAsset,
				TradeType:         tradeType,
				TickSize:          tickSize,
				StepSize:          stepSize,
				MinQty:            minQty,
				MaxQty:            maxQty,
				QuantityPrecision: core.GetDecimalPlaces(stepSize),
				PricePrecision:    core.GetDecimalPlaces(tickSize),
				Status:            enabled,
			}
			out = append(out, info)
		}
		a.SetCachedSymbols(tradeType, out)
		return core.Ok(out)

	case core.TradeTypeFutures:
		var raw futuresExchangeInfo
		if err := a.futures.Get(ctx, "/fapi/v1/exchangeInfo", nil, false, &raw); err != nil {
			return core.Err[[]core.SymbolInfo](core.ErrorInfo{Code: core.ErrorSymbolNotFound, Message: err.Error(), Raw: err})
		}
		out := make([]core.SymbolInfo, 0, len(raw.Symbols))
		for _, s := range raw.Symbols {
			tickSize, stepSize, minQty, maxQty := extractFilters(s.Filters)
			enabled := core.SymbolStatusDisabled
			if s.Status == "TRADING" {
				enabled = core.SymbolStatusEnabled
			}
			unified := rawToUnifiedSymbol(s.Symbol, tradeType)
			info := core.SymbolInfo{
				Symbol:            unified,
				RawSymbol:         s.Symbol,
				BaseCurrency:      s.BaseAsset,
				QuoteCurrency:     s.QuoteAsset,
				TradeType:         tradeType,
				TickSize:          tickSize,
				StepSize:          stepSize,
				MinQty:            minQty,
				MaxQty:            maxQty,
				QuantityPrecision: s.QuantityPrecision,
				PricePrecision:    s.PricePrecision,
				Status:            enabled,
			}
			out = append(out, info)
		}
		a.SetCachedSymbols(tradeType, out)
		return core.Ok(out)

	case core.TradeTypeDelivery:
		var raw futuresExchangeInfo
		if err := a.delivery.Get(ctx, "/dapi/v1/exchangeInfo", nil, false, &raw); err != nil {
			return core.Err[[]core.SymbolInfo](core.ErrorInfo{Code: core.ErrorSymbolNotFound, Message: err.Error(), Raw: err})
		}
		out := make([]core.SymbolInfo, 0, len(raw.Symbols))
		for _, s := range raw.Symbols {
			tickSize, stepSize, minQty, maxQty := extractFilters(s.Filters)
			enabled := core.SymbolStatusDisabled
			if s.Status == "TRADING" {
				enabled = core.SymbolStatusEnabled
			}
			unified := rawToUnifiedSymbol(s.Symbol, tradeType)
			info := core.SymbolInfo{
				Symbol:            unified,
				RawSymbol:         s.Symbol,
				BaseCurrency:      s.BaseAsset,
				QuoteCurrency:     s.QuoteAsset,
				TradeType:         tradeType,
				TickSize:          tickSize,
				StepSize:          stepSize,
				MinQty:            minQty,
				MaxQty:            maxQty,
				QuantityPrecision: s.QuantityPrecision,
				PricePrecision:    s.PricePrecision,
				Status:            enabled,
			}
			out = append(out, info)
		}
		a.SetCachedSymbols(tradeType, out)
		return core.Ok(out)

	default:
		return core.Err[[]core.SymbolInfo](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func extractFilters(filters []exchangeInfoFilter) (tickSize, stepSize, minQty, maxQty string) {
	for _, f := range filters {
		switch f.FilterType {
		case "PRICE_FILTER":
			tickSize = f.TickSize
		case "LOT_SIZE":
			stepSize = f.StepSize
			minQty = f.MinQty
			maxQty = f.MaxQty
		}
	}
	return tickSize, stepSize, minQty, maxQty
}

func (a *PublicAdapter) GetPrice(ctx context.Context, symbol string, tradeType core.TradeType) core.Result[string] {
	raw := unifiedToRawSymbol(symbol, tradeType)

	switch tradeType {
	case core.TradeTypeSpot:
		resp, err := a.spot.GetSymbolPrice(ctx, raw)
		if err != nil {
			return core.Err[string](core.ErrorInfo{Code: core.ErrorPriceNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(resp.Price)
	case core.TradeTypeFutures:
		resp, err := a.futures.GetSymbolPrice(ctx, raw)
		if err != nil {
			return core.Err[string](core.ErrorInfo{Code: core.ErrorPriceNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(resp.Price)
	case core.TradeTypeDelivery:
		resp, err := a.delivery.GetSymbolPrice(ctx, raw)
		if err != nil {
			return core.Err[string](core.ErrorInfo{Code: core.ErrorPriceNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(resp.Price)
	default:
		return core.Err[string](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *PublicAdapter) GetMarkPrice(ctx context.Context, symbol string, tradeType core.TradeType) core.Result[string] {
	if tradeType == core.TradeTypeSpot {
		return a.GetPrice(ctx, symbol, tradeType)
	}

	raw := unifiedToRawSymbol(symbol, tradeType)

	switch tradeType {
	case core.TradeTypeFutures:
		resp, err := a.futures.GetMarkPrice(ctx, raw)
		if err != nil {
			return core.Err[string](core.ErrorInfo{Code: core.ErrorMarkPriceNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(resp.MarkPrice)
	case core.TradeTypeDelivery:
		resp, err := a.delivery.GetMarkPrice(ctx, raw)
		if err != nil {
			return core.Err[string](core.ErrorInfo{Code: core.ErrorMarkPriceNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(resp.MarkPrice)
	default:
		return core.Err[string](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *PublicAdapter) GetTicker(ctx context.Context, symbol string, tradeType core.TradeType) core.Result[core.Ticker] {
	raw := unifiedToRawSymbol(symbol, tradeType)

	now := time.Now().UnixMilli()
	switch tradeType {
	case core.TradeTypeSpot:
		var resp btypes.ChangeStats24hr
		err := a.spot.Get(ctx, "/api/v3/ticker/24hr", map[string]interface{}{"symbol": raw}, false, &resp)
		if err != nil {
			return core.Err[core.Ticker](core.ErrorInfo{Code: core.ErrorTickerNotFound, Message: err.Error(), Raw: err})
		}
		ts := resp.CloseTime
		if ts == 0 {
			ts = now
		}
		return core.Ok(core.Ticker{
			Symbol:      rawToUnifiedSymbol(resp.Symbol, tradeType),
			Last:        resp.LastPrice,
			High:        resp.HighPrice,
			Low:         resp.LowPrice,
			Volume:      resp.Volume,
			QuoteVolume: resp.QuoteVolume,
			Timestamp:   ts,
			Raw:         resp,
		})
	case core.TradeTypeFutures:
		resp, err := a.futures.Get24hrChangeStatistics(ctx, raw)
		if err != nil {
			return core.Err[core.Ticker](core.ErrorInfo{Code: core.ErrorTickerNotFound, Message: err.Error(), Raw: err})
		}
		ts := resp.CloseTime
		if ts == 0 {
			ts = now
		}
		return core.Ok(core.Ticker{
			Symbol:      rawToUnifiedSymbol(resp.Symbol, tradeType),
			Last:        resp.LastPrice,
			High:        resp.HighPrice,
			Low:         resp.LowPrice,
			Volume:      resp.Volume,
			QuoteVolume: resp.QuoteVolume,
			Timestamp:   ts,
			Raw:         resp,
		})
	case core.TradeTypeDelivery:
		var resp btypes.ChangeStats24hr
		err := a.delivery.Get(ctx, "/dapi/v1/ticker/24hr", map[string]interface{}{"symbol": raw}, false, &resp)
		if err != nil {
			return core.Err[core.Ticker](core.ErrorInfo{Code: core.ErrorTickerNotFound, Message: err.Error(), Raw: err})
		}
		ts := resp.CloseTime
		if ts == 0 {
			ts = now
		}
		return core.Ok(core.Ticker{
			Symbol:      rawToUnifiedSymbol(resp.Symbol, tradeType),
			Last:        resp.LastPrice,
			High:        resp.HighPrice,
			Low:         resp.LowPrice,
			Volume:      resp.Volume,
			QuoteVolume: resp.QuoteVolume,
			Timestamp:   ts,
			Raw:         resp,
		})
	default:
		return core.Err[core.Ticker](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *PublicAdapter) GetOrderBook(ctx context.Context, symbol string, tradeType core.TradeType, limit int) core.Result[core.OrderBook] {
	raw := unifiedToRawSymbol(symbol, tradeType)
	if limit <= 0 {
		limit = 20
	}

	switch tradeType {
	case core.TradeTypeSpot:
		resp, err := a.spot.GetOrderBook(ctx, btypes.OrderBookParams{Symbol: raw, Limit: normalizeOrderBookLimit(limit)})
		if err != nil {
			return core.Err[core.OrderBook](core.ErrorInfo{Code: core.ErrorOrderBookNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(mapOrderBook(rawToUnifiedSymbol(raw, tradeType), resp.Bids, resp.Asks, time.Now().UnixMilli(), resp))
	case core.TradeTypeFutures:
		resp, err := a.futures.GetOrderBook(ctx, btypes.OrderBookParams{Symbol: raw, Limit: normalizeOrderBookLimit(limit)})
		if err != nil {
			return core.Err[core.OrderBook](core.ErrorInfo{Code: core.ErrorOrderBookNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(mapOrderBook(rawToUnifiedSymbol(raw, tradeType), resp.Bids, resp.Asks, time.Now().UnixMilli(), resp))
	case core.TradeTypeDelivery:
		resp, err := a.delivery.GetOrderBook(ctx, btypes.OrderBookParams{Symbol: raw, Limit: normalizeOrderBookLimit(limit)})
		if err != nil {
			return core.Err[core.OrderBook](core.ErrorInfo{Code: core.ErrorOrderBookNotFound, Message: err.Error(), Raw: err})
		}
		return core.Ok(mapOrderBook(rawToUnifiedSymbol(raw, tradeType), resp.Bids, resp.Asks, time.Now().UnixMilli(), resp))
	default:
		return core.Err[core.OrderBook](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func normalizeOrderBookLimit(limit int) int {
	switch limit {
	case 5, 10, 20, 50, 100, 500, 1000, 5000:
		return limit
	default:
		if limit <= 10 {
			return 10
		}
		if limit <= 20 {
			return 20
		}
		if limit <= 50 {
			return 50
		}
		if limit <= 100 {
			return 100
		}
		if limit <= 500 {
			return 500
		}
		if limit <= 1000 {
			return 1000
		}
		return 5000
	}
}

func mapOrderBook(symbol string, bids []btypes.OrderBookRow, asks []btypes.OrderBookRow, ts int64, raw any) core.OrderBook {
	outBids := make([][2]string, 0, len(bids))
	for _, b := range bids {
		outBids = append(outBids, [2]string{b[0], b[1]})
	}
	outAsks := make([][2]string, 0, len(asks))
	for _, a := range asks {
		outAsks = append(outAsks, [2]string{a[0], a[1]})
	}
	return core.OrderBook{
		Symbol:    symbol,
		Bids:      outBids,
		Asks:      outAsks,
		Timestamp: ts,
		Raw:       raw,
	}
}
