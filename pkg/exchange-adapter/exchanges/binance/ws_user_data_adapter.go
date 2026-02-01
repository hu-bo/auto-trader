package binance

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	binanceapi "github.com/pkg/binance-api"
	bws "github.com/pkg/binance-api/types/websockets"
	"github.com/pkg/exchange-adapter/core"
)

type WsUserDataAdapterOptions struct {
	APIKey    string
	APISecret string
	Options   *core.AdapterOptions
}

type WsUserDataAdapter struct {
	core.BaseWsUserDataAdapter

	testnet   bool
	apiKey    string
	apiSecret string

	spotREST     *binanceapi.MainClient
	futuresREST  *binanceapi.USDMClient
	deliveryREST *binanceapi.COINMClient

	mu    sync.Mutex
	conns map[core.TradeType]*binanceConn
}

type binanceConn struct {
	tradeType core.TradeType
	wsKey     bws.WsKey
	ws        *binanceapi.WebsocketClient

	// Spot needs listenKey for keepalive/close.
	listenKey string

	anyListenerIDs []core.ListenerID
	stopCh         chan struct{}
}

func NewWsUserDataAdapter(opts WsUserDataAdapterOptions) *WsUserDataAdapter {
	demonet := true
	if opts.Options != nil && opts.Options.Demonet != nil {
		demonet = *opts.Options.Demonet
	}

	spot := binanceapi.NewMainClient(binanceapi.MainClientOptions{APIKey: opts.APIKey, APISecret: opts.APISecret, Testnet: demonet})
	futures := binanceapi.NewUSDMClient(binanceapi.USDMClientOptions{APIKey: opts.APIKey, APISecret: opts.APISecret, Testnet: demonet})
	delivery := binanceapi.NewCOINMClient(binanceapi.COINMClientOptions{APIKey: opts.APIKey, APISecret: opts.APISecret, Testnet: demonet})

	return &WsUserDataAdapter{
		BaseWsUserDataAdapter: core.NewBaseWsUserDataAdapter(core.ExchangeBinance),
		testnet:               demonet,
		apiKey:                opts.APIKey,
		apiSecret:             opts.APISecret,
		spotREST:              spot,
		futuresREST:           futures,
		deliveryREST:          delivery,
		conns:                 make(map[core.TradeType]*binanceConn),
	}
}

func (a *WsUserDataAdapter) IsConnected(tradeType *core.TradeType) bool {
	a.mu.Lock()
	defer a.mu.Unlock()

	if tradeType == nil {
		for _, c := range a.conns {
			if c.ws != nil && c.ws.IsConnected(c.wsKey) {
				return true
			}
		}
		return false
	}

	c := a.conns[*tradeType]
	if c == nil || c.ws == nil {
		return false
	}
	return c.ws.IsConnected(c.wsKey)
}

func (a *WsUserDataAdapter) Subscribe(ctx context.Context, options core.WsSubscribeOptions, handler core.WsEventHandler) error {
	a.applySubscribeOptions(options)

	a.mu.Lock()
	if existing := a.conns[options.TradeType]; existing != nil {
		existing.anyListenerIDs = append(existing.anyListenerIDs, a.OnAny(handler))
		a.mu.Unlock()
		return nil
	}
	a.mu.Unlock()

	ws := binanceapi.NewWebsocketClient(bws.WsClientConfig{
		APIKey:       a.apiKey,
		APISecret:    a.apiSecret,
		Testnet:      a.testnet,
		PingInterval: 30_000,
	})

	tt := options.TradeType
	wsKey, err := tradeTypeToWsKey(tt, a.testnet)
	if err != nil {
		return err
	}

	conn := &binanceConn{
		tradeType:      tt,
		wsKey:          wsKey,
		ws:             ws,
		anyListenerIDs: []core.ListenerID{a.OnAny(handler)},
		stopCh:         make(chan struct{}),
	}

	a.registerHandlers(conn)

	listenKey := ""
	switch tt {
	case core.TradeTypeSpot:
		resp, err := a.spotREST.GetSpotUserDataListenKey(ctx)
		if err != nil {
			return fmt.Errorf("get spot listenKey: %w", err)
		}
		listenKey = resp.ListenKey
	case core.TradeTypeFutures:
		resp, err := a.futuresREST.GetFuturesUserDataListenKey(ctx)
		if err != nil {
			return fmt.Errorf("get futures listenKey: %w", err)
		}
		listenKey = resp.ListenKey
	case core.TradeTypeDelivery:
		resp, err := a.deliveryREST.GetFuturesUserDataListenKey(ctx)
		if err != nil {
			return fmt.Errorf("get delivery listenKey: %w", err)
		}
		listenKey = resp.ListenKey
	default:
		return fmt.Errorf("unsupported tradeType: %s", tt)
	}
	conn.listenKey = listenKey

	if err := ws.ConnectWithListenKey(wsKey, listenKey); err != nil {
		return err
	}

	a.mu.Lock()
	a.conns[tt] = conn
	a.mu.Unlock()

	ttCopy := tt
	a.EmitConnected(&ttCopy)

	go a.keepAliveLoop(tt, conn)
	return nil
}

func (a *WsUserDataAdapter) Unsubscribe(ctx context.Context, tradeType *core.TradeType) error {
	if tradeType == nil {
		a.mu.Lock()
		keys := make([]core.TradeType, 0, len(a.conns))
		for tt := range a.conns {
			keys = append(keys, tt)
		}
		a.mu.Unlock()

		for _, tt := range keys {
			ttCopy := tt
			_ = a.Unsubscribe(ctx, &ttCopy)
		}
		return nil
	}

	a.mu.Lock()
	conn := a.conns[*tradeType]
	delete(a.conns, *tradeType)
	a.mu.Unlock()

	if conn == nil {
		return nil
	}

	close(conn.stopCh)
	for _, id := range conn.anyListenerIDs {
		a.OffAny(id)
	}
	if conn.ws != nil {
		_ = conn.ws.Close(conn.wsKey)
	}

	switch conn.tradeType {
	case core.TradeTypeSpot:
		if conn.listenKey != "" {
			_ = a.spotREST.CloseSpotUserDataListenKey(ctx, conn.listenKey)
		}
	case core.TradeTypeFutures:
		_ = a.futuresREST.CloseFuturesUserDataListenKey(ctx)
	case core.TradeTypeDelivery:
		_ = a.deliveryREST.CloseFuturesUserDataListenKey(ctx)
	}

	ttCopy := conn.tradeType
	a.EmitDisconnected(&ttCopy, "unsubscribed")
	return nil
}

func (a *WsUserDataAdapter) Close(ctx context.Context) error {
	return a.Unsubscribe(ctx, nil)
}

func tradeTypeToWsKey(tradeType core.TradeType, testnet bool) (bws.WsKey, error) {
	switch tradeType {
	case core.TradeTypeSpot:
		if testnet {
			return bws.WsKeyMainTestnet, nil
		}
		return bws.WsKeyMain, nil
	case core.TradeTypeFutures:
		if testnet {
			return bws.WsKeyUSDMTestnet, nil
		}
		return bws.WsKeyUSDM, nil
	case core.TradeTypeDelivery:
		if testnet {
			return bws.WsKeyCOINMTestnet, nil
		}
		return bws.WsKeyCOINM, nil
	default:
		return "", fmt.Errorf("unsupported tradeType: %s", tradeType)
	}
}

func (a *WsUserDataAdapter) keepAliveLoop(tradeType core.TradeType, conn *binanceConn) {
	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-conn.stopCh:
			return
		case <-ticker.C:
			ctx := context.Background()
			var err error
			switch tradeType {
			case core.TradeTypeSpot:
				if conn.listenKey != "" {
					err = a.spotREST.KeepAliveSpotUserDataListenKey(ctx, conn.listenKey)
				}
			case core.TradeTypeFutures:
				err = a.futuresREST.KeepAliveFuturesUserDataListenKey(ctx)
			case core.TradeTypeDelivery:
				err = a.deliveryREST.KeepAliveFuturesUserDataListenKey(ctx)
			}
			if err != nil {
				ttCopy := tradeType
				a.EmitError(core.ErrorWsConnection, err.Error(), &ttCopy, err)
			}
		}
	}
}

func (a *WsUserDataAdapter) registerHandlers(conn *binanceConn) {
	tt := conn.tradeType

	conn.ws.OnError(func(err error) {
		if err == nil {
			return
		}
		ttCopy := tt
		a.EmitError(core.ErrorWsConnection, err.Error(), &ttCopy, err)
	})

	switch tt {
	case core.TradeTypeSpot:
		conn.ws.OnMessage("executionReport", func(ev interface{}) { a.handleSpotExecutionReport(ev, conn) })
		conn.ws.OnMessage("outboundAccountPosition", func(ev interface{}) { a.handleSpotAccountUpdate(ev, conn) })
		conn.ws.OnMessage("listenKeyExpired", func(ev interface{}) { a.handleListenKeyExpired(ev, conn) })
	case core.TradeTypeFutures, core.TradeTypeDelivery:
		conn.ws.OnMessage("ORDER_TRADE_UPDATE", func(ev interface{}) { a.handleFuturesOrderUpdate(ev, conn) })
		conn.ws.OnMessage("ACCOUNT_UPDATE", func(ev interface{}) { a.handleFuturesAccountUpdate(ev, conn) })
		conn.ws.OnMessage("listenKeyExpired", func(ev interface{}) { a.handleListenKeyExpired(ev, conn) })
	}
}

func (a *WsUserDataAdapter) handleListenKeyExpired(ev interface{}, conn *binanceConn) {
	raw, _ := json.Marshal(ev)
	ttCopy := conn.tradeType
	a.EmitError(core.ErrorWsAuthentication, "listenKeyExpired", &ttCopy, json.RawMessage(raw))
}

func (a *WsUserDataAdapter) handleSpotAccountUpdate(ev interface{}, conn *binanceConn) {
	raw, err := json.Marshal(ev)
	if err != nil {
		return
	}
	var msg bws.WsAccountUpdateEvent
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	for _, b := range msg.Balances {
		update := core.WsBalanceUpdate{
			Asset:      b.Asset,
			TradeType:  core.TradeTypeSpot,
			Available:  b.Free,
			Frozen:     b.Locked,
			Total:      addStrings(b.Free, b.Locked),
			UpdateTime: msg.Time,
			Raw:        json.RawMessage(raw),
		}
		a.Emit(update)
	}
}

func (a *WsUserDataAdapter) handleSpotExecutionReport(ev interface{}, conn *binanceConn) {
	raw, err := json.Marshal(ev)
	if err != nil {
		return
	}
	var msg bws.WsOrderUpdateEvent
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	updateTime := msg.TransactionTime
	if updateTime == 0 {
		updateTime = msg.Time
	}

	update := core.WsOrderUpdate{
		Symbol:         rawToUnifiedSymbol(msg.Symbol, core.TradeTypeSpot),
		TradeType:      core.TradeTypeSpot,
		OrderID:        strconv.FormatInt(msg.OrderID, 10),
		ClientOrderID:  msg.ClientOrderID,
		Side:           toCoreSide(msg.Side),
		OrderType:      toCoreOrderType(msg.OrderType),
		Status:         toCoreOrderStatus(msg.Status),
		Price:          msg.Price,
		Quantity:       msg.Quantity,
		FilledQuantity: msg.CumulativeFilledQty,
		AvgPrice:       msg.LastExecutedPrice,
		Fee:            msg.CommissionAmount,
		FeeAsset:       msg.CommissionAsset,
		UpdateTime:     updateTime,
		Raw:            json.RawMessage(raw),
	}
	a.Emit(update)
}

func (a *WsUserDataAdapter) handleFuturesAccountUpdate(ev interface{}, conn *binanceConn) {
	raw, err := json.Marshal(ev)
	if err != nil {
		return
	}
	var msg bws.WsFuturesAccountUpdateEvent
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	tt := conn.tradeType

	for _, b := range msg.AccountUpdate.Balances {
		update := core.WsBalanceUpdate{
			Asset:      b.Asset,
			TradeType:  tt,
			Available:  b.CrossWalletBalance,
			Total:      b.WalletBalance,
			UpdateTime: msg.Time,
			Raw:        json.RawMessage(raw),
		}
		a.Emit(update)
	}

	for _, p := range msg.AccountUpdate.Positions {
		posSide := core.PositionSideLong
		if strings.EqualFold(p.PositionSide, "SHORT") {
			posSide = core.PositionSideShort
		}
		update := core.WsPositionUpdate{
			Symbol:        rawToUnifiedSymbol(p.Symbol, tt),
			TradeType:     tt,
			PositionSide:  posSide,
			Quantity:      p.PositionAmount,
			EntryPrice:    p.EntryPrice,
			UnrealizedPnl: p.UnrealizedPnL,
			MarginType:    core.MarginMode(strings.ToLower(p.MarginType)),
			UpdateTime:    msg.Time,
			Raw:           json.RawMessage(raw),
		}
		a.Emit(update)
	}
}

func (a *WsUserDataAdapter) handleFuturesOrderUpdate(ev interface{}, conn *binanceConn) {
	raw, err := json.Marshal(ev)
	if err != nil {
		return
	}
	var msg bws.WsFuturesOrderUpdateEvent
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	tt := conn.tradeType
	o := msg.Order

	update := core.WsOrderUpdate{
		Symbol:         rawToUnifiedSymbol(o.Symbol, tt),
		TradeType:      tt,
		OrderID:        strconv.FormatInt(o.OrderID, 10),
		ClientOrderID:  o.ClientOrderID,
		Side:           toCoreSide(o.Side),
		PositionSide:   toCorePositionSide(o.PositionSide),
		OrderType:      toCoreOrderType(o.OrderType),
		Status:         toCoreOrderStatus(o.Status),
		Price:          o.OrigPrice,
		Quantity:       o.OrigQty,
		FilledQuantity: o.FilledAccumulatedQty,
		AvgPrice:       o.AvgPrice,
		Fee:            o.Commission,
		FeeAsset:       o.CommissionAsset,
		ReduceOnly:     o.IsReduceOnly,
		UpdateTime:     msg.Time,
		Raw:            json.RawMessage(raw),
	}
	a.Emit(update)
}

func (a *WsUserDataAdapter) applySubscribeOptions(options core.WsSubscribeOptions) {
	if options.AutoReconnect != nil {
		a.AutoReconnect = *options.AutoReconnect
	}
	if options.ReconnectInterval != nil {
		a.ReconnectInterval = *options.ReconnectInterval
	}
	if options.MaxReconnectAttempts != nil {
		a.MaxReconnectAttempts = *options.MaxReconnectAttempts
	}
}
