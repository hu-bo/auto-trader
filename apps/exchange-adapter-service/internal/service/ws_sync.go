package service

import (
	"context"
	"sync"
	"time"

	"exchange-adapter-service/internal/config"
	"exchange-adapter-service/internal/publisher"
	"exchange-adapter-service/internal/storage"
	"exchange-adapter-service/internal/utils"

	"github.com/pkg/exchange-adapter/aggregator"
	exbinance "github.com/pkg/exchange-adapter/exchanges/binance"
	exokx "github.com/pkg/exchange-adapter/exchanges/okx"
	exchange "github.com/pkg/exchange-adapter/marketdata"
	"github.com/pkg/logger"
)

var logWs = logger.Module("ws-sync")

const (
	defaultDBBatchSize     = 100
	defaultDBBatchInterval = 1 * time.Second

	defaultWSHeartbeatInterval = 30 * time.Second
	defaultWSReconnectInterval = 15 * time.Second

	defaultBigOrderThresholdUSD = 5000
	defaultBigOrderExpireHours  = 48
)

// WsSyncService WebSocket 实时同步服务
type WsSyncService struct {
	cfg  *config.Config
	repo storage.Repository

	// 交易所客户端
	clients map[exchange.ExchangeName]exchange.Exchange

	// 每个交易所对应的聚合订阅器（内部管理 PeriodAggregator/OrderBookManager）
	streams map[exchange.ExchangeName]*aggregator.WSAggregator

	// 批量写入处理器
	batchProcessor *utils.BatchProcessor[exchange.NormalizedCandle]

	// 15m 周期更新节流器 (每个 symbol 独立节流，10s 一次)
	updateThrottler *utils.KeyedThrottler

	// 24h ticker 更新节流器 (每个 symbol 独立节流，避免频繁写库)
	tickerThrottler *utils.KeyedThrottler

	// NATS 发布器
	natsPublisher *publisher.Publisher

	// 已订阅的交易对
	subscribed map[string]bool // symbol:exchange:tradeType -> true
	subMu      sync.RWMutex

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
	ready  chan struct{}
}

// NewWsSyncService 创建 WebSocket 同步服务
func NewWsSyncService(cfg *config.Config, repo storage.Repository, natsPublisher *publisher.Publisher) *WsSyncService {
	ctx, cancel := context.WithCancel(context.Background())

	s := &WsSyncService{
		cfg:             cfg,
		repo:            repo,
		clients:         make(map[exchange.ExchangeName]exchange.Exchange),
		streams:         make(map[exchange.ExchangeName]*aggregator.WSAggregator),
		subscribed:      make(map[string]bool),
		updateThrottler: utils.NewKeyedThrottler(10 * time.Second), // 每个 symbol 10s 一次
		tickerThrottler: utils.NewKeyedThrottler(5 * time.Second),  // 每个 symbol 5s 一次
		natsPublisher:   natsPublisher,
		ctx:             ctx,
		cancel:          cancel,
		ready:           make(chan struct{}),
	}

	// 初始化批量写入处理器
	if repo != nil {
		s.batchProcessor = utils.NewBatchProcessor(
			defaultDBBatchSize,
			defaultDBBatchInterval,
			s.saveCandlesBatch,
		)
	}

	// 初始化交易所客户端
	s.initClients()

	return s
}

func (s *WsSyncService) initClients() {
	heartbeat := defaultWSHeartbeatInterval
	reconnect := defaultWSReconnectInterval

	// Binance (WebSocket 使用 SOCKS5 代理)
	binanceClient := exbinance.NewWsPublicAdapter(exbinance.WsPublicAdapterOptions{
		SocksProxy:         s.cfg.Proxy.Socks5,
		HeartbeatInterval:  heartbeat,
		ReconnectInterval:  reconnect,
		SubscribeAggTrades: false,
	})
	s.clients[exchange.Binance] = binanceClient
	s.streams[exchange.Binance] = aggregator.NewWSAggregator(binanceClient, aggregator.WSAggregatorOptions{
		BigOrderThresholdUSD: defaultBigOrderThresholdUSD,
		BigOrderExpireHours:  defaultBigOrderExpireHours,
	})

	// OKX (WebSocket 使用 SOCKS5 代理)
	okxClient := exokx.NewWsPublicAdapter(exokx.WsPublicAdapterOptions{
		SocksProxy:        s.cfg.Proxy.Socks5,
		ReconnectInterval: reconnect,
	})
	s.clients[exchange.OKX] = okxClient
	s.streams[exchange.OKX] = aggregator.NewWSAggregator(okxClient, aggregator.WSAggregatorOptions{
		BigOrderThresholdUSD: defaultBigOrderThresholdUSD,
		BigOrderExpireHours:  defaultBigOrderExpireHours,
	})

	// 设置回调
	s.setupCallbacks()
}

func (s *WsSyncService) setupCallbacks() {
	for name, stream := range s.streams {
		exchangeName := name

		_ = stream.SubCandle15m(nil, func(event aggregator.Candle15mEvent) {
			candle := event.Candle

			if event.Closed {
				// 写入数据库（周期闭合）
				if s.batchProcessor != nil {
					s.batchProcessor.Add(candle)
				}
			}

			// 发布到 NATS（更新+闭合都发布）
			if s.natsPublisher != nil {
				s.natsPublisher.PublishCandle(candle)
			}

			// 只对 15m 更新进行节流写库，避免周期切换时中断导致数据丢失
			if !event.Closed && candle.Period == string(exchange.Period15m) && candle.BuyVolume > 0 && s.repo != nil {
				throttleKey := candle.Exchange + ":" + candle.Symbol + ":" + candle.TradeType + ":" + candle.Period
				s.updateThrottler.TryExecute(throttleKey, func() {
					if _, err := s.repo.UpdateCandleIfExists(s.ctx, candle); err != nil {
						logWs.Warn().Err(err).
							Str("symbol", candle.Symbol).
							Str("period", candle.Period).
							Msg("Failed to update candle")
					}
				})
			}
		})

		_ = stream.SubOrderbooks(nil, func(event aggregator.OrderBookEvent) {
			if s.natsPublisher != nil {
				s.natsPublisher.PublishOrderBookFull(string(event.Exchange), string(event.TradeType), event.OrderBook)
			}
		})

		_ = stream.SubMiniTicker(nil, func(ticker exchange.MiniTicker) {
			if s.repo == nil {
				return
			}
			throttleKey := ticker.Exchange + ":" + ticker.Symbol + ":" + string(ticker.TradeType)
			s.tickerThrottler.TryExecute(throttleKey, func() {
				if err := s.repo.UpsertMiniTicker24h(s.ctx, ticker); err != nil {
					logWs.Warn().Err(err).
						Str("exchange", ticker.Exchange).
						Str("symbol", ticker.Symbol).
						Str("tradeType", string(ticker.TradeType)).
						Msg("Failed to upsert 24h ticker")
				}
			})
		})

		stream.OnError(func(err error) {
			logWs.Error().Err(err).Str("exchange", string(exchangeName)).Msg("Exchange error")
		})
	}
}

// Start 启动服务
func (s *WsSyncService) Start() error {
	for name, client := range s.clients {
		if err := client.Connect(s.ctx); err != nil {
			logWs.Error().Err(err).Str("exchange", string(name)).Msg("Failed to connect")
			continue
		}
		logWs.Info().Str("exchange", string(name)).Msg("Connected")
	}

	close(s.ready)
	return nil
}

// WaitReady 等待服务就绪
func (s *WsSyncService) WaitReady(timeout time.Duration) error {
	select {
	case <-s.ready:
		return nil
	case <-time.After(timeout):
		return context.DeadlineExceeded
	}
}

// Subscribe 订阅交易对
func (s *WsSyncService) Subscribe(exchangeName exchange.ExchangeName, symbols []exchange.SubscribeRequest) error {
	stream, ok := s.streams[exchangeName]
	if !ok {
		return nil
	}

	// 过滤已订阅的
	newSymbols := make([]exchange.SubscribeRequest, 0)
	newKeys := make([]string, 0)
	s.subMu.Lock()
	for _, sym := range symbols {
		key := sym.Symbol + ":" + string(exchangeName) + ":" + string(sym.TradeType)
		if !s.subscribed[key] {
			s.subscribed[key] = true
			newSymbols = append(newSymbols, sym)
			newKeys = append(newKeys, key)
		}
	}
	s.subMu.Unlock()

	if len(newSymbols) == 0 {
		return nil
	}

	logWs.Info().
		Str("exchange", string(exchangeName)).
		Int("count", len(newSymbols)).
		Msg("Subscribing symbols")

	rollback := func() {
		s.subMu.Lock()
		for _, key := range newKeys {
			delete(s.subscribed, key)
		}
		s.subMu.Unlock()
	}

	if err := stream.SubCandle15m(newSymbols, nil); err != nil {
		rollback()
		return err
	}
	if err := stream.SubOrderbooks(newSymbols, nil); err != nil {
		rollback()
		return err
	}
	if err := stream.SubMiniTicker(newSymbols, nil); err != nil {
		rollback()
		return err
	}

	return nil
}

// Unsubscribe 取消订阅
func (s *WsSyncService) Unsubscribe(exchangeName exchange.ExchangeName, symbols []string) error {
	stream, ok := s.streams[exchangeName]
	if !ok {
		return nil
	}

	s.subMu.Lock()
	for _, sym := range symbols {
		delete(s.subscribed, sym+":"+string(exchangeName)+":spot")
		delete(s.subscribed, sym+":"+string(exchangeName)+":futures")
	}
	s.subMu.Unlock()

	return stream.Unsubscribe(symbols)
}

// SubscribeTickers 订阅所有 tickers (不需要指定 symbol)
// 内部使用 TickerAggregator 将 ticker 数据聚合成 15m/4h/1d K线
func (s *WsSyncService) SubscribeTickers(exchangeName exchange.ExchangeName, tradeTypes []exchange.TradeType) error {
	stream, ok := s.streams[exchangeName]
	if !ok {
		return nil
	}

	logWs.Info().
		Str("exchange", string(exchangeName)).
		Int("tradeTypes", len(tradeTypes)).
		Msg("Subscribing all tickers")

	return stream.SubTickers(tradeTypes, nil)
}

// GetCurrentCandle 获取当前K线
func (s *WsSyncService) GetCurrentCandle(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string, period exchange.Period) *exchange.NormalizedCandle {
	stream, ok := s.streams[exchangeName]
	if !ok {
		return nil
	}
	return stream.GetCurrentCandle(tradeType, symbol, period)
}

// GetOrderBook 获取订单簿
func (s *WsSyncService) GetOrderBook(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string) *exchange.OrderBook {
	stream, ok := s.streams[exchangeName]
	if !ok {
		return nil
	}
	return stream.GetOrderBook(tradeType, symbol)
}

// GetFilteredOrderBook 获取过滤后的订单簿
func (s *WsSyncService) GetFilteredOrderBook(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string, priceRange float64) *exchange.OrderBook {
	stream, ok := s.streams[exchangeName]
	if !ok {
		return nil
	}
	return stream.GetFilteredOrderBook(tradeType, symbol, priceRange)
}

// GetTracePrice 获取追踪价格
func (s *WsSyncService) GetTracePrice(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string, distance float64) *aggregator.TracePriceResult {
	stream, ok := s.streams[exchangeName]
	if !ok {
		return nil
	}
	return stream.GetTracePrice(tradeType, symbol, distance)
}

// Stop 停止服务
func (s *WsSyncService) Stop() error {
	s.cancel()

	// 关闭交易所客户端
	for name, client := range s.clients {
		if err := client.Close(); err != nil {
			logWs.Error().Err(err).Str("exchange", string(name)).Msg("Failed to close")
		}
	}

	// 关闭聚合订阅器
	for _, stream := range s.streams {
		stream.Close()
	}

	// 刷新批量处理器
	if s.batchProcessor != nil {
		if err := s.batchProcessor.Stop(); err != nil {
			logWs.Error().Err(err).Msg("Failed to stop batch processor")
		}
	}

	s.wg.Wait()
	return nil
}

func (s *WsSyncService) saveCandlesBatch(candles []exchange.NormalizedCandle) error {
	if s.repo == nil || len(candles) == 0 {
		return nil
	}

	err := s.repo.SaveCandles(context.Background(), candles)
	if err != nil {
		logWs.Warn().Err(err).Int("count", len(candles)).Msg("Batch save failed, trying single insert")
		// 降级为单条插入
		for _, candle := range candles {
			if err := s.repo.SaveCandle(context.Background(), candle); err != nil {
				logWs.Error().Err(err).Str("symbol", candle.Symbol).Msg("Single save failed")
			}
		}
	}
	return err
}
