package okx

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/exchange-adapter/core"
	okxapi "github.com/pkg/okx-api"
	okxtypes "github.com/pkg/okx-api/types"
	okxrest "github.com/pkg/okx-api/types/rest"
	okxutil "github.com/pkg/okx-api/util"
)

type PublicAdapter struct {
	core.BasePublicAdapter

	client  *okxapi.RestClient
	initErr error
}

func NewPublicAdapter(options *core.AdapterOptions) *PublicAdapter {
	demonet := true
	if options != nil && options.Demonet != nil {
		demonet = *options.Demonet
	}

	proxyURL := ""
	socksProxyURL := ""
	if options != nil {
		proxyURL = options.HTTPSProxy
		socksProxyURL = options.SOCKSProxy
	}

	client, err := okxapi.NewRestClient(okxrest.RestClientOptions{
		Market:          okxtypes.APIMarketGLOBAL,
		DemoTrading:     demonet,
		ParseExceptions: true,
		Proxy:           proxyURL,
		SocksProxy:      socksProxyURL,
	})

	return &PublicAdapter{
		BasePublicAdapter: core.NewBasePublicAdapter(core.ExchangeOKX, time.Hour),
		client:            client,
		initErr:           err,
	}
}

func (a *PublicAdapter) ToRawSymbol(symbol string, tradeType core.TradeType) string {
	return unifiedToRawSymbol(symbol, tradeType)
}

func (a *PublicAdapter) FromRawSymbol(rawSymbol string, _ core.TradeType) string {
	return rawToUnifiedSymbol(rawSymbol)
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

type okxInstrument struct {
	InstID   string `json:"instId"`
	BaseCcy  string `json:"baseCcy"`
	QuoteCcy string `json:"quoteCcy"`
	TickSz   string `json:"tickSz"`
	LotSz    string `json:"lotSz"`
	MinSz    string `json:"minSz"`
	MaxLmtSz string `json:"maxLmtSz"`
	State    string `json:"state"`
	CtVal    string `json:"ctVal,omitempty"`
	Lever    string `json:"lever,omitempty"`
}

type getInstrumentsParams struct {
	InstType string `json:"instType"`
	InstID   string `json:"instId,omitempty"`
}

func (a *PublicAdapter) GetAllSymbols(ctx context.Context, tradeType core.TradeType) core.Result[[]core.SymbolInfo] {
	if a.initErr != nil {
		return core.Err[[]core.SymbolInfo](core.ErrorInfo{Code: "INIT_ERROR", Message: a.initErr.Error(), Raw: a.initErr})
	}

	raw, err := a.client.GetInstruments(ctx, getInstrumentsParams{InstType: tradeTypeToInstType(tradeType)})
	if err != nil {
		return core.Err[[]core.SymbolInfo](wrapAPIError("GET_ALL_SYMBOLS_ERROR", err))
	}

	var insts []okxInstrument
	if uerr := json.Unmarshal(raw, &insts); uerr != nil {
		return core.Err[[]core.SymbolInfo](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}

	// OKX delivery futures have multiple expiries per base/quote, which would collide in our symbol cache.
	// Deduplicate by selecting the earliest expiry (lexicographically) per unified symbol.
	if tradeType == core.TradeTypeDelivery {
		insts = dedupDeliveryInstruments(insts)
	}

	out := make([]core.SymbolInfo, 0, len(insts))
	for _, inst := range insts {
		info := transformSymbolInfo(inst, tradeType)
		out = append(out, info)
	}

	a.SetCachedSymbols(tradeType, out)
	return core.Ok(out)
}

func dedupDeliveryInstruments(insts []okxInstrument) []okxInstrument {
	best := make(map[string]okxInstrument)
	for _, inst := range insts {
		unified := rawToUnifiedSymbol(inst.InstID)
		prev, ok := best[unified]
		if !ok {
			best[unified] = inst
			continue
		}

		prevDate := deliveryExpiry(prev.InstID)
		thisDate := deliveryExpiry(inst.InstID)

		// If we can compare expiry, pick the earliest; otherwise keep the existing one.
		if thisDate != "" && (prevDate == "" || thisDate < prevDate) {
			best[unified] = inst
		}
	}

	keys := make([]string, 0, len(best))
	for k := range best {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	out := make([]okxInstrument, 0, len(best))
	for _, k := range keys {
		out = append(out, best[k])
	}
	return out
}

func deliveryExpiry(instID string) string {
	parts := strings.Split(instID, "-")
	if len(parts) == 3 && isDigits(parts[2]) {
		return parts[2]
	}
	return ""
}

func transformSymbolInfo(inst okxInstrument, tradeType core.TradeType) core.SymbolInfo {
	parts := strings.Split(inst.InstID, "-")
	unifiedSymbol := rawToUnifiedSymbol(inst.InstID)

	base := inst.BaseCcy
	quote := inst.QuoteCcy
	if base == "" && len(parts) > 0 {
		base = parts[0]
	}
	if quote == "" && len(parts) > 1 {
		quote = parts[1]
	}

	status := core.SymbolStatusDisabled
	if strings.EqualFold(inst.State, "live") {
		status = core.SymbolStatusEnabled
	}

	var contractValue *float64
	if inst.CtVal != "" {
		if f, err := strconv.ParseFloat(inst.CtVal, 64); err == nil && f > 0 {
			contractValue = &f
		}
	}

	var maxLeverage *float64
	if inst.Lever != "" {
		if f, err := strconv.ParseFloat(inst.Lever, 64); err == nil && f > 0 {
			maxLeverage = &f
		}
	}

	return core.SymbolInfo{
		Symbol:            unifiedSymbol,
		RawSymbol:         inst.InstID,
		BaseCurrency:      base,
		QuoteCurrency:     quote,
		TradeType:         tradeType,
		TickSize:          inst.TickSz,
		StepSize:          inst.LotSz,
		MinQty:            inst.MinSz,
		MaxQty:            inst.MaxLmtSz,
		QuantityPrecision: core.GetDecimalPlaces(inst.LotSz),
		PricePrecision:    core.GetDecimalPlaces(inst.TickSz),
		Status:            status,
		ContractValue:     contractValue,
		MaxLeverage:       maxLeverage,
	}
}

type okxTicker struct {
	Last      string `json:"last"`
	High24h   string `json:"high24h"`
	Low24h    string `json:"low24h"`
	Vol24h    string `json:"vol24h"`
	VolCcy24h string `json:"volCcy24h"`
	Ts        string `json:"ts"`
}

type getTickerParams struct {
	InstID string `json:"instId"`
}

func (a *PublicAdapter) GetPrice(ctx context.Context, symbol string, tradeType core.TradeType) core.Result[string] {
	if a.initErr != nil {
		return core.Err[string](core.ErrorInfo{Code: "INIT_ERROR", Message: a.initErr.Error(), Raw: a.initErr})
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[string](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	raw, err := a.client.GetTicker(ctx, getTickerParams{InstID: instID})
	if err != nil {
		return core.Err[string](wrapAPIError(core.ErrorPriceNotFound, err))
	}

	var ticks []okxTicker
	if uerr := json.Unmarshal(raw, &ticks); uerr != nil {
		return core.Err[string](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(ticks) == 0 {
		return core.Err[string](core.ErrorInfo{Code: core.ErrorPriceNotFound, Message: "empty ticker response", Raw: string(raw)})
	}
	return core.Ok(ticks[0].Last)
}

func (a *PublicAdapter) GetTicker(ctx context.Context, symbol string, tradeType core.TradeType) core.Result[core.Ticker] {
	if a.initErr != nil {
		return core.Err[core.Ticker](core.ErrorInfo{Code: "INIT_ERROR", Message: a.initErr.Error(), Raw: a.initErr})
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[core.Ticker](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	raw, err := a.client.GetTicker(ctx, getTickerParams{InstID: instID})
	if err != nil {
		return core.Err[core.Ticker](wrapAPIError(core.ErrorTickerNotFound, err))
	}

	var ticks []okxTicker
	if uerr := json.Unmarshal(raw, &ticks); uerr != nil {
		return core.Err[core.Ticker](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(ticks) == 0 {
		return core.Err[core.Ticker](core.ErrorInfo{Code: core.ErrorTickerNotFound, Message: "empty ticker response", Raw: string(raw)})
	}

	ts, _ := strconv.ParseInt(ticks[0].Ts, 10, 64)
	return core.Ok(core.Ticker{
		Symbol:      symbol,
		Last:        ticks[0].Last,
		High:        ticks[0].High24h,
		Low:         ticks[0].Low24h,
		Volume:      ticks[0].Vol24h,
		QuoteVolume: ticks[0].VolCcy24h,
		Timestamp:   ts,
		Raw:         json.RawMessage(raw),
	})
}

type okxOrderBook struct {
	Asks [][]string `json:"asks"`
	Bids [][]string `json:"bids"`
	Ts   string     `json:"ts"`
}

type getOrderBookParams struct {
	InstID string `json:"instId"`
	Sz     string `json:"sz,omitempty"`
}

func (a *PublicAdapter) GetOrderBook(ctx context.Context, symbol string, tradeType core.TradeType, limit int) core.Result[core.OrderBook] {
	if a.initErr != nil {
		return core.Err[core.OrderBook](core.ErrorInfo{Code: "INIT_ERROR", Message: a.initErr.Error(), Raw: a.initErr})
	}
	if limit <= 0 {
		limit = 20
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[core.OrderBook](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	raw, err := a.client.GetOrderBook(ctx, getOrderBookParams{InstID: instID, Sz: strconv.Itoa(limit)})
	if err != nil {
		return core.Err[core.OrderBook](wrapAPIError(core.ErrorOrderBookNotFound, err))
	}

	var books []okxOrderBook
	if uerr := json.Unmarshal(raw, &books); uerr != nil {
		return core.Err[core.OrderBook](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(books) == 0 {
		return core.Err[core.OrderBook](core.ErrorInfo{Code: core.ErrorOrderBookNotFound, Message: "empty order book response", Raw: string(raw)})
	}

	book := books[0]
	asks := make([][2]string, 0, len(book.Asks))
	for _, a := range book.Asks {
		if len(a) < 2 {
			continue
		}
		asks = append(asks, [2]string{a[0], a[1]})
	}
	bids := make([][2]string, 0, len(book.Bids))
	for _, b := range book.Bids {
		if len(b) < 2 {
			continue
		}
		bids = append(bids, [2]string{b[0], b[1]})
	}

	ts, _ := strconv.ParseInt(book.Ts, 10, 64)
	return core.Ok(core.OrderBook{
		Symbol:    symbol,
		Asks:      asks,
		Bids:      bids,
		Timestamp: ts,
		Raw:       json.RawMessage(raw),
	})
}

type okxMarkPrice struct {
	MarkPx string `json:"markPx"`
}

type getMarkPriceParams struct {
	InstID string `json:"instId"`
}

func (a *PublicAdapter) GetMarkPrice(ctx context.Context, symbol string, tradeType core.TradeType) core.Result[string] {
	if tradeType == core.TradeTypeSpot {
		return a.GetPrice(ctx, symbol, tradeType)
	}
	if a.initErr != nil {
		return core.Err[string](core.ErrorInfo{Code: "INIT_ERROR", Message: a.initErr.Error(), Raw: a.initErr})
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[string](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	raw, err := a.client.GetMarkPrice(ctx, getMarkPriceParams{InstID: instID})
	if err != nil {
		return core.Err[string](wrapAPIError(core.ErrorMarkPriceNotFound, err))
	}

	var mp []okxMarkPrice
	if uerr := json.Unmarshal(raw, &mp); uerr != nil {
		return core.Err[string](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(mp) == 0 {
		return core.Err[string](core.ErrorInfo{Code: core.ErrorMarkPriceNotFound, Message: "empty mark price response", Raw: string(raw)})
	}
	return core.Ok(mp[0].MarkPx)
}

func (a *PublicAdapter) resolveInstID(ctx context.Context, symbol string, tradeType core.TradeType) (string, error) {
	// For SPOT/FUTURES, we can derive deterministically.
	if tradeType == core.TradeTypeSpot || tradeType == core.TradeTypeFutures {
		return unifiedToRawSymbol(symbol, tradeType), nil
	}

	// Delivery needs the expiry suffix. If the caller passes an instId-like value, accept it.
	if detectTradeTypeFromInstID(symbol) == core.TradeTypeDelivery {
		return symbol, nil
	}

	info := a.GetSymbolInfo(ctx, symbol, tradeType)
	if info.Ok {
		return info.Data.RawSymbol, nil
	}
	return "", fmt.Errorf("failed to resolve instId for %s (%s)", symbol, tradeType)
}

func wrapAPIError(fallbackCode string, err error) core.ErrorInfo {
	if err == nil {
		return core.ErrorInfo{Code: fallbackCode, Message: "unknown error"}
	}
	if apiErr, ok := err.(*okxutil.APIError); ok {
		code := apiErr.Code
		if code == "" {
			code = fallbackCode
		}
		msg := apiErr.Message
		if msg == "" {
			msg = apiErr.Error()
		}
		return core.ErrorInfo{Code: code, Message: msg, Raw: apiErr}
	}
	return core.ErrorInfo{Code: fallbackCode, Message: err.Error(), Raw: err}
}
