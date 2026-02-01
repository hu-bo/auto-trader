package util

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/bytedance/sonic"
	"github.com/go-resty/resty/v2"
	"github.com/pkg/binance-api/types"
)

// RestClientOptions represents REST client options.
type RestClientOptions struct {
	APIKey          string
	APISecret       string
	BaseURL         string
	BaseURLKey      types.BinanceBaseURLKey
	Testnet         bool
	RecvWindow      int64
	TimeOffset      int64
	DisableTimeSync bool
	Timeout         time.Duration
	// Proxy is an optional HTTP proxy URL (e.g. "http://127.0.0.1:7890").
	Proxy string
}

// BaseRestClient represents the base REST client.
type BaseRestClient struct {
	client     *resty.Client
	options    RestClientOptions
	logger     *Logger
	timeOffset int64
}

// NewBaseRestClient creates a new base REST client.
func NewBaseRestClient(opts RestClientOptions) *BaseRestClient {
	client := resty.New()

	// Set timeout
	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	client.SetTimeout(timeout)

	// Set default headers
	client.SetHeader("Content-Type", "application/json")
	client.SetHeader("Accept", "application/json")

	if opts.APIKey != "" {
		client.SetHeader("X-MBX-APIKEY", opts.APIKey)
	}

	// Determine base URL
	baseURL := opts.BaseURL
	if baseURL == "" && opts.BaseURLKey != "" {
		baseURL = BaseURLMap[opts.BaseURLKey]
	}

	if baseURL != "" {
		client.SetBaseURL(baseURL)
	}

	if strings.TrimSpace(opts.Proxy) != "" {
		client.SetProxy(strings.TrimSpace(opts.Proxy))
	}

	return &BaseRestClient{
		client:  client,
		options: opts,
		logger:  DefaultLogger,
	}
}

// SetLogger sets the logger.
func (c *BaseRestClient) SetLogger(logger *Logger) {
	c.logger = logger
}

// GetTimeOffset returns the current time offset.
func (c *BaseRestClient) GetTimeOffset() int64 {
	return c.timeOffset
}

// SetTimeOffset sets the time offset.
func (c *BaseRestClient) SetTimeOffset(offset int64) {
	c.timeOffset = offset
}

// GetTimestamp returns the current timestamp with offset.
func (c *BaseRestClient) GetTimestamp() int64 {
	return time.Now().UnixMilli() + c.timeOffset + c.options.TimeOffset
}

// GetRecvWindow returns the recv window.
func (c *BaseRestClient) GetRecvWindow() int64 {
	if c.options.RecvWindow > 0 {
		return c.options.RecvWindow
	}
	return 5000
}

// RequestMethod represents HTTP request method.
type RequestMethod string

const (
	MethodGET    RequestMethod = "GET"
	MethodPOST   RequestMethod = "POST"
	MethodPUT    RequestMethod = "PUT"
	MethodDELETE RequestMethod = "DELETE"
)

// RequestOptions represents request options.
type RequestOptions struct {
	Method      RequestMethod
	Endpoint    string
	Params      interface{}
	RequireAuth bool
	IsPrivate   bool
}

// DoRequest performs a REST request.
func (c *BaseRestClient) DoRequest(ctx context.Context, opts RequestOptions, result interface{}) error {
	req := c.client.R().SetContext(ctx)

	// Build params
	params := make(map[string]interface{})
	if opts.Params != nil {
		params = StructToMap(opts.Params)
	}

	// Add auth params if required
	if opts.RequireAuth || opts.IsPrivate {
		params["timestamp"] = c.GetTimestamp()
		params["recvWindow"] = c.GetRecvWindow()

		// Build query string and sign
		queryString := SerializeParams(params, true, false, true)
		signature := SignHMACSHA256(queryString, c.options.APISecret)
		params["signature"] = signature
	}

	// Set query params for requests. Binance endpoints expect query/form params (not JSON bodies).
	switch opts.Method {
	case MethodGET, MethodDELETE:
		for k, v := range params {
			req.SetQueryParam(k, formatValue(v))
		}
	case MethodPOST, MethodPUT:
		for k, v := range params {
			req.SetQueryParam(k, formatValue(v))
		}
	}

	// Execute request
	var resp *resty.Response
	var err error

	url := opts.Endpoint
	switch opts.Method {
	case MethodGET:
		resp, err = req.Get(url)
	case MethodPOST:
		resp, err = req.Post(url)
	case MethodPUT:
		resp, err = req.Put(url)
	case MethodDELETE:
		resp, err = req.Delete(url)
	default:
		return fmt.Errorf("unsupported method: %s", opts.Method)
	}

	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode() >= http.StatusBadRequest {
		var apiErr types.GenericCodeMsgError
		if err := sonic.Unmarshal(resp.Body(), &apiErr); err == nil && apiErr.Code != 0 {
			return &APIError{
				Code:    apiErr.Code,
				Message: apiErr.Msg,
			}
		}
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode(), resp.String())
	}

	// Parse response
	body := resp.Body()
	if result != nil {
		if err := sonic.Unmarshal(body, result); err != nil {
			trimmed := bytes.TrimSpace(body)
			if len(trimmed) > 0 && trimmed[0] == '[' {
				symbol := ""
				if v, ok := params["symbol"]; ok {
					symbol = formatValue(v)
				}
				if handled, hErr := tryUnmarshalArrayIntoSingle(trimmed, result, symbol); handled {
					return hErr
				}
			}
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return nil
}

func tryUnmarshalArrayIntoSingle(body []byte, result any, symbol string) (bool, error) {
	rv := reflect.ValueOf(result)
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
		return false, nil
	}

	out := rv.Elem()
	if !out.CanSet() || out.Kind() == reflect.Slice {
		return false, nil
	}

	sliceType := reflect.SliceOf(out.Type())
	slicePtr := reflect.New(sliceType)
	if err := sonic.Unmarshal(body, slicePtr.Interface()); err != nil {
		return false, nil
	}

	slice := slicePtr.Elem()
	if slice.Len() == 0 {
		return true, fmt.Errorf("empty array response")
	}

	if symbol != "" {
		if idx, ok := findIndexBySymbol(slice, symbol); ok {
			out.Set(slice.Index(idx))
			return true, nil
		}
	}

	if slice.Len() == 1 {
		out.Set(slice.Index(0))
		return true, nil
	}

	if symbol != "" {
		return true, fmt.Errorf("expected single object but got %d results for symbol=%s", slice.Len(), symbol)
	}
	return true, fmt.Errorf("expected single object but got array length %d", slice.Len())
}

func findIndexBySymbol(slice reflect.Value, symbol string) (int, bool) {
	for i := 0; i < slice.Len(); i++ {
		if s, ok := getStringField(slice.Index(i), "Symbol"); ok && strings.EqualFold(s, symbol) {
			return i, true
		}
	}
	return 0, false
}

func getStringField(v reflect.Value, name string) (string, bool) {
	for v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return "", false
		}
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return "", false
	}
	f := v.FieldByName(name)
	if !f.IsValid() || f.Kind() != reflect.String {
		return "", false
	}
	return f.String(), true
}

// Get performs a GET request.
func (c *BaseRestClient) Get(ctx context.Context, endpoint string, params interface{}, requireAuth bool, result interface{}) error {
	return c.DoRequest(ctx, RequestOptions{
		Method:      MethodGET,
		Endpoint:    endpoint,
		Params:      params,
		RequireAuth: requireAuth,
	}, result)
}

// Post performs a POST request.
func (c *BaseRestClient) Post(ctx context.Context, endpoint string, params interface{}, requireAuth bool, result interface{}) error {
	return c.DoRequest(ctx, RequestOptions{
		Method:      MethodPOST,
		Endpoint:    endpoint,
		Params:      params,
		RequireAuth: requireAuth,
	}, result)
}

// Delete performs a DELETE request.
func (c *BaseRestClient) Delete(ctx context.Context, endpoint string, params interface{}, requireAuth bool, result interface{}) error {
	return c.DoRequest(ctx, RequestOptions{
		Method:      MethodDELETE,
		Endpoint:    endpoint,
		Params:      params,
		RequireAuth: requireAuth,
	}, result)
}

// Put performs a PUT request.
func (c *BaseRestClient) Put(ctx context.Context, endpoint string, params interface{}, requireAuth bool, result interface{}) error {
	return c.DoRequest(ctx, RequestOptions{
		Method:      MethodPUT,
		Endpoint:    endpoint,
		Params:      params,
		RequireAuth: requireAuth,
	}, result)
}

// APIError represents an API error.
type APIError struct {
	Code    int
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API Error %d: %s", e.Code, e.Message)
}

// IsAPIError checks if an error is an API error with the given code.
func IsAPIError(err error, code int) bool {
	if apiErr, ok := err.(*APIError); ok {
		return apiErr.Code == code
	}
	return false
}
