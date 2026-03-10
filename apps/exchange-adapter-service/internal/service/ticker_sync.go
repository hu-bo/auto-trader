package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"exchange-adapter-service/internal/storage"
	"exchange-adapter-service/internal/utils"

	binanceAdapter "github.com/pkg/exchange-adapter/exchanges/binance"
	okxAdapter "github.com/pkg/exchange-adapter/exchanges/okx"
	"github.com/pkg/exchange-adapter/marketdata"
	"github.com/pkg/logger"
)

var logTicker = logger.Module("ticker-sync")

type TickerSyncService struct {
	redis        *storage.RedisClient
	binanceWS    *binanceAdapter.WsPublicAdapter
	okxWS        *okxAdapter.WsPublicAdapter
	stopChan     chan struct{}
	wg           sync.WaitGroup
	tickerCache  *utils.Cache[*TickerData]
	volumeFilter float64
	proxySOCKS   string
}

type TickerData struct {
	Exchange       string  `json:"exchange"`
	Symbol         string  `json:"symbol"`
	TradeType      string  `json:"tradeType"`
	LastPrice      float64 `json:"lastPrice"`
	LastSz         float64 `json:"lastSz"`
	PriceChange    float64 `json:"priceChange"`
	PriceChangePct float64 `json:"priceChangePct"`
	High24h        float64 `json:"high24h"`
	Low24h         float64 `json:"low24h"`
	Volume24h      float64 `json:"volume24h"`
	QuoteVolume    float64 `json:"quoteVolume24h"`
	Timestamp      int64   `json:"timestamp"`
	UpdatedAt      int64   `json:"updatedAt"`
}

func NewTickerSyncService(redis *storage.RedisClient, proxyHTTP, proxySOCKS string) *TickerSyncService {
	return &TickerSyncService{
		redis:        redis,
		stopChan:     make(chan struct{}),
		tickerCache:  utils.NewCache[*TickerData](),
		volumeFilter: 0.3, // Filter bottom 30% by volume
		proxySOCKS:   proxySOCKS,
	}
}

func (s *TickerSyncService) Start(ctx context.Context) error {
	if s.redis == nil {
		return fmt.Errorf("redis client not configured")
	}

	logTicker.Info().Msg("Starting ticker sync service with WebSocket streams")

	// Initialize Binance WebSocket adapter
	s.binanceWS = binanceAdapter.NewWsPublicAdapter(binanceAdapter.WsPublicAdapterOptions{
		SocksProxy:        s.proxySOCKS,
		HeartbeatInterval: 30 * time.Second,
		ReconnectInterval: 15 * time.Second,
		Proxy:             s.proxySOCKS,
	})

	// Initialize OKX WebSocket adapter
	s.okxWS = okxAdapter.NewWsPublicAdapter(okxAdapter.WsPublicAdapterOptions{
		SocksProxy:        s.proxySOCKS,
		ReconnectInterval: 15 * time.Second,
		Proxy:             s.proxySOCKS,
	})

	// Connect WebSocket clients
	if err := s.binanceWS.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect Binance WebSocket: %w", err)
	}
	if err := s.okxWS.Connect(ctx); err != nil {
		return fmt.Errorf("failed to connect OKX WebSocket: %w", err)
	}

	logTicker.Info().Msg("WebSocket clients connected")

	// Initialize active symbols (filter by volume)
	tradeTypes := []marketdata.TradeType{marketdata.Spot, marketdata.Futures}

	logTicker.Info().Msg("Initializing Binance symbols...")
	if err := s.binanceWS.InitSymbols(ctx, tradeTypes, nil, s.volumeFilter); err != nil {
		return fmt.Errorf("failed to initialize Binance symbols: %w", err)
	}

	logTicker.Info().Msg("Initializing OKX symbols...")
	if err := s.okxWS.InitSymbols(ctx, tradeTypes, nil, s.volumeFilter); err != nil {
		return fmt.Errorf("failed to initialize OKX symbols: %w", err)
	}

	// Log symbol counts
	binanceSpotCount := len(s.binanceWS.GetActiveSymbols(marketdata.Spot))
	binanceFuturesCount := len(s.binanceWS.GetActiveSymbols(marketdata.Futures))
	okxSpotCount := len(s.okxWS.GetActiveSymbols(marketdata.Spot))
	okxFuturesCount := len(s.okxWS.GetActiveSymbols(marketdata.Futures))

	logTicker.Info().
		Int("binanceSpot", binanceSpotCount).
		Int("binanceFutures", binanceFuturesCount).
		Int("okxSpot", okxSpotCount).
		Int("okxFutures", okxFuturesCount).
		Msg("Active symbols initialized")

	// Setup ticker handlers
	s.binanceWS.OnTickerAll(s.handleBinanceTicker)
	s.okxWS.OnTickerAll(s.handleOKXTicker)

	// Setup error handlers
	s.binanceWS.OnError(func(err error) {
		logTicker.Error().Err(err).Msg("Binance WebSocket error")
	})
	s.okxWS.OnError(func(err error) {
		logTicker.Error().Err(err).Msg("OKX WebSocket error")
	})

	// Subscribe to ticker streams
	logTicker.Info().Msg("Subscribing to Binance ticker streams...")
	binanceSubErr := s.binanceWS.SubMultiPeriodCandles(tradeTypes)
	if binanceSubErr != nil {
		logTicker.Error().Err(binanceSubErr).Msg("Failed to subscribe Binance tickers")
	}

	logTicker.Info().Msg("Subscribing to OKX ticker streams...")
	okxSubErr := s.okxWS.SubMultiPeriodCandles(tradeTypes)
	if okxSubErr != nil {
		logTicker.Error().Err(okxSubErr).Msg("Failed to subscribe OKX tickers")
	}

	if binanceSubErr != nil && okxSubErr != nil {
		return fmt.Errorf("failed to subscribe ticker streams: binance=%v, okx=%v", binanceSubErr, okxSubErr)
	}

	logTicker.Info().Msg("Ticker streams subscribed successfully")

	// Start background sync to Redis
	s.wg.Add(1)
	go s.syncToRedis(ctx)

	return nil
}

func (s *TickerSyncService) Stop() {
	logTicker.Info().Msg("Stopping ticker sync service")
	close(s.stopChan)
	s.wg.Wait()

	if s.binanceWS != nil {
		_ = s.binanceWS.Close()
	}
	if s.okxWS != nil {
		_ = s.okxWS.Close()
	}
}

func (s *TickerSyncService) handleBinanceTicker(ticker marketdata.TickerUpdate) {
	now := time.Now().UnixMilli()

	tickerData := &TickerData{
		Exchange:       "binance",
		Symbol:         ticker.Symbol,
		TradeType:      string(ticker.TradeType),
		LastPrice:      ticker.LastPrice,
		LastSz:         ticker.LastSz,
		PriceChange:    utils.RoundFloat(ticker.PriceChange, 4),
		PriceChangePct: utils.RoundFloat(ticker.PriceChangePct, 4),
		High24h:        ticker.High24h,
		Low24h:         ticker.Low24h,
		Volume24h:      ticker.Volume24h,
		QuoteVolume:    ticker.QuoteVolume24h,
		Timestamp:      ticker.Timestamp,
		UpdatedAt:      now,
	}

	key := s.getTickerKey("binance", ticker.Symbol, string(ticker.TradeType))
	s.tickerCache.Set(key, tickerData, 0)
}

func (s *TickerSyncService) handleOKXTicker(ticker marketdata.TickerUpdate) {
	now := time.Now().UnixMilli()

	tickerData := &TickerData{
		Exchange:       "okx",
		Symbol:         ticker.Symbol,
		TradeType:      string(ticker.TradeType),
		LastPrice:      ticker.LastPrice,
		LastSz:         ticker.LastSz,
		PriceChange:    utils.RoundFloat(ticker.PriceChange, 4),
		PriceChangePct: utils.RoundFloat(ticker.PriceChangePct, 4),
		High24h:        ticker.High24h,
		Low24h:         ticker.Low24h,
		Volume24h:      ticker.Volume24h,
		QuoteVolume:    ticker.QuoteVolume24h,
		Timestamp:      ticker.Timestamp,
		UpdatedAt:      now,
	}

	key := s.getTickerKey("okx", ticker.Symbol, string(ticker.TradeType))
	s.tickerCache.Set(key, tickerData, 0)
}

func (s *TickerSyncService) syncToRedis(ctx context.Context) {
	defer s.wg.Done()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.flushToRedis(ctx)
		}
	}
}

func (s *TickerSyncService) flushToRedis(ctx context.Context) {
	snapshot := s.tickerCache.Snapshot()
	if len(snapshot) == 0 {
		return
	}

	tickers := make(map[string]interface{}, len(snapshot))
	for k, v := range snapshot {
		tickers[k] = v
	}

	// Batch save to Redis with 60s expiration
	if err := s.redis.MSet(ctx, tickers, 60*time.Second); err != nil {
		logTicker.Error().
			Err(err).
			Int("count", len(tickers)).
			Msg("Failed to save tickers to Redis")
	} else {
		logTicker.Debug().
			Int("count", len(tickers)).
			Msg("Synced tickers to Redis")
	}
}

func (s *TickerSyncService) getTickerKey(exchange, symbol, tradeType string) string {
	return fmt.Sprintf("ticker:%s:%s:%s", exchange, tradeType, symbol)
}

func (s *TickerSyncService) GetTicker(ctx context.Context, exchange, symbol, tradeType string) (*TickerData, error) {
	key := s.getTickerKey(exchange, symbol, tradeType)

	// Try cache first
	if ticker, ok := s.tickerCache.Get(key); ok {
		return ticker, nil
	}

	// Fallback to Redis
	var ticker TickerData
	if err := s.redis.Get(ctx, key, &ticker); err != nil {
		return nil, err
	}
	return &ticker, nil
}

// GetTickerPriceMap 返回 symbol -> lastPrice 的映射
func (s *TickerSyncService) GetTickerPriceMap(exchange, tradeType string) map[string]float64 {
	prefix := fmt.Sprintf("ticker:%s:%s:", exchange, tradeType)
	priceMap := make(map[string]float64)
	s.tickerCache.Range(func(key string, ticker *TickerData) bool {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			priceMap[ticker.Symbol] = ticker.LastPrice
		}
		return true
	})
	return priceMap
}

func (s *TickerSyncService) GetTickers(ctx context.Context, exchange, tradeType string) ([]TickerData, error) {
	// Try cache first
	prefix := fmt.Sprintf("ticker:%s:%s:", exchange, tradeType)
	tickers := make([]TickerData, 0)
	s.tickerCache.Range(func(key string, ticker *TickerData) bool {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			tickers = append(tickers, *ticker)
		}
		return true
	})

	if len(tickers) > 0 {
		logTicker.Debug().
			Str("exchange", exchange).
			Str("tradeType", tradeType).
			Int("count", len(tickers)).
			Msg("GetTickers from cache")
		return tickers, nil
	}

	// Fallback to Redis
	pattern := fmt.Sprintf("ticker:%s:%s:*", exchange, tradeType)
	keys, err := s.redis.Keys(ctx, pattern)
	if err != nil {
		return nil, err
	}

	if len(keys) == 0 {
		logTicker.Warn().
			Str("exchange", exchange).
			Str("tradeType", tradeType).
			Msg("No tickers found in cache or Redis")
		return []TickerData{}, nil
	}

	// Get all tickers from Redis
	dataMap, err := s.redis.MGet(ctx, keys)
	if err != nil {
		return nil, err
	}

	tickers = make([]TickerData, 0, len(dataMap))
	for _, data := range dataMap {
		var ticker TickerData
		if err := json.Unmarshal(data, &ticker); err == nil {
			tickers = append(tickers, ticker)
		}
	}

	logTicker.Debug().
		Str("exchange", exchange).
		Str("tradeType", tradeType).
		Int("count", len(tickers)).
		Msg("GetTickers from Redis")

	return tickers, nil
}
