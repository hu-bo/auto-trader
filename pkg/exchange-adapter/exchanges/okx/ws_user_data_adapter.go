package okx

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/pkg/exchange-adapter/core"
	okxapi "github.com/pkg/okx-api"
	okxtypes "github.com/pkg/okx-api/types"
	okxws "github.com/pkg/okx-api/types/websockets"
)

type WsUserDataAdapterOptions struct {
	APIKey    string
	APISecret string
	APIPass   string
	Options   *core.AdapterOptions
}

type WsUserDataAdapter struct {
	core.BaseWsUserDataAdapter

	ws *okxapi.WebsocketClient

	mu            sync.Mutex
	subscribed    map[core.TradeType][]core.ListenerID
	connected     map[core.TradeType]bool
	accountSubbed bool
}

func NewWsUserDataAdapter(opts WsUserDataAdapterOptions) *WsUserDataAdapter {
	demonet := true
	if opts.Options != nil && opts.Options.Demonet != nil {
		demonet = *opts.Options.Demonet
	}

	proxyURL := ""
	socksProxyURL := ""
	if opts.Options != nil {
		proxyURL = opts.Options.HTTPSProxy
		socksProxyURL = opts.Options.SOCKSProxy
	}

	ws := okxapi.NewWebsocketClient(okxws.WSClientConfig{
		Accounts: []okxtypes.APICredentials{{
			APIKey:    opts.APIKey,
			APISecret: opts.APISecret,
			APIPass:   opts.APIPass,
		}},
		Market:           okxtypes.APIMarketGLOBAL,
		DemoTrading:      demonet,
		ReconnectTimeout: 5 * time.Second,
		Proxy:            proxyURL,
		SocksProxy:       socksProxyURL,
	})

	a := &WsUserDataAdapter{
		BaseWsUserDataAdapter: core.NewBaseWsUserDataAdapter(core.ExchangeOKX),
		ws:                    ws,
		subscribed:            make(map[core.TradeType][]core.ListenerID),
		connected:             make(map[core.TradeType]bool),
	}

	a.setupEventHandlers()
	return a
}

func (a *WsUserDataAdapter) IsConnected(tradeType *core.TradeType) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	if tradeType == nil {
		return len(a.connected) > 0
	}
	return a.connected[*tradeType]
}

func (a *WsUserDataAdapter) Subscribe(ctx context.Context, options core.WsSubscribeOptions, handler core.WsEventHandler) error {
	a.applySubscribeOptions(options)

	a.mu.Lock()
	tt := options.TradeType
	a.subscribed[tt] = append(a.subscribed[tt], a.OnAny(handler))

	needAccount := !a.accountSubbed
	a.accountSubbed = true
	a.mu.Unlock()

	args := make([]map[string]any, 0, 4)
	args = append(args, map[string]any{
		"channel":  "orders",
		"instType": tradeTypeToInstType(tt),
	})
	args = append(args, map[string]any{
		"channel":  "orders-algo",
		"instType": tradeTypeToInstType(tt),
	})
	if tt != core.TradeTypeSpot {
		args = append(args, map[string]any{
			"channel":  "positions",
			"instType": tradeTypeToInstType(tt),
		})
	}
	if needAccount {
		args = append(args, map[string]any{"channel": "account"})
	}

	return a.ws.Subscribe(ctx, args, nil)
}

func (a *WsUserDataAdapter) Unsubscribe(ctx context.Context, tradeType *core.TradeType) error {
	if tradeType == nil {
		a.mu.Lock()
		keys := make([]core.TradeType, 0, len(a.subscribed))
		for tt := range a.subscribed {
			keys = append(keys, tt)
		}
		a.mu.Unlock()

		for _, tt := range keys {
			ttCopy := tt
			_ = a.Unsubscribe(ctx, &ttCopy)
		}
		return nil
	}

	tt := *tradeType

	a.mu.Lock()
	ids := a.subscribed[tt]
	delete(a.subscribed, tt)
	delete(a.connected, tt)
	noSubs := len(a.subscribed) == 0
	if noSubs {
		a.accountSubbed = false
	}
	a.mu.Unlock()

	for _, id := range ids {
		a.OffAny(id)
	}

	args := make([]map[string]any, 0, 3)
	args = append(args, map[string]any{
		"channel":  "orders",
		"instType": tradeTypeToInstType(tt),
	})
	args = append(args, map[string]any{
		"channel":  "orders-algo",
		"instType": tradeTypeToInstType(tt),
	})
	if tt != core.TradeTypeSpot {
		args = append(args, map[string]any{
			"channel":  "positions",
			"instType": tradeTypeToInstType(tt),
		})
	}

	_ = a.ws.Unsubscribe(ctx, args, nil)

	if noSubs {
		_ = a.ws.Unsubscribe(ctx, []map[string]any{{"channel": "account"}}, nil)
		a.ws.CloseAll()
	}

	return nil
}

func (a *WsUserDataAdapter) Close(ctx context.Context) error {
	_ = a.Unsubscribe(ctx, nil)
	a.ws.CloseAll()
	return nil
}

// ============================================================================//
// OKX websocket events
// ============================================================================//

func (a *WsUserDataAdapter) setupEventHandlers() {
	a.ws.On("authenticated", func(_ any) {
		a.mu.Lock()
		tradeTypes := make([]core.TradeType, 0, len(a.subscribed))
		for tt := range a.subscribed {
			tradeTypes = append(tradeTypes, tt)
		}
		a.mu.Unlock()

		for _, tt := range tradeTypes {
			a.mu.Lock()
			if a.connected[tt] {
				a.mu.Unlock()
				continue
			}
			a.connected[tt] = true
			a.mu.Unlock()

			ttCopy := tt
			a.EmitConnected(&ttCopy)
		}
	})

	a.ws.On("close", func(_ any) {
		a.mu.Lock()
		tradeTypes := make([]core.TradeType, 0, len(a.connected))
		for tt := range a.connected {
			tradeTypes = append(tradeTypes, tt)
		}
		a.connected = make(map[core.TradeType]bool)
		a.mu.Unlock()

		for _, tt := range tradeTypes {
			ttCopy := tt
			a.EmitDisconnected(&ttCopy, "connection closed")
		}
	})

	a.ws.OnError(func(err error) {
		if err == nil {
			return
		}
		a.EmitError(core.ErrorWsConnection, err.Error(), nil, err)
	})

	a.ws.On("exception", func(event any) {
		msg := ""
		switch v := event.(type) {
		case okxapi.WsEvent:
			msg = v.Message.Msg
			if msg == "" {
				msg = string(v.Raw)
			}
		case okxapi.WsRawMessage:
			msg = string(v.Raw)
		default:
			msg = fmt.Sprintf("%v", v)
		}
		a.EmitError(core.ErrorWsSubscription, msg, nil, event)
	})

	a.ws.On("update", func(event any) {
		upd, ok := event.(okxapi.WsDataEvent)
		if !ok {
			return
		}
		a.handleUpdate(upd)
	})
}

type okxWsArg struct {
	Channel  string `json:"channel"`
	InstType string `json:"instType,omitempty"`
}

type okxWsOrder struct {
	InstID     string `json:"instId"`
	OrdID      string `json:"ordId"`
	ClOrdID    string `json:"clOrdId"`
	Side       string `json:"side"`
	PosSide    string `json:"posSide"`
	OrdType    string `json:"ordType"`
	State      string `json:"state"`
	Px         string `json:"px"`
	Sz         string `json:"sz"`
	FillSz     string `json:"fillSz"`
	AvgPx      string `json:"avgPx"`
	Fee        string `json:"fee"`
	FeeCcy     string `json:"feeCcy"`
	ReduceOnly string `json:"reduceOnly"`
	UTime      string `json:"uTime"`
}

type okxWsAlgoOrder struct {
	InstID      string `json:"instId"`
	AlgoID      string `json:"algoId"`
	AlgoClOrdID string `json:"algoClOrdId"`
	Side        string `json:"side"`
	PosSide     string `json:"posSide"`
	OrdType     string `json:"ordType"`
	State       string `json:"state"`
	TriggerPx   string `json:"triggerPx"`
	OrdPx       string `json:"ordPx"`
	Sz          string `json:"sz"`
	TriggerTime string `json:"triggerTime"`
	UTime       string `json:"uTime"`
}

type okxWsPosition struct {
	InstID  string `json:"instId"`
	PosSide string `json:"posSide"`
	Pos     string `json:"pos"`
	AvgPx   string `json:"avgPx"`
	Upl     string `json:"upl"`
	Lever   string `json:"lever"`
	MgnMode string `json:"mgnMode"`
	LiqPx   string `json:"liqPx"`
	UTime   string `json:"uTime"`
}

type okxWsBalance struct {
	Ccy       string `json:"ccy"`
	CashBal   string `json:"cashBal"`
	AvailBal  string `json:"availBal"`
	FrozenBal string `json:"frozenBal"`
	Upl       string `json:"upl"`
	UTime     string `json:"uTime"`
}

type okxWsAccount struct {
	Details []okxWsBalance `json:"details"`
	UTime   string         `json:"uTime"`
}

func (a *WsUserDataAdapter) handleUpdate(upd okxapi.WsDataEvent) {
	var arg okxWsArg
	if err := json.Unmarshal(upd.Message.Arg, &arg); err != nil {
		return
	}

	tradeType := core.TradeTypeFutures
	if arg.InstType != "" {
		tradeType = instTypeToTradeType(arg.InstType)
	}

	switch arg.Channel {
	case "orders":
		var data []okxWsOrder
		if err := json.Unmarshal(upd.Message.Data, &data); err != nil {
			return
		}
		for _, o := range data {
			update := core.WsOrderUpdate{
				Symbol:         rawToUnifiedSymbol(o.InstID),
				TradeType:      tradeType,
				OrderID:        o.OrdID,
				ClientOrderID:  o.ClOrdID,
				Side:           toCoreSide(o.Side),
				PositionSide:   toCorePositionSide(o.PosSide),
				OrderType:      toCoreOrderType(o.OrdType),
				Status:         toCoreOrderStatus(o.State),
				Price:          o.Px,
				Quantity:       o.Sz,
				FilledQuantity: o.FillSz,
				AvgPrice:       o.AvgPx,
				Fee:            o.Fee,
				FeeAsset:       o.FeeCcy,
				ReduceOnly:     strings.EqualFold(strings.TrimSpace(o.ReduceOnly), "true"),
				UpdateTime:     msStringToInt64(o.UTime),
				Raw:            json.RawMessage(upd.Raw),
			}
			a.Emit(update)
		}

	case "orders-algo":
		var data []okxWsAlgoOrder
		if err := json.Unmarshal(upd.Message.Data, &data); err != nil {
			return
		}
		for _, o := range data {
			var triggerTime *int64
			if v := msStringToInt64(o.TriggerTime); v > 0 {
				triggerTime = &v
			}
			update := core.WsStrategyOrderUpdate{
				Symbol:       rawToUnifiedSymbol(o.InstID),
				TradeType:    tradeType,
				AlgoID:       o.AlgoID,
				ClientAlgoID: o.AlgoClOrdID,
				Side:         toCoreSide(o.Side),
				PositionSide: toCorePositionSide(o.PosSide),
				StrategyType: toCoreStrategyOrderType(o.OrdType, false),
				Status:       toCoreStrategyOrderStatus(o.State),
				TriggerPrice: o.TriggerPx,
				OrderPrice:   o.OrdPx,
				Quantity:     o.Sz,
				TriggerTime:  triggerTime,
				UpdateTime:   msStringToInt64(o.UTime),
				Raw:          json.RawMessage(upd.Raw),
			}
			a.Emit(update)
		}

	case "positions":
		var data []okxWsPosition
		if err := json.Unmarshal(upd.Message.Data, &data); err != nil {
			return
		}
		for _, p := range data {
			update := core.WsPositionUpdate{
				Symbol:           rawToUnifiedSymbol(p.InstID),
				TradeType:        tradeType,
				PositionSide:     core.PositionSide(strings.ToLower(p.PosSide)),
				Quantity:         p.Pos,
				EntryPrice:       p.AvgPx,
				UnrealizedPnl:    p.Upl,
				Leverage:         p.Lever,
				MarginType:       core.MarginMode(strings.ToLower(p.MgnMode)),
				LiquidationPrice: p.LiqPx,
				UpdateTime:       msStringToInt64(p.UTime),
				Raw:              json.RawMessage(upd.Raw),
			}
			a.Emit(update)
		}

	case "account":
		var data []okxWsAccount
		if err := json.Unmarshal(upd.Message.Data, &data); err != nil {
			return
		}
		for _, acct := range data {
			updateTime := msStringToInt64(acct.UTime)
			balances := make([]core.WsBalanceUpdate, 0, len(acct.Details))
			for _, b := range acct.Details {
				bu := core.WsBalanceUpdate{
					Asset:         b.Ccy,
					TradeType:     tradeType,
					Available:     b.AvailBal,
					Total:         b.CashBal,
					Frozen:        b.FrozenBal,
					UnrealizedPnl: b.Upl,
					UpdateTime:    msStringToInt64(b.UTime),
					Raw:           json.RawMessage(upd.Raw),
				}
				balances = append(balances, bu)
				a.Emit(bu)
			}

			a.Emit(core.WsAccountUpdate{
				TradeType:  tradeType,
				Balances:   balances,
				Positions:  nil,
				UpdateTime: updateTime,
				Raw:        json.RawMessage(upd.Raw),
			})
		}
	}
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
