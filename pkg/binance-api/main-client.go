package binanceapi

import (
	"context"

	"github.com/pkg/binance-api/types"
	"github.com/pkg/binance-api/util"
)

// MainClient represents the Binance Spot/Margin REST client.
type MainClient struct {
	*util.BaseRestClient
}

// MainClientOptions represents MainClient options.
type MainClientOptions struct {
	APIKey    string
	APISecret string
	Testnet   bool
	Proxy     string
}

// NewMainClient creates a new MainClient.
func NewMainClient(opts MainClientOptions) *MainClient {
	baseURLKey := types.BaseURLSpot
	if opts.Testnet {
		baseURLKey = types.BaseURLSpotTest
	}

	return &MainClient{
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
func (c *MainClient) GetServerTime(ctx context.Context) (int64, error) {
	var result struct {
		ServerTime int64 `json:"serverTime"`
	}
	err := c.Get(ctx, "/api/v3/time", nil, false, &result)
	return result.ServerTime, err
}

// GetExchangeInfo returns exchange info.
func (c *MainClient) GetExchangeInfo(ctx context.Context) (*types.SpotExchangeInfo, error) {
	var result types.SpotExchangeInfo
	err := c.Get(ctx, "/api/v3/exchangeInfo", nil, false, &result)
	return &result, err
}

// Market Data Endpoints

// GetOrderBook returns the order book.
func (c *MainClient) GetOrderBook(ctx context.Context, params types.OrderBookParams) (*types.SpotOrderBook, error) {
	var result types.SpotOrderBook
	err := c.Get(ctx, "/api/v3/depth", params, false, &result)
	return &result, err
}

// GetRecentTrades returns recent trades.
func (c *MainClient) GetRecentTrades(ctx context.Context, params types.RecentTradesParams) ([]types.SpotTrade, error) {
	var result []types.SpotTrade
	err := c.Get(ctx, "/api/v3/trades", params, false, &result)
	return result, err
}

// GetKlines returns kline/candlestick data.
func (c *MainClient) GetKlines(ctx context.Context, params types.KlinesParams) ([][]interface{}, error) {
	var result [][]interface{}
	err := c.Get(ctx, "/api/v3/klines", params, false, &result)
	return result, err
}

// GetSymbolPrice returns the latest price for a symbol.
func (c *MainClient) GetSymbolPrice(ctx context.Context, symbol string) (*types.SymbolPrice, error) {
	var result types.SymbolPrice
	err := c.Get(ctx, "/api/v3/ticker/price", map[string]interface{}{"symbol": symbol}, false, &result)
	return &result, err
}

// GetAllSymbolPrices returns the latest prices for all symbols.
func (c *MainClient) GetAllSymbolPrices(ctx context.Context) ([]types.SymbolPrice, error) {
	var result []types.SymbolPrice
	err := c.Get(ctx, "/api/v3/ticker/price", nil, false, &result)
	return result, err
}

// GetAll24hrTickers returns 24hr change statistics for all spot symbols.
func (c *MainClient) GetAll24hrTickers(ctx context.Context) ([]types.ChangeStats24hr, error) {
	var result []types.ChangeStats24hr
	err := c.Get(ctx, "/api/v3/ticker/24hr", nil, false, &result)
	return result, err
}

// Account Endpoints

// GetAccountInfo returns account information.
func (c *MainClient) GetAccountInfo(ctx context.Context) (*types.SpotAccountInfo, error) {
	var result types.SpotAccountInfo
	err := c.Get(ctx, "/api/v3/account", nil, true, &result)
	return &result, err
}

// Trading Endpoints

// SubmitNewOrder submits a new order.
func (c *MainClient) SubmitNewOrder(ctx context.Context, params types.NewSpotOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Post(ctx, "/api/v3/order", params, true, &result)
	return &result, err
}

// CancelOrder cancels an order.
func (c *MainClient) CancelOrder(ctx context.Context, params types.CancelOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Delete(ctx, "/api/v3/order", params, true, &result)
	return &result, err
}

// GetOrder returns order status.
func (c *MainClient) GetOrder(ctx context.Context, params types.GetOrderParams) (*types.SpotOrderResult, error) {
	var result types.SpotOrderResult
	err := c.Get(ctx, "/api/v3/order", params, true, &result)
	return &result, err
}

// GetOpenOrders returns all open orders.
func (c *MainClient) GetOpenOrders(ctx context.Context, symbol string) ([]types.SpotOrderResult, error) {
	var result []types.SpotOrderResult
	params := map[string]interface{}{}
	if symbol != "" {
		params["symbol"] = symbol
	}
	err := c.Get(ctx, "/api/v3/openOrders", params, true, &result)
	return result, err
}

// GetAllOrders returns all orders.
func (c *MainClient) GetAllOrders(ctx context.Context, params types.GetAllOrdersParams) ([]types.SpotOrderResult, error) {
	var result []types.SpotOrderResult
	err := c.Get(ctx, "/api/v3/allOrders", params, true, &result)
	return result, err
}

// User Data Stream Endpoints

// GetSpotUserDataListenKey creates a new user data stream listen key.
func (c *MainClient) GetSpotUserDataListenKey(ctx context.Context) (*types.ListenKeyResponse, error) {
	var result types.ListenKeyResponse
	err := c.Post(ctx, "/api/v3/userDataStream", nil, false, &result)
	return &result, err
}

// KeepAliveSpotUserDataListenKey keeps the user data stream alive.
func (c *MainClient) KeepAliveSpotUserDataListenKey(ctx context.Context, listenKey string) error {
	return c.Put(ctx, "/api/v3/userDataStream", map[string]interface{}{"listenKey": listenKey}, false, nil)
}

// CloseSpotUserDataListenKey closes the user data stream.
func (c *MainClient) CloseSpotUserDataListenKey(ctx context.Context, listenKey string) error {
	return c.Delete(ctx, "/api/v3/userDataStream", map[string]interface{}{"listenKey": listenKey}, false, nil)
}

// Margin Endpoints

// GetMarginUserDataListenKey creates a new margin user data stream listen key.
func (c *MainClient) GetMarginUserDataListenKey(ctx context.Context) (*types.ListenKeyResponse, error) {
	var result types.ListenKeyResponse
	err := c.Post(ctx, "/sapi/v1/userDataStream", nil, false, &result)
	return &result, err
}

// KeepAliveMarginUserDataListenKey keeps the margin user data stream alive.
func (c *MainClient) KeepAliveMarginUserDataListenKey(ctx context.Context, listenKey string) error {
	return c.Put(ctx, "/sapi/v1/userDataStream", map[string]interface{}{"listenKey": listenKey}, false, nil)
}

// CloseMarginUserDataListenKey closes the margin user data stream.
func (c *MainClient) CloseMarginUserDataListenKey(ctx context.Context, listenKey string) error {
	return c.Delete(ctx, "/sapi/v1/userDataStream", map[string]interface{}{"listenKey": listenKey}, false, nil)
}

// Advanced Order Types - OCO, OTO, OTOCO, OPO, OPOCO, SOR

// SubmitNewOCO submits a new OCO order (deprecated - use SubmitNewOrderListOCO).
func (c *MainClient) SubmitNewOCO(ctx context.Context, params types.NewOCOParams) (*types.OrderList, error) {
	var result types.OrderList
	err := c.Post(ctx, "/api/v3/order/oco", params, true, &result)
	return &result, err
}

// SubmitNewOrderListOCO submits a new OCO order list.
func (c *MainClient) SubmitNewOrderListOCO(ctx context.Context, params types.NewOCOParams) (*types.OrderList, error) {
	var result types.OrderList
	err := c.Post(ctx, "/api/v3/orderList/oco", params, true, &result)
	return &result, err
}

// SubmitNewOrderListOTO submits a new OTO order list.
func (c *MainClient) SubmitNewOrderListOTO(ctx context.Context, params types.NewOrderListOTOParams) (*types.NewOrderListOTOResponse, error) {
	var result types.NewOrderListOTOResponse
	err := c.Post(ctx, "/api/v3/orderList/oto", params, true, &result)
	return &result, err
}

// SubmitNewOrderListOTOCO submits a new OTOCO order list.
func (c *MainClient) SubmitNewOrderListOTOCO(ctx context.Context, params types.NewOrderListOTOCOParams) (*types.NewOrderListOTOCOResponse, error) {
	var result types.NewOrderListOTOCOResponse
	err := c.Post(ctx, "/api/v3/orderList/otoco", params, true, &result)
	return &result, err
}

// SubmitNewOrderListOPO submits a new OPO order list.
func (c *MainClient) SubmitNewOrderListOPO(ctx context.Context, params types.NewOrderListOPOParams) (*types.NewOrderListOPOResponse, error) {
	var result types.NewOrderListOPOResponse
	err := c.Post(ctx, "/api/v3/orderList/opo", params, true, &result)
	return &result, err
}

// SubmitNewOrderListOPOCO submits a new OPOCO order list.
func (c *MainClient) SubmitNewOrderListOPOCO(ctx context.Context, params types.NewOrderListOPOCOParams) (*types.NewOrderListOPOCOResponse, error) {
	var result types.NewOrderListOPOCOResponse
	err := c.Post(ctx, "/api/v3/orderList/opoco", params, true, &result)
	return &result, err
}

// CancelOCO cancels an OCO order.
func (c *MainClient) CancelOCO(ctx context.Context, params types.CancelOCOParams) (*types.CancelOrderListResult, error) {
	var result types.CancelOrderListResult
	err := c.Delete(ctx, "/api/v3/orderList", params, true, &result)
	return &result, err
}

// GetOCO gets OCO order information.
func (c *MainClient) GetOCO(ctx context.Context, params types.GetOCOParams) (*types.OrderList, error) {
	var result types.OrderList
	err := c.Get(ctx, "/api/v3/orderList", params, true, &result)
	return &result, err
}

// GetAllOCO gets all OCO orders.
func (c *MainClient) GetAllOCO(ctx context.Context, params map[string]interface{}) ([]types.OrderList, error) {
	var result []types.OrderList
	err := c.Get(ctx, "/api/v3/allOrderList", params, true, &result)
	return result, err
}

// GetAllOpenOCO gets all open OCO orders.
func (c *MainClient) GetAllOpenOCO(ctx context.Context) ([]types.OrderList, error) {
	var result []types.OrderList
	err := c.Get(ctx, "/api/v3/openOrderList", nil, true, &result)
	return result, err
}

// SubmitNewSOROrder places an order using smart order routing (SOR).
func (c *MainClient) SubmitNewSOROrder(ctx context.Context, params types.NewSpotSOROrderParams) (*types.SOROrderResponseFull, error) {
	var result types.SOROrderResponseFull
	err := c.Post(ctx, "/api/v3/sor/order", params, true, &result)
	return &result, err
}

// TestNewSOROrder tests new order creation using SOR without sending to matching engine.
func (c *MainClient) TestNewSOROrder(ctx context.Context, params types.NewSpotSOROrderParams) (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.Post(ctx, "/api/v3/sor/order/test", params, true, &result)
	return result, err
}

// CancelAllSymbolOrders cancels all open orders on a symbol.
func (c *MainClient) CancelAllSymbolOrders(ctx context.Context, symbol string) ([]types.SpotOrderResult, error) {
	var result []types.SpotOrderResult
	err := c.Delete(ctx, "/api/v3/openOrders", map[string]interface{}{"symbol": symbol}, true, &result)
	return result, err
}

// Account Information Endpoints

// GetAccountTradeList returns account trade list.
func (c *MainClient) GetAccountTradeList(ctx context.Context, params types.SymbolFromPaginatedRequestFromId) ([]types.AccountTradeList, error) {
	var result []types.AccountTradeList
	err := c.Get(ctx, "/api/v3/myTrades", params, true, &result)
	return result, err
}

// GetOrderRateLimit returns current order rate limit usage.
func (c *MainClient) GetOrderRateLimit(ctx context.Context) ([]types.OrderRateLimitUsage, error) {
	var result []types.OrderRateLimitUsage
	err := c.Get(ctx, "/api/v3/rateLimit/order", nil, true, &result)
	return result, err
}

// GetPreventedMatches returns prevented matches for a symbol.
func (c *MainClient) GetPreventedMatches(ctx context.Context, params map[string]interface{}) ([]types.PreventedMatch, error) {
	var result []types.PreventedMatch
	err := c.Get(ctx, "/api/v3/myPreventedMatches", params, true, &result)
	return result, err
}
