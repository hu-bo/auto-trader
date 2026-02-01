# Exchange Sync - Agent Context Document

> AI Agent 专用上下文文档，用于快速理解项目结构、核心逻辑和开发规范
> 代码风格：可维护性高，易阅读，充分利用设计模式


## 项目定位

**Exchange Sync** 是一个 Go 语言实现的加密货币交易所实时数据聚合服务。核心功能是从 Binance 和 OKX 获取 WebSocket 实时数据流，聚合为标准化 K 线，并通过 HTTP API 和 Socket.IO 对外提供服务。

**核心价值**:
- 多交易所数据归一化
- 5m → 15m/4h/1d K 线聚合
- 大单过滤 (≥$5000 USDT)
- 实时推送 + 历史查询
- REST API 同步交易所历史数据
- 需要同步的币种(分批写入 batch_size + interval)
---

## workspace: /Users/hubo/Work/Coding/MyProject/app-nodejs/apps/exchange-sync

## 技术栈概览

| 类别 | 技术选型 |
|------|---------|
| 语言 | Go 1.22+ |
| HTTP | Echo v4 |
| WebSocket | gorilla/websocket |
| 实时推送 | go-socket.io |
| 数据库 | PostgreSQL (pgx/v5) |
| 配置 | Viper (YAML + ENV) |
| JSON | ByteDance Sonic (高性能) |
| 数据结构 | emirpasic/gods (TreeMap) |

---

## 目录结构

```
apps/exchange-sync/
├── cmd/
│   └── main.go                 # 入口：初始化配置、服务、优雅关闭
├── internal/
│   ├── api/
│   │   ├── server.go           # Echo HTTP 服务器配置
│   │   ├── handler.go          # REST API 处理器 
│   │   └── socketio.go         # Socket.IO 事件处理
│   ├── aggregator/
│   │   ├── period.go           # K线周期聚合器
│   │   ├── period_test.go      # 聚合器单元测试
│   │   ├── orderbook.go        # 丁单薄+大单过滤管理器
│   │   └── orderbook_test.go   # 丁单薄+大单过滤管理器单元测试
│   ├── config/
│   │   └── config.go           # Viper 配置加载 
│   ├── exchange/
│   │   ├── types.go            # 通用接口和数据类型
│   │   ├── binance/
│   │   │   └── client.go       # Binance WebSocket 客户端
│   │   └── okx/
│   │       └── client.go       # OKX WebSocket 客户端
│   ├── service/
│   │   ├── sync.go             # 同步历史数据服务
│   │   ├── sync_test.go        # 同步历史数据服务测试
│   │   ├── ws_sync.go          # WebSocket 核心同步服务编排
│   │   └── ws_sync_test.go     # WebSocket 服务测试
│   └── storage/
│       ├── repository.go       # 存储接口定义
│       └── postgres.go         # PostgreSQL 实现 
├── pkg/utils/
│   └── parse.go                # 工具函数
├── config.yaml                 # 默认配置模板
├── config.local.yaml           # 本地开发配置
├── docker-compose.local.yaml   # 开发环境 PostgreSQL
├── Makefile                    # 构建脚本
└── README.md                   # 用户文档
```

---

## 核心数据流

```
┌───────────────────────────────────────────────────────────────┐
│        Binance / OKX      getCandles(Kline 15m)               │
│                                                               │
│         需要检索到最开始的日期(首次/数据库中无SymbolInfo)，非首次仅同步近2天数据 │
│         按批次 limit: 100                                      │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────┐
│              Binance / OKX WebSocket Streams  (spot | futures)│
│         (Kline 5m, AggTrade, Depth@500ms, Books)              │
└─────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SyncService (编排层)                          │
│  - 管理多交易所连接                                               │
│  - 为每个交易所创建 PeriodAggregator + OrderBookManager           │
│  - 注册回调: OnKline, OnTrade, OnDepth                           │
└──────────┬────────────────────────────────┬─────────────────────┘
           │                                │
           ▼                                ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│   PeriodAggregator       │    │     OrderBookManager         │
│  - 5m → 15m/4h/1d 聚合    │    │  - 过滤大单 ≥ $5000           │
│  - 跟踪 OHLCV + 买卖量     │    │  - TreeMap 价格排序           │
│  - 周期边界自动刷新         │    │  - 48h 自动清理               │
└──────────┬───────────────┘    └──────────────┬───────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  Batch Write Channel     │    │      Socket.IO Broadcast     │
│  (15m周期批量写入缓冲队列)  │    │   (实时推送到客户端房间)         │
└──────────┬───────────────┘    └──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL (normalized_candles)                 │
│  - Upsert 写入 (ON CONFLICT)                                 │
│  - 索引: symbol, exchange, period, timestamp                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 核心数据结构

### NormalizedCandle (标准化 K 线)

```go
type NormalizedCandle struct {
    Symbol       string  // 交易对: BTC-USDT  格式统一(binance -> BTCUSDT)(okx -> BTC-USDT)
    Exchange     string  // 交易所: binance | okx
    TradeType    string  // 类型: spot | futures | Delivery(不用实现)
    Period       string  // 周期: 15m | 4h | 1d
    Timestamp    int64   // 周期起始时间 (毫秒)
    Open         float64 // 开盘价
    High         float64 // 最高价
    Low          float64 // 最低价
    Close        float64 // 收盘价
    Volume       float64 // 总成交量
    BuyVolume    float64 // 主动买入成交量
    SymbolFamily string  // 资产族: BTC, ETH
}
```

### OrderBook (订单簿)

```go
type OrderBook struct {
    Symbol string           // 交易对
    Bids   []OrderBookEntry // 买单 (价格降序, ≥$5000)
    Asks   []OrderBookEntry // 卖单 (价格升序, ≥$5000)
    Price  float64          // 当前价格
}

type OrderBookEntry struct {
    Price     float64 // 价格
    Quantity  float64 // 数量
    USDValue  float64 // USD 价值
    Timestamp int64   // 时间戳
}
```
### Symbol Format

| Exchange | Spot | Futures | Delivery(不用实现) |
|----------|------|---------|----------|
| Unified | `BTC-USDT` | `BTC-USDT` | `BTC-USDT` |
| Binance | `BTCUSDT` | `BTCUSDT` | `BTCUSD_PERP` |
| OKX | `BTC-USDT` | `BTC-USDT-SWAP` | `BTC-USDT-240329` |

### 需要同步的交易对信息列表

```go
/**
 * 统一的交易对信息
 */
type SymbolInfo struct {
  // 统一格式: BTC-USDT
  Symbol string `json:"symbol"`
  // 原始格式: BTCUSDT (Binance) / BTC-USDT-SWAP (OKX)
  RawSymbol string `json:"rawSymbol"`
  // 基础货币: BTC
  BaseCurrency string `json:"baseCurrency"`
  // 计价货币: USDT
  QuoteCurrency string `json:"quoteCurrency"`
  // 交易类型 spot | futures | delivery
  TradeType string `json:"tradeType"` 
  // 最小价格变动: "0.01"
  TickSize string `json:"tickSize"`
  // 最小数量变动: "0.001"
  StepSize string `json:"stepSize"`
  // 最小下单数量
  MinQty string `json:"minQty"`
  // 最大下单数量
  MaxQty string `json:"maxQty"`
  // 数量精度
  QuantityPrecision int `json:"quantityPrecision"`
  // 价格精度
  PricePrecision int `json:"pricePrecision"`
  // 交易对状态
  Status string `json:"status"`
  // 合约面值 (仅合约)
  ContractValue *float64 `json:"contractValue,omitempty"`
  // 最大杠杆 (仅合约)
  MaxLeverage *float64 `json:"maxLeverage,omitempty"`
}
```


### Exchange 接口

```go
type Exchange interface {
    Name() string
    Connect(ctx context.Context) error
    Subscribe(symbols []SubscribeRequest) error
    Unsubscribe(symbols []string) error
    Close() error
    OnKline(handler func(Kline))
    OnTrade(handler func(Trade))
    OnDepth(handler func(DepthUpdate))
    OnError(handler func(error))
}
```

---

## 配置说明

### config.yaml 结构

```yaml
server:
  http_port: 9003            # HTTP 服务端口
  socketio_port: 9005
database:
  host: localhost            # 数据库地址 (空 = 无持久化)
  port: 15000
  user: exchange_sync_user
  password: 123456
  database: exchange_info
  ssl_mode: disable
  batch_size: 100            # 批量写入大小
  batch_interval_ms: 1000    # 批量写入间隔

proxy: "socks5://127.0.0.1:7890"  # 可选代理
```


---

## API 接口

### REST API

| 方法 | 路径 | 参数 | 说明 |
|-----|------|------|------|
| GET | `/health` | - | 健康检查 |
| GET | `/api/orderbook` | exchange, symbol, range | 指定价格范围内的大单 |
| GET | `/api/trace-price` | exchange, symbol, distance | 按距离排序的 Top6 大单价格 |
| GET | `/api/candle/fill-miss` | exchange, symbol, period, start_time, end_time | 检索周期内缺失的数据，并填充 |
| GET | `/api/candles` | exchange, symbol, period, limit, start_time, end_time | 历史 K 线 |
| POST | `/api/subscribe` | body: {exchange, symbols[]} | 动态订阅交易对 |
| POST | `/api/unsubscribe` | body: {exchange, symbols[]} | 取消订阅 |

### 示例请求

```bash
# 获取订单簿 (±10% 范围)
curl "http://localhost:9003/api/orderbook?exchange=binance&symbol=BTC-USDT&range=0.1"

# 获取当前 15m K 线
curl "http://localhost:9003/api/candle/current?exchange=binance&symbol=BTC-USDT&period=15m"

# 订阅新交易对
curl -X POST "http://localhost:9003/api/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"exchange":"okx","symbols":[{"symbol":"ETH-USDT","trade_type":"spot"}]}'

# 获取历史 K 线
curl "http://localhost:9003/api/candles?exchange=binance&symbol=BTCUSDT&period=15m&limit=100"
```

### Socket.IO 事件

| 事件 | 方向 | Payload | 说明 |
|-----|------|---------|------|
| `subscribe` | C→S | symbol | 订阅交易对房间 |
| `unsubscribe` | C→S | symbol | 取消订阅 |
| `subscribed` | S→C | - | 订阅确认 |
| `orderbook_update` | S→C | OrderBook | 订单簿更新广播 |
| `candle_update` | S→C | NormalizedCandle | K 线更新广播 |
| `orderbook` | S→C | OrderBook | 订单簿响应 |
| `candle` | S→C | NormalizedCandle | K 线响应 |

---

## 交易所集成

### Binance

| 配置项 | 值 |
|-------|---|
| Endpoint (Spot) | `wss://stream.binance.com:9443/ws` |
| Endpoint (Futures) | `wss://fstream.binance.com/ws` |
| Symbol 格式 | `BTCUSDT` (大写连写) |
| 订阅流 | `@kline_5m`, `@aggTrade`, `@depth@500ms` |

### OKX

| 配置项 | 值 |
|-------|---|
| Endpoint | `wss://ws.okx.com:8443/ws/v5/public` |
| Symbol 格式 (Spot) | `BTC-USDT` |
| Symbol 格式 (Futures) | `BTC-USDT-SWAP` |
| 订阅频道 | `candle5m`, `trades`, `books` |

---

## 数据库 Schema

```sql
CREATE TABLE normalized_candles (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(24) NOT NULL,
    exchange VARCHAR(16) NOT NULL,
    trade_type VARCHAR(10) NOT NULL,      --  spot | futures | delivery(无需实现)
    period VARCHAR(5) NOT NULL,           -- 15m
    timestamp BIGINT NOT NULL,            -- 周期起始时间 (ms)
    open NUMERIC NOT NULL,
    high NUMERIC NOT NULL,
    low NUMERIC NOT NULL,
    close NUMERIC NOT NULL,
    volume NUMERIC NOT NULL,
    buy_volume NUMERIC NOT NULL,
    symbol_family VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (symbol, exchange, trade_type, period, timestamp)
);

CREATE INDEX idx_candles_query ON normalized_candles(exchange, symbol, period, timestamp DESC);
```

---

## 核心组件详解

### 1. PeriodAggregator (`internal/aggregator/period.go`)

**职责**: 将 5m K 线聚合为更大周期

**关键逻辑**:
- `CandleBuilder`: 内部状态机，跟踪当前周期的 OHLCV
- `ProcessKline()`: 处理新 5m K 线，更新或创建周期
- `ProcessTrade()`: 从 Trade 数据中分离买卖量
- `OnPeriodComplete`: 周期结束回调 → 写入数据库
- `OnUpdate`: 实时更新回调 → Socket.IO 广播
- 后台 goroutine 每分钟检查周期边界

**支持周期**: 15m, 4h, 1d

### 2. OrderBookManager (`internal/aggregator/orderbook.go`)

**职责**: 管理大单订单簿

**关键逻辑**:
- 使用 TreeMap 按价格排序存储
- 过滤规则: USD 价值 ≥ $5,000
- 48 小时自动清理过期订单
- `GetFilteredBook()`: 获取指定价格范围内的大单
- `GetTracePrice()`: 获取按距离/数量排序的 Top 价格

### 3. SyncService (`internal/service/sync.go`)

**职责**: 核心编排层

**关键逻辑**:
- 管理多个交易所客户端 (Binance + OKX)
- 为每个交易所创建独立的 Aggregator 和 OrderBookManager
- 批量写入: 可配置 batch_size 和 batch_interval
- Channel-based 缓冲队列防止数据丢失
- 失败降级: 批量写入失败时回退到单条写入

**职责**: 分批同步历史数据

**关键逻辑**:
- 尝试找出从给定 startTime 到现在之间，某交易对在交易所上存在历史 K 线数据的最早月份（按月粒度）
- 为每个交易所创建独立的 Aggregator 和 OrderBookManager
- 查询平台限制频率和长度 每次查询limit: 100，队列查询，不限制等待时间，完成(exchange, symbol, startTime, endTime, interval=15m, limit=100)查询并写入就继续，直到同步完成
- 批量写入

---

## 开发命令

```bash
# 构建
make build          # 输出到 ./bin/exchange-sync

# 运行
make run            # 构建并运行
make dev            # 热重载开发模式 (Air)

# 测试
make test           # 运行单元测试

# 文档
make swagger        # 生成 Swagger API 文档

# 依赖
make deps           # 同步 Go modules

# 清理
make clean          # 删除构建产物
```

---

## 启动流程

1. **加载配置**: config.yaml + 环境变量
2. **初始化数据库**: 创建连接池, 执行 schema 初始化
3. **获取需要同步的symbol**: 获取需要同步的symbol列表
3. **fill miss data**: 查询近2天的数据，一一判断数据库中的15m周期的数据是否有缺失，缺失则补充，2天约等于 limt=100查询两次
3. **创建 WsSyncService**: 设置批量写入参数
4. **注册交易所**: 添加 Binance 和 OKX 客户端
5. **启动 API 服务器**: Echo 路由 + Socket.IO 挂载
6. **启动交易所连接**: 后台 goroutine
7. **等待就绪**: 最多 15 秒超时
8. **订阅交易对**: 根据配置文件
9. **监听信号**: SIGINT/SIGTERM 优雅关闭

---

## 扩展指南

### 添加新交易所

1. 在 `internal/exchange/` 创建新目录
2. 实现 `Exchange` 接口
3. 在 `cmd/main.go` 注册新交易所

### 添加新存储后端

1. 实现 `storage.Repository` 接口
2. 在 `cmd/main.go` 替换 PostgreSQL 实现

### 动态订阅

无需重启服务:

```bash
POST /api/subscribe
{
  "exchange": "binance",
  "symbols": [
    {"symbol": "ETH-USDT", "trade_type": "spot"},
    {"symbol": "BTC-USDT", "trade_type": "spot"}
  ]
}
```

---
## README.md补充(优先级最低)
1. 介绍
2. 使用说明
3. 开发说明

## 注意事项

1. **Symbol 格式差异**: 参考 ###Symbol Format
2. **无数据库模式**: `database.host` 为空时跳过持久化
3. **代理支持**: 支持 SOCKS5 和 HTTP 代理
4. **批量写入**: 失败只重试1次
5. **大单阈值**: 固定 $5,000 USDT(可配置)，如需调整修改 `orderbook.go`
6. **周期边界**: 每分钟检查一次，最大延迟约 1 分钟
7. **同步历史**: 同步历史k线数据，一般会给一个比较早的年，比如当前是2025.12.20，会给出一个默认值2016年，通过二分边界依次定位到具体是哪年哪月有开始有数据，取2016.12.20 ～ 2025.12.20 中间时间看是否能拿到数据，如果不能则继续，直到Candles接口返回数据、同时需要分段，100个symbol，10个一批，等都同步完了才继续下一批。
8. **工具方法抽离**: 为了后续更好维护，和代码可读性，功能独立的，需要复用的逻辑尽可能抽离工具方法。 任务分批、队列等可拆成独立的模块
9. **重复订阅**: 第三方通过socket.io订阅，重复订阅时，不影响ws_sync本身(不会重复订阅)

---

## 相关文档

- [exchange-api-reference.md](./exchange-api-reference.md) 
- [ws-reference.md](./ws-reference.md)

