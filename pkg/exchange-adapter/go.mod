module github.com/pkg/exchange-adapter

go 1.23.0

require (
	github.com/pkg/binance-api v0.0.0
	github.com/pkg/bybit-api v0.0.0
	github.com/pkg/okx-api v0.0.0
)

replace (
	github.com/pkg/binance-api => ../binance-api
	github.com/pkg/bybit-api => ../bybit-api
	github.com/pkg/okx-api => ../okx-api
)
