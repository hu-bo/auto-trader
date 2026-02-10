package marketdata

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ExchangeName 交易所名称
type ExchangeName string

const (
	Binance ExchangeName = "binance"
	OKX     ExchangeName = "okx"
)

// TradeType 交易类型
type TradeType string

const (
	Spot    TradeType = "spot"
	Futures TradeType = "futures"
)

// Period K线周期
type Period string

const (
	Period1m  Period = "1m"
	Period5m  Period = "5m"
	Period15m Period = "15m"
	Period30m Period = "30m"
	Period1h  Period = "1h"
	Period4h  Period = "4h"
	Period1d  Period = "1d"
)

const (
	Minute = 60 * 1000
	Hour   = 60 * Minute
	Day    = 24 * Hour
)

var periodIntervalMs = map[Period]int64{
	Period1m:  1 * Minute,
	Period5m:  5 * Minute,
	Period15m: 15 * Minute,
	Period30m: 30 * Minute,
	Period1h:  1 * Hour,
	Period4h:  4 * Hour,
	Period1d:  1 * Day,
}

func (p Period) IntervalMs() int64 { return periodIntervalMs[p] }

func (p Period) IsValid() bool {
	_, ok := periodIntervalMs[p]
	return ok
}

// RoundToInterval 将时间戳对齐到周期起始时间 (ms).
func (p Period) RoundToInterval(ts int64) int64 {
	interval := p.IntervalMs()
	if interval == 0 {
		return ts
	}
	return (ts / interval) * interval
}

func (p Period) RoundTimeToInterval(t time.Time) time.Time {
	return time.UnixMilli(p.RoundToInterval(t.UnixMilli()))
}

func (p Period) NextInterval(ts int64) int64 {
	return p.RoundToInterval(ts) + p.IntervalMs()
}

func (p Period) PrevInterval(ts int64) int64 {
	return p.RoundToInterval(ts) - p.IntervalMs()
}

// SymbolInfo 统一的交易对信息
type SymbolInfo struct {
	Symbol            string   `json:"symbol"`            // 统一格式: BTC-USDT
	RawSymbol         string   `json:"rawSymbol"`         // 原始格式: BTCUSDT (Binance) / BTC-USDT-SWAP (OKX)
	BaseCurrency      string   `json:"baseCurrency"`      // 基础货币: BTC
	QuoteCurrency     string   `json:"quoteCurrency"`     // 计价货币: USDT
	TradeType         string   `json:"tradeType"`         // spot | futures
	TickSize          string   `json:"tickSize"`          // 最小价格变动
	StepSize          string   `json:"stepSize"`          // 最小数量变动
	MinQty            string   `json:"minQty"`            // 最小下单数量
	MaxQty            string   `json:"maxQty"`            // 最大下单数量
	QuantityPrecision int      `json:"quantityPrecision"` // 数量精度
	PricePrecision    int      `json:"pricePrecision"`    // 价格精度
	Status            string   `json:"status"`            // 交易对状态
	ContractValue     *float64 `json:"contractValue,omitempty"`
	MaxLeverage       *float64 `json:"maxLeverage,omitempty"`
	SyncEnabled       bool     `json:"syncEnabled"`    // 是否开启同步
	EarliestDataTs    int64    `json:"earliestDataTs"` // 最早同步到的数据时间戳（ms）
	LatestSyncTs      int64    `json:"latestSyncTs"`   // 最近一次同步到的时间戳（ms）

	// 24h Ticker (optional cache fields used by exchange-sync)
	OpenPrice24h      *float64 `json:"openPrice24h,omitempty"`      // 24h 开盘价
	LastPrice         *float64 `json:"lastPrice,omitempty"`         // 24h 最新价
	QuoteVolume24h    *float64 `json:"quoteVolume24h,omitempty"`    // 24h 成交量 (USDT)
	PriceChangePct24h *float64 `json:"priceChangePct24h,omitempty"` // 24h 价格变化百分比
	TickerEventTimeMs *int64   `json:"tickerEventTimeMs,omitempty"` // 事件时间 (ms)
}

// MiniTicker 24h Ticker
type MiniTicker struct {
	Symbol         string    `json:"symbol"`           // 交易对: BTC-USDT
	Exchange       string    `json:"exchange"`         // binance | okx
	TradeType      TradeType `json:"trade_type"`       // spot | futures
	EventTimeMs    int64     `json:"event_time_ms"`    // 事件时间 (ms)
	OpenPrice24h   float64   `json:"open_price_24h"`   // 24h 开盘价
	LastPrice      float64   `json:"last_price"`       // 24h 最新价
	QuoteVolume24h float64   `json:"quote_volume_24h"` // 24h 成交量
}

// TickerUpdate 用于 TickerAggregator 的 ticker 输入
// 用于从 ticker 流聚合成 K线
type TickerUpdate struct {
	Symbol    string    `json:"symbol"`      // 交易对: BTC-USDT
	Exchange  string    `json:"exchange"`    // binance | okx
	TradeType TradeType `json:"trade_type"`  // spot | futures
	LastPrice float64   `json:"last_price"`  // 最新成交价格
	LastSz    float64   `json:"last_sz"`     // 最新成交量 (Binance: Q, OKX: lastSz)
	Timestamp int64     `json:"timestamp"`   // 事件时间 (ms)
}

// SubscribeRequest 订阅请求
type SubscribeRequest struct {
	Symbol    string    `json:"symbol"`     // 统一格式: BTC-USDT
	TradeType TradeType `json:"trade_type"` // spot | futures
}

// NormalizedCandle 标准化K线
type NormalizedCandle struct {
	Symbol       string  `json:"symbol"`        // 交易对: BTC-USDT
	Exchange     string  `json:"exchange"`      // 交易所: binance | okx
	TradeType    string  `json:"trade_type"`    // 类型: spot | futures
	Period       string  `json:"period"`        // 周期: 15m | 4h | 1d
	Timestamp    int64   `json:"timestamp"`     // 周期起始时间 (毫秒)
	Open         float64 `json:"open"`          // 开盘价
	High         float64 `json:"high"`          // 最高价
	Low          float64 `json:"low"`           // 最低价
	Close        float64 `json:"close"`         // 收盘价
	Volume       float64 `json:"volume"`        // 总成交量
	BuyVolume    float64 `json:"buy_volume"`    // 主动买入成交量
	SymbolFamily string  `json:"symbol_family"` // 资产族: BTC, ETH
}

// Kline WebSocket K线数据
type Kline struct {
	Symbol    string    `json:"symbol"`     // 统一格式
	Exchange  string    `json:"exchange"`   // 交易所名
	TradeType TradeType `json:"trade_type"` // spot | futures
	Period    Period    `json:"period"`     // 周期
	Timestamp int64     `json:"timestamp"`  // 开盘时间 (毫秒)
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    float64   `json:"volume"`
	BuyVolume float64   `json:"buy_volume"` // 主动买入成交量
	Closed    bool      `json:"closed"`     // 是否已关闭
}

// Trade 成交数据
type Trade struct {
	Symbol    string    `json:"symbol"`
	Exchange  string    `json:"exchange"`
	TradeType TradeType `json:"trade_type"`
	Price     float64   `json:"price"`
	Quantity  float64   `json:"quantity"`
	Timestamp int64     `json:"timestamp"`
	IsBuy     bool      `json:"is_buy"` // 是否为买方成交
}

// DepthUpdate 深度更新
type DepthUpdate struct {
	Symbol    string       `json:"symbol"`
	Exchange  string       `json:"exchange"`
	TradeType TradeType    `json:"trade_type"`
	Bids      []DepthEntry `json:"bids"` // 买单 (价格降序)
	Asks      []DepthEntry `json:"asks"` // 卖单 (价格升序)
	Timestamp int64        `json:"timestamp"`
}

// DepthEntry 深度条目
type DepthEntry struct {
	Price    float64 `json:"price"`
	Quantity float64 `json:"quantity"`
}

// OrderBook 订单簿
type OrderBook struct {
	Symbol string           `json:"symbol"`
	Bids   []OrderBookEntry `json:"bids"`  // 买单 (价格降序, ≥$5000)
	Asks   []OrderBookEntry `json:"asks"`  // 卖单 (价格升序, ≥$5000)
	Price  float64          `json:"price"` // 当前价格
}

// OrderBookEntry 订单簿条目
type OrderBookEntry struct {
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	USDValue  float64 `json:"usd_value"`
	Timestamp int64   `json:"timestamp"`
}

// Exchange WebSocket 公共数据接口（用于 exchange-sync）
type Exchange interface {
	Name() ExchangeName
	Connect(ctx context.Context) error
	Subscribe(symbols []SubscribeRequest) error
	Unsubscribe(symbols []string) error
	Close() error
	OnKline(handler func(Kline))
	OnTrade(handler func(Trade))
	OnDepth(handler func(DepthUpdate))
	OnMiniTicker(handler func(MiniTicker))
	OnError(handler func(error))
}

// RESTClient REST API 客户端接口（用于 exchange-sync）
type RESTClient interface {
	Name() ExchangeName
	GetSymbols(ctx context.Context, tradeType TradeType) ([]SymbolInfo, error)
	GetCandles(ctx context.Context, symbol string, tradeType TradeType, period Period, startTime, endTime int64, limit int) ([]NormalizedCandle, error)
}

// NormalizeSymbol 将各交易所格式统一为 BTC-USDT 格式
func NormalizeSymbol(exchange ExchangeName, rawSymbol string, tradeType TradeType) string {
	switch exchange {
	case Binance:
		// BTCUSDT -> BTC-USDT
		if strings.HasSuffix(rawSymbol, "USDT") {
			base := strings.TrimSuffix(rawSymbol, "USDT")
			return base + "-USDT"
		}
		if strings.HasSuffix(rawSymbol, "BUSD") {
			base := strings.TrimSuffix(rawSymbol, "BUSD")
			return base + "-BUSD"
		}
		return rawSymbol
	case OKX:
		// OKX spot: BTC-USDT
		// OKX futures: BTC-USDT-SWAP -> BTC-USDT
		if tradeType == Futures && strings.HasSuffix(rawSymbol, "-SWAP") {
			return strings.TrimSuffix(rawSymbol, "-SWAP")
		}
		return rawSymbol
	default:
		return rawSymbol
	}
}

// ToExchangeSymbol 将统一格式转换为交易所格式
func ToExchangeSymbol(exchange ExchangeName, symbol string, tradeType TradeType) string {
	switch exchange {
	case Binance:
		// BTC-USDT -> BTCUSDT
		return strings.ReplaceAll(symbol, "-", "")
	case OKX:
		// OKX spot: BTC-USDT
		// OKX futures: BTC-USDT -> BTC-USDT-SWAP
		if tradeType == Futures && !strings.HasSuffix(symbol, "-SWAP") {
			return symbol + "-SWAP"
		}
		return symbol
	default:
		return symbol
	}
}

// ExtractSymbolFamily 从交易对中提取资产族
func ExtractSymbolFamily(symbol string) string {
	// BTC-USDT -> BTC
	parts := strings.Split(symbol, "-")
	if len(parts) > 0 {
		return parts[0]
	}
	return symbol
}

// CalculatePrecision 根据 tickSize/lotSz/stepSize 计算精度
// 例如: "0.01" -> 2, "0.001" -> 3, "0.00001" -> 5, "1" -> 0, "10" -> 0
func CalculatePrecision(size string) int {
	if size == "" {
		return 0
	}

	size = strings.TrimRight(size, "0")
	idx := strings.Index(size, ".")
	if idx == -1 {
		return 0
	}
	return len(size) - idx - 1
}

func ValidateSubscribeRequest(req SubscribeRequest) error {
	if req.Symbol == "" {
		return fmt.Errorf("symbol is required")
	}
	switch req.TradeType {
	case Spot, Futures:
		return nil
	default:
		return fmt.Errorf("invalid tradeType: %s", req.TradeType)
	}
}
