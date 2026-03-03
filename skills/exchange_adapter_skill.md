# Exchange Adapter Service Skill

> 适用于 `apps/exchange-adapter-service/` 的开发指南。帮助 AI 理解项目上下文，快速定位代码并正确修改。

## 服务定位

Exchange Adapter Service 是 Auto Trader 平台的**交易所 API 网关**，用 Go 编写。它有两个核心职责：

1. **交易网关** — 通过 gRPC 对上游服务（trader-service-node）暴露统一交易接口，内部适配 OKX / Binance 等交易所 API
2. **行情数据同步** — 内嵌可选的行情同步模块，通过 WebSocket 实时采集 K 线 / Ticker / OrderBook，通过 REST 回补历史数据，持久化到 PostgreSQL 并发布到 NATS

## 技术栈

| 技术 | 用途 |
|------|------|
| Go 1.23+ | 主语言 |
| gRPC / Protobuf | 交易服务接口 |
| Echo v4 | HTTP REST API |
| PostgreSQL (pgx) | K 线时序存储 |
| Redis (go-redis) | Ticker 缓存 |
| NATS | 消息发布（行情 & 订单更新） |
| Viper | 配置管理 |
| zerolog (pkg/logger) | 结构化日志 |
| sqlc | SQL → Go 代码生成 |

## 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                  Exchange Adapter Service                  │
│                                                            │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────┐  │
│  │  gRPC :9101  │   │  HTTP :9100   │   │  Market App   │  │
│  │              │   │              │   │  (可选)        │  │
│  │ Exchange     │   │ /health      │   │ WsSync        │  │
│  │ Service      │   │ /ready       │   │ HistorySync   │  │
│  │              │   │ /market/*    │   │ TickerSync    │  │
│  └──────┬───────┘   └──────────────┘   └───────┬───────┘  │
│         │                                       │          │
│  ┌──────▼───────┐   ┌──────────────┐   ┌───────▼───────┐  │
│  │   Trading    │   │   Session    │   │  Publisher    │  │
│  │   Manager    │   │   Store      │   │  (NATS)       │  │
│  └──────┬───────┘   └──────────────┘   └───────────────┘  │
│         │                                                  │
└─────────┼──────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────┐
│  pkg/exchange-     │  ← 统一交易所适配器
│  adapter           │     (OKX, Binance, Bybit)
│  pkg/okx-api       │
│  pkg/binance-api   │
└────────────────────┘
```

## 关键文件索引

### 入口 & 引导

| 文件 | 说明 |
|------|------|
| `cmd/main.go` | 主服务入口：加载配置 → 初始化日志 → 创建 App → Run |
| `cmd/cron/main.go` | 定时任务独立入口 |
| `internal/app/trader_app.go` | 应用引导：初始化 Trading Manager、Session Store、gRPC Server、HTTP Server、Market App |
| `internal/app/market_app.go` | 行情子应用：管理 WsSync / HistorySync / TickerSync 服务 |

### gRPC 服务

| 文件 | 说明 |
|------|------|
| `proto/exchange.proto` | 服务定义（所有 RPC 方法 & 消息类型） |
| `gen/exchange/` | protoc 生成的 Go 代码（不要手动修改） |
| `internal/grpc/server.go` | gRPC 服务器启动、TLS 配置、拦截器 |
| `internal/grpc/service.go` | `ExchangeService` 所有方法的实现（~1150 行） |
| `internal/contract/` | Proto 类型 ↔ 核心类型双向转换 |

### 交易管理

| 文件 | 说明 |
|------|------|
| `internal/trading/manager.go` | 核心：订单执行、WebSocket 订阅管理、交易所适配器生命周期 |
| `internal/trading/stream_hub.go` | 订单更新广播 Hub（gRPC Stream 消费） |
| `internal/trading/order_index.go` | 内存订单索引（按账户、品种快速查找） |

### 会话管理

| 文件 | 说明 |
|------|------|
| `internal/session/store.go` | Token 发放、验证、过期清理 |
| `internal/session/types.go` | AccountConfig（交易所、API Key、密钥、密码短语） |

### 行情同步

| 文件 | 说明 |
|------|------|
| `internal/service/ws_sync.go` | WebSocket 实时 K 线 & OrderBook 同步，200ms 批聚合 |
| `internal/service/history_sync.go` | REST 历史 K 线回补（限流） |
| `internal/service/ticker_sync.go` | 24h Ticker 同步 → Redis 缓存 |
| `internal/service/symbols_sync.go` | 交易品种元数据同步 |
| `internal/marketjobs/` | 定时任务：品种同步、分区管理 |

### 数据存储

| 文件 | 说明 |
|------|------|
| `internal/storage/postgres.go` | PostgreSQL 连接池 & Schema 自动迁移 |
| `internal/storage/redis.go` | Redis 客户端初始化 |
| `internal/storage/db/migrations/` | 5 个 SQL 迁移文件 |
| `internal/storage/db/queries/` | sqlc SQL 源文件 |
| `internal/storage/db/*.sql.go` | sqlc 生成的 Go 代码（不要手动修改） |

### 消息发布

| 文件 | 说明 |
|------|------|
| `internal/publisher/nats.go` | NATS 连接、K 线/OrderBook/订单更新发布、gzip 压缩 |

### HTTP API

| 文件 | 说明 |
|------|------|
| `internal/api/server.go` | Echo HTTP 服务器、路由、中间件（CORS、限流、认证） |
| `internal/api/handler.go` | 端点处理器（health、market data 查询） |
| `internal/api/validator.go` | 请求参数校验 |

### 配置

| 文件 | 说明 |
|------|------|
| `config.yaml` | 默认配置 |
| `config.local.yaml` | 本地覆盖（git ignored） |
| `internal/config/config.go` | 配置结构体 & Viper 加载逻辑 |

### 工具

| 文件 | 说明 |
|------|------|
| `internal/utils/batch_processor.go` | 泛型批处理器 |
| `internal/utils/rate_limiter.go` | 请求限流 |
| `internal/utils/task_manager.go` | 并发任务管理 |

## HTTP REST API 参考

> 基础地址: `http://localhost:9100`，认证方式: `X-API-Key` Header 或 `Authorization: Bearer <key>`（仅在 `server.api_key` 配置非空时启用）。

### 响应格式

```json
// 成功
{ "code": 0, "status": "ok", "message": "success", "data": {...} }

// 错误
{ "code": 400, "status": "error", "message": "...", "errors": [{"field": "...", "message": "..."}] }
```

### 健康检查（无需认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查，返回当前时间 |
| GET | `/ready` | 就绪探针 |
| GET | `/version` | 服务版本 |

### K 线数据

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/candles` | 查询历史 K 线 |
| GET | `/api/candle/current` | 获取当前周期实时 K 线 |
| GET | `/api/candle/fill-miss` | 触发缺失数据回补 |
| GET | `/api/candle/verify` | 验证 K 线数据完整性 |

**GET /api/candles** 参数:

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `exchange` | string | 是 | - | 交易所名称 (binance/okx) |
| `symbol` | string | 是 | - | 交易对 (BTC-USDT) |
| `period` | string | 否 | 15m | K 线周期 (1m/5m/15m/1h/4h/1d) |
| `limit` | int | 否 | 300 | 返回条数上限 |
| `start_time` | int64 | 否 | 1天前 | 起始时间 (ms 时间戳) |
| `end_time` | int64 | 否 | 当前 | 结束时间 (ms 时间戳) |
| `column` | bool | 否 | false | 列式格式返回 |
| `compact` | bool | 否 | false | 紧凑数组格式返回 |

> 注：4h 周期会从 15m 源数据聚合计算。

**GET /api/candle/current** 参数: `exchange`, `symbol`, `trade_type`(默认 spot), `period`(默认 15m)

**GET /api/candle/fill-miss** 参数: `exchange`, `symbol`, `trade_type`(默认 spot), `start_time`, `end_time`

**GET /api/candle/verify** 参数: `exchange`, `symbol`, `trade_type`(默认 spot), `period`(默认 15m), `limit`(默认 100)

### OrderBook

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/orderbook` | 获取实时订单簿（内存快照） |
| GET | `/api/trace-price` | 获取追踪价格（基于深度计算） |

**GET /api/orderbook** 参数: `exchange`(必填), `symbol`(必填), `trade_type`(默认 spot), `range`(默认 0.1, 价格范围比例)

**GET /api/trace-price** 参数: `exchange`(必填), `symbol`(必填), `trade_type`(默认 spot), `distance`(默认 0.1)

### Ticker

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ticker` | 查询单个交易对 24h Ticker |
| GET | `/api/tickers` | 查询交易所所有 Tickers |
| GET | `/api/tickers/price-map` | 返回 symbol → lastPrice 映射 |

**GET /api/ticker** 参数: `exchange`(必填), `symbol`(必填), `trade_type`(默认 spot)

**GET /api/tickers** 参数: `exchange`(必填), `trade_type`(默认 spot) → 返回 `{exchange, tradeType, count, tickers}`

**GET /api/tickers/price-map** 参数: `exchange`(必填), `trade_type`(默认 spot) → 返回 `{symbol: price}` 字典

### 交易对管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/symbols` | 查询交易对列表（支持过滤排序） |
| PUT | `/api/symbols` | 更新交易对属性（如 sync_enabled） |
| DELETE | `/api/symbols` | 删除单个交易对（同时取消 WS 订阅） |
| DELETE | `/api/symbols/batch` | 批量删除交易对 |

**GET /api/symbols** 参数: `exchange`(必填), `trade_type`, `symbol`(精确过滤), `orderBy`(amount/quoteVolume24h/change24h), `order`(asc/desc)

**PUT /api/symbols** Body:
```json
{ "exchange": "binance", "symbol": "BTC-USDT", "trade_type": "spot", "sync_enabled": true }
```
> 开启 `sync_enabled` 会自动触发历史回补 + WS 订阅；关闭会取消同步任务 + WS 订阅。

**DELETE /api/symbols** Body: `{ "exchange": "binance", "symbol": "BTC-USDT", "trade_type": "spot" }`

**DELETE /api/symbols/batch** Body: `{ "exchange": "binance", "symbols": ["BTC-USDT", "ETH-USDT"], "trade_type": "spot" }`

### 订阅管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/subscribe` | 动态添加 WebSocket 行情订阅 |
| POST | `/api/unsubscribe` | 取消 WebSocket 行情订阅 |

**POST /api/subscribe** Body:
```json
{ "exchange": "binance", "symbols": [{ "symbol": "BTC-USDT", "tradeType": "spot", "periods": ["15m", "1h"] }] }
```

**POST /api/unsubscribe** Body: `{ "exchange": "binance", "symbols": ["BTC-USDT"] }`

### 同步状态

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sync/tasks` | 查询历史回补任务列表（可按 status 过滤） |
| GET | `/api/sync/status` | 查询单个交易对同步状态 |
| GET | `/api/sync/status/all` | 查询所有交易对同步状态 |

**GET /api/sync/tasks** 参数: `status`(可选, running/pending/completed/failed)

**GET /api/sync/status** 参数: `exchange`(必填), `symbol`(必填), `trade_type`(默认 spot)

**GET /api/sync/status/all** 参数: `exchange`(必填), `trade_type`(可选)

## NATS 消息发布参考

> 所有主题以 `{subject_prefix}` 开头，默认 `exchange`。消息格式为 JSON (sonic 序列化)，连接启用 gzip 压缩。

### 行情数据（批量聚合，200ms 窗口）

| 主题模式 | 说明 | 消息体 |
|----------|------|--------|
| `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` | K 线更新 | `NormalizedCandle` |
| `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}` | OrderBook 快照 | `OrderBook` |

示例: `exchange.candle.binance.spot.BTC-USDT.15m`

### 订单更新（即时发布，不走批量）

| 主题模式 | 说明 | 消息体 |
|----------|------|--------|
| `{prefix}.order_update.{accountID}` | 普通订单状态变更 | `OrderUpdateMessage` |
| `{prefix}.strategy_order_update.{accountID}` | 策略单状态变更 | `StrategyOrderUpdateMessage` |

**OrderUpdateMessage 结构:**

```json
{
  "orderId": "123456",
  "clientOrderId": "my-order-1",
  "symbol": "BTC-USDT",
  "tradeType": "futures",
  "side": "buy",
  "positionSide": "long",
  "orderType": "limit",
  "status": "filled",
  "price": "50000.00",
  "quantity": "0.1",
  "filledQuantity": "0.1",
  "avgPrice": "49999.50",
  "fee": "0.005",
  "feeAsset": "USDT",
  "reduceOnly": false,
  "updateTime": 1709462400000
}
```

**StrategyOrderUpdateMessage 结构:**

```json
{
  "algoId": "789",
  "clientAlgoId": "my-sl-1",
  "symbol": "BTC-USDT",
  "tradeType": "futures",
  "side": "sell",
  "positionSide": "long",
  "strategyType": "stop_loss",
  "status": "triggered",
  "triggerPrice": "48000.00",
  "orderPrice": "47900.00",
  "quantity": "0.1",
  "triggerTime": 1709462400000,
  "updateTime": 1709462400000
}
```

### 订阅方式（消费端）

```go
// Go 消费端示例
nc.Subscribe("exchange.candle.binance.spot.BTC-USDT.15m", func(msg *nats.Msg) {
    var candle NormalizedCandle
    sonic.Unmarshal(msg.Data, &candle)
})

// 通配符订阅所有 BTC-USDT 周期
nc.Subscribe("exchange.candle.binance.spot.BTC-USDT.*", handler)

// 订阅某账户所有订单更新
nc.Subscribe("exchange.order_update.account-123", handler)
```

## 常见开发任务

### 添加新的 gRPC 方法

1. 编辑 `proto/exchange.proto` 添加 RPC 定义和消息类型
2. `make proto` 重新生成代码
3. 在 `internal/grpc/service.go` 中实现新方法
4. 如需类型转换，更新 `internal/contract/`

### 添加新的交易所支持

1. 在 `pkg/` 下创建新的交易所 SDK（如 `pkg/bybit-api/`）
2. 在 `pkg/exchange-adapter/` 中实现统一接口
3. 更新 `go.mod` 的 `replace` 指令
4. 在 `proto/exchange.proto` 的 `Exchange` 枚举中添加新值

### 添加新的数据库表

1. 在 `internal/storage/db/migrations/` 新建迁移文件（递增编号）
2. 在 `internal/storage/db/queries/` 添加 SQL 查询
3. 运行 `sqlc generate` 生成 Go 代码
4. 在服务层调用生成的查询函数

### 添加新的 HTTP 端点

1. 在 `internal/api/handler.go` 添加处理器方法
2. 在 `internal/api/server.go` 注册路由
3. 如需参数校验，更新 `internal/api/validator.go`

### 添加新的 NATS 主题

1. 在 `internal/publisher/nats.go` 添加发布方法
2. 定义主题命名规则：`exchange.{domain}.{...}`
3. 在服务层调用发布

## 数据流

### 交易下单流程

```
gRPC Client (trader-service-node)
    │
    ▼
ExchangeService.PlaceOrder()
    ├─ 验证 Token (Session Store)
    ├─ 获取/创建交易所适配器 (Trading Manager)
    ├─ 调用 adapter.PlaceOrder()
    ├─ 索引订单 (OrderIndex)
    ├─ 订阅 WebSocket 更新 (Manager.EnsureWsSubscribed)
    └─ 返回响应

异步: WebSocket 订单状态变更
    ├─ OrderUpdateHub → gRPC SubscribeOrders Stream
    └─ NATS Publisher → exchange.orders.{accountID}
```

### 行情数据流程

```
WsSyncService (WebSocket 实时)
    ├─ 200ms 批聚合
    ├─ 写入 PostgreSQL (batch insert)
    └─ 发布 NATS (K线 / OrderBook)

HistorySyncService (REST 历史回补)
    ├─ 限流调用 REST API
    ├─ 写入 PostgreSQL
    └─ 触发 WsSync 订阅

TickerSyncService
    ├─ WebSocket 订阅 Ticker
    ├─ 缓存到 Redis
    └─ 更新 24h 统计表
```

## 本地运行清单

```bash
# 1. 启动依赖
cd apps/exchange-adapter-service
docker compose up -d        # NATS :15002 + Redis :16000

# 2. 确保 PostgreSQL 可用 (默认 :15000)

# 3. 创建本地配置
cp config.yaml config.local.yaml
# 编辑数据库连接等

# 4. 启动服务
go run ./cmd
# gRPC → :9101, HTTP → :9100

# 5. 验证
curl http://localhost:9100/health
```

## 注意事项

- `gen/exchange/*.go` 和 `internal/storage/db/*.sql.go` 是生成代码，不要手动修改
- 本地开发使用 `config.local.yaml`，优先级高于 `config.yaml`
- 环境变量前缀 `EXCHANGE_ADAPTER_`，下划线分隔层级（如 `EXCHANGE_ADAPTER_DATABASE_HOST`）
- Go 模块使用 `replace` 指令引用本地 `pkg/` 包，确保 `go.work` 包含本模块
- 行情同步模块可通过 `market.enabled: false` 关闭，仅保留交易网关功能
- 优雅关闭有 15 秒宽限期，会清理 WebSocket 连接、NATS 发布者、数据库连接池
