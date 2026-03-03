# Exchange Adapter Service

交易所适配器服务 —— Auto Trader 平台的交易所 API 网关。使用 Go 编写，通过 gRPC 对内提供统一的交易接口，同时内嵌行情数据同步能力，支持多交易所（OKX、Binance）的现货与合约交易。

## 核心能力

- **统一交易接口** — 通过 gRPC 暴露标准化的下单、撤单、持仓、余额查询等操作，屏蔽各交易所 API 差异
- **策略订单** — 支持止损、止盈、触发、追踪止损等条件单
- **实时订单推送** — 基于 WebSocket 的订单状态变更，通过 gRPC Stream 和 NATS 双通道推送
- **行情数据同步** — 内嵌 K 线、Ticker、OrderBook 的 WebSocket 实时同步与 REST 历史回补
- **会话管理** — Token 化的账户隔离，支持 TTL 过期自动清理
- **HTTP API** — 提供健康检查、行情查询等 REST 端点

## 项目结构

```
exchange-adapter-service/
├── cmd/
│   ├── main.go                  # 主服务入口
│   └── cron/main.go             # 定时任务入口
├── internal/
│   ├── api/                     # HTTP REST 端点 (Echo 框架)
│   │   ├── server.go            # HTTP 服务器 & 路由注册
│   │   ├── handler.go           # 请求处理器
│   │   └── validator.go         # 请求参数校验
│   ├── app/                     # 应用引导 & 生命周期管理
│   │   ├── trader_app.go        # 主应用 (gRPC + HTTP + Trading)
│   │   └── market_app.go        # 行情子应用 (数据同步)
│   ├── config/                  # 配置加载 (Viper)
│   ├── contract/                # Proto ↔ 核心类型双向转换
│   ├── cron/                    # Cron 调度器
│   ├── grpc/                    # gRPC 服务端
│   │   ├── server.go            # 服务器启动 & TLS
│   │   └── service.go           # ExchangeService 实现
│   ├── marketjobs/              # 行情同步任务 (品种同步、分区管理)
│   ├── publisher/               # NATS 消息发布 (K线、OrderBook、订单)
│   ├── service/                 # 业务服务层
│   │   ├── ws_sync.go           # WebSocket 实时行情同步
│   │   ├── history_sync.go      # REST 历史 K 线回补
│   │   ├── ticker_sync.go       # 24h Ticker 同步 (Redis 缓存)
│   │   └── symbols_sync.go      # 交易品种元数据同步
│   ├── session/                 # 会话管理 (Token 发放 & TTL 清理)
│   ├── storage/                 # 数据存储
│   │   ├── postgres.go          # PostgreSQL 连接 & Schema 初始化
│   │   ├── redis.go             # Redis 客户端
│   │   └── db/
│   │       ├── migrations/      # 数据库迁移 (5 个)
│   │       └── queries/         # SQL 查询 (sqlc 生成)
│   ├── trading/                 # 交易管理
│   │   ├── manager.go           # 订单执行 & WebSocket 订阅
│   │   ├── stream_hub.go        # 订单更新广播
│   │   └── order_index.go       # 订单索引
│   └── utils/                   # 工具 (批处理、限流、任务管理)
├── proto/
│   └── exchange.proto           # gRPC 服务定义
├── gen/exchange/                # 生成的 gRPC Go 代码
├── config.yaml                  # 默认配置
├── docker-compose.yaml          # 本地开发依赖 (NATS, Redis)
├── Makefile                     # Proto 代码生成
├── go.mod / go.sum              # Go 依赖
└── sqlc.yaml                    # sqlc 配置
```

## 快速开始

### 前置依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Go | 1.23+ | 编译运行 |
| PostgreSQL | 12+ | K 线存储 & 时间分区 |
| Redis | 6+ | Ticker 缓存（可选） |
| NATS | 2+ | 消息发布（可选） |
| protoc | 3+ | Proto 代码生成（开发时） |

### 1. 启动基础设施

```bash
cd apps/exchange-adapter-service
docker compose up -d    # 启动 NATS + Redis
```

### 2. 配置

复制并修改本地配置（覆盖 `config.yaml` 中的默认值）：

```bash
cp config.yaml config.local.yaml
# 编辑 config.local.yaml，设置数据库连接、NATS 地址等
```

也可通过环境变量覆盖，前缀 `EXCHANGE_ADAPTER_`：

```bash
export EXCHANGE_ADAPTER_DATABASE_HOST=localhost
export EXCHANGE_ADAPTER_DATABASE_PORT=15000
export EXCHANGE_ADAPTER_NATS_URL=nats://localhost:15002
```

### 3. 运行

```bash
cd apps/exchange-adapter-service
go run ./cmd
```

服务启动后暴露：

| 端口 | 协议 | 说明 |
|------|------|------|
| 9100 | HTTP | REST API (健康检查、行情查询) |
| 9101 | gRPC | 交易服务 (ExchangeService) |

## 开发

### 构建

```bash
cd apps/exchange-adapter-service

# 编译
go build -o exchange-adapter-service ./cmd

# 运行测试
go test ./...
```

### Proto 代码生成

当修改 `proto/exchange.proto` 后：

```bash
# 首次：安装 protoc 插件
make tools

# 生成 Go 代码到 gen/exchange/
make proto
```

### SQLc 代码生成

当修改 `internal/storage/db/queries/*.sql` 后：

```bash
sqlc generate
```

> 不要直接修改 `internal/storage/db/*.sql.go`，它们会被 sqlc 覆盖。

### 数据库迁移

迁移文件位于 `internal/storage/db/migrations/`，服务启动时自动按编号顺序执行：

| 文件 | 说明 |
|------|------|
| `001_normalized_candles.sql` | K 线时序表 |
| `002_symbol_infos.sql` | 交易品种信息 |
| `003_symbol_sync_status.sql` | 同步状态追踪 |
| `004_partition_registry.sql` | 分区管理 |
| `005_symbol_tickers_24h.sql` | 24h Ticker 统计 |

## gRPC 接口概览

服务名：`exchange.ExchangeService`

| 分类 | 方法 | 说明 |
|------|------|------|
| 账户 | `InitAccount` | 初始化账户会话（传入 API Key） |
| | `ValidateToken` | 验证 Token |
| | `InvalidateToken` | 注销 Token |
| 订单 | `PlaceOrder` / `PlaceOrders` | 下单 / 批量下单 |
| | `CancelOrder` | 撤单 |
| | `GetOrder` / `GetOrders` | 查询订单 |
| 持仓 | `GetPositions` | 查询持仓 |
| | `SyncPositions` | 同步持仓 |
| 余额 | `GetBalance` | 查询余额 |
| 行情 | `GetPrice` | 获取当前价格 |
| 杠杆 | `SetLeverage` | 设置杠杆 |
| 策略单 | `PlaceStrategyOrder(s)` | 下条件单 |
| | `CancelStrategyOrder` | 撤条件单 |
| | `GetStrategyOrder` | 查询条件单 |
| | `GetOpenStrategyOrders` | 查询活跃条件单 |
| 流式 | `SubscribeOrders` | 订阅实时订单更新 (Server Stream) |

## 配置参考

```yaml
server:
  grpc_port: 9101           # gRPC 端口
  http_port: 9100           # HTTP 端口
  api_key: ""               # HTTP API 认证密钥（空则不鉴权）
  rate_limit_rps: 100       # HTTP 限流 (req/s)，0 关闭

session:
  token_ttl_hours: 24       # Token 过期时间
  cleanup_interval_minutes: 60

market:
  enabled: true             # 是否启用内嵌行情同步

database:                   # PostgreSQL
  host: "127.0.0.1"
  port: 15000
  user: exchange_sync_user
  password: "123456"
  database: exchange_info

redis:                      # Redis（Ticker 缓存）
  host: "localhost"
  port: 16000

nats:                       # NATS（消息发布）
  enabled: true
  url: "nats://localhost:15002"
  subject_prefix: "exchange"

proxy:                      # 代理（可选）
  http: ""                  # REST API 代理
  socks5: ""                # WebSocket 代理

security:                   # TLS（可选）
  tls_enabled: false
```

## HTTP REST API

> 基础地址: `:9100`，API 路由前缀 `/api`。配置 `server.api_key` 非空时启用认证（`X-API-Key` 或 `Authorization: Bearer`）。

### 健康检查（无认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/ready` | 就绪探针 |
| GET | `/version` | 服务版本 |

### K 线

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/candles` | 查询历史 K 线（支持 column/compact 格式） |
| GET | `/api/candle/current` | 获取当前周期实时 K 线 |
| GET | `/api/candle/fill-miss` | 触发缺失数据回补 |
| GET | `/api/candle/verify` | 验证数据完整性 |

### OrderBook

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/orderbook` | 获取实时订单簿 |
| GET | `/api/trace-price` | 获取追踪价格 |

### Ticker

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ticker` | 单个交易对 24h Ticker |
| GET | `/api/tickers` | 交易所所有 Tickers |
| GET | `/api/tickers/price-map` | symbol → lastPrice 映射 |

### 交易对管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/symbols` | 查询交易对（支持排序过滤） |
| PUT | `/api/symbols` | 更新交易对（如 sync_enabled 开关） |
| DELETE | `/api/symbols` | 删除交易对（取消 WS 订阅） |
| DELETE | `/api/symbols/batch` | 批量删除 |

### 订阅管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/subscribe` | 动态添加 WebSocket 行情订阅 |
| POST | `/api/unsubscribe` | 取消 WebSocket 行情订阅 |

### 同步状态

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sync/tasks` | 查询回补任务列表 |
| GET | `/api/sync/status` | 单个交易对同步状态 |
| GET | `/api/sync/status/all` | 所有交易对同步状态 |

> 完整参数说明见 [skills/exchange_adapter_skill.md](../../skills/exchange_adapter_skill.md)。

## NATS 消息主题

> 前缀由 `nats.subject_prefix` 配置，默认 `exchange`。JSON 格式，gzip 压缩。

### 行情数据（200ms 批量聚合）

| 主题模式 | 说明 |
|----------|------|
| `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` | K 线更新 |
| `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}` | OrderBook 快照 |

### 订单更新（即时发布）

| 主题模式 | 说明 |
|----------|------|
| `{prefix}.order_update.{accountID}` | 普通订单状态变更 |
| `{prefix}.strategy_order_update.{accountID}` | 策略单状态变更 |

示例: `exchange.candle.binance.spot.BTC-USDT.15m`、`exchange.order_update.acc-123`
