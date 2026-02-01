package core

import (
	"context"
	"sync"
	"sync/atomic"
	"time"
)

type WsEventHandler func(event WsUserDataEvent)

type ListenerID uint64

type WsUserDataAdapter interface {
	Exchange() Exchange

	IsConnected(tradeType *TradeType) bool
	Subscribe(ctx context.Context, options WsSubscribeOptions, handler WsEventHandler) error
	Unsubscribe(ctx context.Context, tradeType *TradeType) error
	Close(ctx context.Context) error

	On(eventType WsUserDataEventType, handler WsEventHandler) ListenerID
	Off(eventType WsUserDataEventType, id ListenerID)
	OnAny(handler WsEventHandler) ListenerID
	OffAny(id ListenerID)
}

type BaseWsUserDataAdapter struct {
	exchange Exchange

	listenersMu  sync.RWMutex
	listeners    map[WsUserDataEventType]map[ListenerID]WsEventHandler
	anyListeners map[ListenerID]WsEventHandler
	nextID       atomic.Uint64

	// Reconnect config (used by exchange implementations).
	AutoReconnect        bool
	ReconnectInterval    time.Duration
	MaxReconnectAttempts int
}

func NewBaseWsUserDataAdapter(exchange Exchange) BaseWsUserDataAdapter {
	return BaseWsUserDataAdapter{
		exchange:             exchange,
		listeners:            make(map[WsUserDataEventType]map[ListenerID]WsEventHandler),
		anyListeners:         make(map[ListenerID]WsEventHandler),
		AutoReconnect:        true,
		ReconnectInterval:    5 * time.Second,
		MaxReconnectAttempts: 10,
	}
}

func (b *BaseWsUserDataAdapter) Exchange() Exchange { return b.exchange }

func (b *BaseWsUserDataAdapter) On(eventType WsUserDataEventType, handler WsEventHandler) ListenerID {
	if handler == nil {
		return 0
	}
	id := ListenerID(b.nextID.Add(1))
	b.listenersMu.Lock()
	defer b.listenersMu.Unlock()
	if b.listeners[eventType] == nil {
		b.listeners[eventType] = make(map[ListenerID]WsEventHandler)
	}
	b.listeners[eventType][id] = handler
	return id
}

func (b *BaseWsUserDataAdapter) Off(eventType WsUserDataEventType, id ListenerID) {
	b.listenersMu.Lock()
	defer b.listenersMu.Unlock()
	if b.listeners[eventType] == nil {
		return
	}
	delete(b.listeners[eventType], id)
}

func (b *BaseWsUserDataAdapter) OnAny(handler WsEventHandler) ListenerID {
	if handler == nil {
		return 0
	}
	id := ListenerID(b.nextID.Add(1))
	b.listenersMu.Lock()
	defer b.listenersMu.Unlock()
	b.anyListeners[id] = handler
	return id
}

func (b *BaseWsUserDataAdapter) OffAny(id ListenerID) {
	b.listenersMu.Lock()
	defer b.listenersMu.Unlock()
	delete(b.anyListeners, id)
}

func (b *BaseWsUserDataAdapter) emit(event WsUserDataEvent) {
	eventType := event.EventType()

	b.listenersMu.RLock()
	specific := b.listeners[eventType]
	anyHandlers := b.anyListeners

	// Copy to avoid holding the lock while calling user handlers.
	specificCopy := make([]WsEventHandler, 0, len(specific))
	for _, h := range specific {
		specificCopy = append(specificCopy, h)
	}
	anyCopy := make([]WsEventHandler, 0, len(anyHandlers))
	for _, h := range anyHandlers {
		anyCopy = append(anyCopy, h)
	}
	b.listenersMu.RUnlock()

	for _, h := range specificCopy {
		h(event)
	}
	for _, h := range anyCopy {
		h(event)
	}
}

// Emit dispatches an event to all registered handlers.
func (b *BaseWsUserDataAdapter) Emit(event WsUserDataEvent) {
	b.emit(event)
}

func (b *BaseWsUserDataAdapter) EmitConnected(tradeType *TradeType) {
	b.emit(WsConnectionEvent{
		Type:      WsEventConnected,
		TradeType: tradeType,
		Timestamp: time.Now().UnixMilli(),
	})
}

func (b *BaseWsUserDataAdapter) EmitDisconnected(tradeType *TradeType, reason string) {
	b.emit(WsConnectionEvent{
		Type:      WsEventDisconnected,
		TradeType: tradeType,
		Timestamp: time.Now().UnixMilli(),
		Reason:    reason,
	})
}

func (b *BaseWsUserDataAdapter) EmitError(code string, message string, tradeType *TradeType, raw any) {
	b.emit(WsErrorEvent{
		Code:      code,
		Message:   message,
		TradeType: tradeType,
		Timestamp: time.Now().UnixMilli(),
		Raw:       raw,
	})
}
