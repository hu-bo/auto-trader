package websockets

import (
	"time"

	"github.com/pkg/okx-api/types"
)

type WSClientConfig struct {
	Accounts []types.APICredentials

	Market      types.APIMarket
	DemoTrading bool

	ReconnectTimeout time.Duration

	// Proxy is an optional HTTP proxy URL (rarely needed for wss, but kept for parity).
	Proxy string
	// SocksProxy is an optional SOCKS5 proxy URL (e.g. "socks5://127.0.0.1:7890").
	SocksProxy string
}
