package binanceapi

import (
	"context"

	"github.com/pkg/binance-api/types"
)

// Margin Trading Endpoints

// GetCommissionRates returns commission rates for a symbol.
func (c *MainClient) GetCommissionRates(ctx context.Context, symbol string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/api/v3/account/commission", map[string]interface{}{"symbol": symbol}, true, &result)
	return result, err
}

// GetAllCrossMarginPairs returns all cross margin pairs.
func (c *MainClient) GetAllCrossMarginPairs(ctx context.Context) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/allPairs", nil, false, &result)
	return result, err
}

// GetIsolatedMarginAllSymbols returns all isolated margin symbols.
func (c *MainClient) GetIsolatedMarginAllSymbols(ctx context.Context, symbol string) ([]map[string]interface{}, error) {
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/isolated/allPairs", params, true, &result)
	return result, err
}

// GetAllMarginAssets returns all margin assets.
func (c *MainClient) GetAllMarginAssets(ctx context.Context) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/allAssets", nil, false, &result)
	return result, err
}

// QueryMarginPriceIndex returns margin price index.
func (c *MainClient) QueryMarginPriceIndex(ctx context.Context, symbol string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/priceIndex", map[string]interface{}{"symbol": symbol}, false, &result)
	return result, err
}

// SubmitMarginAccountBorrowRepay submits margin account borrow or repay.
func (c *MainClient) SubmitMarginAccountBorrowRepay(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/margin/borrow-repay", params, true, &result)
	return result, err
}

// GetMarginAccountBorrowRepayRecords returns margin account borrow/repay records.
func (c *MainClient) GetMarginAccountBorrowRepayRecords(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/borrow-repay", params, true, &result)
	return result, err
}

// QueryMaxBorrow returns maximum borrowable amount.
func (c *MainClient) QueryMaxBorrow(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/maxBorrowable", params, true, &result)
	return result, err
}

// QueryMaxTransferOutAmount returns maximum transfer out amount.
func (c *MainClient) QueryMaxTransferOutAmount(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/maxTransferable", params, true, &result)
	return result, err
}

// SubmitMarginAccountOrder submits a margin account order.
func (c *MainClient) SubmitMarginAccountOrder(ctx context.Context, params types.NewSpotOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Post(ctx, "/sapi/v1/margin/order", params, true, &result)
	return &result, err
}

// CancelMarginAccountOrder cancels a margin account order.
func (c *MainClient) CancelMarginAccountOrder(ctx context.Context, params types.CancelOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Delete(ctx, "/sapi/v1/margin/order", params, true, &result)
	return &result, err
}

// GetMarginAccountOrder returns margin account order.
func (c *MainClient) GetMarginAccountOrder(ctx context.Context, params types.GetOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Get(ctx, "/sapi/v1/margin/order", params, true, &result)
	return &result, err
}

// GetMarginAccountOpenOrders returns all open margin orders.
func (c *MainClient) GetMarginAccountOpenOrders(ctx context.Context, symbol string) ([]types.SpotOrderResult, error) {
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	var result []types.SpotOrderResult
	err := c.Get(ctx, "/sapi/v1/margin/openOrders", params, true, &result)
	return result, err
}

// GetMarginAccountAllOrders returns all margin account orders.
func (c *MainClient) GetMarginAccountAllOrders(ctx context.Context, params types.GetAllOrdersParams) ([]types.SpotOrderResult, error) {
	var result []types.SpotOrderResult
	err := c.Get(ctx, "/sapi/v1/margin/allOrders", params, true, &result)
	return result, err
}

// CancelMarginAccountAllOrders cancels all margin account open orders.
func (c *MainClient) CancelMarginAccountAllOrders(ctx context.Context, symbol string) ([]types.SpotOrderResult, error) {
	var result []types.SpotOrderResult
	err := c.Delete(ctx, "/sapi/v1/margin/openOrders", map[string]interface{}{"symbol": symbol}, true, &result)
	return result, err
}

// SubmitMarginAccountOCO submits margin account OCO order.
func (c *MainClient) SubmitMarginAccountOCO(ctx context.Context, params types.NewOCOParams) (*types.OrderList, error) {
	var result types.OrderList
	err := c.Post(ctx, "/sapi/v1/margin/order/oco", params, true, &result)
	return &result, err
}

// CancelMarginAccountOCO cancels margin account OCO order.
func (c *MainClient) CancelMarginAccountOCO(ctx context.Context, params types.CancelOCOParams) (*types.CancelOrderListResult, error) {
	var result types.CancelOrderListResult
	err := c.Delete(ctx, "/sapi/v1/margin/orderList", params, true, &result)
	return &result, err
}

// GetMarginAccountOCO returns margin account OCO order.
func (c *MainClient) GetMarginAccountOCO(ctx context.Context, params types.GetOCOParams) (*types.OrderList, error) {
	var result types.OrderList
	err := c.Get(ctx, "/sapi/v1/margin/orderList", params, true, &result)
	return &result, err
}

// GetMarginAccountAllOCO returns all margin account OCO orders.
func (c *MainClient) GetMarginAccountAllOCO(ctx context.Context, params map[string]interface{}) ([]types.OrderList, error) {
	var result []types.OrderList
	err := c.Get(ctx, "/sapi/v1/margin/allOrderList", params, true, &result)
	return result, err
}

// GetMarginAccountOpenOCO returns all open margin account OCO orders.
func (c *MainClient) GetMarginAccountOpenOCO(ctx context.Context, params map[string]interface{}) ([]types.OrderList, error) {
	var result []types.OrderList
	err := c.Get(ctx, "/sapi/v1/margin/openOrderList", params, true, &result)
	return result, err
}

// GetMarginAccountTradeList returns margin account trade list.
func (c *MainClient) GetMarginAccountTradeList(ctx context.Context, params types.SymbolFromPaginatedRequestFromId) ([]types.AccountTradeList, error) {
	var result []types.AccountTradeList
	err := c.Get(ctx, "/sapi/v1/margin/myTrades", params, true, &result)
	return result, err
}

// IsolatedMarginAccountTransfer executes isolated margin account transfer.
func (c *MainClient) IsolatedMarginAccountTransfer(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/margin/isolated/transfer", params, true, &result)
	return result, err
}

// GetIsolatedMarginAccountInfo returns isolated margin account info.
func (c *MainClient) GetIsolatedMarginAccountInfo(ctx context.Context, symbols string) (map[string]interface{}, error) {
	params := map[string]interface{}{}
	if symbols != "" {
		params["symbols"] = symbols
	}
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/isolated/account", params, true, &result)
	return result, err
}

// DisableIsolatedMarginAccount disables isolated margin account.
func (c *MainClient) DisableIsolatedMarginAccount(ctx context.Context, symbol string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Delete(ctx, "/sapi/v1/margin/isolated/account", map[string]interface{}{"symbol": symbol}, true, &result)
	return result, err
}

// EnableIsolatedMarginAccount enables isolated margin account.
func (c *MainClient) EnableIsolatedMarginAccount(ctx context.Context, symbols string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/margin/isolated/account", map[string]interface{}{"symbols": symbols}, true, &result)
	return result, err
}

// GetCrossMarginTransferHistory returns cross margin transfer history.
func (c *MainClient) GetCrossMarginTransferHistory(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/transfer", params, true, &result)
	return result, err
}

// GetMarginInterestHistory returns margin interest history.
func (c *MainClient) GetMarginInterestHistory(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/interestHistory", params, true, &result)
	return result, err
}

// GetMarginForceLiquidationRecord returns margin force liquidation record.
func (c *MainClient) GetMarginForceLiquidationRecord(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/forceLiquidationRec", params, true, &result)
	return result, err
}

// QueryCrossMarginAccountDetails returns cross margin account details.
func (c *MainClient) QueryCrossMarginAccountDetails(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/margin/account", nil, true, &result)
	return result, err
}
