package core

import (
	"context"
	"fmt"
	"math"
	"os"
	"sync"
)

// TradeAdapter extends PublicAdapter with authenticated trading operations.
type TradeAdapter interface {
	PublicAdapter

	PublicAdapter() PublicAdapter

	Init(ctx context.Context) Result[struct{}]
	Destroy(ctx context.Context) error
	LoadSymbols(ctx context.Context, tradeType *TradeType) Result[struct{}]

	// Account
	GetBalance(ctx context.Context, tradeType TradeType) Result[[]Balance]
	GetPositions(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Position]

	// Validation utilities (public, for callers)
	ValidateOrderParams(params PlaceOrderParams, symbolInfo SymbolInfo) ValidationResult
	ValidateBalance(
		params PlaceOrderParams,
		symbolInfo SymbolInfo,
		balances []Balance,
		currentPrice float64,
		positions []Position,
	) ValidationResult
	FormatOrderParams(params PlaceOrderParams, symbolInfo SymbolInfo) Result[PlaceOrderParamsFormatted]

	// Orders
	PlaceOrder(ctx context.Context, params PlaceOrderParams) Result[Order]
	PlaceOrders(ctx context.Context, paramsList []PlaceOrderParams) BatchPlaceOrderResult
	GetBatchOrderLimits() BatchOrderLimits

	CancelOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order]
	GetOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order]
	GetOpenOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Order]

	// Leverage
	SetLeverage(ctx context.Context, symbol string, leverage float64, tradeType TradeType, positionSide *PositionSide) Result[struct{}]

	// Strategy orders (optional; unsupported exchanges should return Err)
	PlaceStrategyOrder(ctx context.Context, params StrategyOrderParams) Result[StrategyOrder]
	PlaceStrategyOrders(ctx context.Context, paramsList []StrategyOrderParams) []Result[StrategyOrder]
	CancelStrategyOrder(ctx context.Context, symbol string, algoID string, tradeType TradeType) Result[StrategyOrder]
	GetStrategyOrder(ctx context.Context, algoID string, tradeType TradeType) Result[StrategyOrder]
	GetOpenStrategyOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]StrategyOrder]
}

// TradeAdapterImpl defines the exchange-specific operations required by BaseTradeAdapter.
type TradeAdapterImpl interface {
	GenerateClientOrderID(tradeType TradeType) string

	DoPlaceOrder(ctx context.Context, params PlaceOrderParamsFormatted, symbolInfo SymbolInfo) Result[Order]
	DoBatchPlaceOrder(
		ctx context.Context,
		paramsList []PlaceOrderParamsFormatted,
		symbolInfoMap map[string]SymbolInfo,
	) []Result[Order]
	GetBatchOrderLimits() BatchOrderLimits

	GetBalance(ctx context.Context, tradeType TradeType) Result[[]Balance]
	GetPositions(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Position]
	CancelOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order]
	GetOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order]
	GetOpenOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Order]
	SetLeverage(ctx context.Context, symbol string, leverage float64, tradeType TradeType, positionSide *PositionSide) Result[struct{}]

	PlaceStrategyOrder(ctx context.Context, params StrategyOrderParams) Result[StrategyOrder]
	CancelStrategyOrder(ctx context.Context, symbol string, algoID string, tradeType TradeType) Result[StrategyOrder]
	GetStrategyOrder(ctx context.Context, algoID string, tradeType TradeType) Result[StrategyOrder]
	GetOpenStrategyOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]StrategyOrder]
}

type BaseTradeAdapter struct {
	publicAdapter PublicAdapter
	impl          TradeAdapterImpl
}

func NewBaseTradeAdapter(publicAdapter PublicAdapter, impl TradeAdapterImpl) *BaseTradeAdapter {
	return &BaseTradeAdapter{
		publicAdapter: publicAdapter,
		impl:          impl,
	}
}

func (b *BaseTradeAdapter) PublicAdapter() PublicAdapter { return b.publicAdapter }

func (b *BaseTradeAdapter) Exchange() Exchange { return b.publicAdapter.Exchange() }

// ============================================================================
// Public API delegation
// ============================================================================

func (b *BaseTradeAdapter) GetSymbolInfo(ctx context.Context, symbol string, tradeType TradeType) Result[SymbolInfo] {
	return b.publicAdapter.GetSymbolInfo(ctx, symbol, tradeType)
}

func (b *BaseTradeAdapter) GetAllSymbols(ctx context.Context, tradeType TradeType) Result[[]SymbolInfo] {
	return b.publicAdapter.GetAllSymbols(ctx, tradeType)
}

func (b *BaseTradeAdapter) GetPrice(ctx context.Context, symbol string, tradeType TradeType) Result[string] {
	return b.publicAdapter.GetPrice(ctx, symbol, tradeType)
}

func (b *BaseTradeAdapter) GetMarkPrice(ctx context.Context, symbol string, tradeType TradeType) Result[string] {
	return b.publicAdapter.GetMarkPrice(ctx, symbol, tradeType)
}

func (b *BaseTradeAdapter) GetTicker(ctx context.Context, symbol string, tradeType TradeType) Result[Ticker] {
	return b.publicAdapter.GetTicker(ctx, symbol, tradeType)
}

func (b *BaseTradeAdapter) GetOrderBook(ctx context.Context, symbol string, tradeType TradeType, limit int) Result[OrderBook] {
	return b.publicAdapter.GetOrderBook(ctx, symbol, tradeType, limit)
}

func (b *BaseTradeAdapter) ToRawSymbol(symbol string, tradeType TradeType) string {
	return b.publicAdapter.ToRawSymbol(symbol, tradeType)
}

func (b *BaseTradeAdapter) FromRawSymbol(rawSymbol string, tradeType TradeType) string {
	return b.publicAdapter.FromRawSymbol(rawSymbol, tradeType)
}

// ============================================================================
// Lifecycle
// ============================================================================

func (b *BaseTradeAdapter) Init(ctx context.Context) Result[struct{}] {
	tradeTypes := []TradeType{TradeTypeSpot, TradeTypeFutures, TradeTypeDelivery}
	for _, tt := range tradeTypes {
		res := b.LoadSymbols(ctx, &tt)
		if !res.Ok {
			// Do not fail init; mirror TS behavior (warn-only).
			_ = res
		}
	}
	return Ok(struct{}{})
}

func (b *BaseTradeAdapter) Destroy(_ context.Context) error {
	// Exchange-specific adapters may override and clean up resources.
	return nil
}

func (b *BaseTradeAdapter) LoadSymbols(ctx context.Context, tradeType *TradeType) Result[struct{}] {
	if tradeType != nil {
		res := b.publicAdapter.GetAllSymbols(ctx, *tradeType)
		if !res.Ok {
			return Err[struct{}](*res.Error)
		}
		return Ok(struct{}{})
	}

	tradeTypes := []TradeType{TradeTypeSpot, TradeTypeFutures, TradeTypeDelivery}
	for _, tt := range tradeTypes {
		_ = b.publicAdapter.GetAllSymbols(ctx, tt)
	}
	return Ok(struct{}{})
}

// ============================================================================
// Account (delegate)
// ============================================================================

func (b *BaseTradeAdapter) GetBalance(ctx context.Context, tradeType TradeType) Result[[]Balance] {
	return b.impl.GetBalance(ctx, tradeType)
}

func (b *BaseTradeAdapter) GetPositions(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Position] {
	return b.impl.GetPositions(ctx, symbol, tradeType)
}

// ============================================================================
// Validation
// ============================================================================

func (b *BaseTradeAdapter) ValidateOrderParams(params PlaceOrderParams, symbolInfo SymbolInfo) ValidationResult {
	if params.Symbol == "" {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorInvalidParams, Message: "symbol is required"}}
	}
	if params.TradeType == "" {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorInvalidParams, Message: "tradeType is required"}}
	}
	if params.Side != OrderSideBuy && params.Side != OrderSideSell {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorInvalidParams, Message: "side must be buy or sell"}}
	}
	if params.OrderType == "" {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorInvalidParams, Message: "orderType is required"}}
	}
	if !(params.Quantity > 0) || math.IsNaN(params.Quantity) {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorInvalidParams, Message: "quantity must be greater than 0"}}
	}
	if (params.OrderType == OrderTypeLimit || params.OrderType == OrderTypeMakerOnly) && (params.Price == nil || !(*params.Price > 0)) {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorInvalidParams, Message: "price is required for limit/maker-only order"}}
	}
	if params.TradeType != TradeTypeSpot && params.PositionSide == nil {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorInvalidParams, Message: "positionSide is required for futures/delivery"}}
	}
	if symbolInfo.Status != SymbolStatusEnabled {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorSymbolNotAvailable, Message: fmt.Sprintf("%s is not available for trading", params.Symbol)}}
	}

	minQty, _ := parseFloat(symbolInfo.MinQty)
	maxQty, _ := parseFloat(symbolInfo.MaxQty)

	if minQty > 0 && params.Quantity < minQty {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorQuantityTooSmall, Message: fmt.Sprintf("Quantity %.8f is less than minimum %.8f", params.Quantity, minQty)}}
	}
	if maxQty > 0 && params.Quantity > maxQty {
		return ValidationResult{Valid: false, Error: &ErrorInfo{Code: ErrorQuantityTooLarge, Message: fmt.Sprintf("Quantity %.8f is greater than maximum %.8f", params.Quantity, maxQty)}}
	}
	return ValidationResult{Valid: true}
}

func (b *BaseTradeAdapter) ValidateBalance(
	params PlaceOrderParams,
	symbolInfo SymbolInfo,
	balances []Balance,
	currentPrice float64,
	positions []Position,
) ValidationResult {
	price := currentPrice
	if params.Price != nil && *params.Price > 0 {
		price = *params.Price
	}

	var (
		required float64
		asset    string
	)

	if params.TradeType == TradeTypeSpot {
		if params.Side == OrderSideBuy {
			asset = symbolInfo.QuoteCurrency
			required = price * params.Quantity
		} else {
			asset = symbolInfo.BaseCurrency
			required = params.Quantity
		}
	} else {
		// Close position: LONG+SELL or SHORT+BUY
		if params.PositionSide != nil && ((*params.PositionSide == PositionSideLong && params.Side == OrderSideSell) ||
			(*params.PositionSide == PositionSideShort && params.Side == OrderSideBuy)) {
			for _, p := range positions {
				if p.Symbol == params.Symbol && p.PositionSide == *params.PositionSide {
					posAmt, _ := parseFloat(p.PositionAmt)
					if math.Abs(posAmt) < params.Quantity && os.Getenv("SKIP_VALIDATE") == "" {
						return ValidationResult{
							Valid: false,
							Error: &ErrorInfo{
								Code:    ErrorInsufficientPosition,
								Message: fmt.Sprintf("Insufficient position. Required: %.8f, Available: %.8f", params.Quantity, math.Abs(posAmt)),
							},
						}
					}
					return ValidationResult{Valid: true}
				}
			}
			// No matching position => insufficient
			if os.Getenv("SKIP_VALIDATE") == "" {
				return ValidationResult{
					Valid: false,
					Error: &ErrorInfo{
						Code:    ErrorInsufficientPosition,
						Message: fmt.Sprintf("Insufficient position. Required: %.8f, Available: %.8f", params.Quantity, 0.0),
					},
				}
			}
			return ValidationResult{Valid: true}
		}

		asset = symbolInfo.QuoteCurrency
		leverage := 1.0
		if params.Leverage != nil && *params.Leverage > 0 {
			leverage = *params.Leverage
		}
		required = (price * params.Quantity) / leverage
	}

	available := 0.0
	for _, b := range balances {
		if b.Asset == asset {
			available, _ = parseFloat(b.Free)
			break
		}
	}

	if available < required && os.Getenv("SKIP_VALIDATE") == "" {
		return ValidationResult{
			Valid: false,
			Error: &ErrorInfo{
				Code:    ErrorInsufficientBalance,
				Message: fmt.Sprintf("Insufficient balance. Required: %.8f %s, Available: %.8f %s", required, asset, available, asset),
			},
		}
	}

	return ValidationResult{Valid: true}
}

func (b *BaseTradeAdapter) FormatOrderParams(params PlaceOrderParams, symbolInfo SymbolInfo) Result[PlaceOrderParamsFormatted] {
	qty, err := FormatQuantity(params.Quantity, symbolInfo.StepSize)
	if err != nil {
		return Err[PlaceOrderParamsFormatted](ErrorInfo{Code: ErrorInvalidParams, Message: "format quantity failed", Raw: err.Error()})
	}

	var priceStr *string
	if params.Price != nil {
		p, err := FormatPrice(*params.Price, symbolInfo.TickSize)
		if err != nil {
			return Err[PlaceOrderParamsFormatted](ErrorInfo{Code: ErrorInvalidParams, Message: "format price failed", Raw: err.Error()})
		}
		priceStr = &p
	}

	clientOrderID := params.ClientOrderID
	if clientOrderID == "" {
		clientOrderID = b.impl.GenerateClientOrderID(params.TradeType)
	}

	return Ok(PlaceOrderParamsFormatted{
		Symbol:        params.Symbol,
		TradeType:     params.TradeType,
		Side:          params.Side,
		OrderType:     params.OrderType,
		Quantity:      qty,
		Price:         priceStr,
		PositionSide:  params.PositionSide,
		Leverage:      params.Leverage,
		ClientOrderID: clientOrderID,
		TimeInForce:   params.TimeInForce,
		ReduceOnly:    params.ReduceOnly,
	})
}

// ============================================================================
// Orders
// ============================================================================

func (b *BaseTradeAdapter) PlaceOrder(ctx context.Context, params PlaceOrderParams) Result[Order] {
	var (
		symbolRes Result[SymbolInfo]
		priceRes  Result[string]
	)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		symbolRes = b.publicAdapter.GetSymbolInfo(ctx, params.Symbol, params.TradeType)
	}()
	go func() {
		defer wg.Done()
		priceRes = b.publicAdapter.GetPrice(ctx, params.Symbol, params.TradeType)
	}()
	wg.Wait()

	if !symbolRes.Ok {
		return Err[Order](*symbolRes.Error)
	}
	if !priceRes.Ok {
		return Err[Order](*priceRes.Error)
	}
	symbolInfo := symbolRes.Data

	validation := b.ValidateOrderParams(params, symbolInfo)
	if !validation.Valid {
		return Err[Order](*validation.Error)
	}

	currentPrice, _ := parseFloat(priceRes.Data)

	var (
		balRes Result[[]Balance]
		posRes Result[[]Position]
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		balRes = b.impl.GetBalance(ctx, params.TradeType)
	}()
	go func() {
		defer wg.Done()
		if params.TradeType == TradeTypeSpot {
			posRes = Ok([]Position{})
			return
		}
		s := params.Symbol
		tt := params.TradeType
		posRes = b.impl.GetPositions(ctx, &s, &tt)
	}()
	wg.Wait()

	if !balRes.Ok {
		return Err[Order](*balRes.Error)
	}
	positions := []Position{}
	if posRes.Ok {
		positions = posRes.Data
	}

	balValidation := b.ValidateBalance(params, symbolInfo, balRes.Data, currentPrice, positions)
	if !balValidation.Valid {
		return Err[Order](*balValidation.Error)
	}

	formatted := b.FormatOrderParams(params, symbolInfo)
	if !formatted.Ok {
		return Err[Order](*formatted.Error)
	}

	formattedQty, _ := parseFloat(formatted.Data.Quantity)
	minQty, _ := parseFloat(symbolInfo.MinQty)
	if minQty > 0 && formattedQty < minQty {
		return Err[Order](ErrorInfo{Code: ErrorQuantityTooSmall, Message: fmt.Sprintf("Formatted quantity %.8f is less than minimum %s", formattedQty, symbolInfo.MinQty)})
	}

	return b.impl.DoPlaceOrder(ctx, formatted.Data, symbolInfo)
}

func (b *BaseTradeAdapter) PlaceOrders(ctx context.Context, paramsList []PlaceOrderParams) BatchPlaceOrderResult {
	if len(paramsList) == 0 {
		return BatchPlaceOrderResult{SuccessCount: 0, FailedCount: 0, Results: []Result[Order]{}}
	}

	limits := b.GetBatchOrderLimits()
	results := make([]Result[Order], len(paramsList))

	symbolInfoMap := make(map[string]SymbolInfo)
	prepared := make([]PlaceOrderParamsFormatted, 0, len(paramsList))
	validIndices := make([]int, 0, len(paramsList))

	for i := range paramsList {
		p := paramsList[i]
		key := p.Symbol + ":" + string(p.TradeType)

		si, ok := symbolInfoMap[key]
		if !ok {
			r := b.publicAdapter.GetSymbolInfo(ctx, p.Symbol, p.TradeType)
			if !r.Ok {
				results[i] = Err[Order](*r.Error)
				continue
			}
			si = r.Data
			symbolInfoMap[key] = si
		}

		if !containsTradeType(limits.SupportedTradeTypes, p.TradeType) {
			results[i] = Err[Order](ErrorInfo{Code: ErrorInvalidTradeType, Message: fmt.Sprintf("batch orders not supported for %s", p.TradeType)})
			continue
		}

		validation := b.ValidateOrderParams(p, si)
		if !validation.Valid {
			results[i] = Err[Order](*validation.Error)
			continue
		}

		formatted := b.FormatOrderParams(p, si)
		if !formatted.Ok {
			results[i] = Err[Order](*formatted.Error)
			continue
		}

		formattedQty, _ := parseFloat(formatted.Data.Quantity)
		minQty, _ := parseFloat(si.MinQty)
		if minQty > 0 && formattedQty < minQty {
			results[i] = Err[Order](ErrorInfo{Code: ErrorQuantityTooSmall, Message: fmt.Sprintf("Formatted quantity %.8f is less than minimum %s", formattedQty, si.MinQty)})
			continue
		}

		prepared = append(prepared, formatted.Data)
		validIndices = append(validIndices, i)
	}

	for start := 0; start < len(prepared); start += limits.MaxBatchSize {
		end := start + limits.MaxBatchSize
		if end > len(prepared) {
			end = len(prepared)
		}

		batch := prepared[start:end]
		batchResults := b.impl.DoBatchPlaceOrder(ctx, batch, symbolInfoMap)

		for j := range batchResults {
			originalIndex := validIndices[start+j]
			results[originalIndex] = batchResults[j]
		}
	}

	success := 0
	failed := 0
	for i := range results {
		if results[i].Ok {
			success++
		} else {
			failed++
		}
	}

	return BatchPlaceOrderResult{
		SuccessCount: success,
		FailedCount:  failed,
		Results:      results,
	}
}

func (b *BaseTradeAdapter) GetBatchOrderLimits() BatchOrderLimits {
	return b.impl.GetBatchOrderLimits()
}

func (b *BaseTradeAdapter) CancelOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order] {
	return b.impl.CancelOrder(ctx, symbol, orderID, tradeType)
}

func (b *BaseTradeAdapter) GetOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order] {
	return b.impl.GetOrder(ctx, symbol, orderID, tradeType)
}

func (b *BaseTradeAdapter) GetOpenOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Order] {
	return b.impl.GetOpenOrders(ctx, symbol, tradeType)
}

func (b *BaseTradeAdapter) SetLeverage(ctx context.Context, symbol string, leverage float64, tradeType TradeType, positionSide *PositionSide) Result[struct{}] {
	return b.impl.SetLeverage(ctx, symbol, leverage, tradeType, positionSide)
}

// ============================================================================
// Strategy Orders (default batch implementation)
// ============================================================================

func (b *BaseTradeAdapter) PlaceStrategyOrder(ctx context.Context, params StrategyOrderParams) Result[StrategyOrder] {
	return b.impl.PlaceStrategyOrder(ctx, params)
}

func (b *BaseTradeAdapter) PlaceStrategyOrders(ctx context.Context, paramsList []StrategyOrderParams) []Result[StrategyOrder] {
	results := make([]Result[StrategyOrder], 0, len(paramsList))
	for _, p := range paramsList {
		results = append(results, b.impl.PlaceStrategyOrder(ctx, p))
	}
	return results
}

func (b *BaseTradeAdapter) CancelStrategyOrder(ctx context.Context, symbol string, algoID string, tradeType TradeType) Result[StrategyOrder] {
	return b.impl.CancelStrategyOrder(ctx, symbol, algoID, tradeType)
}

func (b *BaseTradeAdapter) GetStrategyOrder(ctx context.Context, algoID string, tradeType TradeType) Result[StrategyOrder] {
	return b.impl.GetStrategyOrder(ctx, algoID, tradeType)
}

func (b *BaseTradeAdapter) GetOpenStrategyOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]StrategyOrder] {
	return b.impl.GetOpenStrategyOrders(ctx, symbol, tradeType)
}

// ============================================================================
// Helpers
// ============================================================================

func containsTradeType(list []TradeType, tt TradeType) bool {
	for _, v := range list {
		if v == tt {
			return true
		}
	}
	return false
}

func parseFloat(s string) (float64, error) {
	if s == "" {
		return 0, fmt.Errorf("empty")
	}
	// Avoid importing strconv in multiple files; parse via fmt is slower but fine for now.
	var f float64
	_, err := fmt.Sscan(s, &f)
	return f, err
}
