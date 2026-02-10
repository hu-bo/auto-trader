# exchange-adapter Go examples

对应 `node-pkg/exchange-adapter/example` 的 Go 版本迁移，包含：

- `public`：公共行情/深度/交易对信息示例
- `trader`：单笔下单 + 批量下单（默认模拟，不会真实下单）
- `ws_user_data`：WebSocket 用户数据流（订单/持仓/余额/策略订单等）

## 环境变量

在 `pkg/exchange-adapter` 目录下复制 `.env.example`：

```bash
cp .env.example .env.local
```

然后填写 key。

## 运行

在 `pkg/exchange-adapter` 目录下执行：

```bash
go run ./example/public
go run ./example/trader
go run ./example/trader --ws
go run ./example/trader --ws-only
go run ./example/ws_user_data
go run ./example/ws_user_data binance
go run ./example/ws_user_data --trade-type=futures okx

# Binance 现货
EXCHANGE=binance TRADE_TYPE=spot SYMBOL=BTC-USDT go run ./example/ticker_stream

# OKX 合约
EXCHANGE=okx TRADE_TYPE=futures SYMBOL=BTC-USDT go run ./example/ticker_stream
```

## 重要提示

- 默认 `SIMULATED=true`：只构建请求并打印，不会真实下单；要真实下单需显式设置 `SIMULATED=false`
- 默认 `DEMONET=true`：会走演示网/模拟盘（各交易所支持情况不同）
- 下单前会做余额/持仓校验；如需跳过可设置 `SKIP_VALIDATE=1`（风险自担）

