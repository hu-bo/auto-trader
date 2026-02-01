# Exchange API Reference

整理并分类官方文档链接（供 agent 和实现者参考） — 直接用于 `kline` 聚合、深度（orderbook）与成交（trades）拆分。

说明: 下面把链接按交易所（Binance / OKX）与频道类型（Kline / Depth / Trades / 其它）分类，并补充常用 Rust 库/文档用于获取蜡烛图（REST / WS）。

---

## Binance

### API 文档
- Kline (WS): https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md#klinecandlestick-streams-for-utc  (WS kline 格式与示例)
- Depth / Order Book (WS + snapshot): https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md#diff-depth-stream  (diff depth + 本地 orderbook 管理)
- Trades (WS): https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md#trade-streams  (trade / aggTrade 格式)
- General WebSocket guide: https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md  (端点、订阅/退订、限制、时间单位)
- REST Candlesticks (Klines): https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#kline-candlestick-data  (历史 K 线 REST endpoint)

### WebSocket 心跳机制

| 项目 | 说明 |
|------|------|
| **心跳模式** | 被动模式 (服务端发 Ping，客户端回 Pong) |
| **服务端 Ping 间隔** | 每 3 分钟发送一次 Ping 帧 |
| **客户端响应** | 收到 Ping 后立即回复 Pong 帧，携带相同的 appData |
| **超时断连** | 10 分钟内未收到 Pong，服务端断开连接 |
| **K线推送频率** | 每 2 秒推送一次更新 (非实时) |

**实现方式：**
```go
// 使用 SetPassiveHeartbeat() 设置被动心跳模式
session.SetPassiveHeartbeat()

// wsconn 内部会设置 PingHandler：
conn.SetPingHandler(func(appData string) error {
    return conn.WriteControl(websocket.PongMessage, []byte(appData), time.Now().Add(time.Second))
})
```

### WebSocket 连接限制
- WebSocket 服务器每秒最多接受 5 个消息 (包括 PING/PONG 帧和 JSON 消息)
- 单个连接最多可以订阅 1024 个 Streams
- 每 IP 地址、每 5 分钟最多可以发送 300 次连接请求
- 连接生命周期：24 小时 (建议 23 小时主动重连)

---

## OKX

### API 文档
- Kline (WS): https://www.okx.com/docs-v5/zh/#order-book-trading-market-data-ws-candlesticks-channel  (频道例如 `candle1m`, `candle15m`, `candle1D`；返回数组 [ts,o,h,l,c,vol,...])
- Depth / Order Book (WS): https://www.okx.com/docs-v5/zh/#order-book-trading-market-data-ws-order-book-channel  (`books`, `bbo-tbt`, `books-l2-tbt` 等)
- Trades (WS): https://www.okx.com/docs-v5/zh/#order-book-trading-market-data-ws-trades-channel  (`trades`, `trades-all` 等)
- Public WS overview / subscribe pattern: https://www.okx.com/docs-v5/zh/#overview-websocket  (`/ws/v5/public`、`op":"subscribe"` 消息格式)
- SBE / binary schemas: https://www.okx.com/docs-v5/log_zh/xml/okx_sbe_1_0.xml  (低延迟二进制格式的 XML schema)
- REST Candles (历史 K 线): https://www.okx.com/docs-v5/zh/#rest-api-market-data-get-candlesticks

### WebSocket 心跳机制

| 项目 | 说明 |
|------|------|
| **心跳模式** | 主动模式 (客户端主动发送心跳) |
| **心跳格式** | 发送文本 `"ping"`，期望收到 `"pong"` |
| **推荐间隔** | 小于 30 秒 (建议 15-25 秒) |
| **超时断连** | 30 秒内无数据则断开连接 |
| **K线推送频率** | 实时推送 |

**实现方式：**
```go
// 使用 SetHeartbeatFunc() 设置主动心跳模式
session.SetHeartbeatFunc(func() (int, []byte) {
    return websocket.TextMessage, []byte("ping")
})

// 消息处理中需要过滤 pong 响应：
func handleMessage(data []byte) {
    if string(data) == "pong" {
        return // 忽略心跳响应
    }
    // ... 处理其他消息
}
```

### WebSocket 连接限制
- 连接限制：每秒 3 次请求 (基于 IP)
- 每连接每小时最多 480 次 subscribe/unsubscribe/login 请求

---

## 心跳模式对比

| 交易所 | 心跳模式 | 发送方 | 格式 | 间隔 | 超时 |
|--------|----------|--------|------|------|------|
| Binance | 被动 | 服务端 Ping | WebSocket Ping/Pong 帧 | 3 分钟 | 10 分钟 |
| OKX | 主动 | 客户端 ping | 文本 `"ping"` / `"pong"` | < 30 秒 | 30 秒 |

---

**Rust / Libraries / Docs（用于实现 agent 的抓取/解析）**
- `binance` crate (crates.io + docs.rs): https://crates.io/crates/binance  and  https://docs.rs/binance  (支持 REST + WS，包含 kline/trades/depth 示例)
- `binance-rs` 项目页（GH）: https://github.com/wisespace-io/binance-rs  (参考实现与示例代码)
- OKX: 官方无广泛认可的 Rust SDK，建议使用 `tokio-tungstenite` / `async-tungstenite` + `reqwest` 根据上面 OKX 文档直接实现 WS/REST 消息处理

**实践要点（Agent 使用注意）**
- 时间戳: 使用交易所返回的时间戳（通常是毫秒），不要用服务器本地时间来决定周期边界。
- Kline 完成判定: 使用 kline payload 中的闭合标识（Binance 的 `k.x` 或 OKX 的 `confirm`/配套字段）来判断周期已结束并 flush 桶。
- Depth 本地重建: 先用 REST snapshot（Binance depth snapshot; OKX 同类接口），然后用 WS diff/增量消息按文档中的步骤更新本地 orderbook。
- Trade 买卖方向: 从 trade 消息解出买卖方向（如 `side`、`isBuyerMaker`、`m` 等）以计算 `buy_volume` / `sell_volume`。
- 连接与限频: 注意 WS 订阅/连接限制（最大 streams、消息速率）；必要时合并流或做订阅调度。


