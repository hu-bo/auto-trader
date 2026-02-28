package binance

import (
	"context"
	"crypto/rand"
	"strconv"
	"strings"
	"time"

	binanceapi "github.com/pkg/binance-api"
	btypes "github.com/pkg/binance-api/types"
	"github.com/pkg/exchange-adapter/core"
)

type TradeAdapterOptions struct {
	APIKey    string
	APISecret string
	Options   *core.AdapterOptions

	PublicAdapter *PublicAdapter
}

type TradeAdapter struct {
	*core.BaseTradeAdapter

	public   *PublicAdapter
	spot     *binanceapi.MainClient
	futures  *binanceapi.USDMClient
	delivery *binanceapi.COINMClient
}

func NewTradeAdapter(opts TradeAdapterOptions) *TradeAdapter {
	demonet := true
	if opts.Options != nil && opts.Options.Demonet != nil {
		demonet = *opts.Options.Demonet
	}

	proxy := ""
	if opts.Options != nil {
		proxy = opts.Options.HTTPSProxy
	}

	public := opts.PublicAdapter
	if public == nil {
		public = NewPublicAdapter(opts.Options)
	}

	spot := binanceapi.NewMainClient(binanceapi.MainClientOptions{APIKey: opts.APIKey, APISecret: opts.APISecret, Testnet: demonet, Proxy: proxy})
	futures := binanceapi.NewUSDMClient(binanceapi.USDMClientOptions{APIKey: opts.APIKey, APISecret: opts.APISecret, Testnet: demonet, Proxy: proxy})
	delivery := binanceapi.NewCOINMClient(binanceapi.COINMClientOptions{APIKey: opts.APIKey, APISecret: opts.APISecret, Testnet: demonet, Proxy: proxy})

	a := &TradeAdapter{
		public:   public,
		spot:     spot,
		futures:  futures,
		delivery: delivery,
	}
	a.BaseTradeAdapter = core.NewBaseTradeAdapter(public, a)
	return a
}

// ============================================================================//
// TradeAdapterImpl
// ============================================================================//

func (a *TradeAdapter) GenerateClientOrderID(tradeType core.TradeType) string {
	const prefix = "hbbin"
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	const totalLen = 32

	n := totalLen - len(prefix)
	if n <= 0 {
		return prefix
	}

	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		now := time.Now().UnixNano()
		for i := range buf {
			buf[i] = byte(now >> (i % 8 * 8))
		}
	}
	for i := range buf {
		buf[i] = chars[int(buf[i])%len(chars)]
	}

	// Add tradeType hint in suffix (best-effort).
	suffix := string(tradeType)
	if len(suffix) > 0 {
		buf[len(buf)-1] = suffix[0]
	}
	return prefix + string(buf)
}

func (a *TradeAdapter) GetBatchOrderLimits() core.BatchOrderLimits {
	return core.BatchOrderLimits{
		MaxBatchSize:        5,
		SupportedTradeTypes: []core.TradeType{core.TradeTypeFutures, core.TradeTypeDelivery},
	}
}

func (a *TradeAdapter) GetBalance(ctx context.Context, tradeType core.TradeType) core.Result[[]core.Balance] {
	switch tradeType {
	case core.TradeTypeSpot:
		acc, err := a.spot.GetAccountInfo(ctx)
		if err != nil {
			return core.Err[[]core.Balance](core.ErrorInfo{Code: "GET_SPOT_BALANCE_ERROR", Message: err.Error(), Raw: err})
		}
		out := make([]core.Balance, 0, len(acc.Balances))
		for _, b := range acc.Balances {
			if isZeroFloatString(b.Free) && isZeroFloatString(b.Locked) {
				continue
			}
			out = append(out, core.Balance{
				Asset:  b.Asset,
				Free:   b.Free,
				Locked: b.Locked,
				Total:  addStrings(b.Free, b.Locked),
			})
		}
		return core.Ok(out)

	case core.TradeTypeFutures:
		bals, err := a.futures.GetBalance(ctx)
		if err != nil {
			return core.Err[[]core.Balance](core.ErrorInfo{Code: "GET_FUTURES_BALANCE_ERROR", Message: err.Error(), Raw: err})
		}
		out := make([]core.Balance, 0, len(bals))
		for _, b := range bals {
			if isZeroFloatString(b.CrossWalletBalance) {
				continue
			}
			out = append(out, core.Balance{
				Asset:  b.Asset,
				Free:   b.AvailableBalance,
				Locked: subStrings(b.CrossWalletBalance, b.AvailableBalance),
				Total:  b.CrossWalletBalance,
			})
		}
		return core.Ok(out)

	case core.TradeTypeDelivery:
		bals, err := a.delivery.GetBalance(ctx)
		if err != nil {
			return core.Err[[]core.Balance](core.ErrorInfo{Code: "GET_DELIVERY_BALANCE_ERROR", Message: err.Error(), Raw: err})
		}
		out := make([]core.Balance, 0, len(bals))
		for _, b := range bals {
			if isZeroFloatString(b.CrossWalletBalance) {
				continue
			}
			out = append(out, core.Balance{
				Asset:  b.Asset,
				Free:   b.AvailableBalance,
				Locked: subStrings(b.CrossWalletBalance, b.AvailableBalance),
				Total:  b.CrossWalletBalance,
			})
		}
		return core.Ok(out)

	default:
		return core.Err[[]core.Balance](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *TradeAdapter) GetPositions(ctx context.Context, symbol *string, tradeType *core.TradeType) core.Result[[]core.Position] {
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

	switch *tradeType {
	case core.TradeTypeSpot:
		return core.Ok([]core.Position{})

	case core.TradeTypeFutures:
		rawSymbol := ""
		if symbol != nil && *symbol != "" {
			rawSymbol = unifiedToRawSymbol(*symbol, core.TradeTypeFutures)
		}
		positions, err := a.futures.GetPositions(ctx, rawSymbol)
		if err != nil {
			return core.Err[[]core.Position](core.ErrorInfo{Code: "GET_FUTURES_POSITIONS_ERROR", Message: err.Error(), Raw: err})
		}
		return core.Ok(mapFuturesPositions(positions, core.TradeTypeFutures))

	case core.TradeTypeDelivery:
		rawSymbol := ""
		if symbol != nil && *symbol != "" {
			rawSymbol = unifiedToRawSymbol(*symbol, core.TradeTypeDelivery)
		}
		positions, err := a.delivery.GetPositions(ctx, rawSymbol)
		if err != nil {
			return core.Err[[]core.Position](core.ErrorInfo{Code: "GET_DELIVERY_POSITIONS_ERROR", Message: err.Error(), Raw: err})
		}
		return core.Ok(mapFuturesPositions(positions, core.TradeTypeDelivery))

	default:
		return core.Err[[]core.Position](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func mapFuturesPositions(positions []btypes.FuturesPosition, tradeType core.TradeType) []core.Position {
	out := make([]core.Position, 0, len(positions))
	for _, p := range positions {
		if isZeroFloatString(p.PositionAmt) {
			continue
		}
		lev, _ := strconv.ParseFloat(p.Leverage, 64)
		side := strings.ToLower(string(p.PositionSide))
		posSide := core.PositionSideLong
		if side == "short" {
			posSide = core.PositionSideShort
		}
		out = append(out, core.Position{
			Symbol:           rawToUnifiedSymbol(p.Symbol, tradeType),
			PositionSide:     posSide,
			PositionAmt:      p.PositionAmt,
			EntryPrice:       p.EntryPrice,
			UnrealizedPnl:    p.UnRealizedProfit,
			Leverage:         lev,
			MarginMode:       core.MarginMode(strings.ToLower(p.MarginType)),
			LiquidationPrice: p.LiquidationPrice,
		})
	}
	return out
}

func (a *TradeAdapter) DoPlaceOrder(ctx context.Context, params core.PlaceOrderParamsFormatted, symbolInfo core.SymbolInfo) core.Result[core.Order] {
	rawSymbol := symbolInfo.RawSymbol

	switch params.TradeType {
	case core.TradeTypeSpot:
		return a.placeSpotOrder(ctx, params, rawSymbol)
	case core.TradeTypeFutures:
		return a.placeFuturesOrder(ctx, params, rawSymbol, core.TradeTypeFutures)
	case core.TradeTypeDelivery:
		return a.placeFuturesOrder(ctx, params, rawSymbol, core.TradeTypeDelivery)
	default:
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *TradeAdapter) DoBatchPlaceOrder(
	ctx context.Context,
	paramsList []core.PlaceOrderParamsFormatted,
	symbolInfoMap map[string]core.SymbolInfo,
) []core.Result[core.Order] {
	out := make([]core.Result[core.Order], len(paramsList))
	for i := range paramsList {
		p := paramsList[i]
		key := p.Symbol + ":" + string(p.TradeType)
		si, ok := symbolInfoMap[key]
		if !ok {
			out[i] = core.Err[core.Order](core.ErrorInfo{Code: core.ErrorSymbolNotFound, Message: "symbolInfo missing for batch order"})
			continue
		}
		out[i] = a.DoPlaceOrder(ctx, p, si)
	}
	return out
}

func (a *TradeAdapter) placeSpotOrder(ctx context.Context, params core.PlaceOrderParamsFormatted, rawSymbol string) core.Result[core.Order] {
	req := btypes.NewSpotOrderParams{
		Symbol:           rawSymbol,
		Side:             sideToBinance(params.Side),
		Type:             spotOrderTypeToBinance(params.OrderType),
		Quantity:         params.Quantity,
		NewClientOrderID: params.ClientOrderID,
	}

	if params.OrderType == core.OrderTypeLimit || params.OrderType == core.OrderTypeMakerOnly {
		if params.Price == nil {
			return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: "price is required for limit order"})
		}
		req.Price = *params.Price
		if params.OrderType == core.OrderTypeLimit {
			req.TimeInForce = tifToBinance(params.TimeInForce)
		}
	}

	resp, err := a.spot.SubmitNewOrder(ctx, req)
	if err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorPlaceOrder, Message: err.Error(), Raw: err})
	}
	return core.Ok(transformSpotOrder(*resp))
}

func (a *TradeAdapter) placeFuturesOrder(ctx context.Context, params core.PlaceOrderParamsFormatted, rawSymbol string, tradeType core.TradeType) core.Result[core.Order] {
	req := btypes.NewFuturesOrderParams{
		Symbol:           rawSymbol,
		Side:             sideToBinance(params.Side),
		Type:             futuresOrderTypeToBinance(params.OrderType),
		Quantity:         params.Quantity,
		NewClientOrderID: params.ClientOrderID,
	}

	if params.PositionSide != nil {
		req.PositionSide = positionSideToBinance(*params.PositionSide)
	}
	if params.ReduceOnly {
		req.ReduceOnly = "true"
	}

	if params.OrderType == core.OrderTypeLimit || params.OrderType == core.OrderTypeMakerOnly {
		if params.Price == nil {
			return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: "price is required for limit order"})
		}
		req.Price = *params.Price
		if params.OrderType == core.OrderTypeMakerOnly {
			req.TimeInForce = btypes.TimeInForceGTX
		} else {
			req.TimeInForce = tifToBinance(params.TimeInForce)
		}
	}

	var (
		resp *btypes.NewOrderResult
		err  error
	)
	switch tradeType {
	case core.TradeTypeFutures:
		resp, err = a.futures.SubmitNewOrder(ctx, req)
	case core.TradeTypeDelivery:
		resp, err = a.delivery.SubmitNewOrder(ctx, req)
	default:
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
	if err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorPlaceOrder, Message: err.Error(), Raw: err})
	}

	return core.Ok(transformFuturesOrder(*resp, tradeType))
}

func (a *TradeAdapter) CancelOrder(ctx context.Context, symbol string, orderID string, tradeType core.TradeType) core.Result[core.Order] {
	rawSymbol := unifiedToRawSymbol(symbol, tradeType)
	id, err := strconv.ParseInt(orderID, 10, 64)
	if err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: "invalid orderId", Raw: err})
	}

	switch tradeType {
	case core.TradeTypeSpot:
		resp, err := a.spot.CancelOrder(ctx, btypes.CancelOrderParams{Symbol: rawSymbol, OrderID: id})
		if err != nil {
			return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorCancelOrder, Message: err.Error(), Raw: err})
		}
		return core.Ok(transformSpotOrder(*resp))
	case core.TradeTypeFutures:
		resp, err := a.futures.CancelOrder(ctx, btypes.CancelOrderParams{Symbol: rawSymbol, OrderID: id})
		if err != nil {
			return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorCancelOrder, Message: err.Error(), Raw: err})
		}
		return core.Ok(transformCancelFuturesOrder(*resp, tradeType))
	case core.TradeTypeDelivery:
		resp, err := a.delivery.CancelOrder(ctx, btypes.CancelOrderParams{Symbol: rawSymbol, OrderID: id})
		if err != nil {
			return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorCancelOrder, Message: err.Error(), Raw: err})
		}
		return core.Ok(transformCancelFuturesOrder(*resp, tradeType))
	default:
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *TradeAdapter) GetOrder(ctx context.Context, symbol string, orderID string, tradeType core.TradeType) core.Result[core.Order] {
	rawSymbol := unifiedToRawSymbol(symbol, tradeType)
	id, err := strconv.ParseInt(orderID, 10, 64)
	if err != nil {
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: "invalid orderId", Raw: err})
	}

	switch tradeType {
	case core.TradeTypeSpot:
		resp, err := a.spot.GetOrder(ctx, btypes.GetOrderParams{Symbol: rawSymbol, OrderID: id})
		if err != nil {
			return core.Err[core.Order](core.ErrorInfo{Code: "GET_ORDER_ERROR", Message: err.Error(), Raw: err})
		}
		return core.Ok(transformSpotOrder(*resp))
	case core.TradeTypeFutures:
		resp, err := a.futures.GetOrder(ctx, btypes.GetOrderParams{Symbol: rawSymbol, OrderID: id})
		if err != nil {
			return core.Err[core.Order](core.ErrorInfo{Code: "GET_ORDER_ERROR", Message: err.Error(), Raw: err})
		}
		return core.Ok(transformFuturesOrderResult(*resp, tradeType))
	case core.TradeTypeDelivery:
		resp, err := a.delivery.GetOrder(ctx, btypes.GetOrderParams{Symbol: rawSymbol, OrderID: id})
		if err != nil {
			return core.Err[core.Order](core.ErrorInfo{Code: "GET_ORDER_ERROR", Message: err.Error(), Raw: err})
		}
		return core.Ok(transformFuturesOrderResult(*resp, tradeType))
	default:
		return core.Err[core.Order](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *TradeAdapter) GetOpenOrders(ctx context.Context, symbol *string, tradeType *core.TradeType) core.Result[[]core.Order] {
	if tradeType == nil {
		types := []core.TradeType{core.TradeTypeSpot, core.TradeTypeFutures, core.TradeTypeDelivery}
		out := make([]core.Order, 0)
		var firstErr *core.ErrorInfo
		for _, tt := range types {
			ttCopy := tt
			res := a.GetOpenOrders(ctx, symbol, &ttCopy)
			if res.Ok {
				out = append(out, res.Data...)
			} else if firstErr == nil {
				firstErr = res.Error
			}
		}
		if len(out) == 0 && firstErr != nil {
			return core.Err[[]core.Order](*firstErr)
		}
		return core.Ok(out)
	}

	rawSymbol := ""
	if symbol != nil && *symbol != "" {
		rawSymbol = unifiedToRawSymbol(*symbol, *tradeType)
	}

	switch *tradeType {
	case core.TradeTypeSpot:
		orders, err := a.spot.GetOpenOrders(ctx, rawSymbol)
		if err != nil {
			return core.Err[[]core.Order](core.ErrorInfo{Code: "GET_OPEN_ORDERS_ERROR", Message: err.Error(), Raw: err})
		}
		out := make([]core.Order, 0, len(orders))
		for _, o := range orders {
			out = append(out, transformSpotOrder(o))
		}
		return core.Ok(out)

	case core.TradeTypeFutures:
		orders, err := a.futures.GetOpenOrders(ctx, rawSymbol)
		if err != nil {
			return core.Err[[]core.Order](core.ErrorInfo{Code: "GET_OPEN_ORDERS_ERROR", Message: err.Error(), Raw: err})
		}
		out := make([]core.Order, 0, len(orders))
		for _, o := range orders {
			out = append(out, transformFuturesOrderResult(o, core.TradeTypeFutures))
		}
		return core.Ok(out)

	case core.TradeTypeDelivery:
		orders, err := a.delivery.GetOpenOrders(ctx, rawSymbol)
		if err != nil {
			return core.Err[[]core.Order](core.ErrorInfo{Code: "GET_OPEN_ORDERS_ERROR", Message: err.Error(), Raw: err})
		}
		out := make([]core.Order, 0, len(orders))
		for _, o := range orders {
			out = append(out, transformFuturesOrderResult(o, core.TradeTypeDelivery))
		}
		return core.Ok(out)

	default:
		return core.Err[[]core.Order](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

func (a *TradeAdapter) SetLeverage(ctx context.Context, symbol string, leverage float64, tradeType core.TradeType, _ *core.PositionSide) core.Result[struct{}] {
	if tradeType == core.TradeTypeSpot {
		return core.Err[struct{}](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "cannot set leverage for spot"})
	}
	if leverage <= 0 {
		return core.Err[struct{}](core.ErrorInfo{Code: core.ErrorInvalidParams, Message: "leverage must be > 0"})
	}

	rawSymbol := unifiedToRawSymbol(symbol, tradeType)
	lv := int(leverage)
	if lv <= 0 {
		lv = 1
	}

	switch tradeType {
	case core.TradeTypeFutures:
		if _, err := a.futures.SetLeverage(ctx, btypes.SetLeverageParams{Symbol: rawSymbol, Leverage: lv}); err != nil {
			return core.Err[struct{}](core.ErrorInfo{Code: "SET_LEVERAGE_ERROR", Message: err.Error(), Raw: err})
		}
		return core.Ok(struct{}{})
	case core.TradeTypeDelivery:
		if _, err := a.delivery.SetLeverage(ctx, btypes.SetLeverageParams{Symbol: rawSymbol, Leverage: lv}); err != nil {
			return core.Err[struct{}](core.ErrorInfo{Code: "SET_LEVERAGE_ERROR", Message: err.Error(), Raw: err})
		}
		return core.Ok(struct{}{})
	default:
		return core.Err[struct{}](core.ErrorInfo{Code: core.ErrorInvalidTradeType, Message: "invalid tradeType"})
	}
}

// ============================================================================//
// Strategy / Algo Orders
// ============================================================================//

func (a *TradeAdapter) PlaceStrategyOrder(ctx context.Context, params core.StrategyOrderParams) core.Result[core.StrategyOrder] {
	if params.TradeType != core.TradeTypeFutures {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorInvalidTradeType,
			Message: "Binance algo orders are only supported for futures",
		})
	}

	rawSymbol := unifiedToRawSymbol(params.Symbol, params.TradeType)
	hasOrderPrice := params.OrderPrice != nil && *params.OrderPrice > 0

	algoCondType, err := strategyOrderTypeToBinance(params.StrategyType, hasOrderPrice)
	if err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorInvalidStrategyOrderType,
			Message: err.Error(),
		})
	}

	req := btypes.NewAlgoOrderParams{
		AlgoType:     btypes.AlgoOrderTypeConditional,
		Symbol:       rawSymbol,
		Side:         sideToBinance(params.Side),
		Type:         algoCondType,
		Quantity:     strconv.FormatFloat(params.Quantity, 'f', -1, 64),
		TriggerPrice: strconv.FormatFloat(params.TriggerPrice, 'f', -1, 64),
		WorkingType:  triggerPriceTypeToBinance(params.TriggerPriceType),
	}

	if params.PositionSide != nil {
		req.PositionSide = positionSideToBinance(*params.PositionSide)
	}
	if params.ReduceOnly {
		req.ReduceOnly = "true"
	}
	if params.ClientAlgoID != "" {
		req.ClientAlgoID = params.ClientAlgoID
	}

	// Limit price for STOP / TAKE_PROFIT types.
	if hasOrderPrice {
		req.Price = strconv.FormatFloat(*params.OrderPrice, 'f', -1, 64)
		req.TimeInForce = btypes.TimeInForceGTC
	}

	// Trailing stop specific fields.
	if params.StrategyType == core.StrategyOrderTypeTrailingStop {
		if params.CallbackRatio != nil {
			req.CallbackRate = strconv.FormatFloat(*params.CallbackRatio, 'f', -1, 64)
		}
		if params.ActivationPrice != nil {
			req.ActivationPrice = strconv.FormatFloat(*params.ActivationPrice, 'f', -1, 64)
		}
	}

	resp, apiErr := a.futures.SubmitNewAlgoOrder(ctx, req)
	if apiErr != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorPlaceStrategyOrder,
			Message: apiErr.Error(),
			Raw:     apiErr,
		})
	}

	return core.Ok(transformAlgoOrder(*resp, params.TradeType))
}

func (a *TradeAdapter) CancelStrategyOrder(ctx context.Context, symbol string, algoID string, tradeType core.TradeType) core.Result[core.StrategyOrder] {
	if tradeType != core.TradeTypeFutures {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorInvalidTradeType,
			Message: "Binance algo orders are only supported for futures",
		})
	}

	id, err := strconv.ParseInt(algoID, 10, 64)
	if err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorInvalidParams,
			Message: "invalid algoId: " + algoID,
			Raw:     err,
		})
	}

	_, apiErr := a.futures.CancelAlgoOrder(ctx, btypes.CancelAlgoOrderParams{AlgoID: id})
	if apiErr != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorCancelStrategyOrder,
			Message: apiErr.Error(),
			Raw:     apiErr,
		})
	}

	// Fetch the updated order state after cancellation.
	return a.GetStrategyOrder(ctx, algoID, tradeType)
}

func (a *TradeAdapter) GetStrategyOrder(ctx context.Context, algoID string, tradeType core.TradeType) core.Result[core.StrategyOrder] {
	if tradeType != core.TradeTypeFutures {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorInvalidTradeType,
			Message: "Binance algo orders are only supported for futures",
		})
	}

	id, err := strconv.ParseInt(algoID, 10, 64)
	if err != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorInvalidParams,
			Message: "invalid algoId: " + algoID,
			Raw:     err,
		})
	}

	resp, apiErr := a.futures.GetAlgoOrder(ctx, btypes.QueryAlgoOrderParams{AlgoID: id})
	if apiErr != nil {
		return core.Err[core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorGetStrategyOrder,
			Message: apiErr.Error(),
			Raw:     apiErr,
		})
	}

	return core.Ok(transformQueryAlgoOrder(*resp, tradeType))
}

func (a *TradeAdapter) GetOpenStrategyOrders(ctx context.Context, symbol *string, tradeType *core.TradeType) core.Result[[]core.StrategyOrder] {
	// Default to futures if no trade type specified; algo orders only exist in futures.
	tt := core.TradeTypeFutures
	if tradeType != nil {
		tt = *tradeType
	}

	if tt != core.TradeTypeFutures {
		return core.Err[[]core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorInvalidTradeType,
			Message: "Binance algo orders are only supported for futures",
		})
	}

	params := &btypes.QueryOpenAlgoOrdersParams{}
	if symbol != nil && *symbol != "" {
		params.Symbol = unifiedToRawSymbol(*symbol, tt)
	}

	resp, apiErr := a.futures.GetOpenAlgoOrders(ctx, params)
	if apiErr != nil {
		return core.Err[[]core.StrategyOrder](core.ErrorInfo{
			Code:    core.ErrorGetOpenStrategyOrders,
			Message: apiErr.Error(),
			Raw:     apiErr,
		})
	}

	out := make([]core.StrategyOrder, 0, len(resp))
	for _, o := range resp {
		out = append(out, transformAlgoOrder(o, tt))
	}
	return core.Ok(out)
}

// ============================================================================//
// Mappers/helpers
// ============================================================================//

func sideToBinance(side core.OrderSide) btypes.OrderSide {
	if side == core.OrderSideSell {
		return btypes.SideSell
	}
	return btypes.SideBuy
}

func spotOrderTypeToBinance(orderType core.OrderType) btypes.SpotOrderType {
	switch orderType {
	case core.OrderTypeMarket:
		return btypes.SpotOrderTypeMarket
	case core.OrderTypeMakerOnly:
		return btypes.SpotOrderTypeLimitMaker
	default:
		return btypes.SpotOrderTypeLimit
	}
}

func futuresOrderTypeToBinance(orderType core.OrderType) btypes.FuturesOrderType {
	switch orderType {
	case core.OrderTypeMarket:
		return btypes.FuturesOrderTypeMarket
	default:
		return btypes.FuturesOrderTypeLimit
	}
}

func positionSideToBinance(side core.PositionSide) btypes.PositionSide {
	switch strings.ToLower(string(side)) {
	case "short":
		return btypes.PositionSideShort
	case "long":
		fallthrough
	default:
		return btypes.PositionSideLong
	}
}

func tifToBinance(tif *core.TimeInForce) btypes.OrderTimeInForce {
	if tif == nil || *tif == "" {
		return btypes.TimeInForceGTC
	}
	switch btypes.OrderTimeInForce(*tif) {
	case btypes.TimeInForceIOC:
		return btypes.TimeInForceIOC
	case btypes.TimeInForceFOK:
		return btypes.TimeInForceFOK
	case btypes.TimeInForceGTX:
		return btypes.TimeInForceGTX
	default:
		return btypes.TimeInForceGTC
	}
}

func transformSpotOrder(o btypes.SpotOrderResult) core.Order {
	return core.Order{
		OrderID:       strconv.FormatInt(o.OrderID, 10),
		ClientOrderID: o.ClientOrderID,
		Symbol:        rawToUnifiedSymbol(o.Symbol, core.TradeTypeSpot),
		TradeType:     core.TradeTypeSpot,
		Side:          toCoreSide(string(o.Side)),
		OrderType:     toCoreOrderType(string(o.Type)),
		Status:        toCoreOrderStatus(string(o.Status)),
		Price:         o.Price,
		AvgPrice:      o.Price,
		Quantity:      o.OrigQty,
		FilledQty:     o.ExecutedQty,
		CreateTime:    unixMsToTimePtr(o.TransactTime),
		UpdateTime:    unixMsToTimePtr(o.WorkingTime),
		Raw:           o,
	}
}

func transformFuturesOrder(o btypes.NewOrderResult, tradeType core.TradeType) core.Order {
	posSide := toCorePositionSide(string(o.PositionSide))
	return core.Order{
		OrderID:       strconv.FormatInt(o.OrderID, 10),
		ClientOrderID: o.ClientOrderID,
		Symbol:        rawToUnifiedSymbol(o.Symbol, tradeType),
		TradeType:     tradeType,
		Side:          toCoreSide(string(o.Side)),
		PositionSide:  posSide,
		OrderType:     toCoreOrderType(string(o.Type)),
		Status:        toCoreOrderStatus(string(o.Status)),
		Price:         o.Price,
		AvgPrice:      firstNonEmpty(o.AvgPrice, o.Price),
		Quantity:      o.OrigQty,
		FilledQty:     o.ExecutedQty,
		ReduceOnly:    o.ReduceOnly,
		UpdateTime:    unixMsToTimePtr(o.UpdateTime),
		Raw:           o,
	}
}

func transformCancelFuturesOrder(o btypes.CancelFuturesOrderResult, tradeType core.TradeType) core.Order {
	posSide := toCorePositionSide(string(o.PositionSide))
	return core.Order{
		OrderID:       strconv.FormatInt(o.OrderID, 10),
		ClientOrderID: o.ClientOrderID,
		Symbol:        rawToUnifiedSymbol(o.Symbol, tradeType),
		TradeType:     tradeType,
		Side:          toCoreSide(string(o.Side)),
		PositionSide:  posSide,
		OrderType:     toCoreOrderType(string(o.OrigType)),
		Status:        toCoreOrderStatus(string(o.Status)),
		Price:         o.Price,
		AvgPrice:      o.Price,
		Quantity:      o.OrigQty,
		FilledQty:     o.ExecutedQty,
		ReduceOnly:    o.ReduceOnly,
		Raw:           o,
	}
}

func transformFuturesOrderResult(o btypes.OrderResult, tradeType core.TradeType) core.Order {
	posSide := toCorePositionSide(string(o.PositionSide))
	return core.Order{
		OrderID:       strconv.FormatInt(o.OrderID, 10),
		ClientOrderID: o.ClientOrderID,
		Symbol:        rawToUnifiedSymbol(o.Symbol, tradeType),
		TradeType:     tradeType,
		Side:          toCoreSide(string(o.Side)),
		PositionSide:  posSide,
		OrderType:     toCoreOrderType(string(o.Type)),
		Status:        toCoreOrderStatus(string(o.Status)),
		Price:         o.Price,
		AvgPrice:      firstNonEmpty(o.AvgPrice, o.Price),
		Quantity:      o.OrigQty,
		FilledQty:     o.ExecutedQty,
		ReduceOnly:    o.ReduceOnly,
		CreateTime:    unixMsToTimePtr(o.Time),
		UpdateTime:    unixMsToTimePtr(o.UpdateTime),
		Raw:           o,
	}
}

func unixMsToTimePtr(ms int64) *time.Time {
	if ms <= 0 {
		return nil
	}
	t := time.UnixMilli(ms)
	return &t
}

func firstNonEmpty(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

func addStrings(a, b string) string {
	af, _ := strconv.ParseFloat(a, 64)
	bf, _ := strconv.ParseFloat(b, 64)
	return strconv.FormatFloat(af+bf, 'f', -1, 64)
}

func subStrings(a, b string) string {
	af, _ := strconv.ParseFloat(a, 64)
	bf, _ := strconv.ParseFloat(b, 64)
	return strconv.FormatFloat(af-bf, 'f', -1, 64)
}

func isZeroFloatString(s string) bool {
	v, err := strconv.ParseFloat(s, 64)
	return err != nil || v == 0
}
