package binanceapi

import (
	"context"

	"github.com/pkg/binance-api/types"
	"github.com/pkg/binance-api/util"
)

// USDMClient represents the Binance USD-M Futures REST client.
type USDMClient struct {
	*util.BaseRestClient
}

// USDMClientOptions represents USDMClient options.
type USDMClientOptions struct {
	APIKey    string
	APISecret string
	Testnet   bool
	Proxy     string
}

// NewUSDMClient creates a new USDMClient.
func NewUSDMClient(opts USDMClientOptions) *USDMClient {
	baseURLKey := types.BaseURLUSDM
	if opts.Testnet {
		baseURLKey = types.BaseURLUSDMTest
	}

	return &USDMClient{
		BaseRestClient: util.NewBaseRestClient(util.RestClientOptions{
			APIKey:     opts.APIKey,
			APISecret:  opts.APISecret,
			BaseURLKey: baseURLKey,
			Testnet:    opts.Testnet,
			Proxy:      opts.Proxy,
		}),
	}
}

// General Endpoints

// GetServerTime returns the server time.
func (c *USDMClient) GetServerTime(ctx context.Context) (int64, error) {
	var result struct {
		ServerTime int64 `json:"serverTime"`
	}
	err := c.Get(ctx, "/fapi/v1/time", nil, false, &result)
	return result.ServerTime, err
}

// GetExchangeInfo returns exchange info.
func (c *USDMClient) GetExchangeInfo(ctx context.Context) (*types.FuturesExchangeInfo, error) {
	var result types.FuturesExchangeInfo
	err := c.Get(ctx, "/fapi/v1/exchangeInfo", nil, false, &result)
	return &result, err
}

// Market Data Endpoints

// GetOrderBook returns the order book.
func (c *USDMClient) GetOrderBook(ctx context.Context, params types.OrderBookParams) (*types.FuturesOrderBook, error) {
	var result types.FuturesOrderBook
	err := c.Get(ctx, "/fapi/v1/depth", params, false, &result)
	return &result, err
}

// GetRecentTrades returns recent trades.
func (c *USDMClient) GetRecentTrades(ctx context.Context, params types.RecentTradesParams) ([]types.RawFuturesTrade, error) {
	var result []types.RawFuturesTrade
	err := c.Get(ctx, "/fapi/v1/trades", params, false, &result)
	return result, err
}

// GetKlines returns kline/candlestick data.
func (c *USDMClient) GetKlines(ctx context.Context, params types.KlinesParams) ([][]interface{}, error) {
	var result [][]interface{}
	err := c.Get(ctx, "/fapi/v1/klines", params, false, &result)
	return result, err
}

// GetMarkPrice returns mark price and funding rate.
func (c *USDMClient) GetMarkPrice(ctx context.Context, symbol string) (*types.MarkPrice, error) {
	var result types.MarkPrice
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/fapi/v1/premiumIndex", params, false, &result)
	return &result, err
}

// GetAllMarkPrices returns mark price and funding rate for all symbols.
func (c *USDMClient) GetAllMarkPrices(ctx context.Context) ([]types.MarkPrice, error) {
	var result []types.MarkPrice
	err := c.Get(ctx, "/fapi/v1/premiumIndex", nil, false, &result)
	return result, err
}

// GetFundingRateHistory returns funding rate history.
func (c *USDMClient) GetFundingRateHistory(ctx context.Context, params types.BasicSymbolPaginatedParams) ([]types.FundingRateHistory, error) {
	var result []types.FundingRateHistory
	err := c.Get(ctx, "/fapi/v1/fundingRate", params, false, &result)
	return result, err
}

// Get24hrChangeStatistics returns 24hr change statistics for a symbol.
func (c *USDMClient) Get24hrChangeStatistics(ctx context.Context, symbol string) (*types.ChangeStats24hr, error) {
	var result types.ChangeStats24hr
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/fapi/v1/ticker/24hr", params, false, &result)
	return &result, err
}

// GetAll24hrTickers returns 24hr change statistics for all futures symbols.
func (c *USDMClient) GetAll24hrTickers(ctx context.Context) ([]types.ChangeStats24hr, error) {
	var result []types.ChangeStats24hr
	err := c.Get(ctx, "/fapi/v1/ticker/24hr", nil, false, &result)
	return result, err
}

// GetSymbolPrice returns the latest price for a symbol.
func (c *USDMClient) GetSymbolPrice(ctx context.Context, symbol string) (*types.SymbolPrice, error) {
	var result types.SymbolPrice
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/fapi/v1/ticker/price", params, false, &result)
	return &result, err
}

// GetAllSymbolPrices returns the latest prices for all symbols.
func (c *USDMClient) GetAllSymbolPrices(ctx context.Context) ([]types.SymbolPrice, error) {
	var result []types.SymbolPrice
	err := c.Get(ctx, "/fapi/v1/ticker/price", nil, false, &result)
	return result, err
}

// GetOpenInterest returns open interest.
func (c *USDMClient) GetOpenInterest(ctx context.Context, symbol string) (*types.OpenInterest, error) {
	var result types.OpenInterest
	err := c.Get(ctx, "/fapi/v1/openInterest", map[string]interface{}{"symbol": symbol}, false, &result)
	return &result, err
}

// Account/Trade Endpoints

// GetPositionMode returns position mode.
func (c *USDMClient) GetPositionMode(ctx context.Context) (*types.PositionModeResponse, error) {
	var result types.PositionModeResponse
	err := c.Get(ctx, "/fapi/v1/positionSide/dual", nil, true, &result)
	return &result, err
}

// SetPositionMode sets position mode.
func (c *USDMClient) SetPositionMode(ctx context.Context, params types.PositionModeParams) (*types.ModeChangeResult, error) {
	var result types.ModeChangeResult
	err := c.Post(ctx, "/fapi/v1/positionSide/dual", params, true, &result)
	return &result, err
}

// GetMultiAssetMode returns multi-asset mode.
func (c *USDMClient) GetMultiAssetMode(ctx context.Context) (*types.MultiAssetModeResponse, error) {
	var result types.MultiAssetModeResponse
	err := c.Get(ctx, "/fapi/v1/multiAssetsMargin", nil, true, &result)
	return &result, err
}

// SubmitNewOrder submits a new futures order.
func (c *USDMClient) SubmitNewOrder(ctx context.Context, params types.NewFuturesOrderParams) (*types.NewOrderResult, error) {
	var result types.NewOrderResult
	err := c.Post(ctx, "/fapi/v1/order", params, true, &result)
	return &result, err
}

// ModifyOrder modifies an existing order.
func (c *USDMClient) ModifyOrder(ctx context.Context, params types.ModifyFuturesOrderParams) (*types.OrderResult, error) {
	var result types.OrderResult
	err := c.Put(ctx, "/fapi/v1/order", params, true, &result)
	return &result, err
}

// CancelOrder cancels an order.
func (c *USDMClient) CancelOrder(ctx context.Context, params types.CancelOrderParams) (*types.CancelFuturesOrderResult, error) {
	var result types.CancelFuturesOrderResult
	err := c.Delete(ctx, "/fapi/v1/order", params, true, &result)
	return &result, err
}

// CancelAllOpenOrders cancels all open orders for a symbol.
func (c *USDMClient) CancelAllOpenOrders(ctx context.Context, symbol string) (*types.CancelAllOpenOrdersResult, error) {
	var result types.CancelAllOpenOrdersResult
	err := c.Delete(ctx, "/fapi/v1/allOpenOrders", map[string]interface{}{"symbol": symbol}, true, &result)
	return &result, err
}

// GetOrder returns order status.
func (c *USDMClient) GetOrder(ctx context.Context, params types.GetOrderParams) (*types.OrderResult, error) {
	var result types.OrderResult
	err := c.Get(ctx, "/fapi/v1/order", params, true, &result)
	return &result, err
}

// GetOpenOrders returns all open orders.
func (c *USDMClient) GetOpenOrders(ctx context.Context, symbol string) ([]types.OrderResult, error) {
	var result []types.OrderResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/fapi/v1/openOrders", params, true, &result)
	return result, err
}

// GetAllOrders returns all orders.
func (c *USDMClient) GetAllOrders(ctx context.Context, params types.GetAllOrdersParams) ([]types.OrderResult, error) {
	var result []types.OrderResult
	err := c.Get(ctx, "/fapi/v1/allOrders", params, true, &result)
	return result, err
}

// Account Endpoints

// GetBalance returns account balance.
func (c *USDMClient) GetBalance(ctx context.Context) ([]types.FuturesAccountBalance, error) {
	var result []types.FuturesAccountBalance
	err := c.Get(ctx, "/fapi/v2/balance", nil, true, &result)
	return result, err
}

// GetAccountInfo returns account information.
func (c *USDMClient) GetAccountInfo(ctx context.Context) (*types.FuturesAccountInformation, error) {
	var result types.FuturesAccountInformation
	err := c.Get(ctx, "/fapi/v2/account", nil, true, &result)
	return &result, err
}

// GetPositions returns all positions.
func (c *USDMClient) GetPositions(ctx context.Context, symbol string) ([]types.FuturesPosition, error) {
	var result []types.FuturesPosition
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/fapi/v2/positionRisk", params, true, &result)
	return result, err
}

// GetAccountTrades returns account trades.
func (c *USDMClient) GetAccountTrades(ctx context.Context, params types.SymbolFromPaginatedRequestFromId) ([]types.FuturesPositionTrade, error) {
	var result []types.FuturesPositionTrade
	err := c.Get(ctx, "/fapi/v1/userTrades", params, true, &result)
	return result, err
}

// GetIncomeHistory returns income history.
func (c *USDMClient) GetIncomeHistory(ctx context.Context, params types.GetIncomeHistoryParams) ([]types.IncomeHistory, error) {
	var result []types.IncomeHistory
	err := c.Get(ctx, "/fapi/v1/income", params, true, &result)
	return result, err
}

// Leverage & Margin Endpoints

// SetLeverage sets leverage for a symbol.
func (c *USDMClient) SetLeverage(ctx context.Context, params types.SetLeverageParams) (*types.SetLeverageResult, error) {
	var result types.SetLeverageResult
	err := c.Post(ctx, "/fapi/v1/leverage", params, true, &result)
	return &result, err
}

// SetMarginType sets margin type for a symbol.
func (c *USDMClient) SetMarginType(ctx context.Context, params types.SetMarginTypeParams) (*types.ModeChangeResult, error) {
	var result types.ModeChangeResult
	err := c.Post(ctx, "/fapi/v1/marginType", params, true, &result)
	return &result, err
}

// SetIsolatedPositionMargin modifies isolated position margin.
func (c *USDMClient) SetIsolatedPositionMargin(ctx context.Context, params types.SetIsolatedMarginParams) (*types.ModeChangeResult, error) {
	var result types.ModeChangeResult
	err := c.Post(ctx, "/fapi/v1/positionMargin", params, true, &result)
	return &result, err
}

// GetLeverageBrackets returns leverage brackets for symbols.
func (c *USDMClient) GetLeverageBrackets(ctx context.Context, symbol string) ([]types.SymbolLeverageBracketsResult, error) {
	var result []types.SymbolLeverageBracketsResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/fapi/v1/leverageBracket", params, true, &result)
	return result, err
}

// User Data Stream Endpoints

// GetFuturesUserDataListenKey creates a new user data stream listen key.
func (c *USDMClient) GetFuturesUserDataListenKey(ctx context.Context) (*types.ListenKeyResponse, error) {
	var result types.ListenKeyResponse
	err := c.Post(ctx, "/fapi/v1/listenKey", nil, false, &result)
	return &result, err
}

// KeepAliveFuturesUserDataListenKey keeps the user data stream alive.
func (c *USDMClient) KeepAliveFuturesUserDataListenKey(ctx context.Context) error {
	return c.Put(ctx, "/fapi/v1/listenKey", nil, false, nil)
}

// CloseFuturesUserDataListenKey closes the user data stream.
func (c *USDMClient) CloseFuturesUserDataListenKey(ctx context.Context) error {
	return c.Delete(ctx, "/fapi/v1/listenKey", nil, false, nil)
}

// Commission Rate

// GetCommissionRate returns commission rate.
func (c *USDMClient) GetCommissionRate(ctx context.Context, symbol string) (*types.UserCommissionRate, error) {
	var result types.UserCommissionRate
	err := c.Get(ctx, "/fapi/v1/commissionRate", map[string]interface{}{"symbol": symbol}, true, &result)
	return &result, err
}
