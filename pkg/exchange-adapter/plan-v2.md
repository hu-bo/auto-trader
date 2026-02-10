# 订阅架构重构计划 v2

## 目标

重构订阅逻辑，分离关注点：
1. **量化服务订阅** (Ticker + Depth): 长效订阅，提供周期 K线 + OrderBook 数据
2. **K线独立订阅** (Kline): 支持 15m/4h/1d 周期，可临时订阅/取消

## 核心改动

### 1. 废弃 kline WebSocket 订阅用于主流程

原因：
- Ticker 数据已经足够聚合 K线（OHLC + BuyVolume=0）
- BuyVolume 无法从 Ticker 获取交易方向，固定为 0
- 减少订阅数量，降低复杂度

### 2. 订阅方式对比

| 功能 | Binance | OKX |
|------|---------|-----|
| Ticker | `!ticker@arr` 全局订阅所有 symbol | 需先获取产品列表，按 symbol 订阅 `tickers` |
| Depth | 按 symbol 订阅 `{symbol}@depth` | 按 symbol 订阅 `books` |
| Kline | 按 symbol 订阅 `{symbol}@kline_{period}` | 按 symbol 订阅 `candle{period}` |

### 3. 产品过滤逻辑

初始化时获取产品列表，过滤掉交易额后 30% 的产品：

**Binance:**
- Spot: `GET /api/v3/ticker/24hr` → 按 `quoteVolume` 排序
- Futures: `GET /fapi/v1/ticker/24hr` → 按 `quoteVolume` 排序

**OKX:**
- `GET /api/v5/market/tickers?instType=SPOT` → 按 `volCcy24h` 排序
- `GET /api/v5/market/tickers?instType=SWAP` → 按 `volCcy24h` 排序

过滤规则：
- 按 quoteVolume 降序排列
- 取前 70% 的产品自动订阅
- 后 30% 不自动订阅，但可通过 `SubscribeSymbol()` 手动订阅

## 新的接口设计

### Exchange 接口扩展

```go
// marketdata/types.go

// QuantSubscriber 量化服务订阅接口 (Ticker + Depth)
type QuantSubscriber interface {
    Exchange

    // InitSymbols 初始化产品列表（获取并过滤）
    // blacklist: 黑名单，不订阅的 symbol
    // volumeFilterPct: 交易额过滤百分比，如 0.3 表示过滤后 30%
    InitSymbols(ctx context.Context, tradeTypes []TradeType, blacklist []string, volumeFilterPct float64) error

    // GetActiveSymbols 获取已激活的产品列表
    GetActiveSymbols(tradeType TradeType) []string

    // SubMultiPeriodCandles 订阅量化数据流 (Ticker 全局 + Depth 按 symbol)
    // 返回的 channel 会推送周期 K线 和 OrderBook 数据
    SubMultiPeriodCandles(tradeTypes []TradeType) error

    // SubSymbolDepth 单独订阅某个 symbol 的深度（用于手动添加）
    SubSymbolDepth(symbol string, tradeType TradeType) error

    // UnsubSymbolDepth 取消订阅某个 symbol 的深度
    UnsubSymbolDepth(symbol string, tradeType TradeType) error
}

// KlineSubscriber K线独立订阅接口
type KlineSubscriber interface {
    Exchange

    // SubKline 订阅 K线（支持临时订阅）
    SubKline(symbols []SubscribeRequest, periods []Period) error

    // UnsubKline 取消订阅 K线
    UnsubKline(symbols []SubscribeRequest, periods []Period) error
}
```

### WSAggregator 统一入口

```go
// aggregator/ws_aggregator.go

// SubMultiPeriodCandles 量化服务入口（推荐使用）
// - 自动初始化产品列表
// - 订阅 Ticker 全局 + Depth 按 symbol
// - 返回周期 K线 (15m/4h/1d) + OrderBook 数据
func (a *WSAggregator) SubMultiPeriodCandles(opts QuantStreamOptions) error

type QuantStreamOptions struct {
    TradeTypes       []md.TradeType
    Blacklist        []string  // 黑名单
    VolumeFilterPct  float64   // 交易额过滤百分比，默认 0.3
    OnCandle         func(Candle15mEvent)
    OnOrderBook      func(OrderBookEvent)
}

// SubKline 独立 K线订阅（临时使用）
func (a *WSAggregator) SubKline(symbols []md.SubscribeRequest, periods []md.Period, handler func(md.Kline)) error

// UnsubKline 取消 K线订阅
func (a *WSAggregator) UnsubKline(symbols []md.SubscribeRequest, periods []md.Period) error
```

## Binance Adapter 改动

### ws_public_adapter.go

```go
type WsPublicAdapter struct {
    // ... 现有字段

    // 产品管理
    activeSymbols    map[TradeType][]string  // 已激活的产品列表
    activeSymbolsMu  sync.RWMutex

    // REST 客户端（用于获取产品列表）
    spotClient    *binanceapi.MainClient
    futuresClient *binanceapi.USDMClient
}

// InitSymbols 初始化产品列表
func (a *WsPublicAdapter) InitSymbols(ctx context.Context, tradeTypes []TradeType, blacklist []string, volumeFilterPct float64) error {
    for _, tt := range tradeTypes {
        var tickers []Ticker24hr
        switch tt {
        case Spot:
            // GET /api/v3/ticker/24hr
            tickers = a.spotClient.GetAll24hrTickers(ctx)
        case Futures:
            // GET /fapi/v1/ticker/24hr
            tickers = a.futuresClient.GetAll24hrTickers(ctx)
        }

        // 按 quoteVolume 降序排序
        sort.Slice(tickers, func(i, j int) bool {
            return tickers[i].QuoteVolume > tickers[j].QuoteVolume
        })

        // 取前 70%
        cutoff := int(float64(len(tickers)) * (1 - volumeFilterPct))
        activeSymbols := make([]string, 0, cutoff)
        for i := 0; i < cutoff; i++ {
            symbol := tickers[i].Symbol
            if !contains(blacklist, symbol) {
                activeSymbols = append(activeSymbols, symbol)
            }
        }

        a.activeSymbols[tt] = activeSymbols
    }
    return nil
}

// SubMultiPeriodCandles 订阅量化数据流
func (a *WsPublicAdapter) SubMultiPeriodCandles(tradeTypes []TradeType) error {
    for _, tt := range tradeTypes {
        // 1. 订阅 Ticker 全局 (已有)
        switch tt {
        case Spot:
            a.SubSpotTicker()  // !ticker@arr
        case Futures:
            a.SubFuturesTicker()  // !ticker@arr
        }

        // 2. 订阅 Depth 按 symbol
        symbols := a.activeSymbols[tt]
        for _, symbol := range symbols {
            a.subSymbolDepth(symbol, tt)
        }
    }
    return nil
}

// subSymbolDepth 订阅单个 symbol 的深度
func (a *WsPublicAdapter) subSymbolDepth(symbol string, tradeType TradeType) error {
    conn, _ := a.ensureConn(tradeType)
    rawSymbol := strings.ToLower(unifiedToRawSymbol(symbol, tradeType))
    return conn.ws.Subscribe(conn.wsKey, rawSymbol+"@depth")
}
```

## OKX Adapter 改动

### ws_public_adapter.go

```go
type WsPublicAdapter struct {
    // ... 现有字段

    // 产品管理
    activeSymbols   map[TradeType][]string
    activeSymbolsMu sync.RWMutex

    // REST 客户端
    restClient *okxapi.RestClient
}

// InitSymbols 初始化产品列表
func (a *WsPublicAdapter) InitSymbols(ctx context.Context, tradeTypes []TradeType, blacklist []string, volumeFilterPct float64) error {
    for _, tt := range tradeTypes {
        instType := "SPOT"
        if tt == Futures {
            instType = "SWAP"
        }

        // GET /api/v5/market/tickers?instType=SPOT
        tickers := a.restClient.GetTickers(ctx, instType)

        // 按 volCcy24h 降序排序
        sort.Slice(tickers, func(i, j int) bool {
            return tickers[i].VolCcy24h > tickers[j].VolCcy24h
        })

        // 取前 70%
        cutoff := int(float64(len(tickers)) * (1 - volumeFilterPct))
        activeSymbols := make([]string, 0, cutoff)
        for i := 0; i < cutoff; i++ {
            symbol := normalizeSymbol(tickers[i].InstId, tt)
            if !contains(blacklist, symbol) {
                activeSymbols = append(activeSymbols, symbol)
            }
        }

        a.activeSymbols[tt] = activeSymbols
    }
    return nil
}

// SubMultiPeriodCandles 订阅量化数据流
func (a *WsPublicAdapter) SubMultiPeriodCandles(tradeTypes []TradeType) error {
    for _, tt := range tradeTypes {
        symbols := a.activeSymbols[tt]

        // OKX: 需要按 symbol 订阅 tickers + books
        args := make([]map[string]any, 0, len(symbols)*2)
        for _, symbol := range symbols {
            instId := toExchangeSymbol(OKX, symbol, tt)
            args = append(args,
                map[string]any{"channel": "tickers", "instId": instId},
                map[string]any{"channel": "books", "instId": instId},
            )
        }

        a.ws.Subscribe(a.ctx, args, nil)
    }
    return nil
}
```

## TickerAggregator 改动

```go
// aggregator/ticker_aggregator.go

// BuyVolume 固定为 0（Ticker 无交易方向信息）
func (a *TickerAggregator) updatePeriod(...) {
    // ...
    candle.BuyVolume = 0  // Ticker 无法获取交易方向，固定为 0
    // ...
}
```

## 数据流

### 量化服务数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                        初始化阶段                                    │
├─────────────────────────────────────────────────────────────────────┤
│  1. InitSymbols()                                                   │
│     ├─ Binance: GET /api/v3/ticker/24hr                            │
│     └─ OKX: GET /api/v5/market/tickers                              │
│                                                                     │
│  2. 按 quoteVolume/volCcy24h 排序，取前 70%                          │
│                                                                     │
│  3. 过滤黑名单                                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        订阅阶段                                      │
├─────────────────────────────────────────────────────────────────────┤
│  SubMultiPeriodCandles()                                                   │
│     │                                                               │
│     ├─ Binance:                                                     │
│     │    ├─ !ticker@arr (全局 Ticker)                               │
│     │    └─ {symbol}@depth × N (每个 symbol)                        │
│     │                                                               │
│     └─ OKX:                                                         │
│          ├─ {"channel":"tickers","instId":"xxx"} × N                │
│          └─ {"channel":"books","instId":"xxx"} × N                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        数据处理                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Ticker → TickerAggregator                                          │
│     ├─ 15m K线 (BuyVolume=0)                                        │
│     ├─ 4h K线 (BuyVolume=0)                                         │
│     └─ 1d K线 (BuyVolume=0)                                         │
│                                                                     │
│  Depth → OrderBookManager                                           │
│     └─ OrderBook (大单过滤)                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        回调输出                                      │
├─────────────────────────────────────────────────────────────────────┤
│  OnCandle(Candle15mEvent)     → 周期 K线 (15m/4h/1d)                 │
│  OnOrderBook(OrderBookEvent)  → 实时深度                             │
└─────────────────────────────────────────────────────────────────────┘
```

## 实现步骤

### Phase 1: 基础设施

1. 在 `binance-api` 添加 `GetAll24hrTickers()` 方法
2. 在 `okx-api` 添加 `GetTickers()` 方法
3. 修改 `WsPublicAdapter` 添加 REST 客户端字段

### Phase 2: 产品过滤

1. 实现 `InitSymbols()` 方法
2. 添加 `activeSymbols` 管理
3. 添加黑名单过滤逻辑

### Phase 3: 订阅重构

1. 实现 `SubMultiPeriodCandles()` 方法
2. 分离 Ticker 和 Depth 订阅
3. 实现 `SubKline()` / `UnsubKline()` 独立方法

### Phase 4: 聚合器改动

1. 修改 `TickerAggregator` 将 BuyVolume 固定为 0
2. 修改 `WSAggregator` 添加 `SubMultiPeriodCandles()` 入口
3. 废弃旧的 `SubCandle15m()` 方法（或标记 deprecated）

### Phase 5: 示例更新

1. 更新 `ticker_stream` 示例使用新 API
2. 添加 K线独立订阅示例

## 注意事项

1. **Binance Ticker 是全局的**: `!ticker@arr` 会推送所有 symbol，需要在回调中过滤
2. **OKX 需要按 symbol 订阅**: 无法全局订阅，需要遍历 activeSymbols
3. **BuyVolume 为 0**: Ticker 数据不包含交易方向，无法计算主动买入量
4. **Depth 订阅数量**: 过滤后约 70% 的产品，Binance/OKX 约 200-400 个 symbol
5. **连接限制**: Binance 单连接最多 200 个订阅，可能需要多连接
