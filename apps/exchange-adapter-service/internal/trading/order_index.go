package trading

import (
	"sync"

	"github.com/pkg/exchange-adapter/core"
)

// OrderRef is the minimal information required to resolve CancelOrder/GetOrder.
// exchange APIs typically require (symbol, tradeType, exchangeOrderID).
type OrderRef struct {
	Symbol          string
	TradeType       core.TradeType
	ExchangeOrderID string
}

// OrderIndex keeps an in-memory mapping:
// - (token, exchangeOrderID) -> OrderRef
// - (token, clientOrderID)  -> OrderRef (with ExchangeOrderID filled)
//
// This addresses proto limitations where CancelOrder/GetOrder only carries order_id.
type OrderIndex struct {
	mu      sync.RWMutex
	byToken map[string]map[string]OrderRef
}

func NewOrderIndex() *OrderIndex {
	return &OrderIndex{
		byToken: make(map[string]map[string]OrderRef),
	}
}

func (i *OrderIndex) Upsert(token string, symbol string, tradeType core.TradeType, exchangeOrderID, clientOrderID string) {
	if token == "" || symbol == "" || tradeType == "" {
		return
	}
	if exchangeOrderID == "" && clientOrderID == "" {
		return
	}

	ref := OrderRef{Symbol: symbol, TradeType: tradeType, ExchangeOrderID: exchangeOrderID}

	i.mu.Lock()
	defer i.mu.Unlock()

	m := i.byToken[token]
	if m == nil {
		m = make(map[string]OrderRef)
		i.byToken[token] = m
	}

	if exchangeOrderID != "" {
		m[exchangeOrderID] = ref
	}
	if clientOrderID != "" {
		m[clientOrderID] = ref
	}
}

func (i *OrderIndex) Resolve(token string, anyOrderID string) (OrderRef, bool) {
	if token == "" || anyOrderID == "" {
		return OrderRef{}, false
	}
	i.mu.RLock()
	m := i.byToken[token]
	ref, ok := m[anyOrderID]
	i.mu.RUnlock()
	return ref, ok
}

func (i *OrderIndex) DeleteToken(token string) {
	if token == "" {
		return
	}
	i.mu.Lock()
	delete(i.byToken, token)
	i.mu.Unlock()
}
