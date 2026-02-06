package trading

import (
	"sync"
	"sync/atomic"

	"github.com/pkg/exchange-adapter/core"
)

type OrderUpdate struct {
	Symbol         string
	TradeType      core.TradeType
	OrderID        string
	ClientOrderID  string
	Side           core.OrderSide
	PositionSide   *core.PositionSide
	OrderType      core.OrderType
	Status         core.OrderStatus
	Price          string
	Quantity       string
	FilledQuantity string
	AvgPrice       string
	Fee            string
	FeeAsset       string
	ReduceOnly     bool
	UpdateTime     int64
}

type streamKey struct {
	token     string
	tradeType core.TradeType
}

type OrderUpdateHub struct {
	mu     sync.RWMutex
	subs   map[streamKey]map[uint64]chan OrderUpdate
	nextID atomic.Uint64

	buffer int
}

func NewOrderUpdateHub(buffer int) *OrderUpdateHub {
	if buffer <= 0 {
		buffer = 256
	}
	return &OrderUpdateHub{
		subs:   make(map[streamKey]map[uint64]chan OrderUpdate),
		buffer: buffer,
	}
}

func (h *OrderUpdateHub) Subscribe(token string, tradeType core.TradeType) (<-chan OrderUpdate, func() int) {
	key := streamKey{token: token, tradeType: tradeType}
	id := h.nextID.Add(1)
	ch := make(chan OrderUpdate, h.buffer)

	h.mu.Lock()
	m := h.subs[key]
	if m == nil {
		m = make(map[uint64]chan OrderUpdate)
		h.subs[key] = m
	}
	m[id] = ch
	h.mu.Unlock()

	unsubOnce := sync.Once{}
	unsubscribe := func() int {
		remaining := 0
		unsubOnce.Do(func() {
			h.mu.Lock()
			if subs, ok := h.subs[key]; ok {
				if c, ok := subs[id]; ok {
					delete(subs, id)
					close(c)
				}
				if len(subs) == 0 {
					delete(h.subs, key)
				} else {
					remaining = len(subs)
				}
			}
			h.mu.Unlock()
		})
		return remaining
	}
	return ch, unsubscribe
}

func (h *OrderUpdateHub) Publish(token string, tradeType core.TradeType, upd OrderUpdate) {
	key := streamKey{token: token, tradeType: tradeType}

	h.mu.RLock()
	subs := h.subs[key]
	chans := make([]chan OrderUpdate, 0, len(subs))
	for _, ch := range subs {
		chans = append(chans, ch)
	}
	h.mu.RUnlock()

	for _, ch := range chans {
		select {
		case ch <- upd:
		default:
			// Drop if subscriber is slow; upstream can re-sync via polling.
		}
	}
}

func (h *OrderUpdateHub) SubscriberCount(token string, tradeType core.TradeType) int {
	key := streamKey{token: token, tradeType: tradeType}
	h.mu.RLock()
	n := len(h.subs[key])
	h.mu.RUnlock()
	return n
}

func (h *OrderUpdateHub) CloseToken(token string) {
	h.mu.Lock()
	for key, subs := range h.subs {
		if key.token != token {
			continue
		}
		for id, ch := range subs {
			delete(subs, id)
			close(ch)
		}
		delete(h.subs, key)
	}
	h.mu.Unlock()
}
