package binanceapi

import (
	"context"

	"github.com/pkg/binance-api/types"
	"github.com/pkg/binance-api/util"
)

// COINMClient represents the Binance COIN-M Futures REST client.
type COINMClient struct {
	*util.BaseRestClient
}

// COINMClientOptions represents COINMClient options.
type COINMClientOptions struct {
	APIKey    string
	APISecret string
	Testnet   bool
	Proxy     string
}

// NewCOINMClient creates a new COINMClient.
func NewCOINMClient(opts COINMClientOptions) *COINMClient {
	baseURLKey := types.BaseURLCOINM
	if opts.Testnet {
		baseURLKey = types.BaseURLCOINMTest
	}

	return &COINMClient{
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
func (c *COINMClient) GetServerTime(ctx context.Context) (int64, error) {
	var result struct {
		ServerTime int64 `json:"serverTime"`
	}
	err := c.Get(ctx, "/dapi/v1/time", nil, false, &result)
	return result.ServerTime, err
}

// GetExchangeInfo returns exchange info.
func (c *COINMClient) GetExchangeInfo(ctx context.Context) (*types.FuturesExchangeInfo, error) {
	var result types.FuturesExchangeInfo
	err := c.Get(ctx, "/dapi/v1/exchangeInfo", nil, false, &result)
	return &result, err
}

// Market Data Endpoints

// GetOrderBook returns the order book.
func (c *COINMClient) GetOrderBook(ctx context.Context, params types.OrderBookParams) (*types.FuturesOrderBook, error) {
	var result types.FuturesOrderBook
	err := c.Get(ctx, "/dapi/v1/depth", params, false, &result)
	return &result, err
}

// GetRecentTrades returns recent trades.
func (c *COINMClient) GetRecentTrades(ctx context.Context, params types.RecentTradesParams) ([]types.RawFuturesTrade, error) {
	var result []types.RawFuturesTrade
	err := c.Get(ctx, "/dapi/v1/trades", params, false, &result)
	return result, err
}

// GetKlines returns kline/candlestick data.
func (c *COINMClient) GetKlines(ctx context.Context, params types.KlinesParams) ([][]interface{}, error) {
	var result [][]interface{}
	err := c.Get(ctx, "/dapi/v1/klines", params, false, &result)
	return result, err
}

// GetMarkPrice returns mark price and funding rate.
func (c *COINMClient) GetMarkPrice(ctx context.Context, symbol string) (*types.MarkPrice, error) {
	var result types.MarkPrice
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/dapi/v1/premiumIndex", params, false, &result)
	return &result, err
}

// GetAllMarkPrices returns mark price and funding rate for all symbols.
func (c *COINMClient) GetAllMarkPrices(ctx context.Context) ([]types.MarkPrice, error) {
	var result []types.MarkPrice
	err := c.Get(ctx, "/dapi/v1/premiumIndex", nil, false, &result)
	return result, err
}

// GetFundingRateHistory returns funding rate history.
func (c *COINMClient) GetFundingRateHistory(ctx context.Context, params types.BasicSymbolPaginatedParams) ([]types.FundingRateHistory, error) {
	var result []types.FundingRateHistory
	err := c.Get(ctx, "/dapi/v1/fundingRate", params, false, &result)
	return result, err
}

// GetSymbolPrice returns the latest price for a symbol.
func (c *COINMClient) GetSymbolPrice(ctx context.Context, symbol string) (*types.SymbolPrice, error) {
	var result types.SymbolPrice
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/dapi/v1/ticker/price", params, false, &result)
	return &result, err
}

// GetAllSymbolPrices returns the latest prices for all symbols.
func (c *COINMClient) GetAllSymbolPrices(ctx context.Context) ([]types.SymbolPrice, error) {
	var result []types.SymbolPrice
	err := c.Get(ctx, "/dapi/v1/ticker/price", nil, false, &result)
	return result, err
}

// GetOpenInterest returns open interest.
func (c *COINMClient) GetOpenInterest(ctx context.Context, symbol string) (*types.OpenInterest, error) {
	var result types.OpenInterest
	err := c.Get(ctx, "/dapi/v1/openInterest", map[string]interface{}{"symbol": symbol}, false, &result)
	return &result, err
}

// Account/Trade Endpoints

// GetPositionMode returns position mode.
func (c *COINMClient) GetPositionMode(ctx context.Context) (*types.PositionModeResponse, error) {
	var result types.PositionModeResponse
	err := c.Get(ctx, "/dapi/v1/positionSide/dual", nil, true, &result)
	return &result, err
}

// SetPositionMode sets position mode.
func (c *COINMClient) SetPositionMode(ctx context.Context, params types.PositionModeParams) (*types.ModeChangeResult, error) {
	var result types.ModeChangeResult
	err := c.Post(ctx, "/dapi/v1/positionSide/dual", params, true, &result)
	return &result, err
}

// SubmitNewOrder submits a new futures order.
func (c *COINMClient) SubmitNewOrder(ctx context.Context, params types.NewFuturesOrderParams) (*types.NewOrderResult, error) {
	var result types.NewOrderResult
	err := c.Post(ctx, "/dapi/v1/order", params, true, &result)
	return &result, err
}

// CancelOrder cancels an order.
func (c *COINMClient) CancelOrder(ctx context.Context, params types.CancelOrderParams) (*types.CancelFuturesOrderResult, error) {
	var result types.CancelFuturesOrderResult
	err := c.Delete(ctx, "/dapi/v1/order", params, true, &result)
	return &result, err
}

// CancelAllOpenOrders cancels all open orders for a symbol.
func (c *COINMClient) CancelAllOpenOrders(ctx context.Context, symbol string) (*types.CancelAllOpenOrdersResult, error) {
	var result types.CancelAllOpenOrdersResult
	err := c.Delete(ctx, "/dapi/v1/allOpenOrders", map[string]interface{}{"symbol": symbol}, true, &result)
	return &result, err
}

// GetOrder returns order status.
func (c *COINMClient) GetOrder(ctx context.Context, params types.GetOrderParams) (*types.OrderResult, error) {
	var result types.OrderResult
	err := c.Get(ctx, "/dapi/v1/order", params, true, &result)
	return &result, err
}

// GetOpenOrders returns all open orders.
func (c *COINMClient) GetOpenOrders(ctx context.Context, symbol string) ([]types.OrderResult, error) {
	var result []types.OrderResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/dapi/v1/openOrders", params, true, &result)
	return result, err
}

// GetAllOrders returns all orders.
func (c *COINMClient) GetAllOrders(ctx context.Context, params types.GetAllOrdersParams) ([]types.OrderResult, error) {
	var result []types.OrderResult
	err := c.Get(ctx, "/dapi/v1/allOrders", params, true, &result)
	return result, err
}

// Account Endpoints

// GetBalance returns account balance.
func (c *COINMClient) GetBalance(ctx context.Context) ([]types.CoinMAccountBalance, error) {
	var result []types.CoinMAccountBalance
	err := c.Get(ctx, "/dapi/v1/balance", nil, true, &result)
	return result, err
}

// GetAccountInfo returns account information.
func (c *COINMClient) GetAccountInfo(ctx context.Context) (*types.CoinMAccountInformation, error) {
	var result types.CoinMAccountInformation
	err := c.Get(ctx, "/dapi/v1/account", nil, true, &result)
	return &result, err
}

// GetPositions returns all positions.
func (c *COINMClient) GetPositions(ctx context.Context, symbol string) ([]types.FuturesPosition, error) {
	var result []types.FuturesPosition
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/dapi/v1/positionRisk", params, true, &result)
	return result, err
}

// GetAccountTrades returns account trades.
func (c *COINMClient) GetAccountTrades(ctx context.Context, params types.SymbolFromPaginatedRequestFromId) ([]types.FuturesPositionTrade, error) {
	var result []types.FuturesPositionTrade
	err := c.Get(ctx, "/dapi/v1/userTrades", params, true, &result)
	return result, err
}

// GetIncomeHistory returns income history.
func (c *COINMClient) GetIncomeHistory(ctx context.Context, params types.GetIncomeHistoryParams) ([]types.IncomeHistory, error) {
	var result []types.IncomeHistory
	err := c.Get(ctx, "/dapi/v1/income", params, true, &result)
	return result, err
}

// Leverage & Margin Endpoints

// SetLeverage sets leverage for a symbol.
func (c *COINMClient) SetLeverage(ctx context.Context, params types.SetLeverageParams) (*types.SetLeverageResult, error) {
	var result types.SetLeverageResult
	err := c.Post(ctx, "/dapi/v1/leverage", params, true, &result)
	return &result, err
}

// SetMarginType sets margin type for a symbol.
func (c *COINMClient) SetMarginType(ctx context.Context, params types.SetMarginTypeParams) (*types.ModeChangeResult, error) {
	var result types.ModeChangeResult
	err := c.Post(ctx, "/dapi/v1/marginType", params, true, &result)
	return &result, err
}

// GetLeverageBrackets returns leverage brackets for symbols.
func (c *COINMClient) GetLeverageBrackets(ctx context.Context, symbol string) ([]types.SymbolLeverageBracketsResult, error) {
	var result []types.SymbolLeverageBracketsResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/dapi/v1/leverageBracket", params, true, &result)
	return result, err
}

// User Data Stream Endpoints

// GetFuturesUserDataListenKey creates a new user data stream listen key.
func (c *COINMClient) GetFuturesUserDataListenKey(ctx context.Context) (*types.ListenKeyResponse, error) {
	var result types.ListenKeyResponse
	err := c.Post(ctx, "/dapi/v1/listenKey", nil, false, &result)
	return &result, err
}

// KeepAliveFuturesUserDataListenKey keeps the user data stream alive.
func (c *COINMClient) KeepAliveFuturesUserDataListenKey(ctx context.Context) error {
	return c.Put(ctx, "/dapi/v1/listenKey", nil, false, nil)
}

// CloseFuturesUserDataListenKey closes the user data stream.
func (c *COINMClient) CloseFuturesUserDataListenKey(ctx context.Context) error {
	return c.Delete(ctx, "/dapi/v1/listenKey", nil, false, nil)
}
