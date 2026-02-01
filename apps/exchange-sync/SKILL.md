---
name: exchange-sync
description: Exchange Sync 对外对接指南（HTTP REST API + NATS 订阅）：认证方式、接口列表、请求参数与示例、消息主题与数据格式。
---

# Exchange Sync 对外接口 Skill（对接用）

本 Skill 只包含对外部调用方/下游服务的对接信息：HTTP REST API + NATS 订阅。

更完整的接口说明与示例：`docs/api-integration.md`（优先参考）。

## 基础信息

- HTTP Base URL：`http://<host>:<server.http_port>`
- 统一 symbol 格式：`BTC-USDT`
- 时间戳单位：毫秒（`start_time` / `end_time` / `timestamp`）
- `trade_type`：`spot`（默认）或 `futures`
- `exchange`：`binance` 或 `okx`

## 认证（可选）

当服务端配置了 `server.api_key` 时，所有 `/api/*` 需要携带 API Key：

- `X-API-Key: <key>`
- 或 `Authorization: Bearer <key>`

## 响应结构

成功：
```json
{"code":0,"status":"ok","message":"success","data":{}}
```

失败：
```json
{"code":400,"status":"error","message":"...","errors":[{"field":"...","message":"..."}]}
```

常见错误：
- `400`：参数缺失/格式不对
- `404`：数据不存在（如 orderbook/candle 找不到）
- `503`：未配置数据库（部分接口依赖 DB）

## HTTP REST API（对接清单）

- `GET /health`：健康检查
- `GET /api/candles`：历史 K 线（支持 `compact=true` 行式/`column=true` 列式）
- `GET /api/candle/current`：当前周期 K 线
- `GET /api/candle/fill-miss`：补全缺失数据（默认近 2 天）
- `GET /api/candle/verify`：校验本地数据与交易所一致性
- `GET /api/orderbook`：大单订单簿（`range` 控制 ±% 范围）
- `GET /api/trace-price`：追踪价格（`distance` 控制 ±% 范围）
- `POST /api/subscribe`：动态订阅
- `POST /api/unsubscribe`：取消订阅
- `GET /api/symbols`：交易对列表（可排序/过滤）
- `PUT /api/symbols`：更新交易对同步开关
- `DELETE /api/symbols`：删除交易对
- `DELETE /api/symbols/batch`：批量删除交易对
- `GET /api/sync/tasks`：同步任务状态

参数与响应的完整表格：`docs/api-integration.md`。

### 最小可用示例（curl）

```bash
# 健康检查
curl http://localhost:9003/health

# 历史 K 线
curl "http://localhost:9003/api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100"

# 列式/紧凑格式
curl "http://localhost:9003/api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100&column=true"
curl "http://localhost:9003/api/candles?exchange=binance&symbol=BTC-USDT&period=15m&limit=100&compact=true"

# 大单订单簿
curl "http://localhost:9003/api/orderbook?exchange=binance&symbol=BTC-USDT&range=0.1"

# 动态订阅
curl -X POST "http://localhost:9003/api/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"exchange":"binance","symbols":[{"symbol":"ETH-USDT","trade_type":"spot"}]}'
```

## NATS 对接

### 主题（subject）

- K 线更新：`{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}`
  - 示例：`exchange.candle.binance.spot.BTC-USDT.15m`
- 订单簿更新：`{prefix}.orderbook.{exchange}.{tradeType}.{symbol}`
  - 示例：`exchange.orderbook.binance.spot.BTC-USDT`

其中 `{prefix}` 来自配置 `nats.subject_prefix`（默认 `exchange`）。

### 消息格式（JSON）

- Candle：见 `docs/api-integration.md` 的 `NormalizedCandle`
- OrderBook：见 `docs/api-integration.md` 的 `OrderBook`

### 订阅示例（Node.js）

```js
const { connect, StringCodec } = require("nats");

const nc = await connect({ servers: "nats://localhost:4222" });
const sc = StringCodec();
const sub = nc.subscribe("exchange.candle.binance.spot.BTC-USDT.15m");

for await (const msg of sub) {
  console.log(JSON.parse(sc.decode(msg.data)));
}
```

## 对接文档索引

- `docs/api-integration.md`：对外对接主文档（HTTP + NATS，推荐）
- `README.md`：运行示例与部分 API 示例
