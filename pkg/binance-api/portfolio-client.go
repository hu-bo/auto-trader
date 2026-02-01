package binanceapi

import (
	"context"

	"github.com/pkg/binance-api/types"
	"github.com/pkg/binance-api/util"
)

// PortfolioClient represents the Binance Portfolio Margin REST client.
type PortfolioClient struct {
	*util.BaseRestClient
}

// PortfolioClientOptions represents PortfolioClient options.
type PortfolioClientOptions struct {
	APIKey    string
	APISecret string
}

// NewPortfolioClient creates a new PortfolioClient.
func NewPortfolioClient(opts PortfolioClientOptions) *PortfolioClient {
	return &PortfolioClient{
		BaseRestClient: util.NewBaseRestClient(util.RestClientOptions{
			APIKey:     opts.APIKey,
			APISecret:  opts.APISecret,
			BaseURLKey: types.BaseURLPAPI,
		}),
	}
}

// Account Endpoints

// GetAccountInfo returns portfolio margin account info.
func (c *PortfolioClient) GetAccountInfo(ctx context.Context) (*types.PortfolioMarginAccountInfo, error) {
	var result types.PortfolioMarginAccountInfo
	err := c.Get(ctx, "/papi/v1/account", nil, true, &result)
	return &result, err
}

// GetBalance returns portfolio margin balance.
func (c *PortfolioClient) GetBalance(ctx context.Context) ([]types.PortfolioMarginBalance, error) {
	var result []types.PortfolioMarginBalance
	err := c.Get(ctx, "/papi/v1/balance", nil, true, &result)
	return result, err
}

// GetUMPositions returns USD-M positions.
func (c *PortfolioClient) GetUMPositions(ctx context.Context, symbol string) ([]types.PortfolioMarginPosition, error) {
	var result []types.PortfolioMarginPosition
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/papi/v1/um/positionRisk", params, true, &result)
	return result, err
}

// GetCMPositions returns COIN-M positions.
func (c *PortfolioClient) GetCMPositions(ctx context.Context, symbol string) ([]types.PortfolioMarginPosition, error) {
	var result []types.PortfolioMarginPosition
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/papi/v1/cm/positionRisk", params, true, &result)
	return result, err
}

// Trading Endpoints

// SubmitUMOrder submits a new USD-M futures order.
func (c *PortfolioClient) SubmitUMOrder(ctx context.Context, params types.NewFuturesOrderParams) (*types.NewOrderResult, error) {
	var result types.NewOrderResult
	err := c.Post(ctx, "/papi/v1/um/order", params, true, &result)
	return &result, err
}

// CancelUMOrder cancels a USD-M futures order.
func (c *PortfolioClient) CancelUMOrder(ctx context.Context, params types.CancelOrderParams) (*types.CancelFuturesOrderResult, error) {
	var result types.CancelFuturesOrderResult
	err := c.Delete(ctx, "/papi/v1/um/order", params, true, &result)
	return &result, err
}

// GetUMOrder returns USD-M order status.
func (c *PortfolioClient) GetUMOrder(ctx context.Context, params types.GetOrderParams) (*types.OrderResult, error) {
	var result types.OrderResult
	err := c.Get(ctx, "/papi/v1/um/order", params, true, &result)
	return &result, err
}

// GetUMOpenOrders returns all USD-M open orders.
func (c *PortfolioClient) GetUMOpenOrders(ctx context.Context, symbol string) ([]types.OrderResult, error) {
	var result []types.OrderResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/papi/v1/um/openOrders", params, true, &result)
	return result, err
}

// SubmitCMOrder submits a new COIN-M futures order.
func (c *PortfolioClient) SubmitCMOrder(ctx context.Context, params types.NewFuturesOrderParams) (*types.NewOrderResult, error) {
	var result types.NewOrderResult
	err := c.Post(ctx, "/papi/v1/cm/order", params, true, &result)
	return &result, err
}

// CancelCMOrder cancels a COIN-M futures order.
func (c *PortfolioClient) CancelCMOrder(ctx context.Context, params types.CancelOrderParams) (*types.CancelFuturesOrderResult, error) {
	var result types.CancelFuturesOrderResult
	err := c.Delete(ctx, "/papi/v1/cm/order", params, true, &result)
	return &result, err
}

// GetCMOrder returns COIN-M order status.
func (c *PortfolioClient) GetCMOrder(ctx context.Context, params types.GetOrderParams) (*types.OrderResult, error) {
	var result types.OrderResult
	err := c.Get(ctx, "/papi/v1/cm/order", params, true, &result)
	return &result, err
}

// GetCMOpenOrders returns all COIN-M open orders.
func (c *PortfolioClient) GetCMOpenOrders(ctx context.Context, symbol string) ([]types.OrderResult, error) {
	var result []types.OrderResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/papi/v1/cm/openOrders", params, true, &result)
	return result, err
}

// Margin Endpoints

// SubmitMarginOrder submits a new margin order.
func (c *PortfolioClient) SubmitMarginOrder(ctx context.Context, params types.NewSpotOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Post(ctx, "/papi/v1/margin/order", params, true, &result)
	return &result, err
}

// CancelMarginOrder cancels a margin order.
func (c *PortfolioClient) CancelMarginOrder(ctx context.Context, params types.CancelOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Delete(ctx, "/papi/v1/margin/order", params, true, &result)
	return &result, err
}

// GetMarginOrder returns margin order status.
func (c *PortfolioClient) GetMarginOrder(ctx context.Context, params types.GetOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Get(ctx, "/papi/v1/margin/order", params, true, &result)
	return &result, err
}

// GetMarginOpenOrders returns all margin open orders.
func (c *PortfolioClient) GetMarginOpenOrders(ctx context.Context, symbol string) ([]types.SpotOrderResult, error) {
	var result []types.SpotOrderResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/papi/v1/margin/openOrders", params, true, &result)
	return result, err
}

// User Data Stream Endpoints

// GetPMUserDataListenKey creates a new portfolio margin user data stream listen key.
func (c *PortfolioClient) GetPMUserDataListenKey(ctx context.Context) (*types.ListenKeyResponse, error) {
	var result types.ListenKeyResponse
	err := c.Post(ctx, "/papi/v1/listenKey", nil, true, &result)
	return &result, err
}

// KeepAlivePMUserDataListenKey keeps the portfolio margin user data stream alive.
func (c *PortfolioClient) KeepAlivePMUserDataListenKey(ctx context.Context, listenKey string) error {
	return c.Put(ctx, "/papi/v1/listenKey", map[string]interface{}{"listenKey": listenKey}, true, nil)
}

// ClosePMUserDataListenKey closes the portfolio margin user data stream.
func (c *PortfolioClient) ClosePMUserDataListenKey(ctx context.Context, listenKey string) error {
	return c.Delete(ctx, "/papi/v1/listenKey", map[string]interface{}{"listenKey": listenKey}, true, nil)
}
