package binanceapi

import (
	"context"
)

// Wallet Management Endpoints

// GetBalances returns all coin balances.
func (c *MainClient) GetBalances(ctx context.Context) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/capital/config/getall", nil, true, &result)
	return result, err
}

// Withdraw submits a withdrawal request.
func (c *MainClient) Withdraw(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/capital/withdraw/apply", params, true, &result)
	return result, err
}

// GetWithdrawHistory returns withdraw history.
func (c *MainClient) GetWithdrawHistory(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/capital/withdraw/history", params, true, &result)
	return result, err
}

// GetDepositHistory returns deposit history.
func (c *MainClient) GetDepositHistory(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/capital/deposit/hisrec", params, true, &result)
	return result, err
}

// GetDepositAddress returns deposit address for a coin.
func (c *MainClient) GetDepositAddress(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/capital/deposit/address", params, true, &result)
	return result, err
}

// GetDepositAddresses returns deposit addresses list.
func (c *MainClient) GetDepositAddresses(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/capital/deposit/address/list", params, true, &result)
	return result, err
}

// GetAssetDetail returns asset detail.
func (c *MainClient) GetAssetDetail(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/asset/assetDetail", params, true, &result)
	return result, err
}

// GetTradeFee returns trade fee for symbols.
func (c *MainClient) GetTradeFee(ctx context.Context, symbol string) ([]map[string]interface{}, error) {
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/asset/tradeFee", params, true, &result)
	return result, err
}

// SubmitUniversalTransfer executes universal transfer.
func (c *MainClient) SubmitUniversalTransfer(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/asset/transfer", params, true, &result)
	return result, err
}

// GetUniversalTransferHistory returns universal transfer history.
func (c *MainClient) GetUniversalTransferHistory(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/asset/transfer", params, true, &result)
	return result, err
}

// GetFundingAsset returns funding asset.
func (c *MainClient) GetFundingAsset(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/asset/get-funding-asset", params, true, &result)
	return result, err
}

// GetUserAsset returns user asset.
func (c *MainClient) GetUserAsset(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Post(ctx, "/sapi/v3/asset/getUserAsset", params, true, &result)
	return result, err
}

// ConvertDustToBnb converts dust to BNB.
func (c *MainClient) ConvertDustToBnb(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/asset/dust", params, true, &result)
	return result, err
}

// GetDustLog returns dust conversion log.
func (c *MainClient) GetDustLog(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/asset/dribblet", params, true, &result)
	return result, err
}

// GetDust returns dust information.
func (c *MainClient) GetDust(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/sapi/v1/asset/dust-btc", params, true, &result)
	return result, err
}

// GetAssetDividendRecord returns asset dividend record.
func (c *MainClient) GetAssetDividendRecord(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/asset/assetDividend", params, true, &result)
	return result, err
}

// GetWalletBalances returns wallet balances.
func (c *MainClient) GetWalletBalances(ctx context.Context, params map[string]interface{}) ([]map[string]interface{}, error) {
	var result []map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/asset/wallet/balance", params, true, &result)
	return result, err
}

// GetAPIKeyPermissions returns API key permissions.
func (c *MainClient) GetAPIKeyPermissions(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/account/apiRestrictions", nil, true, &result)
	return result, err
}

// GetAccountStatus returns account status.
func (c *MainClient) GetAccountStatus(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/account/status", nil, true, &result)
	return result, err
}

// GetAPITradingStatus returns API trading status.
func (c *MainClient) GetAPITradingStatus(ctx context.Context) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/api/v3/account/apiTradingStatus", nil, true, &result)
	return result, err
}

// GetDailyAccountSnapshot returns daily account snapshot.
func (c *MainClient) GetDailyAccountSnapshot(ctx context.Context, params map[string]interface{}) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Get(ctx, "/sapi/v1/accountSnapshot", params, true, &result)
	return result, err
}

// DisableFastWithdrawSwitch disables fast withdraw.
func (c *MainClient) DisableFastWithdrawSwitch(ctx context.Context) error {
	return c.Post(ctx, "/sapi/v1/account/disableFastWithdrawSwitch", nil, true, nil)
}

// EnableFastWithdrawSwitch enables fast withdraw.
func (c *MainClient) EnableFastWithdrawSwitch(ctx context.Context) error {
	return c.Post(ctx, "/sapi/v1/account/enableFastWithdrawSwitch", nil, true, nil)
}
