package okx

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/exchange-adapter/core"
	okxapi "github.com/pkg/okx-api"
	okxtypes "github.com/pkg/okx-api/types"
	okxrest "github.com/pkg/okx-api/types/rest"
	okxutil "github.com/pkg/okx-api/util"
)

type TradeAdapterOptions struct {
	APIKey    string
	APISecret string
	APIPass   string
	Options   *core.AdapterOptions

	PublicAdapter *PublicAdapter
}

type TradeAdapter struct {
	*core.BaseTradeAdapter

	public  *PublicAdapter
	client  *okxapi.RestClient
	initErr error
}

func NewTradeAdapter(opts TradeAdapterOptions) *TradeAdapter {
	demonet := true
	if opts.Options != nil && opts.Options.Demonet != nil {
		demonet = *opts.Options.Demonet
	}

	proxyURL := ""
	socksProxyURL := ""
	if opts.Options != nil {
		proxyURL = opts.Options.HTTPSProxy
		socksProxyURL = opts.Options.SOCKSProxy
	}

	public := opts.PublicAdapter
	if public == nil {
		public = NewPublicAdapter(opts.Options)
	}

	client, err := okxapi.NewRestClient(okxrest.RestClientOptions{
		APIKey:          opts.APIKey,
		APISecret:       opts.APISecret,
		APIPass:         opts.APIPass,
		Market:          okxtypes.APIMarketGLOBAL,
		DemoTrading:     demonet,
		ParseExceptions: true,
		Proxy:           proxyURL,
		SocksProxy:      socksProxyURL,
	})

	a := &TradeAdapter{
		public:  public,
		client:  client,
		initErr: err,
	}
	a.BaseTradeAdapter = core.NewBaseTradeAdapter(public, a)
	return a
}

// ============================================================================//
// TradeAdapterImpl
// ============================================================================//

func (a *TradeAdapter) GenerateClientOrderID(_ core.TradeType) string {
	const prefix = "hbokx"
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	const totalLen = 32

	n := totalLen - len(prefix)
	if n <= 0 {
		return prefix
	}

	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		// Fallback to timestamp-derived pseudo randomness.
		now := time.Now().UnixNano()
		for i := range buf {
			buf[i] = byte(now >> (i % 8 * 8))
		}
	}

	for i := range buf {
		buf[i] = chars[int(buf[i])%len(chars)]
	}
	return prefix + string(buf)
}

func (a *TradeAdapter) GetBatchOrderLimits() core.BatchOrderLimits {
	return core.BatchOrderLimits{
		MaxBatchSize:        20,
		SupportedTradeTypes: []core.TradeType{core.TradeTypeSpot, core.TradeTypeFutures, core.TradeTypeDelivery},
	}
}

type okxBalanceEnvelope struct {
	Details []struct {
		Ccy       string `json:"ccy"`
		AvailBal  string `json:"availBal"`
		FrozenBal string `json:"frozenBal"`
		CashBal   string `json:"cashBal"`
	} `json:"details"`
}

func (a *TradeAdapter) GetBalance(ctx context.Context, _ core.TradeType) core.Result[[]core.Balance] {
	if err := a.ensureReady(); err != nil {
		return core.Err[[]core.Balance](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	raw, err := a.client.GetBalance(ctx, nil)
	if err != nil {
		return core.Err[[]core.Balance](wrapAPIError("GET_BALANCE_ERROR", err))
	}

	var envs []okxBalanceEnvelope
	if uerr := json.Unmarshal(raw, &envs); uerr != nil {
		return core.Err[[]core.Balance](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(envs) == 0 {
		return core.Ok([]core.Balance{})
	}

	out := make([]core.Balance, 0, len(envs[0].Details))
	for _, d := range envs[0].Details {
		out = append(out, core.Balance{
			Asset:  d.Ccy,
			Free:   d.AvailBal,
			Locked: d.FrozenBal,
			Total:  d.CashBal,
		})
	}
	return core.Ok(out)
}

type okxPosition struct {
	InstID  string `json:"instId"`
	PosSide string `json:"posSide"`
	Pos     string `json:"pos"`
	AvgPx   string `json:"avgPx"`
	Upl     string `json:"upl"`
	Lever   string `json:"lever"`
	MgnMode string `json:"mgnMode"`
	LiqPx   string `json:"liqPx"`
}

type getPositionsParams struct {
	InstType string `json:"instType,omitempty"`
	InstID   string `json:"instId,omitempty"`
}

func (a *TradeAdapter) GetPositions(ctx context.Context, symbol *string, tradeType *core.TradeType) core.Result[[]core.Position] {
	if err := a.ensureReady(); err != nil {
		return core.Err[[]core.Position](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	// If tradeType unspecified: merge futures + delivery.
	if tradeType == nil {
		futures := core.TradeTypeFutures
		delivery := core.TradeTypeDelivery

		fRes := a.GetPositions(ctx, symbol, &futures)
		dRes := a.GetPositions(ctx, symbol, &delivery)

		if !fRes.Ok && !dRes.Ok {
			return core.Err[[]core.Position](*fRes.Error)
		}

		out := make([]core.Position, 0)
		if fRes.Ok {
			out = append(out, fRes.Data...)
		}
		if dRes.Ok {
			out = append(out, dRes.Data...)
		}
		return core.Ok(out)
	}

	if *tradeType == core.TradeTypeSpot {
		return core.Ok([]core.Position{})
	}

	params := getPositionsParams{InstType: tradeTypeToInstType(*tradeType)}

	// For delivery, instId must include expiry; if not, we fetch all and filter by unified symbol.
	filterSymbol := ""
	if symbol != nil && *symbol != "" {
		instID, ok := a.tryResolveInstID(ctx, *symbol, *tradeType)
		if ok && (detectTradeTypeFromInstID(instID) == *tradeType || *tradeType != core.TradeTypeDelivery) {
			params.InstID = instID
		} else {
			filterSymbol = strings.ToUpper(*symbol)
		}
	}

	raw, err := a.client.GetPositions(ctx, params)
	if err != nil {
		return core.Err[[]core.Position](wrapAPIError("GET_POSITIONS_ERROR", err))
	}

	var positions []okxPosition
	if uerr := json.Unmarshal(raw, &positions); uerr != nil {
		return core.Err[[]core.Position](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}

	out := make([]core.Position, 0, len(positions))
	for _, p := range positions {
		posAmt, _ := strconv.ParseFloat(p.Pos, 64)
		if math.Abs(posAmt) == 0 {
			continue
		}

		unified := rawToUnifiedSymbol(p.InstID)
		if filterSymbol != "" && strings.ToUpper(unified) != filterSymbol {
			continue
		}

		lev, _ := strconv.ParseFloat(p.Lever, 64)

		out = append(out, core.Position{
			Symbol:           unified,
			PositionSide:     core.PositionSide(strings.ToLower(p.PosSide)),
			PositionAmt:      p.Pos,
			EntryPrice:       p.AvgPx,
			UnrealizedPnl:    p.Upl,
			Leverage:         lev,
			MarginMode:       core.MarginMode(strings.ToLower(p.MgnMode)),
			LiquidationPrice: p.LiqPx,
		})
	}
	return core.Ok(out)
}

type submitOrderRequest struct {
	InstID     string `json:"instId"`
	TdMode     string `json:"tdMode"`
	Side       string `json:"side"`
	OrdType    string `json:"ordType"`
	Sz         string `json:"sz"`
	Px         string `json:"px,omitempty"`
	PosSide    string `json:"posSide,omitempty"`
	ClOrdID    string `json:"clOrdId,omitempty"`
	ReduceOnly string `json:"reduceOnly,omitempty"`
}

type okxOrderResponse struct {
	OrdID   string `json:"ordId"`
	ClOrdID string `json:"clOrdId"`
	SCode   string `json:"sCode"`
	SMsg    string `json:"sMsg"`
}

func (a *TradeAdapter) DoPlaceOrder(ctx context.Context, params core.PlaceOrderParamsFormatted, symbolInfo core.SymbolInfo) core.Result[core.Order] {
	if err := a.ensureReady(); err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	req := submitOrderRequest{
		InstID:  symbolInfo.RawSymbol,
		TdMode:  tdMode(params.TradeType, core.MarginModeCross),
		Side:    string(params.Side),
		OrdType: toRawOrderType(params.OrderType),
		Sz:      params.Quantity,
		ClOrdID: params.ClientOrderID,
	}

	if params.OrderType == core.OrderTypeLimit || params.OrderType == core.OrderTypeMakerOnly {
		if params.Price == nil {
			return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: "price is required for limit order"})
		}
		req.Px = *params.Price
	}

	if params.TradeType != core.TradeTypeSpot && params.PositionSide != nil {
		req.PosSide = string(*params.PositionSide)
	}

	if params.ReduceOnly {
		req.ReduceOnly = "true"
	}

	raw, err := a.client.SubmitOrder(ctx, req)
	if err != nil {
		return core.Err[core.Order](wrapAPIError(core.ErrorPlaceOrder, err))
	}

	var resp []okxOrderResponse
	if uerr := json.Unmarshal(raw, &resp); uerr != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(resp) == 0 {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorPlaceOrder, Message: "empty response", Raw: string(raw)})
	}
	if resp[0].SCode != "0" {
		return core.Err[core.Order](core.ErrorInfo{Code: resp[0].SCode, Message: resp[0].SMsg, Raw: resp[0]})
	}

	price := "0"
	if params.Price != nil {
		price = *params.Price
	}

	return core.Ok(core.Order{
		OrderID:       resp[0].OrdID,
		ClientOrderID: resp[0].ClOrdID,
		Symbol:        params.Symbol,
		TradeType:     params.TradeType,
		Side:          params.Side,
		PositionSide:  params.PositionSide,
		OrderType:     params.OrderType,
		Status:        core.OrderStatusOpen,
		Price:         price,
		AvgPrice:      "0",
		Quantity:      params.Quantity,
		FilledQty:     "0",
		ReduceOnly:    params.ReduceOnly,
		Raw:           json.RawMessage(raw),
	})
}

func (a *TradeAdapter) DoBatchPlaceOrder(
	ctx context.Context,
	paramsList []core.PlaceOrderParamsFormatted,
	symbolInfoMap map[string]core.SymbolInfo,
) []core.Result[core.Order] {
	if err := a.ensureReady(); err != nil {
		out := make([]core.Result[core.Order], len(paramsList))
		for i := range out {
			out[i] = core.Err[core.Order](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
		}
		return out
	}

	if len(paramsList) == 0 {
		return nil
	}

	orders := make([]submitOrderRequest, 0, len(paramsList))
	for _, p := range paramsList {
		key := p.Symbol + ":" + string(p.TradeType)
		si, ok := symbolInfoMap[key]
		if !ok {
			orders = append(orders, submitOrderRequest{})
			continue
		}

		req := submitOrderRequest{
			InstID:  si.RawSymbol,
			TdMode:  tdMode(p.TradeType, core.MarginModeCross),
			Side:    string(p.Side),
			OrdType: toRawOrderType(p.OrderType),
			Sz:      p.Quantity,
			ClOrdID: p.ClientOrderID,
		}
		if p.OrderType == core.OrderTypeLimit || p.OrderType == core.OrderTypeMakerOnly {
			if p.Price != nil {
				req.Px = *p.Price
			}
		}
		if p.TradeType != core.TradeTypeSpot && p.PositionSide != nil {
			req.PosSide = string(*p.PositionSide)
		}
		if p.ReduceOnly {
			req.ReduceOnly = "true"
		}
		orders = append(orders, req)
	}

	raw, err := a.client.SubmitMultipleOrders(ctx, orders)
	if err != nil {
		out := make([]core.Result[core.Order], len(paramsList))
		for i := range out {
			out[i] = core.Err[core.Order](wrapAPIError(core.ErrorBatchPlaceOrder, err))
		}
		return out
	}

	var resp []okxOrderResponse
	if uerr := json.Unmarshal(raw, &resp); uerr != nil {
		out := make([]core.Result[core.Order], len(paramsList))
		for i := range out {
			out[i] = core.Err[core.Order](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
		}
		return out
	}

	out := make([]core.Result[core.Order], len(paramsList))
	for i := range out {
		if i >= len(resp) {
			out[i] = core.Err[core.Order](core.ErrorInfo{Code: core.ErrorBatchPlaceOrder, Message: "missing response item", Raw: string(raw)})
			continue
		}

		r := resp[i]
		if r.SCode != "0" {
			out[i] = core.Err[core.Order](core.ErrorInfo{Code: r.SCode, Message: r.SMsg, Raw: r})
			continue
		}

		p := paramsList[i]
		price := "0"
		if p.Price != nil {
			price = *p.Price
		}

		out[i] = core.Ok(core.Order{
			OrderID:       r.OrdID,
			ClientOrderID: r.ClOrdID,
			Symbol:        p.Symbol,
			TradeType:     p.TradeType,
			Side:          p.Side,
			PositionSide:  p.PositionSide,
			OrderType:     p.OrderType,
			Status:        core.OrderStatusOpen,
			Price:         price,
			AvgPrice:      "0",
			Quantity:      p.Quantity,
			FilledQty:     "0",
			ReduceOnly:    p.ReduceOnly,
			Raw:           json.RawMessage(raw),
		})
	}
	return out
}

type cancelOrderRequest struct {
	InstID string `json:"instId"`
	OrdID  string `json:"ordId"`
}

func (a *TradeAdapter) CancelOrder(ctx context.Context, symbol string, orderID string, tradeType core.TradeType) core.Result[core.Order] {
	if err := a.ensureReady(); err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	raw, err := a.client.CancelOrder(ctx, cancelOrderRequest{InstID: instID, OrdID: orderID})
	if err != nil {
		return core.Err[core.Order](wrapAPIError(core.ErrorCancelOrder, err))
	}

	var resp []okxOrderResponse
	if uerr := json.Unmarshal(raw, &resp); uerr != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(resp) == 0 {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorCancelOrder, Message: "empty response", Raw: string(raw)})
	}
	if resp[0].SCode != "0" {
		return core.Err[core.Order](core.ErrorInfo{Code: resp[0].SCode, Message: resp[0].SMsg, Raw: resp[0]})
	}

	// Fetch latest order state.
	return a.GetOrder(ctx, symbol, orderID, tradeType)
}

type getOrderDetailsParams struct {
	InstID string `json:"instId"`
	OrdID  string `json:"ordId"`
}

type okxOrderDetail struct {
	InstID     string `json:"instId"`
	OrdID      string `json:"ordId"`
	ClOrdID    string `json:"clOrdId"`
	Side       string `json:"side"`
	PosSide    string `json:"posSide"`
	OrdType    string `json:"ordType"`
	State      string `json:"state"`
	Px         string `json:"px"`
	AvgPx      string `json:"avgPx"`
	Sz         string `json:"sz"`
	AccFillSz  string `json:"accFillSz"`
	CTime      string `json:"cTime"`
	UTime      string `json:"uTime"`
	Fee        string `json:"fee,omitempty"`
	FeeCcy     string `json:"feeCcy,omitempty"`
	ReduceOnly string `json:"reduceOnly,omitempty"`
}

func (a *TradeAdapter) GetOrder(ctx context.Context, symbol string, orderID string, tradeType core.TradeType) core.Result[core.Order] {
	if err := a.ensureReady(); err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	raw, err := a.client.GetOrderDetails(ctx, getOrderDetailsParams{InstID: instID, OrdID: orderID})
	if err != nil {
		return core.Err[core.Order](wrapAPIError("GET_ORDER_ERROR", err))
	}

	var orders []okxOrderDetail
	if uerr := json.Unmarshal(raw, &orders); uerr != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(orders) == 0 {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorOrderNotFound, Message: fmt.Sprintf("order not found: %s", orderID), Raw: string(raw)})
	}

	return core.Ok(transformOrder(orders[0]))
}

type getOpenOrdersParams struct {
	InstType string `json:"instType"`
	InstID   string `json:"instId,omitempty"`
}

func (a *TradeAdapter) GetOpenOrders(ctx context.Context, symbol *string, tradeType *core.TradeType) core.Result[[]core.Order] {
	if err := a.ensureReady(); err != nil {
		return core.Err[[]core.Order](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	if tradeType == nil {
		types := []core.TradeType{core.TradeTypeSpot, core.TradeTypeFutures, core.TradeTypeDelivery}
		out := make([]core.Order, 0)
		var firstErr *core.ErrorInfo
		for _, tt := range types {
			ttCopy := tt
			res := a.GetOpenOrders(ctx, symbol, &ttCopy)
			if res.Ok {
				out = append(out, res.Data...)
				continue
			}
			if firstErr == nil {
				firstErr = res.Error
			}
		}
		if len(out) == 0 && firstErr != nil {
			return core.Err[[]core.Order](*firstErr)
		}
		return core.Ok(out)
	}

	params := getOpenOrdersParams{InstType: tradeTypeToInstType(*tradeType)}
	filterSymbol := ""
	if symbol != nil && *symbol != "" {
		instID, ok := a.tryResolveInstID(ctx, *symbol, *tradeType)
		// Only include instId when it is unambiguous (spot/swap, or delivery with explicit expiry).
		if ok && (*tradeType != core.TradeTypeDelivery || detectTradeTypeFromInstID(instID) == core.TradeTypeDelivery) {
			params.InstID = instID
		} else {
			filterSymbol = strings.ToUpper(*symbol)
		}
	}

	raw, err := a.client.GetOrderList(ctx, params)
	if err != nil {
		return core.Err[[]core.Order](wrapAPIError("GET_OPEN_ORDERS_ERROR", err))
	}

	var orders []okxOrderDetail
	if uerr := json.Unmarshal(raw, &orders); uerr != nil {
		return core.Err[[]core.Order](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}

	out := make([]core.Order, 0, len(orders))
	for _, o := range orders {
		co := transformOrder(o)
		if filterSymbol != "" && strings.ToUpper(co.Symbol) != filterSymbol {
			continue
		}
		out = append(out, co)
	}
	return core.Ok(out)
}

type setLeverageRequest struct {
	InstID  string `json:"instId"`
	Lever   string `json:"lever"`
	MgnMode string `json:"mgnMode"`
	PosSide string `json:"posSide,omitempty"`
}

func (a *TradeAdapter) SetLeverage(ctx context.Context, symbol string, leverage float64, tradeType core.TradeType, positionSide *core.PositionSide) core.Result[struct{}] {
	if err := a.ensureReady(); err != nil {
		return core.Err[struct{}](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}
	if tradeType == core.TradeTypeSpot {
		return core.Err[struct{}](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "cannot set leverage for spot"})
	}
	if leverage <= 0 {
		return core.Err[struct{}](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: "leverage must be > 0"})
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[struct{}](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	req := setLeverageRequest{
		InstID:  instID,
		Lever:   strconv.FormatFloat(leverage, 'f', -1, 64),
		MgnMode: string(core.MarginModeIsolated),
	}
	if positionSide != nil {
		req.PosSide = string(*positionSide)
	}

	_, err = a.client.SetLeverage(ctx, req)
	if err != nil {
		return core.Err[struct{}](wrapAPIError("SET_LEVERAGE_ERROR", err))
	}
	return core.Ok(struct{}{})
}

// ============================================================================//
// Strategy Orders (Algo)
// ============================================================================//

type okxAttachAlgoOrd struct {
	TPTriggerPx     string `json:"tpTriggerPx,omitempty"`
	TPOrdPx         string `json:"tpOrdPx,omitempty"`
	TPTriggerPxType string `json:"tpTriggerPxType,omitempty"`
	SLTriggerPx     string `json:"slTriggerPx,omitempty"`
	SLOrdPx         string `json:"slOrdPx,omitempty"`
	SLTriggerPxType string `json:"slTriggerPxType,omitempty"`
}

type placeAlgoOrderRequest struct {
	InstID      string `json:"instId"`
	TdMode      string `json:"tdMode"`
	Side        string `json:"side"`
	OrdType     string `json:"ordType"`
	Sz          string `json:"sz"`
	PosSide     string `json:"posSide,omitempty"`
	ReduceOnly  string `json:"reduceOnly,omitempty"`
	AlgoClOrdID string `json:"algoClOrdId,omitempty"`

	// Stop-loss / take-profit
	SLTriggerPx     string `json:"slTriggerPx,omitempty"`
	SLTriggerPxType string `json:"slTriggerPxType,omitempty"`
	SLOrdPx         string `json:"slOrdPx,omitempty"`
	TPTriggerPx     string `json:"tpTriggerPx,omitempty"`
	TPTriggerPxType string `json:"tpTriggerPxType,omitempty"`
	TPOrdPx         string `json:"tpOrdPx,omitempty"`

	// Trigger
	TriggerPx      string             `json:"triggerPx,omitempty"`
	TriggerPxType  string             `json:"triggerPxType,omitempty"`
	OrderPx        string             `json:"orderPx,omitempty"`
	AttachAlgoOrds []okxAttachAlgoOrd `json:"attachAlgoOrds,omitempty"`

	// Trailing stop
	CallbackRatio  string `json:"callbackRatio,omitempty"`
	CallbackSpread string `json:"callbackSpread,omitempty"`
	ActivePx       string `json:"activePx,omitempty"`
}

type okxAlgoOrderResult struct {
	AlgoID      string `json:"algoId"`
	AlgoClOrdID string `json:"algoClOrdId,omitempty"`
	SCode       string `json:"sCode"`
	SMsg        string `json:"sMsg"`
}

func (a *TradeAdapter) PlaceStrategyOrder(ctx context.Context, params core.StrategyOrderParams) core.Result[core.StrategyOrder] {
	if err := a.ensureReady(); err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	instID, err := a.resolveInstID(ctx, params.Symbol, params.TradeType)
	if err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	triggerPxType := core.TriggerPriceTypeLast
	if params.TriggerPriceType != nil {
		triggerPxType = *params.TriggerPriceType
	}

	req := placeAlgoOrderRequest{
		InstID:  instID,
		TdMode:  tdMode(params.TradeType, core.MarginModeCross),
		Side:    string(params.Side),
		OrdType: toRawStrategyOrderType(params.StrategyType),
		Sz:      strconv.FormatFloat(params.Quantity, 'f', -1, 64),
	}

	if params.TradeType != core.TradeTypeSpot && params.PositionSide != nil {
		req.PosSide = string(*params.PositionSide)
	}
	if params.ReduceOnly {
		req.ReduceOnly = "true"
	}
	if params.ClientAlgoID != "" {
		req.AlgoClOrdID = params.ClientAlgoID
	}

	// Strategy-specific fields.
	switch params.StrategyType {
	case core.StrategyOrderTypeStopLoss:
		req.SLTriggerPx = strconv.FormatFloat(params.TriggerPrice, 'f', -1, 64)
		req.SLTriggerPxType = string(triggerPxType)
		req.SLOrdPx = "-1"
		if params.OrderPrice != nil {
			req.SLOrdPx = strconv.FormatFloat(*params.OrderPrice, 'f', -1, 64)
		}

	case core.StrategyOrderTypeTakeProfit:
		req.TPTriggerPx = strconv.FormatFloat(params.TriggerPrice, 'f', -1, 64)
		req.TPTriggerPxType = string(triggerPxType)
		req.TPOrdPx = "-1"
		if params.OrderPrice != nil {
			req.TPOrdPx = strconv.FormatFloat(*params.OrderPrice, 'f', -1, 64)
		}

	case core.StrategyOrderTypeTrigger:
		req.TriggerPx = strconv.FormatFloat(params.TriggerPrice, 'f', -1, 64)
		req.TriggerPxType = string(triggerPxType)
		req.OrderPx = "-1"
		if params.OrderPrice != nil {
			req.OrderPx = strconv.FormatFloat(*params.OrderPrice, 'f', -1, 64)
		}

		if len(params.AttachedOrders) > 0 {
			attach := make([]okxAttachAlgoOrd, 0, len(params.AttachedOrders))
			for _, ao := range params.AttachedOrders {
				var item okxAttachAlgoOrd
				if ao.TPTriggerPrice != nil {
					item.TPTriggerPx = strconv.FormatFloat(*ao.TPTriggerPrice, 'f', -1, 64)
				}
				if ao.TPOrderPrice != nil && *ao.TPOrderPrice > 0 {
					item.TPOrdPx = strconv.FormatFloat(*ao.TPOrderPrice, 'f', -1, 64)
				}
				if ao.TPTriggerPriceType != nil {
					item.TPTriggerPxType = string(*ao.TPTriggerPriceType)
				}
				if ao.SLTriggerPrice != nil {
					item.SLTriggerPx = strconv.FormatFloat(*ao.SLTriggerPrice, 'f', -1, 64)
				}
				if ao.SLOrderPrice != nil && *ao.SLOrderPrice > 0 {
					item.SLOrdPx = strconv.FormatFloat(*ao.SLOrderPrice, 'f', -1, 64)
				}
				if ao.SLTriggerPriceType != nil {
					item.SLTriggerPxType = string(*ao.SLTriggerPriceType)
				}
				attach = append(attach, item)
			}
			req.AttachAlgoOrds = attach
		}

	case core.StrategyOrderTypeTrailingStop:
		if params.CallbackRatio != nil {
			req.CallbackRatio = strconv.FormatFloat(*params.CallbackRatio, 'f', -1, 64)
		}
		if params.CallbackSpread != nil {
			req.CallbackSpread = strconv.FormatFloat(*params.CallbackSpread, 'f', -1, 64)
		}
		if params.ActivationPrice != nil {
			req.ActivePx = strconv.FormatFloat(*params.ActivationPrice, 'f', -1, 64)
		}
	}

	raw, err := a.client.PlaceAlgoOrder(ctx, req)
	if err != nil {
		return core.Err[core.StrategyOrder](wrapAPIError(core.ErrorPlaceStrategyOrder, err))
	}

	var resp []okxAlgoOrderResult
	if uerr := json.Unmarshal(raw, &resp); uerr != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(resp) == 0 {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: core.ErrorPlaceStrategyOrder, Message: "empty response", Raw: string(raw)})
	}
	if resp[0].SCode != "0" {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: resp[0].SCode, Message: resp[0].SMsg, Raw: resp[0]})
	}

	triggerPx := strconv.FormatFloat(params.TriggerPrice, 'f', -1, 64)
	var orderPx string
	if params.OrderPrice != nil {
		orderPx = strconv.FormatFloat(*params.OrderPrice, 'f', -1, 64)
	}

	return core.Ok(core.StrategyOrder{
		AlgoID:           resp[0].AlgoID,
		ClientAlgoID:     firstNonEmpty(resp[0].AlgoClOrdID, params.ClientAlgoID),
		Symbol:           params.Symbol,
		TradeType:        params.TradeType,
		Side:             params.Side,
		PositionSide:     params.PositionSide,
		StrategyType:     params.StrategyType,
		Status:           core.StrategyOrderStatusLive,
		TriggerPrice:     triggerPx,
		TriggerPriceType: &triggerPxType,
		OrderPrice:       orderPx,
		Quantity:         strconv.FormatFloat(params.Quantity, 'f', -1, 64),
		Raw:              json.RawMessage(raw),
	})
}

type cancelAlgoOrderItem struct {
	InstID string `json:"instId"`
	AlgoID string `json:"algoId"`
}

func (a *TradeAdapter) CancelStrategyOrder(ctx context.Context, symbol string, algoID string, tradeType core.TradeType) core.Result[core.StrategyOrder] {
	if err := a.ensureReady(); err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	if err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: err.Error(), Raw: err})
	}

	raw, err := a.client.CancelAlgoOrder(ctx, []cancelAlgoOrderItem{{InstID: instID, AlgoID: algoID}})
	if err != nil {
		ei := wrapAPIError(core.ErrorCancelStrategyOrder, err)
		if apiErr, ok := err.(*okxutil.APIError); ok {
			var envelope struct {
				Data []struct {
					SCode string `json:"sCode"`
					SMsg  string `json:"sMsg"`
				} `json:"data"`
			}
			if json.Unmarshal(apiErr.Raw, &envelope) == nil && len(envelope.Data) > 0 {
				if envelope.Data[0].SCode == "51400" {
					ei.Code = core.ErrorOrderNotFound
				}
			}
		}
		return core.Err[core.StrategyOrder](ei)
	}

	var resp []okxAlgoOrderResult
	if uerr := json.Unmarshal(raw, &resp); uerr != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(resp) == 0 {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: core.ErrorCancelStrategyOrder, Message: "empty response", Raw: string(raw)})
	}
	// OKX may return empty details for a just-cancelled order; treat that as success with a stub.
	res := a.GetStrategyOrder(ctx, algoID, tradeType)
	if !res.Ok {
		return core.Ok(core.StrategyOrder{
			AlgoID:    algoID,
			Symbol:    symbol,
			TradeType: tradeType,
			Status:    core.StrategyOrderStatusCanceled,
		})
	}
	return res
}

type getAlgoOrderDetailsParams struct {
	AlgoID string `json:"algoId"`
}

type okxAlgoOrderDetails struct {
	InstID      string `json:"instId"`
	AlgoID      string `json:"algoId"`
	AlgoClOrdID string `json:"algoClOrdId"`
	Side        string `json:"side"`
	PosSide     string `json:"posSide"`
	OrdType     string `json:"ordType"`
	State       string `json:"state"`

	TriggerPx     string `json:"triggerPx"`
	TriggerPxType string `json:"triggerPxType"`
	OrdPx         string `json:"ordPx"`

	SLTriggerPx     string `json:"slTriggerPx"`
	SLTriggerPxType string `json:"slTriggerPxType"`
	SLOrdPx         string `json:"slOrdPx"`

	TPTriggerPx     string `json:"tpTriggerPx"`
	TPTriggerPxType string `json:"tpTriggerPxType"`
	TPOrdPx         string `json:"tpOrdPx"`

	Sz          string `json:"sz"`
	TriggerTime string `json:"triggerTime"`
	CTime       string `json:"cTime"`
	UTime       string `json:"uTime"`
}

func (a *TradeAdapter) GetStrategyOrder(ctx context.Context, algoID string, _ core.TradeType) core.Result[core.StrategyOrder] {
	if err := a.ensureReady(); err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	raw, err := a.client.GetAlgoOrderDetails(ctx, getAlgoOrderDetailsParams{AlgoID: algoID})
	if err != nil {
		return core.Err[core.StrategyOrder](wrapAPIError(core.ErrorGetStrategyOrder, err))
	}

	var details []okxAlgoOrderDetails
	if uerr := json.Unmarshal(raw, &details); uerr != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}
	if len(details) == 0 {
		return core.Err[core.StrategyOrder](core.ErrorInfo{Code: core.ErrorStrategyOrderNotFound, Message: fmt.Sprintf("strategy order not found: %s", algoID), Raw: string(raw)})
	}

	return core.Ok(transformStrategyOrder(details[0]))
}

type getAlgoOrderListParams struct {
	OrdType  string `json:"ordType"`
	InstType string `json:"instType,omitempty"`
	InstID   string `json:"instId,omitempty"`
}

func (a *TradeAdapter) GetOpenStrategyOrders(ctx context.Context, symbol *string, tradeType *core.TradeType) core.Result[[]core.StrategyOrder] {
	if err := a.ensureReady(); err != nil {
		return core.Err[[]core.StrategyOrder](core.ErrorInfo{Code: "INIT_ERROR", Message: err.Error(), Raw: err})
	}

	params := getAlgoOrderListParams{OrdType: "trigger"}
	filterSymbol := ""

	if tradeType != nil {
		params.InstType = tradeTypeToInstType(*tradeType)
	}
	if tradeType != nil && symbol != nil && *symbol != "" {
		instID, ok := a.tryResolveInstID(ctx, *symbol, *tradeType)
		if ok && (*tradeType != core.TradeTypeDelivery || detectTradeTypeFromInstID(instID) == core.TradeTypeDelivery) {
			params.InstID = instID
		} else {
			filterSymbol = strings.ToUpper(*symbol)
		}
	}

	raw, err := a.client.GetAlgoOrderList(ctx, params)
	if err != nil {
		return core.Err[[]core.StrategyOrder](wrapAPIError(core.ErrorGetOpenStrategyOrders, err))
	}

	var details []okxAlgoOrderDetails
	if uerr := json.Unmarshal(raw, &details); uerr != nil {
		return core.Err[[]core.StrategyOrder](core.ErrorInfo{Code: "PARSE_ERROR", Message: uerr.Error(), Raw: string(raw)})
	}

	out := make([]core.StrategyOrder, 0, len(details))
	for _, d := range details {
		so := transformStrategyOrder(d)
		if filterSymbol != "" && strings.ToUpper(so.Symbol) != filterSymbol {
			continue
		}
		out = append(out, so)
	}
	return core.Ok(out)
}

// ============================================================================//
// Helpers
// ============================================================================//

func (a *TradeAdapter) ensureReady() error {
	if a.initErr != nil {
		return a.initErr
	}
	if a.client == nil {
		return fmt.Errorf("nil okx rest client")
	}
	return nil
}

func (a *TradeAdapter) tryResolveInstID(ctx context.Context, symbol string, tradeType core.TradeType) (string, bool) {
	instID, err := a.resolveInstID(ctx, symbol, tradeType)
	return instID, err == nil && instID != ""
}

func (a *TradeAdapter) resolveInstID(ctx context.Context, symbol string, tradeType core.TradeType) (string, error) {
	// For SPOT/FUTURES we can derive deterministically.
	if tradeType == core.TradeTypeSpot || tradeType == core.TradeTypeFutures {
		return unifiedToRawSymbol(symbol, tradeType), nil
	}

	// Delivery needs an expiry; accept instId-like inputs.
	if detectTradeTypeFromInstID(symbol) == core.TradeTypeDelivery {
		return symbol, nil
	}

	info := a.public.GetSymbolInfo(ctx, symbol, tradeType)
	if info.Ok {
		return info.Data.RawSymbol, nil
	}
	return "", fmt.Errorf("failed to resolve instId for %s (%s)", symbol, tradeType)
}

func transformOrder(o okxOrderDetail) core.Order {
	tradeType := detectTradeTypeFromInstID(o.InstID)
	symbol := rawToUnifiedSymbol(o.InstID)

	reduceOnly := strings.EqualFold(strings.TrimSpace(o.ReduceOnly), "true")

	return core.Order{
		OrderID:       o.OrdID,
		ClientOrderID: o.ClOrdID,
		Symbol:        symbol,
		TradeType:     tradeType,
		Side:          toCoreSide(o.Side),
		PositionSide:  toCorePositionSide(o.PosSide),
		OrderType:     toCoreOrderType(o.OrdType),
		Status:        toCoreOrderStatus(o.State),
		Price:         o.Px,
		AvgPrice:      o.AvgPx,
		Quantity:      o.Sz,
		FilledQty:     o.AccFillSz,
		Fee:           o.Fee,
		FeeAsset:      o.FeeCcy,
		ReduceOnly:    reduceOnly,
		CreateTime:    msStringToTimePtr(o.CTime),
		UpdateTime:    msStringToTimePtr(o.UTime),
		Raw:           o,
	}
}

func transformStrategyOrder(d okxAlgoOrderDetails) core.StrategyOrder {
	tradeType := detectTradeTypeFromInstID(d.InstID)
	symbol := rawToUnifiedSymbol(d.InstID)

	triggerPrice := firstNonEmpty(d.TriggerPx, firstNonEmpty(d.SLTriggerPx, d.TPTriggerPx))
	orderPrice := firstNonEmpty(d.OrdPx, firstNonEmpty(d.SLOrdPx, d.TPOrdPx))

	triggerPxTypeStr := firstNonEmpty(d.TriggerPxType, firstNonEmpty(d.SLTriggerPxType, d.TPTriggerPxType))
	triggerPxType := core.TriggerPriceTypeLast
	if triggerPxTypeStr != "" {
		triggerPxType = core.StrategyTriggerPriceType(strings.ToLower(triggerPxTypeStr))
	}

	hasTP := d.TPTriggerPx != "" || d.TPOrdPx != ""
	strategyType := toCoreStrategyOrderType(d.OrdType, hasTP)

	return core.StrategyOrder{
		AlgoID:           d.AlgoID,
		ClientAlgoID:     d.AlgoClOrdID,
		Symbol:           symbol,
		TradeType:        tradeType,
		Side:             toCoreSide(d.Side),
		PositionSide:     toCorePositionSide(d.PosSide),
		StrategyType:     strategyType,
		Status:           toCoreStrategyOrderStatus(d.State),
		TriggerPrice:     triggerPrice,
		TriggerPriceType: &triggerPxType,
		OrderPrice:       orderPrice,
		Quantity:         d.Sz,
		TPTriggerPrice:   d.TPTriggerPx,
		TPOrderPrice:     d.TPOrdPx,
		SLTriggerPrice:   d.SLTriggerPx,
		SLOrderPrice:     d.SLOrdPx,
		CreateTime:       msStringToTimePtr(d.CTime),
		UpdateTime:       msStringToTimePtr(d.UTime),
		TriggerTime:      msStringToTimePtr(d.TriggerTime),
		Raw:              d,
	}
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}
