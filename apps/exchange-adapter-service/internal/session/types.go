package session

import "github.com/pkg/exchange-adapter/core"

type AccountConfig struct {
	Exchange    core.Exchange
	APIKey      string
	APISecret   string
	Passphrase  string // OKX only
	Demonet     bool
	Name        string // optional label (logs/debug)
	HTTPProxy   string // optional HTTP proxy for REST API
	Socks5Proxy string // optional SOCKS5 proxy for WebSocket
}
