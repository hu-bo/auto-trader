整理的 WebSocket 快速参考（Kline / Depth / Trades）

用途：供实现者和 agent 直接参考订阅格式、重要字段与快速示例（Rust / Go）。

Binance (WS)
- Endpoint (public): `wss://stream.binance.com:9443/ws` 或 `wss://stream.binance.com:9443/stream?streams=`
- Subscribe example (JSON over WS):

  {
    "method": "SUBSCRIBE",
    "params": ["btcusdt@kline_1m", "btcusdt@depth5"],
    "id": 1
  }

- Kline payload: contains `k` object with `t` (start), `T` (close), `o,h,l,c,v,V,Q,x` (`x` 表示 closed)
- Depth: use REST snapshot + `@depth` diff stream; follow docs for `U`/`u`/`lastUpdateId` matching

OKX (WS)
- Public endpoints: `/ws/v5/public` or `/ws/v5/business`
- Subscribe example:

  {
    "op": "subscribe",
    "args": [{ "channel": "candle1m", "instId": "BTC-USDT" }]
  }

- Kline payload: `data` is array of arrays: [ts, o, h, l, c, vol, ...], use `confirm` 或最后一条标志判定完成
- Depth: channels `books`, `books-l2-tbt`, `bbo-tbt` 等；建议先 GET snapshot，再按 `books-l2-tbt` 增量应用

Rust quick note
- For Binance: consider `binance` crate (docs.rs) for high-level usage.
- For direct WS: use `tokio-tungstenite` / `tokio` + `serde_json` 解析消息

Go quick note
- Use `gorilla/websocket` 或标准库 + `encoding/json`。

Examples are provided under `apps/exchange-sync/docs/examples/`.

