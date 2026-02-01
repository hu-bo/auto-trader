module github.com/pkg/exchange-adapter

go 1.23.0

require (
	github.com/pkg/binance-api v0.0.0
	github.com/pkg/okx-api v0.0.0
)

require (
	github.com/bytedance/sonic v1.12.6 // indirect
	github.com/bytedance/sonic/loader v0.2.0 // indirect
	github.com/cloudwego/base64x v0.1.4 // indirect
	github.com/cloudwego/iasm v0.2.0 // indirect
	github.com/dolthub/maphash v0.1.0 // indirect
	github.com/go-resty/resty/v2 v2.11.0 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/klauspost/compress v1.17.5 // indirect
	github.com/klauspost/cpuid/v2 v2.0.9 // indirect
	github.com/lxzan/gws v1.8.0 // indirect
	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
	golang.org/x/arch v0.0.0-20210923205945-b76863e36670 // indirect
	golang.org/x/net v0.43.0 // indirect
)

replace (
	github.com/pkg/binance-api => ../binance-api
	github.com/pkg/bybit-api => ../bybit-api
	github.com/pkg/okx-api => ../okx-api
)
