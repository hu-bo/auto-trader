# Exchange Adapter Service（Go）技术方案

> **服务定位**: 统一的交易所适配层，提供标准化的交易执行和市场数据查询能力
>
> **核心能力**: 下单、查询订单、撤单 + 市场数据查询（K线、订单簿、交易对信息）
>
> **关键约束**: 下单无状态设计，下单不依赖数据库，订单与账户由上游服务管理(市场数据同步到数据库)

---

## 1. 服务定位与职责

### 1.1 核心交易能力

**交易执行** (基于 [pkg/exchange-adapter](../../pkg/exchange-adapter))
- ✅ 下单：支持市价/限价/止损等订单类型，单笔与批量下单
- ✅ 查询订单：按 orderId 查询、查询未成交订单列表
- ✅ 撤单：单笔与批量撤单
- ✅ 账户操作：查询余额、持仓、设置杠杆

**市场数据查询** (整合 [apps/exchange-sync](../exchange-sync))
- 📊 K线数据：获取历史K线、当前周期K线（支持 15m/4h/1d）
- 📈 订单簿：获取大单订单簿（≥$5000 USDT）
- 💱 交易对信息：查询交易对规则、精度、状态
- 💰 实时价格：获取当前价格

**风控校验** (可选，基于 [pkg/risk](../../pkg/risk))
- 🛡️ 下单前风控检查
- 📊 账户级与持仓级风险评估

### 1.2 设计原则

- **无状态**: 下单模块不依赖数据库，所有状态由上游服务管理
- **Token 会话**: 内存管理 token → AccountConfig 映射，支持 TTL
- **适配器复用**: 统一使用 `pkg/exchange-adapter` 对接多交易所
- **订单推送**: 通过 WebSocket 实时推送订单状态变化（gRPC stream）
- **模块化集成**: 将 exchange-sync 的市场数据能力集成为独立模块
- **实时数据流**: 通过 NATS 订阅 exchange-sync 推送的实时 K 线和订单簿数据
- **定时同步**: 使用 Cron 定时任务定期同步交易对信息，保持数据最新

---

## 2. 依赖库替换

| 原依赖（Node.js） | 新依赖（Go） | 说明 |
|-----------------|-------------|------|
| `@hquant/exchange-adapter` | [pkg/exchange-adapter](../../pkg/exchange-adapter) | 交易所适配器（OKX/Binance/Bybit） |
| `@hquant/risk-model` | [pkg/risk](../../pkg/risk) | 风控引擎（可选：需协议扩展/明确边界后启用） |
| - | [apps/exchange-sync](../exchange-sync) | 市场数据服务（可选：本服务可作为网关/缓存） |
| - | `github.com/nats-io/nats.go` | 可选：市场数据订阅缓存 |
| - | `github.com/robfig/cron/v3` | 可选：定期同步交易对信息 |

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    上游服务（策略/订单管理）                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ gRPC
                      ↓
┌─────────────────────────────────────────────────────────────┐
│         Exchange Adapter Service (gRPC Server)              │
├─────────────────────────────────────────────────────────────┤
│  Session Layer    │ Token → AccountConfig (内存 + TTL)       │
├─────────────────────────────────────────────────────────────┤
│  Trading Layer    │ ┌──────────────────────────────────┐   │
│                   │ │   pkg/exchange-adapter           │   │
│                   │ │  • TradeAdapter                  │   │
│                   │ │  • WsUserDataAdapter             │   │
│                   │ └──────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Market Data      │ ┌──────────────────────────────────┐   │
│                   │ │   Exchange Sync Client           │   │
│                   │ │  • REST API 调用                  │   │
│                   │ │  • K线/订单簿/交易对查询          │   │
│                   │ │  • NATS 订阅实时市场数据          │   │
│                   │ └──────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Risk Layer       │ pkg/risk (下单前需要经过风控模块)        │
├─────────────────────────────────────────────────────────────┤
│  Cron Layer       │ 定时同步交易对信息 (每日 0 点)           │
└─────────────────────────────────────────────────────────────┘
                      │
                      ↓
            ┌─────────────────────┐
            │   Exchange APIs     │
            │  (OKX/Binance/...)  │
            └─────────────────────┘
                      ↑
                      │ NATS (实时推送)
                      │
            ┌─────────────────────┐
            │   Exchange Sync     │
            │ (市场数据同步服务)    │
            └─────────────────────┘
```

### 3.2 模块划分

```
apps/exchange-adapter-service/
├── cmd/
│   └── main.go                     # 服务入口
├── internal/
│   ├── config/                     # 配置管理
│   │   └── config.go
│   ├── grpc/                       # gRPC 服务
│   │   ├── server.go               # gRPC server 启动
│   │   ├── handler_trading.go      # 交易相关 RPC
│   │   └── interceptors/           # 拦截器（日志/鉴权/恢复）
│   ├── api/                        # HTTP API（健康检查/管理）
│   │   ├── server.go               # Echo server
│   │   ├── handler_market.go       # 市场数据（参考 ../exchange-sync/internal/api/handler.go）
│   │   └── handler.go              # /health, /ready, /version
│   ├── session/                    # 会话管理
│   │   ├── store.go                # Token → AccountConfig 映射
│   │   └── types.go                # AccountConfig 定义
│   ├── trading/                    # 交易执行层
│   │   ├── manager.go              # ExchangeManager: 管理 adapter 实例
│   │   ├── service.go              # 下单/撤单业务逻辑
│   │   └── stream.go               # 订单更新流推送
│   ├── market/                     # 市场数据层（可选：集成 exchange-sync）
│   │   ├── client.go               # Exchange Sync HTTP Client
│   │   ├── nats_subscriber.go      # NATS 订阅器（实时数据）
│   │   └── service.go              # K线/订单簿查询服务
│   ├── risk/                       # 风控（可选）
│   │   └── evaluator.go            # 调用 pkg/risk 评估
│   └── service/                    # 后台服务
│       └── cron_service.go         # Cron 定时任务
├── proto/
│   └── exchange.proto              # gRPC 接口定义（来源：packages/contracts/proto/exchange.proto）
├── gen/                            # protoc 生成代码
├── config.yaml                     # 配置文件
├── Makefile
└── README.md
```

---

## 4. gRPC 接口（以 contracts 为准）

本服务严格实现仓库内协议文件：
- [packages/contracts/proto/exchange.proto](../../packages/contracts/proto/exchange.proto)（`exchange.ExchangeService`）

### 4.1 RPC 列表（MVP）

| RPC | 说明 | 备注 |
|-----|------|------|
| `InitAccount` | 初始化账户并返回 `token` | `demonet` 统一表示测试网/模拟盘（交易所落地方式不同） |
| `ValidateToken` | 校验 `token` 是否有效 | 返回 `valid=false` 即视为需要重新 `InitAccount` |
| `InvalidateToken` | 注销 `token` | 需要清理 session / adapter / WS 订阅 |
| `PlaceOrder` | 下单 | 使用 `pkg/exchange-adapter` 完成参数校验/精度格式化/余额校验 |
| `PlaceOrders` | 批量下单 | 按单笔返回成功/失败，统计 `success_count/failed_count` |
| `CancelOrder` | 撤单 | **协议缺少 `symbol/trade_type`**，需要订单定位策略（见 4.4） |
| `GetOrder` | 查询订单 | **协议缺少 `symbol/trade_type`**，需要订单定位策略（见 4.4） |
| `GetOrders` | 查询订单列表 | MVP 仅保证“未成交订单”（Open Orders）；历史订单需扩展协议/实现 |
| `GetPositions` | 获取持仓 | `pkg/exchange-adapter` 支持 `tradeType=nil` 拉取 futures/delivery 汇总 |
| `SyncPositions` | 同步持仓 | MVP 可等价实现为 `GetPositions` + `success=true` |
| `GetBalance` | 获取余额 | `trade_type` 必填（协议已带） |
| `GetPrice` | 获取行情 | 直接调用 `pkg/exchange-adapter` 的 public API 即可 |
| `SetLeverage` | 设置杠杆 | spot 不支持；futures/delivery 支持（依交易所/仓位模式而定） |
| `SubscribeOrders` | 订单更新流 | 基于 `WsUserDataAdapter` 转发订单更新事件 |

### 4.2 字段与语义约定

- `token`：会话标识，对应一组 API 凭证（仅内存保存）。MVP 支持 TTL；服务重启后 token 失效（上游需重新 `InitAccount`）。
- `InitAccountRequest.name`：仅用于上游标记（日志/排查），不参与鉴权。
- `demonet`：统一表示测试网/模拟盘开关；Binance 对应 testnet，OKX 对应 demo trading（由 `pkg/exchange-adapter` 适配）。
- 时间戳字段（`created_at/updated_at/filled_at/update_time`）：统一使用 **毫秒**（Unix epoch ms）。
- `Order.id` / `CancelOrderRequest.order_id`：MVP 约定 `Order.id == Order.exchange_order_id`，并把 `exchange_order_id` 同步填充，避免上游歧义。
- `client_order_id`：上游可不传；若为空由适配器生成；所有响应尽量回填（用于幂等/排查）。

### 4.3 Adapter 调用映射（核心逻辑）

- `InitAccount` → 创建 session（token→AccountConfig）→（可选）预热 `TradeAdapter.Init()` → 返回 token
- `PlaceOrder/PlaceOrders` → `TradeAdapter.PlaceOrder(s)` → 将 `core.Order` 映射为 proto `Order` → 写入 `OrderIndex`
- `GetBalance` → `TradeAdapter.GetBalance(tradeType)`
- `GetPositions/SyncPositions` → `TradeAdapter.GetPositions(symbol?, tradeType=nil)`（必要时按请求过滤）
- `GetPrice` → `TradeAdapter.GetPrice(symbol, tradeType)`（底层走 public API）
- `SetLeverage` → `TradeAdapter.SetLeverage(symbol, leverage, tradeType, positionSide?)`
- `SubscribeOrders` → `WsUserDataAdapter.Subscribe(tradeType)` → 仅转发 `WsEventOrder` 到 gRPC stream

### 4.4 订单定位（解决 `symbol/trade_type` 缺失）

协议 `CancelOrder/GetOrder` 只给 `order_id`，但交易所 API 通常需要 `symbol`（以及 `trade_type`）。MVP 需要在服务端补一个“订单定位层”：

1. **OrderIndex（内存）**：按 `token` 维度维护 `orderID/clientOrderID -> (symbol, tradeType)`，来源包括：
   - `PlaceOrder/PlaceOrders` 的返回
   - `SubscribeOrders` 的 WS 订单更新流（持续修正）
2. **兜底扫描 Open Orders**：若索引缺失，则调用 `TradeAdapter.GetOpenOrders(symbol=nil, tradeType=nil)` 拉取所有未成交订单，按 `order_id` 同时匹配 `order.OrderID` 与 `order.ClientOrderID`，定位到 `(symbol, tradeType)` 后再执行撤单/查询。
3. **边界与限制**：对“已成交/已取消/历史订单”，在没有 `symbol/trade_type` 的前提下无法保证查询；建议协议补字段（见开放问题）。

### 4.5 错误返回与错误码

- **有 `Error` 字段的响应**：业务错误优先填充 `error.code/error.message`，并设置 `success=false`（如 `PlaceOrderResponse`）。
- **无 `Error` 字段的响应**（如 `GetOrdersResponse/GetPositionsResponse`）：使用 gRPC status code 返回（如 `InvalidArgument/Unauthenticated`），避免静默吞错。
- `error.code` 建议复用 `pkg/exchange-adapter/core/error_codes.go`，并补充服务级错误：
  - `TOKEN_NOT_FOUND` / `TOKEN_EXPIRED`
  - `UNSUPPORTED_EXCHANGE` / `UNSUPPORTED_ORDER_LOOKUP`
  - `INTERNAL_ERROR`

---

## 5. 核心流程设计

### 5.1 InitAccount（建立会话）

```
上游                Service              SessionStore         pkg/exchange-adapter
 │                    │                      │                         │
 │──InitAccount────→  │                      │                         │
 │  (credentials)     │                      │                         │
 │                    │──Generate Token────→ │                         │
 │                    │                      │                         │
 │                    │──Save Config────────→│                         │
 │                    │  (token→AccountConfig,TTL)                     │
 │                    │                      │                         │
 │                    │──Create Adapter──────┼────────────────────────→│
 │                    │  (lazy or eager)     │                         │
 │                    │                      │                         │
 │←──Token─────────── │                      │                         │
```

**实现要点**:
- Token 生成：使用 `crypto/rand` 生成随机 token（base64url），避免从 `api_key` 派生；token 仅用于会话索引。
- TTL：默认 24 小时（可配置）。协议不返回 `expires_at`，上游通过 `ValidateToken` 发现失效后重新 `InitAccount`。
- Adapter 创建：推荐在 `InitAccount` 时创建并做一次轻量连通性校验（如 `GetBalance`），失败直接返回 `success=false`；也可配置为懒加载。

### 5.2 PlaceOrder（下单）

```
上游              Service           SessionStore        ExchangeManager      pkg/exchange-adapter
 │                  │                   │                     │                 │
 │──PlaceOrder────→ │                   │                     │                 │
 │  (token+order)   │                   │                     │                 │
 │                  │──Get Session─────→│                     │                 │
 │                  │←─AccountConfig────│                     │                 │
 │                  │──Get Adapter──────┼────────────────────→│                 │
 │                  │                   │                     │──PlaceOrder────→│
 │                  │                   │                     │←─core.Order─────│
 │                  │──Update OrderIndex│                     │                 │
 │                  │──Ensure WS Subscribe────────────────────→│                 │
 │←─PlaceOrderResp──│                   │                     │                 │
```

**实现要点**:
- Token 验证：检查是否存在、是否过期
- 下单校验：依赖 `pkg/exchange-adapter` 内置校验（交易对可用性、精度、余额/持仓、reduceOnly 等）；高级风控建议由上游执行。
- 订单定位：将返回的 `order_id/client_order_id` 写入 `OrderIndex`，用于后续 `CancelOrder/GetOrder`。
- WS 订阅：确保对应 `trade_type` 的 `WsUserDataAdapter` 已订阅，便于 `SubscribeOrders` 推送更新。
- 返回：`PlaceOrderResponse.success` + `Order`（含 `id/exchange_order_id/client_order_id/...`）

### 5.3 SubscribeOrders（订单更新流）

```
上游              Service         ExchangeManager      WsUserDataAdapter
 │                  │                   │                     │
 │──Subscribe─────→ │                   │                     │
 │  (token+type)    │                   │                     │
 │                  │──Ensure WS────────→│                     │
 │                  │  Subscribe        │                     │
 │                  │                   │──Subscribe──────────→│
 │                  │                   │                     │
 │                  │                   │                     │
 │                  │                   │←─OrderUpdate────────│
 │                  │←─Dispatch─────────│                     │
 │←─OrderUpdate──── │  (filter by      │                     │
 │                  │   token+type)     │                     │
 │                  │                   │                     │
 │←─OrderUpdate──── │                   │                     │
```

**实现要点**:
- 流管理：按 `token + tradeType` 建立独立订阅通道
- 过滤推送：只推送匹配 token 的订单更新
- 重连处理：WS 断开自动重连，上游无感知

### 5.4 CancelOrder / GetOrder（撤单/查询）

```
上游              Service           SessionStore        OrderIndex        pkg/exchange-adapter
 │                  │                   │                     │                 │
 │──CancelOrder───→ │                   │                     │                 │
 │ (token,order_id) │                   │                     │                 │
 │                  │──Get Session─────→│                     │                 │
 │                  │←─AccountConfig────│                     │                 │
 │                  │──Resolve Order────┼────────────────────→│                 │
 │                  │  (id→symbol/tt)   │                     │                 │
 │                  │──If miss: Scan OpenOrders───────────────────────────────→│
 │                  │──CancelOrder/GetOrder──────────────────────────────────→│
 │←─Response────────│                   │                     │                 │
```

**实现要点**:
- 优先使用 `OrderIndex`（由 `PlaceOrder`/WS 更新维护）定位 `symbol/trade_type`；缺失时兜底扫描 `GetOpenOrders(nil, nil)`。
- 若仍无法定位，则返回 `UNSUPPORTED_ORDER_LOOKUP`（或 gRPC `NotFound`/`FailedPrecondition`），提示上游补齐上下文或重新初始化。
- 建议协议为 `CancelOrder/GetOrder` 补充 `symbol/trade_type`（见开放问题），从根源解决可靠性问题。

---

## 6. 集成 Exchange Sync（可选：市场数据网关/缓存）

> 说明：`ExchangeService` gRPC 协议目前只包含 `GetPrice`；策略侧的 K 线/订单簿等实时数据由上游直接通过 NATS/HTTP 使用 `apps/exchange-sync`。本节仅描述“需要在本服务暴露市场数据 HTTP/管理接口或做本地缓存”时的集成方案。

### 6.1 集成方式

**选项 1：HTTP Client 调用** (推荐)
- Exchange Adapter Service 作为 exchange-sync 的 HTTP 客户端
- 调用 exchange-sync 的 REST API 获取市场数据
- 优点：解耦、exchange-sync 可独立部署和扩展

**选项 2：直接复用代码**
- 将 exchange-sync 的核心逻辑作为 Go package 引入
- 缺点：耦合度高、维护成本大

**决策：选择选项 1**

### 6.2 配置

配置项见第 11 章：`exchange_sync` / `nats` / `cron`。

### 6.3 市场数据服务实现

```go
// internal/market/client.go
type SuccessResponse[T any] struct {
    Code    int    `json:"code"`
    Status  string `json:"status"`
    Message string `json:"message"`
    Data    T      `json:"data"`
}

type ExchangeSyncClient struct {
    baseURL string
    client  *http.Client
}

func (c *ExchangeSyncClient) GetCandles(
    ctx context.Context,
    exchange string,
    symbol string,
    period string,
    limit int,
    startTime int64,
    endTime int64,
) ([]marketdata.NormalizedCandle, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/candles", nil)
    if err != nil {
        return nil, err
    }

    q := req.URL.Query()
    q.Set("exchange", exchange)
    q.Set("symbol", symbol)
    q.Set("period", period)
    q.Set("limit", strconv.Itoa(limit))
    q.Set("start_time", strconv.FormatInt(startTime, 10))
    q.Set("end_time", strconv.FormatInt(endTime, 10))
    req.URL.RawQuery = q.Encode()

    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var out SuccessResponse[[]marketdata.NormalizedCandle]
    if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
        return nil, err
    }
    if out.Code != 0 {
        return nil, fmt.Errorf("exchange-sync error: %s", out.Message)
    }
    return out.Data, nil
}

// /api/orderbook, /api/candle/current, /api/symbols 等接口同理封装
```

### 6.4 NATS 订阅实时数据

Exchange Sync 通过 NATS 推送实时市场数据，Exchange Adapter Service 可订阅这些数据以提供低延迟的市场数据查询。

**NATS 主题格式**:
- K 线更新: `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}`
  - 示例: `exchange.candle.binance.spot.BTC-USDT.15m`
- 订单簿更新: `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}`
  - 示例: `exchange.orderbook.okx.futures.ETH-USDT`

**实现示例**:

```go
// internal/market/nats_subscriber.go
type NATSSubscriber struct {
    conn   *nats.Conn
    prefix string

    // 内存缓存最新数据
    candleCache    map[string]*marketdata.NormalizedCandle // key: exchange.symbol.period
    orderBookCache map[string]*marketdata.OrderBook        // key: exchange.symbol
    mu             sync.RWMutex
}

func NewNATSSubscriber(cfg *NATSConfig) (*NATSSubscriber, error) {
    opts := []nats.Option{
        nats.Name("exchange-adapter-subscriber"),
        nats.ReconnectWait(time.Duration(cfg.ReconnectWaitMs) * time.Millisecond),
        nats.MaxReconnects(cfg.MaxReconnects),
    }

    if cfg.Username != "" && cfg.Password != "" {
        opts = append(opts, nats.UserInfo(cfg.Username, cfg.Password))
    }

    conn, err := nats.Connect(cfg.URL, opts...)
    if err != nil {
        return nil, err
    }

    return &NATSSubscriber{
        conn:           conn,
        prefix:         cfg.SubjectPrefix,
        candleCache:    make(map[string]*marketdata.NormalizedCandle),
        orderBookCache: make(map[string]*marketdata.OrderBook),
    }, nil
}

// SubscribeCandles 订阅 K 线更新
func (s *NATSSubscriber) SubscribeCandles(exchange, tradeType, symbol, period string) error {
    subject := fmt.Sprintf("%s.candle.%s.%s.%s.%s",
        s.prefix, exchange, tradeType, symbol, period)

    _, err := s.conn.Subscribe(subject, func(msg *nats.Msg) {
        var candle marketdata.NormalizedCandle
        if err := json.Unmarshal(msg.Data, &candle); err != nil {
            log.Error().Err(err).Msg("Failed to unmarshal candle")
            return
        }

        // 更新缓存
        cacheKey := fmt.Sprintf("%s.%s.%s", exchange, symbol, period)
        s.mu.Lock()
        s.candleCache[cacheKey] = &candle
        s.mu.Unlock()
    })

    return err
}

// GetLatestCandle 获取最新 K 线（从缓存）
func (s *NATSSubscriber) GetLatestCandle(exchange, symbol, period string) (*marketdata.NormalizedCandle, bool) {
    cacheKey := fmt.Sprintf("%s.%s.%s", exchange, symbol, period)
    s.mu.RLock()
    defer s.mu.RUnlock()

    candle, exists := s.candleCache[cacheKey]
    return candle, exists
}

// SubscribeOrderBook 订阅订单簿更新
func (s *NATSSubscriber) SubscribeOrderBook(exchange, tradeType, symbol string) error {
    subject := fmt.Sprintf("%s.orderbook.%s.%s.%s",
        s.prefix, exchange, tradeType, symbol)

    _, err := s.conn.Subscribe(subject, func(msg *nats.Msg) {
        var ob marketdata.OrderBook
        if err := json.Unmarshal(msg.Data, &ob); err != nil {
            log.Error().Err(err).Msg("Failed to unmarshal orderbook")
            return
        }

        // 更新缓存
        cacheKey := fmt.Sprintf("%s.%s", exchange, symbol)
        s.mu.Lock()
        s.orderBookCache[cacheKey] = &ob
        s.mu.Unlock()
    })

    return err
}

// Close 关闭连接
func (s *NATSSubscriber) Close() {
    if s.conn != nil {
        s.conn.Close()
    }
}
```

**使用场景**:
1. **低延迟查询**: 市场数据 HTTP handler 可直接从 NATS 缓存返回最新数据（如当前 K 线/订单簿）。
2. **降级策略**: 缓存未命中或 NATS 不可用时降级到 exchange-sync HTTP API。

### 6.5 Cron 定时同步

使用 Cron 定时任务定期同步交易对信息，保持数据最新。

**实现示例**:

```go
// internal/service/cron_service.go
import (
    "github.com/robfig/cron/v3"
)

type CronService struct {
    cron            *cron.Cron
    exchangeSyncClient *ExchangeSyncClient
}

func NewCronService(cfg *CronConfig, client *ExchangeSyncClient) *CronService {
    return &CronService{
        cron:            cron.New(),
        exchangeSyncClient: client,
    }
}

// Start 启动定时任务
func (s *CronService) Start() error {
    // 每天凌晨 0 点同步交易对信息
    _, err := s.cron.AddFunc("0 0 * * *", func() {
        log.Info().Msg("Starting scheduled symbols sync")

        for _, exchange := range []string{"binance", "okx", "bybit"} {
            if err := s.syncSymbols(exchange); err != nil {
                log.Error().Err(err).Str("exchange", exchange).Msg("Failed to sync symbols")
            }
        }

        log.Info().Msg("Scheduled symbols sync completed")
    })

    if err != nil {
        return err
    }

    s.cron.Start()
    log.Info().Msg("Cron service started")
    return nil
}

// syncSymbols 同步指定交易所的交易对信息
func (s *CronService) syncSymbols(exchange string) error {
    symbols, err := s.exchangeSyncClient.GetSymbols(context.Background(), exchange)
    if err != nil {
        return err
    }

    log.Info().Str("exchange", exchange).Int("count", len(symbols)).Msg("Synced symbols")
    return nil
}

// Stop 停止定时任务
func (s *CronService) Stop() {
    if s.cron != nil {
        s.cron.Stop()
        log.Info().Msg("Cron service stopped")
    }
}
```

**配置选项**:
```yaml
cron:
  enabled: true
  # Cron 表达式: "分 时 日 月 星期"（robfig/cron v3 默认 5 段；如需秒级调度需 WithSeconds）
  symbols_sync: "0 0 * * *"  # 每天凌晨 0 点
```

**常用 Cron 表达式**:
- `"0 0 * * *"` - 每天凌晨 0 点
- `"0 */6 * * *"` - 每 6 小时
- `"0 0 */3 * *"` - 每 3 天
- `"0 0 * * 0"` - 每周日凌晨

---

## 7. 会话管理（无数据库）

### 7.1 SessionStore 设计

```go
// internal/session/store.go
type AccountConfig struct {
    Exchange   string
    Name       string
    APIKey     string
    APISecret  string
    Passphrase string
    Demonet    bool // 测试网/模拟盘
    Proxy      string
    RiskConfig string // JSON（可选：需协议扩展后启用）
    CreatedAt  time.Time
    ExpiresAt  time.Time
}

type SessionStore struct {
    mu       sync.RWMutex
    sessions map[string]*AccountConfig
    ttl      time.Duration
}

func (s *SessionStore) Create(config *AccountConfig) (string, error) {
    token, err := generateToken()
    if err != nil {
        return "", err
    }
    config.CreatedAt = time.Now()
    config.ExpiresAt = config.CreatedAt.Add(s.ttl)

    s.mu.Lock()
    s.sessions[token] = config
    s.mu.Unlock()

    return token, nil
}

func (s *SessionStore) Get(token string) (*AccountConfig, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    config, exists := s.sessions[token]
    if !exists {
        return nil, ErrTokenNotFound
    }

    if time.Now().After(config.ExpiresAt) {
        return nil, ErrTokenExpired
    }

    return config, nil
}

func (s *SessionStore) Delete(token string) {
    s.mu.Lock()
    delete(s.sessions, token)
    s.mu.Unlock()
}

// 定期清理过期 token
func (s *SessionStore) StartCleanup(interval time.Duration) {
    ticker := time.NewTicker(interval)
    go func() {
        for range ticker.C {
            s.cleanup()
        }
    }()
}
```

### 7.2 Token 生成策略

建议使用强随机 token（与 `api_key` 无关），避免可预测/可关联：

```go
func generateToken() (string, error) {
    b := make([]byte, 32)
    if _, err := rand.Read(b); err != nil {
        return "", err
    }
    return base64.RawURLEncoding.EncodeToString(b), nil
}
```

---

## 8. 风控（建议放上游）

当前 `ExchangeService` 协议未携带 session 级风控配置（无 `risk_config_json`），因此本服务 MVP 不做“策略/账户级风控决策”，只依赖两层保护：

1. `pkg/exchange-adapter` 的基础校验：参数合法性、交易对状态、精度格式化、余额/持仓校验、reduceOnly 约束等。
2. 上游（`trader-service`）在下单前执行更完整的风险控制（账户权益、日内损失、仓位限制、黑白名单等）。

**可选扩展（后续）**:
- 协议扩展：为 `InitAccountRequest` 增加 `risk_config_json`（或 `risk_config_id`），把风控策略与 token 绑定，并在 `PlaceOrder` 前强制评估。
- 服务级兜底：提供“全局硬风控”配置（对所有账户统一阈值），用于防误操作；需明确其与上游风控的职责边界。

---

## 9. 实施路线图

### 第一阶段：服务骨架 + contracts 对齐（1-2 天）

**目标**: 服务可运行，gRPC 协议与 `ExchangeService` 对齐

- [ ] 创建项目结构（`cmd/`、`internal/`、`gen/`）
- [ ] 引入并生成 [packages/contracts/proto/exchange.proto](../../packages/contracts/proto/exchange.proto) 的 Go 代码
- [ ] gRPC Server 启动（含 reflection、grpc health）
- [ ] HTTP Server（可选：/health, /ready, /version）
- [ ] 配置加载（YAML/ENV）与基础日志

**验收标准**:
- gRPC health 可用
- `ValidateToken` 可被上游调用（无 token 返回 `valid=false`）

### 第二阶段：会话与适配器管理（1-2 天）

**目标**: 完成 token 生命周期与 adapter 生命周期

- [ ] SessionStore（内存 + TTL + 清理）
- [ ] ExchangeManager：按 token 缓存 `TradeAdapter` / `WsUserDataAdapter`
- [ ] `InitAccount / ValidateToken / InvalidateToken` 完整实现（可配置是否预热 adapter）

**验收标准**:
- `InitAccount` 返回 token；`InvalidateToken` 后 `ValidateToken.valid=false`
- 日志中不出现明文 `api_key/api_secret/passphrase`

### 第三阶段：交易与账户 RPC（2-4 天）

**目标**: 覆盖主要交易/账户能力（与 proto 一致）

- [ ] `PlaceOrder` / `PlaceOrders`（含 enum 映射、字段映射、`OrderIndex` 写入）
- [ ] `GetBalance` / `GetPositions` / `SyncPositions`
- [ ] `SetLeverage`
- [ ] `GetPrice`

**验收标准**:
- 可通过 gRPC 正常下单/查余额/查持仓/设置杠杆/获取价格（至少 OKX/Binance）

### 第四阶段：订单查询与撤单（1-2 天）

**目标**: 在“缺少 symbol/trade_type”的协议下做到可用

- [ ] `OrderIndex`（`orderID/clientOrderID -> (symbol, tradeType)`）
- [ ] `GetOrders`（MVP：Open Orders，支持 `symbol/status/limit/offset` 的最小语义）
- [ ] `GetOrder` / `CancelOrder`：OrderIndex 优先 + Open Orders 兜底扫描

**验收标准**:
- 仅凭 `order_id` 能撤销未成交订单；无法定位时返回明确错误码
- 文档明确 `GetOrders`/历史订单的边界

### 第五阶段：订单更新流（1-2 天）

**目标**: `SubscribeOrders` 稳定可用

- [ ] `WsUserDataAdapter` 管理（连接、订阅、重连）
- [ ] gRPC stream 转发：按 `token + trade_type` 过滤推送
- [ ] 资源回收：stream 结束后清理订阅/监听器（无订阅者可退订）

**验收标准**:
- 订单状态变化能实时推送；WS 断线可自动恢复

### 第六阶段：稳定性与可观测性（1-2 天）

**目标**: 生产就绪的基础能力

- [ ] gRPC Interceptors（日志/恢复/超时/trace-id）
- [ ] 优雅退出（关闭 gRPC、WS、后台 goroutine）
- [ ] 指标采集（Prometheus）与 pprof（可选）
- [ ] 单元测试（mappers/session/orderIndex）+（可选）集成测试

**验收标准**:
- 进程退出时无资源泄露
- 关键 RPC 有可观测指标与结构化日志

---

## 10. 技术选型

| 组件 | 技术选型 | 说明 |
|-----|---------|------|
| HTTP 框架 | Echo v4 | 参考 exchange-sync，轻量高效 |
| gRPC | google.golang.org/grpc | 标准库 |
| 配置 | Viper | 支持 YAML/ENV |
| 日志 | Zap | 高性能结构化日志 |
| 消息队列 | NATS | 可选：市场数据网关/缓存（策略侧建议直接用 exchange-sync） |
| 定时任务 | Cron v3 | 可选：例如定期同步交易对信息 |
| 指标 | Prometheus | 标准监控方案 |
| 测试 | testify | 断言与 mock |

---

## 11. 配置文件

```yaml
# config.yaml
server:
  grpc_port: 9001
  http_port: 9002

# Exchange Sync 集成（可选：仅用于市场数据 HTTP/缓存网关）
exchange_sync:
  enabled: false
  base_url: "http://localhost:9003"
  timeout_seconds: 10

# NATS 消息队列（可选：仅用于市场数据订阅缓存；策略侧建议直接订阅 exchange-sync）
nats:
  enabled: false
  url: "nats://localhost:15002"
  username: "exchange_adapter"
  password: "123456"
  subject_prefix: "exchange"
  batch_window_ms: 200
  enable_compress: true
  reconnect_wait_ms: 2000
  max_reconnects: -1  # -1 表示无限重连

# 定时任务（可选：例如定期同步交易对信息）
cron:
  enabled: false
  # 定期同步交易对信息 (每天凌晨 0 点)
  symbols_sync: "0 0 * * *"

# Session 管理
session:
  token_ttl_hours: 24
  cleanup_interval_minutes: 60

# 风控（可选：需协议扩展/明确边界后启用）
risk:
  enabled: false
  default_config: |
    {
      "account_rules": {
        "max_equity_loss_pct": 0.05
      }
    }

# 日志
log:
  level: info
  format: json

# 代理（可选）
proxy: ""

# 证书（mTLS）
security:
  tls_enabled: false
  cert_file: ""
  key_file: ""
  ca_file: ""
```

---

## 12. FAQ

### Q1: 为什么不用数据库？

**A**: 本服务定位为"执行层"，不承担订单的长期存储和管理职责。订单的持久化由上游服务（订单服务/策略服务）负责。这样设计的好处：
- 服务更轻量、更容易水平扩展
- 减少技术栈复杂度
- 职责清晰、边界明确

### Q2: Token 过期后怎么办？

**A**: 上游服务需要重新调用 InitAccount 建立新会话。可以在上游实现自动重连逻辑。

### Q3: 多实例部署怎么办？

**A**: MVP 阶段设计为单实例。后续如需多实例，有两种方案：
1. 引入 Redis 存储 token → AccountConfig 映射
2. 改为无状态设计，每次请求携带完整凭证（需考虑安全性）

### Q4: exchange-sync 服务挂了怎么办？

**A**: 仅影响本服务的“可选市场数据网关/缓存”能力；核心交易执行（下单/撤单/账户查询）不依赖 exchange-sync。上游可直接通过 NATS/HTTP 使用 exchange-sync，并做降级处理。

### Q5: 如何保证订单推送的可靠性？

**A**:
- WS 断线自动重连
- gRPC stream 支持重新订阅
- 建议上游做订单轮询兜底

---

## 13. 开放问题

以下问题需要与上游服务确认：

1. ✅ **Proto 定义来源**: 使用仓库内 [packages/contracts/proto/exchange.proto](../../packages/contracts/proto/exchange.proto)
2. ✅ **mTLS 证书**: apps 统一使用一个证书
3. ❓ **Order.id 语义**: 是否统一约定 `Order.id == exchange_order_id`，并作为 `CancelOrder/GetOrder(order_id)` 的唯一输入？
4. ❓ **协议补字段**: `CancelOrder/GetOrder` 是否需要补充 `symbol`/`trade_type`（建议 v2，避免无法定位历史订单）？
5. ❓ **GetOrders 语义**: MVP 仅 Open Orders 是否足够？若要支持历史订单，是否需要补 `trade_type`/时间范围等筛选条件？
6. ❓ **撤单入参兼容**: 是否允许用 `client_order_id` 作为 `order_id` 输入（MVP 可兼容：优先按 exchangeOrderId 匹配，失败再按 clientOrderId）？
7. ❓ **多实例部署**: token/OrderIndex 是否需要 Redis 共享（否则重启/扩缩容会丢状态）？

---

## 附录

### A. 参考文档

- [pkg/exchange-adapter 文档](../../pkg/exchange-adapter/doc.go)
- [pkg/risk 文档（可选）](../../pkg/risk/types.go)
- [apps/exchange-sync README](../exchange-sync/README.md)
- [apps/exchange-sync API 文档](../exchange-sync/docs/api-integration.md)

### B. 相关文件

- [packages/contracts/proto/exchange.proto](../../packages/contracts/proto/exchange.proto)
