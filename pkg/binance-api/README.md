# Binance API for Golang (Optimized Version)

高性能 Golang 版本的 Binance API，从 TypeScript 版本转换并优化。

## 参考对象

TypeScript 源项目：`/Users/hubo/Work/Coding/MyProject/app-golang/node-pkg/binance`

目录文件名模仿 TypeScript 版本，方便未来同步更新。

## 文件映射表

| TypeScript (src/) | Go | 说明 |
|-------------------|-----|------|
| `main-client.ts` | `main-client.go` | Spot/Margin REST 客户端（基础功能） |
| `main-client.ts` | `main-client-margin.go` | Margin 交易功能 |
| `main-client.ts` | `main-client-wallet.go` | Wallet 管理功能 |
| `main-client.ts` | `main-client-extended.go` | 扩展功能（子账户、Staking、Convert等） |
| `usdm-client.ts` | `usdm-client.go` | USD-M Futures REST 客户端 |
| `coinm-client.ts` | `coinm-client.go` | COIN-M Futures REST 客户端 |
| `portfolio-client.ts` | `portfolio-client.go` | Portfolio Margin REST 客户端 |
| `websocket-client.ts` | `websocket-client.go` | WebSocket 客户端 |
| `types/shared.ts` | `types/shared.go` | 共享类型和枚举 |
| `types/futures.ts` | `types/futures.go` | 期货类型定义 |
| `types/coin.ts` | `types/coin.go` | COIN-M 特定类型 |
| `types/spot.ts` | `types/spot.go` | 现货类型定义 |
| `types/portfolio-margin.ts` | `types/portfolio-margin.go` | Portfolio Margin 类型 |
| `types/websockets/*.ts` | `types/websockets/*.go` | WebSocket 相关类型 |
| `util/BaseRestClient.ts` | `util/base-rest-client.go` | 基础 REST 客户端 |
| `util/requestUtils.ts` | `util/request-utils.go` | 请求工具函数（签名、序列化） |
| `util/logger.ts` | `util/logger.go` | 日志工具 |
| `util/websockets/*.ts` | `util/websockets/*.go` | WebSocket 工具函数 |

## 目录结构

```
pkg/binance-api/
├── doc.go                      # 包说明文件
├── go.mod / go.sum             # 模块定义
├── main-client.go              # Spot REST 客户端（基础功能）
├── main-client-margin.go       # Margin 交易功能
├── main-client-wallet.go       # Wallet 管理功能
├── main-client-extended.go     # 扩展功能（子账户、Staking、Convert等）
├── usdm-client.go              # USD-M Futures REST 客户端
├── coinm-client.go             # COIN-M Futures REST 客户端
├── portfolio-client.go         # Portfolio Margin REST 客户端
├── websocket-client.go         # WebSocket 客户端
├── types/
│   ├── shared.go               # 共享类型和枚举
│   ├── futures.go              # 期货类型
│   ├── coin.go                 # COIN-M 特定类型
│   ├── spot.go                 # 现货类型
│   ├── portfolio-margin.go     # Portfolio Margin 类型
│   └── websockets/
│       ├── ws-general.go       # WebSocket 通用类型
│       ├── ws-events.go        # WebSocket 事件类型
│       └── ws-api.go           # WebSocket API 类型
└── util/
    ├── base-rest-client.go     # 基础 REST 客户端
    ├── request-utils.go        # 请求工具函数
    ├── logger.go               # 日志工具
    └── websockets/
        └── websocket-util.go   # WebSocket 工具函数
```

## 技术栈

| 组件 | 库 | 说明 |
|------|-----|------|
| HTTP Client | `go-resty/resty` | 连接池、重试、中间件 |
| JSON | `bytedance/sonic` | 高性能 JSON，比标准库快 2-5x |
| WebSocket | `lxzan/gws` | 事件驱动，高性能 |
| 并发 | goroutine + channel | Go 原生并发模型 |

## 已实现的功能

### Spot 交易
- ✅ 基础市场数据（价格、K线、深度、交易历史）
- ✅ 普通订单（市价、限价、止损等）
- ✅ 高级订单类型
  - OCO (One-Cancels-Other)
  - OTO (One-Triggers-Other)
  - OTOCO (One-Triggers-OCO)
  - OPO (Order Sends Order)
  - OPOCO (Order Sends OPOCO)
  - SOR (Smart Order Routing)
- ✅ 账户信息查询
- ✅ 交易历史、订单查询
- ✅ 费率查询、限速查询
- ✅ User Data Stream

### Margin 交易
- ✅ Margin 市场数据查询
- ✅ 借贷和还款
- ✅ Margin 订单管理（下单、撤单、查询）
- ✅ Margin OCO 订单
- ✅ 账户信息和资产查询
- ✅ 孤立保证金账户管理
- ✅ 全仓/逐仓转账
- ✅ 强平记录查询
- ✅ 利息历史查询

### Wallet 管理
- ✅ 充值地址查询
- ✅ 充值历史
- ✅ 提现申请
- ✅ 提现历史
- ✅ 资产详情
- ✅ 账户余额
- ✅ Universal Transfer（通用划转）
- ✅ Dust 转换（小额资产转 BNB）
- ✅ 交易手续费查询
- ✅ 账户快照
- ✅ 账户状态和权限

### 子账户管理
- ✅ 创建虚拟子账户
- ✅ 子账户列表查询
- ✅ 子账户资产查询
- ✅ 子账户转账
- ✅ 子账户 Futures/Margin 启用
- ✅ 子账户划转历史

### Savings/Staking
- ✅ Simple Earn 产品列表
- ✅ 申购/赎回灵活产品
- ✅ 申购/赎回定期产品
- ✅ 额度查询

### Convert (闪兑)
- ✅ 获取交易对
- ✅ 请求报价
- ✅ 接受报价
- ✅ 交易历史

### Algo Trading (算法交易)
- ✅ 提交算法订单
- ✅ 取消算法订单
- ✅ 查询当前/历史算法订单
- ✅ 子订单查询

### 其他功能
- ✅ Futures 账户划转
- ✅ 系统状态查询
- ✅ 快速提现开关

## 使用示例

### REST API

```go
package main

import (
    "context"
    "fmt"
    binance "github.com/pkg/binance-api"
)

func main() {
    // 创建 USDM 客户端
    client := binance.NewUSDMClient(binance.USDMClientOptions{
        APIKey:    "your-api-key",
        APISecret: "your-api-secret",
        Testnet:   false,
    })

    ctx := context.Background()

    // 获取账户余额
    balances, err := client.GetBalance(ctx)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Balances: %+v\n", balances)

    // 下单
    order, err := client.SubmitNewOrder(ctx, types.NewFuturesOrderParams{
        Symbol:   "BTCUSDT",
        Side:     types.SideBuy,
        Type:     types.FuturesOrderTypeMarket,
        Quantity: "0.001",
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("Order: %+v\n", order)

    // 高级订单 - OCO
    ocoOrder, err := client.SubmitNewOCO(ctx, types.NewOCOParams{
        Symbol:    "BTCUSDT",
        Side:      types.SideSell,
        Quantity:  "0.001",
        Price:     "50000",
        StopPrice: "48000",
    })
    if err != nil {
        panic(err)
    }
    fmt.Printf("OCO Order: %+v\n", ocoOrder)
}
```

### WebSocket

```go
package main

import (
    "fmt"
    binance "github.com/pkg/binance-api"
    "github.com/pkg/binance-api/types/websockets"
)

func main() {
    // 创建 WebSocket 客户端
    ws := binance.NewWebsocketClient(websockets.WsClientConfig{
        Testnet: false,
    })

    // 注册消息处理器
    ws.OnMessage("aggTrade", func(event interface{}) {
        fmt.Printf("Trade: %+v\n", event)
    })

    ws.OnError(func(err error) {
        fmt.Printf("Error: %v\n", err)
    })

    // 连接并订阅
    ws.Connect(websockets.WsKeyUSDM)
    ws.SubscribeAggregateTrades(websockets.WsKeyUSDM, "BTCUSDT")

    // 保持运行
    select {}
}
```

## 本地开发/测试

本目录 `pkg/binance-api` 是一个独立的 Go module（自带 `go.mod`）。如果项目根目录存在 `go.work` 且未包含该 module，建议在此目录执行时关闭 workspace：

```bash
cd pkg/binance-api
GOWORK=off GOCACHE="$PWD/.gocache" go build ./...
GOWORK=off GOCACHE="$PWD/.gocache" go test ./...
```

## go.mod

```go
module github.com/pkg/binance-api

go 1.21

require (
    github.com/bytedance/sonic v1.12.6
    github.com/go-resty/resty/v2 v2.11.0
    github.com/lxzan/gws v1.8.0
)
```
