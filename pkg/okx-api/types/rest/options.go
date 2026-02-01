package rest

import "github.com/pkg/okx-api/types"

type RestClientOptions struct {
	APIKey    string
	APISecret string
	APIPass   string

	Market          types.APIMarket
	DemoTrading     bool
	ParseExceptions bool

	// Proxy is an optional HTTP proxy URL (e.g. "http://127.0.0.1:7890").
	Proxy string
	// SocksProxy is an optional SOCKS5 proxy URL (e.g. "socks5://127.0.0.1:7890").
	SocksProxy string
}
