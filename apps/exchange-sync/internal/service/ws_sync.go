package service

import (
	"context"
	"sync"
	"time"

	"exchange-sync/internal/config"
	"exchange-sync/internal/publisher"
	"exchange-sync/internal/storage"
	"exchange-sync/pkg/logger"
	"exchange-sync/pkg/utils"

	"github.com/pkg/exchange-adapter/aggregator"
	exbinance "github.com/pkg/exchange-adapter/exchanges/binance"
	exokx "github.com/pkg/exchange-adapter/exchanges/okx"
	exchange "github.com/pkg/exchange-adapter/marketdata"
)

var logWs = logger.Module("ws-sync")

// aggKey 聚合器缓存 key
type aggKey struct {
	Exchange  exchange.ExchangeName
	TradeType exchange.TradeType
}

// WsSyncService WebSocket 实时同步服务
type WsSyncService struct {
	cfg  *config.Config
	repo storage.Repository

	// 交易所客户端
	clients map[exchange.ExchangeName]exchange.Exchange

	// 每个交易所+交易类型的聚合器和订单簿管理器
	aggregators   map[aggKey]*aggregator.PeriodAggregator
	orderBookMgrs map[aggKey]*aggregator.OrderBookManager
	aggMu         sync.RWMutex // 保护 aggregators 和 orderBookMgrs

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
		aggregators:     make(map[aggKey]*aggregator.PeriodAggregator),
		orderBookMgrs:   make(map[aggKey]*aggregator.OrderBookManager),
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
			cfg.Database.BatchSize,
			cfg.Database.BatchInterval(),
			s.saveCandlesBatch,
		)
	}

	// 初始化交易所客户端
	s.initClients()

	return s
}

func (s *WsSyncService) initClients() {
	heartbeat := time.Duration(s.cfg.Sync.HeartbeatIntervalSec) * time.Second
	reconnect := time.Duration(s.cfg.Sync.ReconnectIntervalSec) * time.Second

	// Binance (WebSocket 使用 SOCKS5 代理)
	binanceClient := exbinance.NewWsPublicAdapter(exbinance.WsPublicAdapterOptions{
		SocksProxy:         s.cfg.Proxy.Socks5,
		HeartbeatInterval:  heartbeat,
		ReconnectInterval:  reconnect,
		SubscribeAggTrades: true,
	})
	s.clients[exchange.Binance] = binanceClient

	// OKX (WebSocket 使用 SOCKS5 代理)
	okxClient := exokx.NewWsPublicAdapter(exokx.WsPublicAdapterOptions{
		SocksProxy:        s.cfg.Proxy.Socks5,
		ReconnectInterval: reconnect,
	})
	s.clients[exchange.OKX] = okxClient

	// 设置回调
	s.setupCallbacks()
}

// getOrCreateAggregator 获取或创建聚合器
func (s *WsSyncService) getOrCreateAggregator(exchangeName exchange.ExchangeName, tradeType exchange.TradeType) *aggregator.PeriodAggregator {
	key := aggKey{Exchange: exchangeName, TradeType: tradeType}

	s.aggMu.RLock()
	agg, ok := s.aggregators[key]
	s.aggMu.RUnlock()
	if ok {
		return agg
	}

	s.aggMu.Lock()
	defer s.aggMu.Unlock()

	// 双重检查
	if agg, ok = s.aggregators[key]; ok {
		return agg
	}

	// 创建新聚合器
	var cfg aggregator.MultiPeriodConfig
	switch exchangeName {
	case exchange.Binance:
		cfg = aggregator.BinanceMultiPeriodConfig()
	case exchange.OKX:
		cfg = aggregator.OKXMultiPeriodConfig()
	default:
		cfg = aggregator.DefaultMultiPeriodConfig(string(exchangeName))
	}

	agg = aggregator.NewMultiPeriodAggregator(cfg)
	s.setupAggregatorCallbacks(agg)
	s.aggregators[key] = agg

	logWs.Info().
		Str("exchange", string(exchangeName)).
		Str("tradeType", string(tradeType)).
		Msg("Created new aggregator")

	return agg
}

// getOrCreateOrderBookManager 获取或创建订单簿管理器
func (s *WsSyncService) getOrCreateOrderBookManager(exchangeName exchange.ExchangeName, tradeType exchange.TradeType) *aggregator.OrderBookManager {
	key := aggKey{Exchange: exchangeName, TradeType: tradeType}

	s.aggMu.RLock()
	obm, ok := s.orderBookMgrs[key]
	s.aggMu.RUnlock()
	if ok {
		return obm
	}

	s.aggMu.Lock()
	defer s.aggMu.Unlock()

	// 双重检查
	if obm, ok = s.orderBookMgrs[key]; ok {
		return obm
	}

	// 创建新订单簿管理器
	obm = aggregator.NewOrderBookManager(s.cfg.BigOrder.ThresholdUSD, s.cfg.BigOrder.ExpireHours)
	s.setupOrderBookCallbacks(obm, exchangeName, tradeType)
	s.orderBookMgrs[key] = obm

	logWs.Info().
		Str("exchange", string(exchangeName)).
		Str("tradeType", string(tradeType)).
		Msg("Created new orderbook manager")

	return obm
}

func (s *WsSyncService) setupCallbacks() {
	for name, client := range s.clients {
		exchangeName := name

		// K线回调 - 根据 tradeType 路由到对应聚合器
		client.OnKline(func(kline exchange.Kline) {
			agg := s.getOrCreateAggregator(exchangeName, kline.TradeType)
			agg.ProcessKline(kline)
		})

		// 成交回调 - 根据 tradeType 路由到对应聚合器
		client.OnTrade(func(trade exchange.Trade) {
			agg := s.getOrCreateAggregator(exchangeName, trade.TradeType)
			agg.ProcessTrade(trade)
		})

		// 深度回调 - 根据 tradeType 路由到对应订单簿管理器
		client.OnDepth(func(depth exchange.DepthUpdate) {
			obm := s.getOrCreateOrderBookManager(exchangeName, depth.TradeType)
			obm.ProcessDepth(depth)
			// js, _ := json.MarshalIndent(depth, "", " ")
			// println(string(js))
		})

		// 24h Ticker 回调 - 用于缓存交易额/涨幅
		client.OnMiniTicker(func(ticker exchange.MiniTicker) {
			if s.repo == nil {
				return
			}
			// throttle key: exchange:symbol:tradeType
			throttleKey := ticker.Exchange + ":" + ticker.Symbol + ":" + string(ticker.TradeType)
			s.tickerThrottler.TryExecute(throttleKey, func() {

				// js, err := json.Marshal(ticker)
				// if err != nil {
				// 	logWs.Warn().Err(err).Msg("Failed to marshal ticker")
				// } else {
				// 	logWs.Info().Str("ticker_json", string(js)).Msg("Ticker JSON")
				// }
				if err := s.repo.UpsertMiniTicker24h(s.ctx, ticker); err != nil {
					logWs.Warn().Err(err).
						Str("exchange", ticker.Exchange).
						Str("symbol", ticker.Symbol).
						Str("tradeType", string(ticker.TradeType)).
						Msg("Failed to upsert 24h ticker")
				}
			})
		})

		// 错误回调
		client.OnError(func(err error) {
			logWs.Error().Err(err).Str("exchange", string(exchangeName)).Msg("Exchange error")
		})
	}
}

// setupOrderBookCallbacks 设置订单簿回调
func (s *WsSyncService) setupOrderBookCallbacks(obm *aggregator.OrderBookManager, exchangeName exchange.ExchangeName, tradeType exchange.TradeType) {
	obm.OnUpdate(func(ob exchange.OrderBook) {
		// js, _ := json.MarshalIndent(ob, "", " ")
		// println(string(js))
		// 发布到 NATS
		if s.natsPublisher != nil {
			s.natsPublisher.PublishOrderBookFull(string(exchangeName), string(tradeType), ob)
		}
	})
}

// setupAggregatorCallbacks 设置聚合器回调
func (s *WsSyncService) setupAggregatorCallbacks(agg *aggregator.PeriodAggregator) {
	agg.OnPeriodComplete(func(candle exchange.NormalizedCandle) {
		// 写入数据库
		if s.batchProcessor != nil {
			s.batchProcessor.Add(candle)
		}
		// 发布到 NATS
		if s.natsPublisher != nil {
			s.natsPublisher.PublishCandle(candle)
		}
	})

	agg.OnUpdate(func(candle exchange.NormalizedCandle) {
		// 发布到 NATS
		if s.natsPublisher != nil {
			s.natsPublisher.PublishCandle(candle)
		}

		// 只对 15m 周期进行节流更新数据库，避免周期合并到最后一秒中断导致数据丢失
		if candle.Period == string(exchange.Period15m) && candle.BuyVolume > 0 && s.repo != nil {
			// 使用 exchange:symbol:tradeType:period 作为节流 key
			throttleKey := candle.Exchange + ":" + candle.Symbol + ":" + candle.TradeType + ":" + candle.Period
			s.updateThrottler.TryExecute(throttleKey, func() {
				// 仅在数据已存在时更新，不存在则忽略
				if _, err := s.repo.UpdateCandleIfExists(s.ctx, candle); err != nil {
					logWs.Warn().Err(err).
						Str("symbol", candle.Symbol).
						Str("period", candle.Period).
						Msg("Failed to update candle")
				}
			})
		}
	})
}

// Start 启动服务
func (s *WsSyncService) Start() error {
	for name, client := range s.clients {
		if err := client.Connect(s.ctx); err != nil {
			logWs.Error().Err(err).Str("exchange", string(name)).Msg("Failed to connect")
			continue
		}
			logWs.Info().Str("exchange", string(name)).Msg("Connected")

			if name == exchange.Binance {
				if bc, ok := client.(*exbinance.WsPublicAdapter); ok {
					if err := bc.SubFuturesMiniTicker(); err != nil {
						logWs.Warn().Err(err).Msg("Failed to subscribe Binance futures mini ticker")
					}
				}
		}
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
	client, ok := s.clients[exchangeName]
	if !ok {
		return nil
	}

	// 过滤已订阅的
	newSymbols := make([]exchange.SubscribeRequest, 0)
	s.subMu.Lock()
	for _, sym := range symbols {
		key := sym.Symbol + ":" + string(exchangeName) + ":" + string(sym.TradeType)
		if !s.subscribed[key] {
			s.subscribed[key] = true
			newSymbols = append(newSymbols, sym)
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
	return client.Subscribe(newSymbols)
}

// Unsubscribe 取消订阅
func (s *WsSyncService) Unsubscribe(exchangeName exchange.ExchangeName, symbols []string) error {
	client, ok := s.clients[exchangeName]
	if !ok {
		return nil
	}

	s.subMu.Lock()
	for _, sym := range symbols {
		delete(s.subscribed, sym+":"+string(exchangeName)+":spot")
		delete(s.subscribed, sym+":"+string(exchangeName)+":futures")
	}
	s.subMu.Unlock()

	return client.Unsubscribe(symbols)
}

// GetCurrentCandle 获取当前K线
func (s *WsSyncService) GetCurrentCandle(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string, period exchange.Period) *exchange.NormalizedCandle {
	key := aggKey{Exchange: exchangeName, TradeType: tradeType}
	s.aggMu.RLock()
	agg, ok := s.aggregators[key]
	s.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return agg.GetCurrentCandle(symbol, period)
}

// GetOrderBook 获取订单簿
func (s *WsSyncService) GetOrderBook(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string) *exchange.OrderBook {
	key := aggKey{Exchange: exchangeName, TradeType: tradeType}
	s.aggMu.RLock()
	obm, ok := s.orderBookMgrs[key]
	s.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return obm.GetOrderBook(symbol)
}

// GetFilteredOrderBook 获取过滤后的订单簿
func (s *WsSyncService) GetFilteredOrderBook(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string, priceRange float64) *exchange.OrderBook {
	key := aggKey{Exchange: exchangeName, TradeType: tradeType}
	s.aggMu.RLock()
	obm, ok := s.orderBookMgrs[key]
	s.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return obm.GetFilteredBook(symbol, priceRange)
}

// GetTracePrice 获取追踪价格
func (s *WsSyncService) GetTracePrice(exchangeName exchange.ExchangeName, tradeType exchange.TradeType, symbol string, distance float64) *aggregator.TracePriceResult {
	key := aggKey{Exchange: exchangeName, TradeType: tradeType}
	s.aggMu.RLock()
	obm, ok := s.orderBookMgrs[key]
	s.aggMu.RUnlock()
	if !ok {
		return nil
	}
	return obm.GetTracePrice(symbol, distance)
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

	// 关闭聚合器
	for _, agg := range s.aggregators {
		agg.Close()
	}

	// 关闭订单簿管理器
	for _, obm := range s.orderBookMgrs {
		obm.Close()
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
