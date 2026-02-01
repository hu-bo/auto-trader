# Exchange Adapter Skill Guide

## 项目概述

exchange-adapter 是一个统一的加密货币交易所适配器层，为多个交易所（OKX、Binance、Bybit）提供统一的 API 接口，用于量化交易系统。该包抽象了不同交易所之间的 API 差异，提供一致的数据结构和方法签名。

### 核心特性

- **统一接口**：为不同交易所提供一致的 API 接口
- **多交易类型支持**：现货(spot)、U本位合约(futures)、币本位合约(delivery)
- **类型安全**：使用 Go 泛型实现的 Result 类型
- **并发友好**：内置并发安全的缓存和事件处理
- **WebSocket 支持**：实时订单、持仓、余额更新
- **批量操作**：支持批量下单提高效率
- **参数验证**：自动验证订单参数、余额和持仓

## 架构设计

### 核心组件

```
pkg/exchange-adapter/
├── core/                          # 核心类型和基础适配器
│   ├── types.go                   # 统一的数据类型定义
│   ├── base_public_adapter.go     # 公共 API 基础实现
│   ├── base_trade_adapter.go      # 交易 API 基础实现
│   ├── base_ws_user_data_adapter.go # WebSocket 基础实现
│   ├── error_codes.go             # 错误码定义
│   ├── symbol.go                  # 交易对处理
│   ├── cache.go                   # 缓存实现
│   └── math.go                    # 数学工具函数
├── exchanges/                     # 各交易所具体实现
│   ├── binance/                   # Binance 适配器
│   │   ├── public_adapter.go      # 公共 API 实现
│   │   ├── trade_adapter.go       # 交易 API 实现
│   │   ├── ws_user_data_adapter.go # WebSocket 实现
│   │   └── mappers.go             # 数据映射函数
│   └── okx/                       # OKX 适配器
│       ├── public_adapter.go
│       ├── trade_adapter.go
│       ├── ws_user_data_adapter.go
│       └── mappers.go
└── example/                       # 示例代码
    ├── public/                    # 公共 API 示例
    ├── trader/                    # 交易示例
    └── ws_user_data/             # WebSocket 示例
```

### 三层接口设计

1. **PublicAdapter**：公共市场数据接口（无需认证）
2. **TradeAdapter**：交易接口（需要认证，包含 PublicAdapter）
3. **WsUserDataAdapter**：WebSocket 用户数据流接口

## 核心类型定义

### Result 类型

```go
type Result[T any] struct {
    Ok    bool       `json:"ok"`
    Data  T          `json:"data,omitempty"`
    Error *ErrorInfo `json:"error,omitempty"`
}

type ErrorInfo struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Raw     any    `json:"raw,omitempty"`
}
```

### 交易所和交易类型

```go
type Exchange string
const (
    ExchangeOKX     Exchange = "okx"
    ExchangeBinance Exchange = "binance"
    ExchangeBybit   Exchange = "bybit"
)

type TradeType string
const (
    TradeTypeSpot     TradeType = "spot"      // 现货
    TradeTypeFutures  TradeType = "futures"   // U本位合约
    TradeTypeDelivery TradeType = "delivery"  // 币本位合约
)
```

### 订单相关类型

```go
type OrderSide string
const (
    OrderSideBuy  OrderSide = "buy"
    OrderSideSell OrderSide = "sell"
)

type OrderType string
const (
    OrderTypeLimit     OrderType = "limit"
    OrderTypeMarket    OrderType = "market"
    OrderTypeMakerOnly OrderType = "maker-only"
)

type OrderStatus string
const (
    OrderStatusPending  OrderStatus = "pending"
    OrderStatusOpen     OrderStatus = "open"
    OrderStatusPartial  OrderStatus = "partial"
    OrderStatusFilled   OrderStatus = "filled"
    OrderStatusCanceled OrderStatus = "canceled"
    OrderStatusRejected OrderStatus = "rejected"
    OrderStatusExpired  OrderStatus = "expired"
)

type PositionSide string
const (
    PositionSideLong  PositionSide = "long"
    PositionSideShort PositionSide = "short"
)
```

## PublicAdapter 接口

### 方法列表

```go
type PublicAdapter interface {
    Exchange() Exchange

    // 交易对信息
    GetSymbolInfo(ctx context.Context, symbol string, tradeType TradeType) Result[SymbolInfo]
    GetAllSymbols(ctx context.Context, tradeType TradeType) Result[[]SymbolInfo]

    // 市场数据
    GetPrice(ctx context.Context, symbol string, tradeType TradeType) Result[string]
    GetMarkPrice(ctx context.Context, symbol string, tradeType TradeType) Result[string]
    GetTicker(ctx context.Context, symbol string, tradeType TradeType) Result[Ticker]
    GetOrderBook(ctx context.Context, symbol string, tradeType TradeType, limit int) Result[OrderBook]

    // 交易对转换
    ToRawSymbol(symbol string, tradeType TradeType) string
    FromRawSymbol(rawSymbol string, tradeType TradeType) string
}
```

### 使用示例

```go
import (
    "github.com/pkg/exchange-adapter/core"
    "github.com/pkg/exchange-adapter/exchanges/binance"
)

// 创建公共适配器
opts := core.AdapterOptions{
    Demonet: ptr(true), // 使用测试网
}
adapter := binance.NewPublicAdapter(opts)

// 获取交易对信息
result := adapter.GetSymbolInfo(ctx, "BTC-USDT", core.TradeTypeSpot)
if !result.Ok {
    log.Error("failed to get symbol", "error", result.Error)
    return
}
symbolInfo := result.Data

// 获取价格
priceResult := adapter.GetPrice(ctx, "BTC-USDT", core.TradeTypeSpot)
if priceResult.Ok {
    log.Info("current price", "price", priceResult.Data)
}

// 获取深度数据
bookResult := adapter.GetOrderBook(ctx, "BTC-USDT", core.TradeTypeSpot, 20)
if bookResult.Ok {
    book := bookResult.Data
    log.Info("order book", "bids", len(book.Bids), "asks", len(book.Asks))
}
```

## TradeAdapter 接口

### 方法列表

```go
type TradeAdapter interface {
    PublicAdapter // 继承公共接口

    PublicAdapter() PublicAdapter
    Init(ctx context.Context) Result[struct{}]
    Destroy(ctx context.Context) error
    LoadSymbols(ctx context.Context, tradeType *TradeType) Result[struct{}]

    // 账户信息
    GetBalance(ctx context.Context, tradeType TradeType) Result[[]Balance]
    GetPositions(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Position]

    // 订单验证和格式化
    ValidateOrderParams(params PlaceOrderParams, symbolInfo SymbolInfo) ValidationResult
    ValidateBalance(params PlaceOrderParams, symbolInfo SymbolInfo, balances []Balance, currentPrice float64, positions []Position) ValidationResult
    FormatOrderParams(params PlaceOrderParams, symbolInfo SymbolInfo) Result[PlaceOrderParamsFormatted]

    // 订单操作
    PlaceOrder(ctx context.Context, params PlaceOrderParams) Result[Order]
    PlaceOrders(ctx context.Context, paramsList []PlaceOrderParams) BatchPlaceOrderResult
    CancelOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order]
    GetOrder(ctx context.Context, symbol string, orderID string, tradeType TradeType) Result[Order]
    GetOpenOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]Order]

    // 杠杆设置
    SetLeverage(ctx context.Context, symbol string, leverage float64, tradeType TradeType, positionSide *PositionSide) Result[struct{}]

    // 策略订单（止盈止损等）
    PlaceStrategyOrder(ctx context.Context, params StrategyOrderParams) Result[StrategyOrder]
    CancelStrategyOrder(ctx context.Context, symbol string, algoID string, tradeType TradeType) Result[StrategyOrder]
    GetStrategyOrder(ctx context.Context, algoID string, tradeType TradeType) Result[StrategyOrder]
    GetOpenStrategyOrders(ctx context.Context, symbol *string, tradeType *TradeType) Result[[]StrategyOrder]
}
```

### 下单示例

```go
import (
    "github.com/pkg/exchange-adapter/core"
    "github.com/pkg/exchange-adapter/exchanges/binance"
)

// 创建交易适配器
opts := core.AdapterOptions{
    Demonet: ptr(true),
}
adapter := binance.NewTradeAdapter("API_KEY", "API_SECRET", opts)

// 初始化（预加载交易对信息）
initResult := adapter.Init(ctx)
if !initResult.Ok {
    log.Fatal("init failed", "error", initResult.Error)
}

// 下限价买单
price := 50000.0
params := core.PlaceOrderParams{
    Symbol:    "BTC-USDT",
    TradeType: core.TradeTypeSpot,
    Side:      core.OrderSideBuy,
    OrderType: core.OrderTypeLimit,
    Quantity:  0.001,
    Price:     &price,
}

result := adapter.PlaceOrder(ctx, params)
if !result.Ok {
    log.Error("order failed", "error", result.Error)
    return
}
order := result.Data
log.Info("order placed", "orderId", order.OrderID, "status", order.Status)

// 合约下单示例（需要指定持仓方向）
positionSide := core.PositionSideLong
leverage := 10.0
futuresParams := core.PlaceOrderParams{
    Symbol:       "BTC-USDT",
    TradeType:    core.TradeTypeFutures,
    Side:         core.OrderSideBuy,
    OrderType:    core.OrderTypeMarket,
    Quantity:     0.01,
    PositionSide: &positionSide,
    Leverage:     &leverage,
}

futuresResult := adapter.PlaceOrder(ctx, futuresParams)
```

### 批量下单示例

```go
// 批量下单
price1 := 50000.0
price2 := 51000.0
paramsList := []core.PlaceOrderParams{
    {
        Symbol:    "BTC-USDT",
        TradeType: core.TradeTypeSpot,
        Side:      core.OrderSideBuy,
        OrderType: core.OrderTypeLimit,
        Quantity:  0.001,
        Price:     &price1,
    },
    {
        Symbol:    "ETH-USDT",
        TradeType: core.TradeTypeSpot,
        Side:      core.OrderSideBuy,
        OrderType: core.OrderTypeLimit,
        Quantity:  0.01,
        Price:     &price2,
    },
}

batchResult := adapter.PlaceOrders(ctx, paramsList)
log.Info("batch order result",
    "success", batchResult.SuccessCount,
    "failed", batchResult.FailedCount)

for i, result := range batchResult.Results {
    if result.Ok {
        log.Info("order success", "index", i, "orderId", result.Data.OrderID)
    } else {
        log.Error("order failed", "index", i, "error", result.Error)
    }
}
```

### 策略订单示例

```go
// 止损单
positionSide := core.PositionSideLong
strategyParams := core.StrategyOrderParams{
    Symbol:       "BTC-USDT",
    TradeType:    core.TradeTypeFutures,
    Side:         core.OrderSideSell,
    StrategyType: core.StrategyOrderTypeStopLoss,
    Quantity:     0.01,
    PositionSide: &positionSide,
    TriggerPrice: 48000.0,
}

strategyResult := adapter.PlaceStrategyOrder(ctx, strategyParams)
if strategyResult.Ok {
    log.Info("strategy order placed", "algoId", strategyResult.Data.AlgoID)
}
```

## WsUserDataAdapter 接口

### WebSocket 事件类型

```go
type WsUserDataEventType string
const (
    WsEventOrder         WsUserDataEventType = "order"         // 订单更新
    WsEventPosition      WsUserDataEventType = "position"      // 持仓更新
    WsEventBalance       WsUserDataEventType = "balance"       // 余额更新
    WsEventStrategyOrder WsUserDataEventType = "strategyOrder" // 策略订单更新
    WsEventAccount       WsUserDataEventType = "account"       // 账户更新
    WsEventConnected     WsUserDataEventType = "connected"     // 连接成功
    WsEventDisconnected  WsUserDataEventType = "disconnected"  // 断开连接
    WsEventError         WsUserDataEventType = "error"         // 错误事件
)
```

### 使用示例

```go
import (
    "github.com/pkg/exchange-adapter/core"
    "github.com/pkg/exchange-adapter/exchanges/binance"
)

// 创建 WebSocket 适配器
wsAdapter := binance.NewWsUserDataAdapter("API_KEY", "API_SECRET", opts)

// 订阅订单更新
wsAdapter.On(core.WsEventOrder, func(event core.WsUserDataEvent) {
    orderUpdate := event.(core.WsOrderUpdate)
    log.Info("order update",
        "symbol", orderUpdate.Symbol,
        "orderId", orderUpdate.OrderID,
        "status", orderUpdate.Status,
        "filledQty", orderUpdate.FilledQuantity)
})

// 订阅持仓更新
wsAdapter.On(core.WsEventPosition, func(event core.WsUserDataEvent) {
    posUpdate := event.(core.WsPositionUpdate)
    log.Info("position update",
        "symbol", posUpdate.Symbol,
        "quantity", posUpdate.Quantity,
        "unrealizedPnl", posUpdate.UnrealizedPnl)
})

// 订阅余额更新
wsAdapter.On(core.WsEventBalance, func(event core.WsUserDataEvent) {
    balUpdate := event.(core.WsBalanceUpdate)
    log.Info("balance update",
        "asset", balUpdate.Asset,
        "available", balUpdate.Available)
})

// 订阅所有事件
wsAdapter.OnAny(func(event core.WsUserDataEvent) {
    log.Debug("ws event", "type", event.EventType())
})

// 连接 WebSocket（现货）
options := core.WsSubscribeOptions{
    TradeType:            core.TradeTypeSpot,
    AutoReconnect:        ptr(true),
    ReconnectInterval:    ptr(5 * time.Second),
    MaxReconnectAttempts: ptr(10),
}

err := wsAdapter.Subscribe(ctx, options, func(event core.WsUserDataEvent) {
    log.Info("event received", "type", event.EventType())
})
if err != nil {
    log.Fatal("subscribe failed", "error", err)
}

// 检查连接状态
tradeType := core.TradeTypeSpot
if wsAdapter.IsConnected(&tradeType) {
    log.Info("websocket connected")
}

// 取消订阅
err = wsAdapter.Unsubscribe(ctx, &tradeType)

// 关闭所有连接
err = wsAdapter.Close(ctx)
```

## 数据类型详解

### SymbolInfo - 交易对信息

```go
type SymbolInfo struct {
    Symbol            string       `json:"symbol"`            // 统一交易对符号 (BTC-USDT)
    RawSymbol         string       `json:"rawSymbol"`         // 原始交易所符号
    BaseCurrency      string       `json:"baseCurrency"`      // 基础货币
    QuoteCurrency     string       `json:"quoteCurrency"`     // 计价货币
    TradeType         TradeType    `json:"tradeType"`         // 交易类型
    TickSize          string       `json:"tickSize"`          // 价格精度步长
    StepSize          string       `json:"stepSize"`          // 数量精度步长
    MinQty            string       `json:"minQty"`            // 最小下单量
    MaxQty            string       `json:"maxQty"`            // 最大下单量
    QuantityPrecision int          `json:"quantityPrecision"` // 数量小数位
    PricePrecision    int          `json:"pricePrecision"`    // 价格小数位
    Status            SymbolStatus `json:"status"`            // 状态
    ContractValue     *float64     `json:"contractValue,omitempty"`  // 合约面值
    MaxLeverage       *float64     `json:"maxLeverage,omitempty"`    // 最大杠杆
}
```

### Order - 订单

```go
type Order struct {
    OrderID       string        `json:"orderId"`
    ClientOrderID string        `json:"clientOrderId,omitempty"`
    Symbol        string        `json:"symbol"`
    TradeType     TradeType     `json:"tradeType"`
    Side          OrderSide     `json:"side"`
    PositionSide  *PositionSide `json:"positionSide,omitempty"`
    OrderType     OrderType     `json:"orderType"`
    Status        OrderStatus   `json:"status"`
    Price         string        `json:"price"`
    AvgPrice      string        `json:"avgPrice"`
    Quantity      string        `json:"quantity"`
    FilledQty     string        `json:"filledQty"`
    Fee           string        `json:"fee,omitempty"`
    FeeAsset      string        `json:"feeAsset,omitempty"`
    CreateTime    *time.Time    `json:"createTime,omitempty"`
    UpdateTime    *time.Time    `json:"updateTime,omitempty"`
}
```

### Position - 持仓

```go
type Position struct {
    Symbol           string       `json:"symbol"`
    PositionSide     PositionSide `json:"positionSide"`
    PositionAmt      string       `json:"positionAmt"`
    EntryPrice       string       `json:"entryPrice"`
    UnrealizedPnl    string       `json:"unrealizedPnl"`
    Leverage         float64      `json:"leverage"`
    MarginMode       MarginMode   `json:"marginMode"`
    LiquidationPrice string       `json:"liquidationPrice"`
}
```

### Balance - 余额

```go
type Balance struct {
    Asset  string `json:"asset"`
    Free   string `json:"free"`
    Locked string `json:"locked"`
    Total  string `json:"total"`
}
```

## 错误处理

### 错误码

```go
const (
    ErrorInvalidParams        = "INVALID_PARAMS"
    ErrorInsufficientBalance  = "INSUFFICIENT_BALANCE"
    ErrorInsufficientPosition = "INSUFFICIENT_POSITION"
    ErrorQuantityTooSmall     = "QUANTITY_TOO_SMALL"
    ErrorQuantityTooLarge     = "QUANTITY_TOO_LARGE"
    ErrorSymbolNotAvailable   = "SYMBOL_NOT_AVAILABLE"
    ErrorInvalidTradeType     = "INVALID_TRADE_TYPE"
    ErrorNetworkError         = "NETWORK_ERROR"
    ErrorExchangeError        = "EXCHANGE_ERROR"
    ErrorUnsupported          = "UNSUPPORTED"
)
```

### 错误处理示例

```go
result := adapter.PlaceOrder(ctx, params)
if !result.Ok {
    switch result.Error.Code {
    case core.ErrorInsufficientBalance:
        log.Error("余额不足", "message", result.Error.Message)
    case core.ErrorQuantityTooSmall:
        log.Error("数量过小", "message", result.Error.Message)
    case core.ErrorSymbolNotAvailable:
        log.Error("交易对不可用", "message", result.Error.Message)
    default:
        log.Error("下单失败", "code", result.Error.Code, "message", result.Error.Message)
    }
    return
}
```

## 环境配置

### 环境变量

在 `pkg/exchange-adapter` 目录下创建 `.env.local` 文件：

```bash
# 交易所 API 密钥
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
OKX_API_KEY=your_okx_api_key
OKX_API_SECRET=your_okx_api_secret
OKX_PASSPHRASE=your_okx_passphrase

# 测试配置
DEMONET=true                # 使用测试网/模拟盘
SIMULATED=true              # 仅模拟下单，不发送真实请求
SKIP_VALIDATE=false         # 跳过余额/持仓验证（不推荐）

# 代理配置（可选）
HTTPS_PROXY=http://127.0.0.1:7890
SOCKS_PROXY=socks5://127.0.0.1:7891
```

### AdapterOptions

```go
type AdapterOptions struct {
    HTTPSProxy  string `json:"httpsProxy,omitempty"`
    SOCKSProxy  string `json:"socksProxy,omitempty"`
    Demonet     *bool  `json:"demonet,omitempty"`  // 是否使用测试网
}

// 使用示例
opts := core.AdapterOptions{
    HTTPSProxy: "http://127.0.0.1:7890",
    Demonet:    ptr(true),
}
```

## 最佳实践

### 1. 始终使用 Context

```go
// 设置超时
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

result := adapter.GetPrice(ctx, "BTC-USDT", core.TradeTypeSpot)
```

### 2. 检查 Result

```go
// 总是检查 Ok 字段
result := adapter.PlaceOrder(ctx, params)
if !result.Ok {
    // 处理错误
    log.Error("operation failed", "error", result.Error)
    return
}
// 使用 result.Data
order := result.Data
```

### 3. 缓存交易对信息

```go
// GetSymbolInfo 会自动缓存，避免频繁调用 GetAllSymbols
symbolInfo, err := adapter.GetSymbolInfo(ctx, "BTC-USDT", core.TradeTypeSpot)
```

### 4. 利用内置验证

```go
// TradeAdapter.PlaceOrder 会自动验证：
// - 订单参数合法性
// - 余额是否充足
// - 持仓是否充足（平仓时）
// - 数量精度格式化
result := adapter.PlaceOrder(ctx, params)
```

### 5. 批量操作提高效率

```go
// 使用批量下单而非循环单个下单
batchResult := adapter.PlaceOrders(ctx, paramsList)
```

### 6. WebSocket 事件处理

```go
// 使用具体事件类型而非 OnAny，提高性能
wsAdapter.On(core.WsEventOrder, handleOrderUpdate)
wsAdapter.On(core.WsEventPosition, handlePositionUpdate)

// 而不是
wsAdapter.OnAny(func(event core.WsUserDataEvent) {
    switch event.EventType() {
    case core.WsEventOrder:
        // ...
    case core.WsEventPosition:
        // ...
    }
})
```

### 7. 资源清理

```go
// 使用 defer 确保资源清理
adapter := binance.NewTradeAdapter(apiKey, secret, opts)
defer adapter.Destroy(ctx)

// WebSocket 清理
wsAdapter := binance.NewWsUserDataAdapter(apiKey, secret, opts)
defer wsAdapter.Close(ctx)
```

## 常见问题

### Q: 如何处理交易对符号格式？

A: 使用统一格式 `BASE-QUOTE`（如 `BTC-USDT`），适配器会自动转换为交易所原始格式。

```go
// 统一格式转原始格式
rawSymbol := adapter.ToRawSymbol("BTC-USDT", core.TradeTypeSpot)

// 原始格式转统一格式
unifiedSymbol := adapter.FromRawSymbol(rawSymbol, core.TradeTypeSpot)
```

### Q: 如何处理精度问题？

A: 使用 `SymbolInfo` 中的 `TickSize` 和 `StepSize`，适配器会自动格式化。

```go
// FormatOrderParams 会自动处理精度
formatted := adapter.FormatOrderParams(params, symbolInfo)
```

### Q: 如何在测试环境使用？

A: 设置 `Demonet: true` 和 `SIMULATED=true`。

```go
opts := core.AdapterOptions{
    Demonet: ptr(true),
}
// 同时设置环境变量 SIMULATED=true 可以只构建请求不发送
```

### Q: 批量下单的限制是什么？

A: 每个交易所有不同限制，使用 `GetBatchOrderLimits()` 查询。

```go
limits := adapter.GetBatchOrderLimits()
log.Info("batch limits",
    "maxBatchSize", limits.MaxBatchSize,
    "supportedTradeTypes", limits.SupportedTradeTypes)
```

### Q: 如何处理 WebSocket 重连？

A: 设置 `AutoReconnect: true` 和相关参数。

```go
options := core.WsSubscribeOptions{
    TradeType:            core.TradeTypeSpot,
    AutoReconnect:        ptr(true),
    ReconnectInterval:    ptr(5 * time.Second),
    MaxReconnectAttempts: ptr(10),
}
```

## 运行示例

```bash
# 在 pkg/exchange-adapter 目录下

# 公共 API 示例
go run ./example/public

# 交易示例（默认模拟模式）
go run ./example/trader

# WebSocket 示例
go run ./example/ws_user_data

# 指定交易所和交易类型
go run ./example/ws_user_data binance
go run ./example/ws_user_data --trade-type=futures okx
```

## Agent 使用指南

当 AI Agent 需要操作此包时：

1. **查询功能**：先阅读接口定义了解可用方法
2. **创建适配器**：选择合适的适配器类型（Public/Trade/WsUserData）
3. **设置配置**：使用 AdapterOptions 配置代理、测试网等
4. **调用方法**：使用 context 和统一的 Result 类型
5. **错误处理**：检查 Result.Ok 并处理 Error
6. **资源清理**：使用 defer 清理资源

### 示例代码模板

```go
package main

import (
    "context"
    "log"
    "time"

    "github.com/pkg/exchange-adapter/core"
    "github.com/pkg/exchange-adapter/exchanges/binance"
)

func main() {
    // 1. 创建适配器
    opts := core.AdapterOptions{
        Demonet: ptr(true),
    }
    adapter := binance.NewTradeAdapter("API_KEY", "API_SECRET", opts)
    defer adapter.Destroy(context.Background())

    // 2. 初始化
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    initResult := adapter.Init(ctx)
    if !initResult.Ok {
        log.Fatal("init failed:", initResult.Error.Message)
    }

    // 3. 执行操作
    result := adapter.GetBalance(ctx, core.TradeTypeSpot)
    if !result.Ok {
        log.Fatal("get balance failed:", result.Error.Message)
    }

    for _, bal := range result.Data {
        log.Printf("Asset: %s, Free: %s, Locked: %s\n",
            bal.Asset, bal.Free, bal.Locked)
    }
}

func ptr[T any](v T) *T {
    return &v
}
```

## 文件索引

- [core/types.go](core/types.go) - 所有核心类型定义
- [core/base_public_adapter.go](core/base_public_adapter.go) - PublicAdapter 接口和基础实现
- [core/base_trade_adapter.go](core/base_trade_adapter.go) - TradeAdapter 接口和基础实现
- [core/base_ws_user_data_adapter.go](core/base_ws_user_data_adapter.go) - WsUserDataAdapter 接口和基础实现
- [core/error_codes.go](core/error_codes.go) - 错误码常量
- [exchanges/binance/](exchanges/binance/) - Binance 交易所实现
- [exchanges/okx/](exchanges/okx/) - OKX 交易所实现
- [example/](example/) - 使用示例代码

## 更新日志

- 从 TypeScript 版本迁移到 Go
- 支持 OKX、Binance 交易所
- 统一的 Result 类型和错误处理
- WebSocket 用户数据流支持
- 批量下单优化
- 自动参数验证和格式化
