package okxapi

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	okxtypes "github.com/pkg/okx-api/types"
	okxrest "github.com/pkg/okx-api/types/rest"
	okxutil "github.com/pkg/okx-api/util"
	"golang.org/x/net/proxy"
)

type RestClient struct {
	opts       okxrest.RestClientOptions
	baseURL    string
	httpClient *http.Client
}

func NewRestClient(opts okxrest.RestClientOptions) (*RestClient, error) {
	baseURL := "https://www.okx.com"
	if opts.Market != "" && opts.Market != okxtypes.APIMarketGLOBAL {
		return nil, fmt.Errorf("unsupported market: %s", opts.Market)
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2: true,
	}

	if strings.TrimSpace(opts.Proxy) != "" {
		proxyURL, err := url.Parse(strings.TrimSpace(opts.Proxy))
		if err != nil {
			return nil, fmt.Errorf("invalid proxy url: %w", err)
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	if strings.TrimSpace(opts.SocksProxy) != "" {
		addr := strings.TrimSpace(opts.SocksProxy)
		if u, err := url.Parse(addr); err == nil && u.Host != "" {
			addr = u.Host
		}
		d, err := proxy.SOCKS5("tcp", addr, nil, proxy.Direct)
		if err != nil {
			return nil, fmt.Errorf("create socks5 dialer: %w", err)
		}
		transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
			return d.Dial(network, address)
		}
	}

	return &RestClient{
		opts:    opts,
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout:   30 * time.Second,
			Transport: transport,
		},
	}, nil
}

type okxEnvelope struct {
	Code string          `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func (c *RestClient) do(ctx context.Context, method string, path string, query any, body any, auth bool) ([]byte, error) {
	u, err := url.Parse(c.baseURL + path)
	if err != nil {
		return nil, err
	}

	if query != nil {
		q := toURLValues(query)
		u.RawQuery = q.Encode()
	}

	var bodyBytes []byte
	if body != nil {
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return nil, err
		}
	}

	req, err := http.NewRequestWithContext(ctx, method, u.String(), bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	if c.opts.DemoTrading {
		req.Header.Set("x-simulated-trading", "1")
	}

	if auth {
		if c.opts.APIKey == "" || c.opts.APISecret == "" || c.opts.APIPass == "" {
			return nil, fmt.Errorf("missing okx api credentials")
		}
		ts := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
		prehash := ts + strings.ToUpper(method) + path
		if u.RawQuery != "" {
			prehash += "?" + u.RawQuery
		}
		prehash += string(bodyBytes)

		sig := signOKX(c.opts.APISecret, prehash)
		req.Header.Set("OK-ACCESS-KEY", c.opts.APIKey)
		req.Header.Set("OK-ACCESS-SIGN", sig)
		req.Header.Set("OK-ACCESS-TIMESTAMP", ts)
		req.Header.Set("OK-ACCESS-PASSPHRASE", c.opts.APIPass)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &okxutil.APIError{Code: fmt.Sprintf("HTTP_%d", resp.StatusCode), Message: string(raw), Raw: raw}
	}

	var env okxEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, err
	}

	if env.Code != "0" {
		return nil, &okxutil.APIError{Code: env.Code, Message: env.Msg, Raw: raw}
	}

	return env.Data, nil
}

func signOKX(secret string, prehash string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(prehash))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func toURLValues(v any) url.Values {
	values := url.Values{}
	if v == nil {
		return values
	}
	switch t := v.(type) {
	case url.Values:
		return t
	case map[string]string:
		for k, val := range t {
			if strings.TrimSpace(val) == "" {
				continue
			}
			values.Set(k, val)
		}
		return values
	case map[string]any:
		for k, val := range t {
			if val == nil {
				continue
			}
			s := fmt.Sprintf("%v", val)
			if strings.TrimSpace(s) == "" {
				continue
			}
			values.Set(k, s)
		}
		return values
	default:
		// struct -> json -> map
		b, err := json.Marshal(v)
		if err != nil {
			return values
		}
		var m map[string]any
		if err := json.Unmarshal(b, &m); err != nil {
			return values
		}
		for k, val := range m {
			if val == nil {
				continue
			}
			s := fmt.Sprintf("%v", val)
			if strings.TrimSpace(s) == "" {
				continue
			}
			values.Set(k, s)
		}
		return values
	}
}

// Public endpoints

func (c *RestClient) GetInstruments(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/public/instruments", params, nil, false)
}

func (c *RestClient) GetTicker(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/market/ticker", params, nil, false)
}

func (c *RestClient) GetMarkPrice(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/public/mark-price", params, nil, false)
}

func (c *RestClient) GetOrderBook(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/market/books", params, nil, false)
}

func (c *RestClient) GetHistoryCandles(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/market/history-candles", params, nil, false)
}

// Ticker24hr represents OKX 24hr ticker data
type Ticker24hr struct {
	InstID    string `json:"instId"`
	Last      string `json:"last"`
	LastSz    string `json:"lastSz"`
	Open24h   string `json:"open24h"`
	High24h   string `json:"high24h"`
	Low24h    string `json:"low24h"`
	Vol24h    string `json:"vol24h"`    // 24h volume in base currency
	VolCcy24h string `json:"volCcy24h"` // 24h volume in quote currency (used for ranking)
	Ts        string `json:"ts"`
}

// GetTickers returns 24hr tickers for all instruments of specified type
// instType: SPOT, SWAP, FUTURES, OPTION
func (c *RestClient) GetTickers(ctx context.Context, instType string) ([]Ticker24hr, error) {
	data, err := c.do(ctx, http.MethodGet, "/api/v5/market/tickers", map[string]string{"instType": instType}, nil, false)
	if err != nil {
		return nil, err
	}
	var tickers []Ticker24hr
	if err := json.Unmarshal(data, &tickers); err != nil {
		return nil, err
	}
	return tickers, nil
}

// Private endpoints

func (c *RestClient) GetBalance(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/account/balance", params, nil, true)
}

func (c *RestClient) GetPositions(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/account/positions", params, nil, true)
}

func (c *RestClient) SubmitOrder(ctx context.Context, body any) ([]byte, error) {
	return c.do(ctx, http.MethodPost, "/api/v5/trade/order", nil, body, true)
}

func (c *RestClient) SubmitMultipleOrders(ctx context.Context, body any) ([]byte, error) {
	return c.do(ctx, http.MethodPost, "/api/v5/trade/batch-orders", nil, body, true)
}

func (c *RestClient) CancelOrder(ctx context.Context, body any) ([]byte, error) {
	return c.do(ctx, http.MethodPost, "/api/v5/trade/cancel-order", nil, body, true)
}

func (c *RestClient) GetOrderDetails(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/trade/order", params, nil, true)
}

func (c *RestClient) GetOrderList(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/trade/orders-pending", params, nil, true)
}

func (c *RestClient) SetLeverage(ctx context.Context, body any) ([]byte, error) {
	return c.do(ctx, http.MethodPost, "/api/v5/account/set-leverage", nil, body, true)
}

func (c *RestClient) PlaceAlgoOrder(ctx context.Context, body any) ([]byte, error) {
	return c.do(ctx, http.MethodPost, "/api/v5/trade/order-algo", nil, body, true)
}

func (c *RestClient) CancelAlgoOrder(ctx context.Context, body any) ([]byte, error) {
	return c.do(ctx, http.MethodPost, "/api/v5/trade/cancel-algos", nil, body, true)
}

func (c *RestClient) GetAlgoOrderDetails(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/trade/order-algo", params, nil, true)
}

func (c *RestClient) GetAlgoOrderList(ctx context.Context, params any) ([]byte, error) {
	return c.do(ctx, http.MethodGet, "/api/v5/trade/orders-algo-pending", params, nil, true)
}
