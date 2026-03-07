package publisher

import (
	"context"
	"fmt"
	"sync"
	"time"

	"exchange-adapter-service/internal/config"

	"github.com/bytedance/sonic"
	"github.com/nats-io/nats.go"
	exchange "github.com/pkg/exchange-adapter/marketdata"
	"github.com/pkg/logger"
)

var log = logger.Module("nats-publisher")

const (
	defaultBatchWindow   = 200 * time.Millisecond
	defaultReconnectWait = 2 * time.Second
	defaultMaxReconnects = 10
	defaultCompress      = true
)

// Publisher NATS 发布器
type Publisher struct {
	cfg  *config.NATSConfig
	conn *nats.Conn

	// 批量聚合
	candleBatch    map[string]*exchange.NormalizedCandle // key: subject
	orderBookBatch map[string]*exchange.OrderBook        // key: subject
	batchMu        sync.Mutex
	batchTicker    *time.Ticker

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// New 创建 NATS 发布器
func New(cfg *config.NATSConfig) (*Publisher, error) {
	opts := []nats.Option{
		nats.Name("exchange-adapter-market-publisher"),
		nats.ReconnectWait(defaultReconnectWait),
		nats.MaxReconnects(defaultMaxReconnects),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			if err != nil {
				log.Warn().Err(err).Msg("NATS disconnected")
			}
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			log.Info().Str("url", nc.ConnectedUrl()).Msg("NATS reconnected")
		}),
		nats.ErrorHandler(func(nc *nats.Conn, sub *nats.Subscription, err error) {
			log.Error().Err(err).Msg("NATS error")
		}),
	}

	// NATS 认证
	if cfg.Username != "" && cfg.Password != "" {
		opts = append(opts, nats.UserInfo(cfg.Username, cfg.Password))
		log.Info().Str("username", cfg.Username).Msg("NATS authentication enabled")
	}

	if defaultCompress {
		opts = append(opts, nats.Compression(true))
	}

	conn, err := nats.Connect(cfg.URL, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to NATS: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	p := &Publisher{
		cfg:            cfg,
		conn:           conn,
		candleBatch:    make(map[string]*exchange.NormalizedCandle),
		orderBookBatch: make(map[string]*exchange.OrderBook),
		batchTicker:    time.NewTicker(defaultBatchWindow),
		ctx:            ctx,
		cancel:         cancel,
	}

	// 启动批量发送协程
	p.wg.Add(1)
	go p.batchLoop()

	log.Info().Str("url", cfg.URL).Msg("NATS publisher started")
	return p, nil
}

// PublishCandle 发布 K线更新（批量聚合）
func (p *Publisher) PublishCandle(candle exchange.NormalizedCandle) {
	subject := p.candleSubject(candle.Exchange, candle.TradeType, candle.Symbol, candle.Period)
	// data, _ := sonic.Marshal(candle)
	// fmt.Println(string(data))
	p.batchMu.Lock()
	p.candleBatch[subject] = &candle
	p.batchMu.Unlock()
}

// PublishOrderBook 发布订单簿更新（批量聚合）
func (p *Publisher) PublishOrderBook(ob exchange.OrderBook) {
	subject := p.orderBookSubject("", "", ob.Symbol) // TODO: 需要在 OrderBook 中添加 exchange 和 tradeType

	p.batchMu.Lock()
	p.orderBookBatch[subject] = &ob
	p.batchMu.Unlock()
}

// PublishOrderBookFull 发布订单簿更新（带完整信息）
func (p *Publisher) PublishOrderBookFull(exchangeName, tradeType string, ob exchange.OrderBook) {
	subject := p.orderBookSubject(exchangeName, tradeType, ob.Symbol)

	// log.Info().
	// 	Str("subject", subject).
	// 	Int("bids", len(ob.Bids)).
	// 	Int("asks", len(ob.Asks)).
	// 	Msg("Publishing orderbook")

	p.batchMu.Lock()
	p.orderBookBatch[subject] = &ob
	p.batchMu.Unlock()
}

// batchLoop 批量发送循环
func (p *Publisher) batchLoop() {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			// 发送剩余数据
			p.flush()
			return
		case <-p.batchTicker.C:
			p.flush()
		}
	}
}

// flush 刷新批量数据
func (p *Publisher) flush() {
	p.batchMu.Lock()
	candles := p.candleBatch
	orderBooks := p.orderBookBatch
	p.candleBatch = make(map[string]*exchange.NormalizedCandle)
	p.orderBookBatch = make(map[string]*exchange.OrderBook)
	p.batchMu.Unlock()

	// 发布 K线
	for subject, candle := range candles {
		data, err := sonic.Marshal(candle)
		if err != nil {
			log.Error().Err(err).Str("subject", subject).Msg("Failed to marshal candle")
			continue
		}
		if err := p.conn.Publish(subject, data); err != nil {
			log.Error().Err(err).Str("subject", subject).Msg("Failed to publish candle")
		}
	}

	// 发布订单簿
	for subject, ob := range orderBooks {
		data, err := sonic.Marshal(ob)
		if err != nil {
			log.Error().Err(err).Str("subject", subject).Msg("Failed to marshal orderbook")
			continue
		}
		if err := p.conn.Publish(subject, data); err != nil {
			log.Error().Err(err).Str("subject", subject).Msg("Failed to publish orderbook")
		}
	}
}

// candleSubject 生成 K线主题
// 格式: {prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}
func (p *Publisher) candleSubject(exchangeName, tradeType, symbol, period string) string {
	return fmt.Sprintf("%s.candle.%s.%s.%s.%s", p.cfg.SubjectPrefix, exchangeName, tradeType, symbol, period)
}

// orderBookSubject 生成订单簿主题
// 格式: {prefix}.orderbook.{exchange}.{tradeType}.{symbol}
func (p *Publisher) orderBookSubject(exchangeName, tradeType, symbol string) string {
	return fmt.Sprintf("%s.orderbook.%s.%s.%s", p.cfg.SubjectPrefix, exchangeName, tradeType, symbol)
}

// ============================================================================
// Order Update Publishing (immediate, not batched)
// ============================================================================

// OrderUpdateMessage represents a regular order update sent via NATS.
type OrderUpdateMessage struct {
	OrderID        string `json:"orderId"`
	ClientOrderID  string `json:"clientOrderId,omitempty"`
	Symbol         string `json:"symbol"`
	TradeType      string `json:"tradeType"`
	Side           string `json:"side"`
	PositionSide   string `json:"positionSide,omitempty"`
	OrderType      string `json:"orderType"`
	Status         string `json:"status"`
	Price          string `json:"price,omitempty"`
	Quantity       string `json:"quantity"`
	FilledQuantity string `json:"filledQuantity"`
	AvgPrice       string `json:"avgPrice,omitempty"`
	Fee            string `json:"fee,omitempty"`
	FeeAsset       string `json:"feeAsset,omitempty"`
	ReduceOnly     bool   `json:"reduceOnly"`
	UpdateTime     int64  `json:"updateTime"`
}

// StrategyOrderUpdateMessage represents a strategy/algo order update sent via NATS.
type StrategyOrderUpdateMessage struct {
	AlgoID       string `json:"algoId"`
	ClientAlgoID string `json:"clientAlgoId,omitempty"`
	Symbol       string `json:"symbol"`
	TradeType    string `json:"tradeType"`
	Side         string `json:"side"`
	PositionSide string `json:"positionSide,omitempty"`
	StrategyType string `json:"strategyType"`
	Status       string `json:"status"`
	TriggerPrice string `json:"triggerPrice,omitempty"`
	OrderPrice   string `json:"orderPrice,omitempty"`
	Quantity     string `json:"quantity"`
	TriggerTime  *int64 `json:"triggerTime,omitempty"`
	UpdateTime   int64  `json:"updateTime"`
}

// PublishOrderUpdate publishes an order update immediately (not batched).
func (p *Publisher) PublishOrderUpdate(accountID string, msg OrderUpdateMessage) {
	subject := fmt.Sprintf("%s.order_update.%s", p.cfg.SubjectPrefix, accountID)
	data, err := sonic.Marshal(msg)
	if err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to marshal order update")
		return
	}
	if err := p.conn.Publish(subject, data); err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to publish order update")
	}
}

// PublishOrderUpdateByToken publishes an order update using token-based subject.
// Subject format: {prefix}.order_update.{exchange}.{token}
func (p *Publisher) PublishOrderUpdateByToken(exchangeName, token string, msg OrderUpdateMessage) {
	subject := fmt.Sprintf("%s.order_update.%s.%s", p.cfg.SubjectPrefix, exchangeName, token)
	data, err := sonic.Marshal(msg)
	if err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to marshal order update")
		return
	}
	if err := p.conn.Publish(subject, data); err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to publish order update")
	}
}

// PublishStrategyOrderUpdate publishes a strategy order update immediately (not batched).
func (p *Publisher) PublishStrategyOrderUpdate(accountID string, msg StrategyOrderUpdateMessage) {
	subject := fmt.Sprintf("%s.strategy_order_update.%s", p.cfg.SubjectPrefix, accountID)
	data, err := sonic.Marshal(msg)
	if err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to marshal strategy order update")
		return
	}
	if err := p.conn.Publish(subject, data); err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to publish strategy order update")
	}
}

// PublishStrategyOrderUpdateByToken publishes a strategy order update using token-based subject.
// Subject format: {prefix}.strategy_order_update.{exchange}.{token}
func (p *Publisher) PublishStrategyOrderUpdateByToken(exchangeName, token string, msg StrategyOrderUpdateMessage) {
	subject := fmt.Sprintf("%s.strategy_order_update.%s.%s", p.cfg.SubjectPrefix, exchangeName, token)
	data, err := sonic.Marshal(msg)
	if err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to marshal strategy order update")
		return
	}
	if err := p.conn.Publish(subject, data); err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("Failed to publish strategy order update")
	}
}

// Close 关闭发布器
func (p *Publisher) Close() error {
	p.cancel()
	p.batchTicker.Stop()
	p.wg.Wait()

	if p.conn != nil {
		p.conn.Close()
	}

	log.Info().Msg("NATS publisher closed")
	return nil
}
