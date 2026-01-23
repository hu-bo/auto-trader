# Exchange Sync API Integration Guide

> 对外对接文档 - 提供完整的 API 接口说明、数据格式和集成示例

## 概述

Exchange Sync 是一个加密货币交易所实时数据聚合服务，提供以下能力：

- **多交易所支持**: Binance、OKX
- **实时 K 线数据**: 15m / 4h / 1d 周期聚合
- **大单监控**: 过滤 ≥$5000 USDT 的订单
- **多种接入方式**: HTTP REST API、NATS 消息队列

---

## 快速开始

### 基础信息

| 配置项 | 默认值 |
|--------|--------|
| HTTP 端口 | `9003` |
| NATS 地址 | `nats://152.32.210.32:15001` |
| 响应格式 | JSON |

### 认证方式

支持可选的 API Key 认证（需在服务端配置启用）：

```bash
# Header 方式
X-API-Key: your-api-key

# Bearer Token 方式
Authorization: Bearer your-api-key
```

---

## HTTP API 接口

---

### 2. K 线数据接口

#### 2.1 获取历史 K 线

```
GET /api/candles
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `exchange` | string | 是 | 交易所: `binance` \| `okx` |
| `symbol` | string | 是 | 交易对 (统一格式: `BTC-USDT`) |
| `trade_type` | string | 否 | 交易类型: `spot` \| `futures`，默认 `spot` |
| `period` | string | 否 | 周期: `15m` \| `4h` \| `1d`，默认 `15m` |
| `limit` | int | 否 | 返回数量，默认 `100` |
| `start_time` | int64 | 否 | 起始时间戳 (毫秒) |
| `end_time` | int64 | 否 | 结束时间戳 (毫秒) |
| `compact` | bool | 否 | 紧凑格式 (行式) |
| `column` | bool | 否 | 列式格式 |

**请求示例:**

```bash
curl "http://exchange-sync.8and1.cn/api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=10"
```

**标准响应:**

```json
{
  "code": 0,
  "status": "ok",
  "data": [
    {
      "symbol": "BTC-USDT",
      "exchange": "binance",
      "trade_type": "spot",
      "period": "15m",
      "timestamp": 1703001600000,
      "open": 45000.5,
      "high": 45100.0,
      "low": 44950.0,
      "close": 45050.0,
      "volume": 12.5,
      "buy_volume": 7.3,
      "symbol_family": "BTC"
    }
  ]
}
```

**列式格式响应** (`?column=true`)(推荐):

```json
{
  "code": 0,
  "status": "ok",
  "data": {
    "timestamp": [1703001600000, 1703001900000],
    "open": [45000.5, 45050.0],
    "high": [45100.0, 45200.0],
    "low": [44950.0, 45000.0],
    "close": [45050.0, 45150.0],
    "volume": [12.5, 13.2],
    "buy_volume": [7.3, 8.1]
  }
}
```

#### 2.2 获取当前 K 线

获取正在形成中的当前周期 K 线。

```
GET /api/candle/current
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `exchange` | string | 是 | 交易所 |
| `symbol` | string | 是 | 交易对 |
| `trade_type` | string | 否 | 交易类型，默认 `spot` |
| `period` | string | 否 | 周期，默认 `15m` |

**请求示例:**

```bash
curl "http://exchange-sync.8and1.cn/api/candle/current?exchange=binance&symbol=BTC-USDT&period=15m"
```

**响应示例:**

```json
{
  "code": 0,
  "status": "ok",
  "data": {
    "exchange": "binance",
    "symbol": "BTC-USDT",
    "trade_type": "spot",
    "period": "15m",
    "total_count": 96,
    "match_count": 94,
    "miss_count": 2,
    "diff_count": 0,
    "miss_list": [1703005200000, 1703008800000],
    "success": true,
    "message": "Verification passed"
  }
}
```

#### 2.4 补全缺失数据


### 3. 订单簿接口

#### 3.1 获取大单订单簿

返回指定价格范围内的大单 (≥$5000 USDT)。

```
GET /api/orderbook
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `exchange` | string | 是 | 交易所 |
| `symbol` | string | 是 | 交易对 |
| `trade_type` | string | 否 | 交易类型，默认 `spot` |
| `range` | float | 否 | 价格范围百分比，默认 `0.1` (10%) |

**请求示例:**

```bash
curl "http://exchange-sync.8and1.cn/api/orderbook?exchange=binance&symbol=BTC-USDT&range=0.05"
```

**响应示例:**

```json
{
  "code": 0,
  "status": "ok",
  "data": {
    "symbol": "BTC-USDT",
    "bids": [
      {
        "price": 45000.5,
        "quantity": 0.5,
        "usd_value": 22500.25,
        "timestamp": 1703001600000
      }
    ],
    "asks": [
      {
        "price": 45100.5,
        "quantity": 0.8,
        "usd_value": 36080.4,
        "timestamp": 1703001600000
      }
    ],
    "price": 45050.0
  }
}
```

---

### 4. 交易对管理接口

#### 4.1 获取交易对列表

```
GET /api/symbols
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `exchange` | string | 是 | 交易所 |
| `trade_type` | string | 否 | 交易类型过滤 |
| `symbol` | string | 否 | 精确匹配交易对 |
| `orderBy` | string | 否 | 排序字段: `amount` \| `quoteVolume24h` \| `change24h` |
| `order` | string | 否 | 排序方向: `asc` \| `desc` |

**响应示例:**

```json
{
  "code": 0,
  "status": "ok",
  "data": {
    "exchange": "binance",
    "count": 50,
    "symbols": [
      {
        "symbol": "BTC-USDT",
        "rawSymbol": "BTCUSDT",
        "baseCurrency": "BTC",
        "quoteCurrency": "USDT",
        "tradeType": "spot",
        "tickSize": "0.01",
        "stepSize": "0.00001",
        "minQty": "0.00001",
        "maxQty": "10000",
        "quantityPrecision": 5,
        "pricePrecision": 2,
        "status": "TRADING",
        "syncEnabled": true,
        "lastPrice": 45050.0,
        "quoteVolume24h": 1250000000.5,
        "priceChangePct24h": 0.34
      }
    ]
  }
}
```


## NATS 消息队列

### 连接配置

```yaml
nats:
  url: "nats://localhost:4222"
  subject_prefix: "exchange"
  batch_window_ms: 100
  enable_compress: true
```

### 消息主题

#### K 线更新

**主题格式:**

```
{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}
```

**示例:**

```
exchange.candle.binance.spot.BTC-USDT.15m
exchange.candle.okx.futures.ETH-USDT.4h
```

**消息格式:**

```json
{
  "symbol": "BTC-USDT",
  "exchange": "binance",
  "trade_type": "spot",
  "period": "15m",
  "timestamp": 1703001600000,
  "open": 45000.5,
  "high": 45100.0,
  "low": 44950.0,
  "close": 45050.0,
  "volume": 12.5,
  "buy_volume": 7.3,
  "symbol_family": "BTC"
}
```

#### 订单簿更新

**主题格式:**

```
{prefix}.orderbook.{exchange}.{tradeType}.{symbol}
```

**示例:**

```
exchange.orderbook.binance.spot.BTC-USDT
```

**消息格式:**

```json
{
  "symbol": "BTC-USDT",
  "bids": [
    {"price": 45000.5, "quantity": 0.5, "usd_value": 22500.25, "timestamp": 1703001600000}
  ],
  "asks": [
    {"price": 45100.5, "quantity": 0.8, "usd_value": 36080.4, "timestamp": 1703001600000}
  ],
  "price": 45050.0
}
```

### NATS 订阅示例

**Go:**

```go
nc, _ := nats.Connect("nats://localhost:4222")
nc.Subscribe("exchange.candle.binance.spot.BTC-USDT.15m", func(m *nats.Msg) {
    var candle NormalizedCandle
    json.Unmarshal(m.Data, &candle)
    fmt.Printf("Candle: %+v\n", candle)
})
```

**Node.js:**

```javascript
const { connect } = require('nats');

const nc = await connect({ servers: 'nats://localhost:4222' });
const sub = nc.subscribe('exchange.candle.binance.spot.BTC-USDT.15m');

for await (const msg of sub) {
  const candle = JSON.parse(msg.data);
  console.log('Candle:', candle);
}
```

**Python:**

```python
import asyncio
import nats
import json

async def main():
    nc = await nats.connect("nats://localhost:4222")

    async def handler(msg):
        candle = json.loads(msg.data)
        print(f"Candle: {candle}")

    await nc.subscribe("exchange.candle.binance.spot.BTC-USDT.15m", cb=handler)

asyncio.run(main())
```

---

## 数据结构定义

### NormalizedCandle

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | string | 交易对 (统一格式: `BTC-USDT`) |
| `exchange` | string | 交易所: `binance` \| `okx` |
| `trade_type` | string | 类型: `spot` \| `futures` |
| `period` | string | 周期: `15m` \| `4h` \| `1d` |
| `timestamp` | int64 | 周期起始时间 (毫秒) |
| `open` | float64 | 开盘价 |
| `high` | float64 | 最高价 |
| `low` | float64 | 最低价 |
| `close` | float64 | 收盘价 |
| `volume` | float64 | 总成交量 |
| `buy_volume` | float64 | 主动买入量 |
| `symbol_family` | string | 资产族: `BTC`, `ETH` |

### OrderBook

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | string | 交易对 |
| `bids` | []OrderBookEntry | 买单列表 (价格降序) |
| `asks` | []OrderBookEntry | 卖单列表 (价格升序) |
| `price` | float64 | 当前价格 |

### OrderBookEntry

| 字段 | 类型 | 说明 |
|------|------|------|
| `price` | float64 | 价格 |
| `quantity` | float64 | 数量 |
| `usd_value` | float64 | USD 价值 |
| `timestamp` | int64 | 时间戳 |

### SymbolInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| `symbol` | string | 统一格式: `BTC-USDT` |
| `rawSymbol` | string | 原始格式 |
| `baseCurrency` | string | 基础货币 |
| `quoteCurrency` | string | 计价货币 |
| `tradeType` | string | 交易类型 |
| `tickSize` | string | 最小价格变动 |
| `stepSize` | string | 最小数量变动 |
| `minQty` | string | 最小下单数量 |
| `maxQty` | string | 最大下单数量 |
| `quantityPrecision` | int | 数量精度 |
| `pricePrecision` | int | 价格精度 |
| `status` | string | 交易对状态 |
| `syncEnabled` | bool | 是否启用同步 |
| `lastPrice` | float64 | 最新价格 |
| `quoteVolume24h` | float64 | 24h 成交额 |
| `priceChangePct24h` | float64 | 24h 涨跌幅 |

---

## 错误处理

### 错误响应格式

```json
{
  "code": 400,
  "status": "error",
  "message": "exchange and symbol are required",
  "errors": [
    {"field": "exchange", "message": "field is required"}
  ]
}
```

### 常见错误码

| 错误码 | 说明 |
|--------|------|
| `0` | 成功 |
| `400` | 请求参数错误 |
| `401` | 认证失败 |
| `404` | 资源不存在 |
| `429` | 请求频率超限 |
| `500` | 服务器内部错误 |

---

## 交易对格式转换

不同交易所使用不同的交易对格式，本服务统一使用 `BTC-USDT` 格式：

| 交易所 | Spot | Futures |
|--------|------|---------|
| **统一格式** | `BTC-USDT` | `BTC-USDT` |
| **Binance** | `BTCUSDT` | `BTCUSDT` |
| **OKX** | `BTC-USDT` | `BTC-USDT-SWAP` |

API 请求时使用统一格式 (`BTC-USDT`)，系统会自动转换。

---

## 最佳实践

### 1. 数据获取策略

- **历史数据**: 使用 `/api/candles` 批量获取
- **实时更新**: 订阅 NATS 消息队列
- **当前周期**: 使用 `/api/candle/current` 获取正在形成的 K 线

### 2. 大单监控

- 订单簿只包含 ≥$5000 USDT 的大单
- 大单数据有 48 小时有效期
- 使用 `range` 参数控制价格范围

### 3. 性能优化

- 使用 `compact=true` 或 `column=true` 减少响应体积
- NATS 消息启用压缩 (`enable_compress: true`)
- 批量请求时注意 `limit` 参数

### 4. 容错处理

- 实现 NATS 断线重连
- 定期使用 `/api/candle/verify` 校验数据完整性
- 使用 `/api/candle/fill-miss` 补全缺失数据

---

## 版本信息

- **当前版本**: v1.0.0
- **API 版本**: v1
- **更新时间**: 2025-01-23
