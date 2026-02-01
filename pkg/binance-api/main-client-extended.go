package binanceapi

import (
	"context"
)

// SubAccount Management Endpoints

// GetSubAccountList returns sub-account list.
func (c *MainClient) GetSubAccountList(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/sub-account/list", params, true, &result)
	return result, err
}

// CreateVirtualSubAccount creates a virtual sub-account.
func (c *MainClient) CreateVirtualSubAccount(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/sub-account/virtualSubAccount", params, true, &result)
	return result, err
}

// SubAccountEnableFutures enables futures for sub-account.
func (c *MainClient) SubAccountEnableFutures(ctx context.Context, email string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/sub-account/futures/enable", map[string]interface{}{"email": email}, true, &result)
	return result, err
}

// SubAccountEnableMargin enables margin for sub-account.
func (c *MainClient) SubAccountEnableMargin(ctx context.Context, email string) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/sub-account/margin/enable", map[string]interface{}{"email": email}, true, &result)
	return result, err
}

// GetSubAccountAssets returns sub-account assets.
func (c *MainClient) GetSubAccountAssets(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v3/sub-account/assets", params, true, &result)
	return result, err
}

// GetSubAccountDepositHistory returns sub-account deposit history.
func (c *MainClient) GetSubAccountDepositHistory(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/sub-account/sub/transfer/history", params, true, &result)
	return result, err
}

// SubAccountUniversalTransfer executes sub-account universal transfer.
func (c *MainClient) SubAccountUniversalTransfer(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/sub-account/universalTransfer", params, true, &result)
	return result, err
}

// GetSubAccountUniversalTransferHistory returns sub-account universal transfer history.
func (c *MainClient) GetSubAccountUniversalTransferHistory(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/sub-account/universalTransfer", params, true, &result)
	return result, err
}

// GetSubAccountFuturesAccountDetail returns sub-account futures account detail.
func (c *MainClient) GetSubAccountFuturesAccountDetail(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/sub-account/futures/account", params, true, &result)
	return result, err
}

// GetSubAccountFuturesAccountSummary returns sub-account futures account summary.
func (c *MainClient) GetSubAccountFuturesAccountSummary(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/sub-account/futures/accountSummary", nil, true, &result)
	return result, err
}

// GetSubAccountMarginAccountDetail returns sub-account margin account detail.
func (c *MainClient) GetSubAccountMarginAccountDetail(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/sub-account/margin/account", params, true, &result)
	return result, err
}

// SubAccountTransferToMaster executes transfer to master account.
func (c *MainClient) SubAccountTransferToMaster(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/sub-account/transfer/subToMaster", params, true, &result)
	return result, err
}

// SubAccountTransferToSameMaster executes transfer to same master account.
func (c *MainClient) SubAccountTransferToSameMaster(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/sub-account/transfer/subToSub", params, true, &result)
	return result, err
}

// Futures Management Endpoints

// SubmitNewFutureAccountTransfer executes futures account transfer.
func (c *MainClient) SubmitNewFutureAccountTransfer(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/futures/transfer", params, true, &result)
	return result, err
}

// GetFutureAccountTransferHistory returns futures account transfer history.
func (c *MainClient) GetFutureAccountTransferHistory(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/futures/transfer", params, true, &result)
	return result, err
}

// Savings/Staking Endpoints

// GetSimpleEarnFlexibleProductList returns simple earn flexible product list.
func (c *MainClient) GetSimpleEarnFlexibleProductList(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/simple-earn/flexible/list", params, true, &result)
	return result, err
}

// GetSimpleEarnLockedProductList returns simple earn locked product list.
func (c *MainClient) GetSimpleEarnLockedProductList(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/simple-earn/locked/list", params, true, &result)
	return result, err
}

// SubscribeSimpleEarnFlexibleProduct subscribes to flexible product.
func (c *MainClient) SubscribeSimpleEarnFlexibleProduct(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/simple-earn/flexible/subscribe", params, true, &result)
	return result, err
}

// RedeemSimpleEarnFlexibleProduct redeems flexible product.
func (c *MainClient) RedeemSimpleEarnFlexibleProduct(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/simple-earn/flexible/redeem", params, true, &result)
	return result, err
}

// SubscribeSimpleEarnLockedProduct subscribes to locked product.
func (c *MainClient) SubscribeSimpleEarnLockedProduct(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/simple-earn/locked/subscribe", params, true, &result)
	return result, err
}

// RedeemSimpleEarnLockedProduct redeems locked product.
func (c *MainClient) RedeemSimpleEarnLockedProduct(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/simple-earn/locked/redeem", params, true, &result)
	return result, err
}

// GetSimpleEarnFlexiblePersonalLeftQuota returns flexible personal left quota.
func (c *MainClient) GetSimpleEarnFlexiblePersonalLeftQuota(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/simple-earn/flexible/personalLeftQuota", params, true, &result)
	return result, err
}

// GetSimpleEarnLockedPersonalLeftQuota returns locked personal left quota.
func (c *MainClient) GetSimpleEarnLockedPersonalLeftQuota(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/simple-earn/locked/personalLeftQuota", params, true, &result)
	return result, err
}

// Convert Endpoints

// GetConvertPairs returns convert pairs.
func (c *MainClient) GetConvertPairs(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/convert/exchangeInfo", params, true, &result)
	return result, err
}

// RequestConvertQuote requests a convert quote.
func (c *MainClient) RequestConvertQuote(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/convert/getQuote", params, true, &result)
	return result, err
}

// AcceptConvertQuote accepts a convert quote.
func (c *MainClient) AcceptConvertQuote(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/convert/acceptQuote", params, true, &result)
	return result, err
}

// GetConvertTradeHistory returns convert trade history.
func (c *MainClient) GetConvertTradeHistory(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/convert/tradeFlow", params, true, &result)
	return result, err
}

// Algo Trading Endpoints

// SubmitNewSpotAlgoOrder submits a new spot algo order.
func (c *MainClient) SubmitNewSpotAlgoOrder(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/algo/spot/newOrderTwap", params, true, &result)
	return result, err
}

// CancelSpotAlgoOrder cancels a spot algo order.
func (c *MainClient) CancelSpotAlgoOrder(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Delete(ctx, "/sapi/v1/algo/spot/order", params, true, &result)
	return result, err
}

// GetSpotAlgoOpenOrders returns open spot algo orders.
func (c *MainClient) GetSpotAlgoOpenOrders(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/algo/spot/openOrders", nil, true, &result)
	return result, err
}

// GetSpotAlgoHistoricalOrders returns historical spot algo orders.
func (c *MainClient) GetSpotAlgoHistoricalOrders(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/algo/spot/historicalOrders", params, true, &result)
	return result, err
}

// GetSpotAlgoSubOrders returns spot algo sub orders.
func (c *MainClient) GetSpotAlgoSubOrders(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/algo/spot/subOrders", params, true, &result)
	return result, err
}

// System Endpoints

// GetSystemStatus returns system status.
func (c *MainClient) GetSystemStatus(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/system/status", nil, false, &result)
	return result, err
}
