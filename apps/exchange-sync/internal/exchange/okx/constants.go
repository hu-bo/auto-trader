package okx

import "exchange-sync/pkg/logger"

var logOKX = logger.Module("okx")

const (
	PublicWSEndpoint   = "wss://ws.okx.com:8443/ws/v5/public"
	BusinessWSEndpoint = "wss://ws.okx.com:8443/ws/v5/business"
	RESTEndpoint       = "https://www.okx.com"
)
