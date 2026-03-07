package trading

import (
	"context"
	"fmt"
	"sync"
	"time"

	"exchange-adapter-service/internal/session"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/exchanges/binance"
	"github.com/pkg/exchange-adapter/exchanges/okx"
	"github.com/pkg/logger"
)

var log = logger.Module("trading.manager")

type WSConfig struct {
	AutoReconnect        bool
	ReconnectIntervalSec int
	MaxReconnectAttempts int
}

func (w WSConfig) ReconnectInterval() time.Duration {
	if w.ReconnectIntervalSec <= 0 {
		return 5 * time.Second
	}
	return time.Duration(w.ReconnectIntervalSec) * time.Second
}

type ManagerOptions struct {
	WS                   WSConfig
	AutoSubscribeOnOrder bool
}

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*sessionResources

	opts     ManagerOptions
	orderIdx *OrderIndex
	hub      *OrderUpdateHub

	onOrderUpdate         func(accountID string, update OrderUpdate)
	onOrderUpdateToken    func(token string, exchange core.Exchange, update OrderUpdate)
	onStrategyOrderUpdate func(accountID string, update StrategyOrderUpdate)
	onStrategyOrderUpdateToken func(token string, exchange core.Exchange, update StrategyOrderUpdate)
}

type sessionResources struct {
	cfg session.AccountConfig

	mu         sync.Mutex
	trade      core.TradeAdapter
	ws         core.WsUserDataAdapter
	subscribed map[core.TradeType]bool
}

func NewManager(opts ManagerOptions, orderIdx *OrderIndex, hub *OrderUpdateHub) *Manager {
	return &Manager{
		sessions: make(map[string]*sessionResources),
		opts:     opts,
		orderIdx: orderIdx,
		hub:      hub,
	}
}

func (m *Manager) SetOnOrderUpdate(fn func(accountID string, update OrderUpdate)) {
	m.onOrderUpdate = fn
}

func (m *Manager) SetOnOrderUpdateToken(fn func(token string, exchange core.Exchange, update OrderUpdate)) {
	m.onOrderUpdateToken = fn
}

func (m *Manager) SetOnStrategyOrderUpdate(fn func(accountID string, update StrategyOrderUpdate)) {
	m.onStrategyOrderUpdate = fn
}

func (m *Manager) SetOnStrategyOrderUpdateToken(fn func(token string, exchange core.Exchange, update StrategyOrderUpdate)) {
	m.onStrategyOrderUpdateToken = fn
}

func (m *Manager) CloseAll(ctx context.Context) {
	m.mu.RLock()
	tokens := make([]string, 0, len(m.sessions))
	for token := range m.sessions {
		tokens = append(tokens, token)
	}
	m.mu.RUnlock()

	for _, token := range tokens {
		m.CloseSession(ctx, token)
	}
}

func (m *Manager) CloseSession(ctx context.Context, token string) {
	if token == "" {
		return
	}

	var r *sessionResources
	m.mu.Lock()
	r = m.sessions[token]
	delete(m.sessions, token)
	m.mu.Unlock()

	if r == nil {
		return
	}

	// Close stream subscribers first to stop outbound fan-out.
	if m.hub != nil {
		m.hub.CloseToken(token)
	}
	if m.orderIdx != nil {
		m.orderIdx.DeleteToken(token)
	}

	r.mu.Lock()
	trade := r.trade
	ws := r.ws
	r.trade = nil
	r.ws = nil
	r.subscribed = nil
	r.mu.Unlock()

	if ws != nil {
		_ = ws.Close(ctx)
	}
	if trade != nil {
		_ = trade.Destroy(ctx)
	}
}

func (m *Manager) TradeAdapter(ctx context.Context, token string, cfg session.AccountConfig) (core.TradeAdapter, error) {
	r := m.getOrCreateSession(token, cfg)
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.trade != nil {
		return r.trade, nil
	}

	adapter, err := m.newTradeAdapter(cfg)
	if err != nil {
		return nil, err
	}
	r.trade = adapter
	return adapter, nil
}

func (m *Manager) EnsureWsSubscribed(ctx context.Context, token string, cfg session.AccountConfig, tradeType core.TradeType) error {
	if tradeType == "" {
		return fmt.Errorf("tradeType is required")
	}

	r := m.getOrCreateSession(token, cfg)
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.subscribed == nil {
		r.subscribed = make(map[core.TradeType]bool)
	}
	if r.subscribed[tradeType] {
		return nil
	}

	if r.ws == nil {
		ws, err := m.newWsUserDataAdapter(cfg)
		if err != nil {
			return err
		}
		r.ws = ws
	}

	autoReconnect := m.opts.WS.AutoReconnect
	reconnectInterval := m.opts.WS.ReconnectInterval()
	maxAttempts := m.opts.WS.MaxReconnectAttempts

	options := core.WsSubscribeOptions{
		TradeType:            tradeType,
		AutoReconnect:        &autoReconnect,
		ReconnectInterval:    &reconnectInterval,
		MaxReconnectAttempts: &maxAttempts,
	}

	err := r.ws.Subscribe(ctx, options, func(event core.WsUserDataEvent) {
		switch ev := event.(type) {
		case core.WsOrderUpdate:
			if m.orderIdx != nil {
				m.orderIdx.Upsert(token, ev.Symbol, ev.TradeType, ev.OrderID, ev.ClientOrderID)
			}
			upd := OrderUpdate{
				Symbol:         ev.Symbol,
				TradeType:      ev.TradeType,
				OrderID:        ev.OrderID,
				ClientOrderID:  ev.ClientOrderID,
				Side:           ev.Side,
				PositionSide:   ev.PositionSide,
				OrderType:      ev.OrderType,
				Status:         ev.Status,
				Price:          ev.Price,
				Quantity:       ev.Quantity,
				FilledQuantity: ev.FilledQuantity,
				AvgPrice:       ev.AvgPrice,
				Fee:            ev.Fee,
				FeeAsset:       ev.FeeAsset,
				ReduceOnly:     ev.ReduceOnly,
				UpdateTime:     ev.UpdateTime,
			}
			if m.hub != nil {
				m.hub.Publish(token, ev.TradeType, upd)
			}
			if m.onOrderUpdate != nil && r.cfg.AccountID != "" {
				m.onOrderUpdate(r.cfg.AccountID, upd)
			}
			if m.onOrderUpdateToken != nil {
				m.onOrderUpdateToken(token, r.cfg.Exchange, upd)
			}

		case core.WsStrategyOrderUpdate:
			supd := StrategyOrderUpdate{
				Symbol:       ev.Symbol,
				TradeType:    ev.TradeType,
				AlgoID:       ev.AlgoID,
				ClientAlgoID: ev.ClientAlgoID,
				Side:         ev.Side,
				PositionSide: ev.PositionSide,
				StrategyType: ev.StrategyType,
				Status:       ev.Status,
				TriggerPrice: ev.TriggerPrice,
				OrderPrice:   ev.OrderPrice,
				Quantity:     ev.Quantity,
				TriggerTime:  ev.TriggerTime,
				UpdateTime:   ev.UpdateTime,
			}
			if m.onStrategyOrderUpdate != nil && r.cfg.AccountID != "" {
				m.onStrategyOrderUpdate(r.cfg.AccountID, supd)
			}
			if m.onStrategyOrderUpdateToken != nil {
				m.onStrategyOrderUpdateToken(token, r.cfg.Exchange, supd)
			}
		}
	})
	if err != nil {
		return err
	}

	r.subscribed[tradeType] = true
	log.Info().
		Str("token", token).
		Str("exchange", string(cfg.Exchange)).
		Str("trade_type", string(tradeType)).
		Msg("WS subscribed")
	return nil
}

// MaybeUnsubscribe is a best-effort resource cleanup:
// - if AutoSubscribeOnOrder is enabled, keep the WS subscription alive until token expiry/invalidation.
// - otherwise, unsubscribe when the last gRPC stream subscriber is gone.
func (m *Manager) MaybeUnsubscribe(ctx context.Context, token string, tradeType core.TradeType) {
	if m.opts.AutoSubscribeOnOrder {
		return
	}
	if m.hub != nil && m.hub.SubscriberCount(token, tradeType) > 0 {
		return
	}

	m.mu.RLock()
	r := m.sessions[token]
	m.mu.RUnlock()
	if r == nil {
		return
	}

	r.mu.Lock()
	ws := r.ws
	if ws == nil || r.subscribed == nil || !r.subscribed[tradeType] {
		r.mu.Unlock()
		return
	}
	delete(r.subscribed, tradeType)
	r.mu.Unlock()

	tt := tradeType
	_ = ws.Unsubscribe(ctx, &tt)
	log.Info().Str("token", token).Str("trade_type", string(tradeType)).Msg("WS unsubscribed (no subscribers)")
}

func (m *Manager) getOrCreateSession(token string, cfg session.AccountConfig) *sessionResources {
	m.mu.RLock()
	r := m.sessions[token]
	m.mu.RUnlock()
	if r != nil {
		return r
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if r = m.sessions[token]; r != nil {
		return r
	}
	r = &sessionResources{
		cfg: cfg,
	}
	m.sessions[token] = r
	return r
}

func (m *Manager) newTradeAdapter(cfg session.AccountConfig) (core.TradeAdapter, error) {
	opts := &core.AdapterOptions{
		HTTPSProxy: cfg.HTTPProxy,
		SOCKSProxy: cfg.Socks5Proxy,
		Demonet:    &cfg.Demonet,
	}
	switch cfg.Exchange {
	case core.ExchangeOKX:
		return okx.NewTradeAdapter(okx.TradeAdapterOptions{
			APIKey:    cfg.APIKey,
			APISecret: cfg.APISecret,
			APIPass:   cfg.Passphrase,
			Options:   opts,
		}), nil
	case core.ExchangeBinance:
		return binance.NewTradeAdapter(binance.TradeAdapterOptions{
			APIKey:    cfg.APIKey,
			APISecret: cfg.APISecret,
			Options:   opts,
		}), nil
	default:
		return nil, fmt.Errorf("unsupported exchange: %s", cfg.Exchange)
	}
}

func (m *Manager) newWsUserDataAdapter(cfg session.AccountConfig) (core.WsUserDataAdapter, error) {
	opts := &core.AdapterOptions{
		HTTPSProxy: cfg.HTTPProxy,
		SOCKSProxy: cfg.Socks5Proxy,
		Demonet:    &cfg.Demonet,
	}
	switch cfg.Exchange {
	case core.ExchangeOKX:
		return okx.NewWsUserDataAdapter(okx.WsUserDataAdapterOptions{
			APIKey:    cfg.APIKey,
			APISecret: cfg.APISecret,
			APIPass:   cfg.Passphrase,
			Options:   opts,
		}), nil
	case core.ExchangeBinance:
		return binance.NewWsUserDataAdapter(binance.WsUserDataAdapterOptions{
			APIKey:    cfg.APIKey,
			APISecret: cfg.APISecret,
			Options:   opts,
		}), nil
	default:
		return nil, fmt.Errorf("unsupported exchange: %s", cfg.Exchange)
	}
}
