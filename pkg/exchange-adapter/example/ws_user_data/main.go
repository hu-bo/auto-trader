package main

import (
	"context"
	"flag"
	"os"
	"strings"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/example/internal/exampleutil"
)

func main() {
	var tradeType string
	flag.StringVar(&tradeType, "trade-type", "", "tradeType (spot|futures|delivery); default uses EnabledTradeTypes[0]")
	flag.Parse()

	log := exampleutil.NewLogger("")
	_ = exampleutil.LoadDotEnvFiles(".env", ".env.local")
	env := exampleutil.LoadEnv()
	opts := exampleutil.AdapterOptionsFromEnv(env)

	if !exampleutil.TestModules.WsUserData {
		log.Warn("WebSocket 用户数据流测试模块已禁用")
		return
	}

	exchanges := exampleutil.EnabledExchanges
	if flag.NArg() > 0 {
		arg := strings.ToLower(flag.Arg(0))
		if ex, err := exampleutil.ParseExchange(arg); err == nil {
			exchanges = []core.Exchange{ex}
		}
	}

	tt := core.TradeTypeFutures
	if len(exampleutil.EnabledTradeTypes) > 0 {
		tt = exampleutil.EnabledTradeTypes[0]
	}
	if tradeType != "" {
		parsed, err := exampleutil.ParseTradeType(tradeType)
		if err != nil {
			log.Error(err.Error())
			os.Exit(1)
		}
		tt = parsed
	}

	adapters, err := exampleutil.NewWsUserDataAdapters(env, exchanges, opts)
	if err != nil {
		log.Error(err.Error())
		os.Exit(1)
	}

	log.Banner("WebSocket 用户数据流测试")

	for _, exchange := range exchanges {
		adapter := adapters[exchange]
		if adapter == nil {
			continue
		}

		label := exampleutil.FormatLabel(exchange, tt)
		adapter.On(core.WsEventConnected, func(_ core.WsUserDataEvent) {
			log.Success("[" + label + "] WebSocket 连接成功")
		})
		adapter.On(core.WsEventDisconnected, func(event core.WsUserDataEvent) {
			if e, ok := event.(core.WsConnectionEvent); ok && e.Reason != "" {
				log.Warn("[" + label + "] WebSocket 断开连接: " + e.Reason)
				return
			}
			log.Warn("[" + label + "] WebSocket 断开连接")
		})
		adapter.On(core.WsEventError, func(event core.WsUserDataEvent) {
			if e, ok := event.(core.WsErrorEvent); ok {
				log.Error("["+label+"] WebSocket 错误: "+e.Code+": "+e.Message, e.Raw)
				return
			}
			log.Error("["+label+"] WebSocket 错误", event)
		})

		adapter.On(core.WsEventOrder, handleOrder(log))
		adapter.On(core.WsEventStrategyOrder, handleStrategyOrder(log))
		adapter.On(core.WsEventPosition, handlePosition(log))
		adapter.On(core.WsEventBalance, handleBalance(log))

		if err := adapter.Subscribe(context.Background(), core.WsSubscribeOptions{
			TradeType:     tt,
			AutoReconnect: ptrBool(true),
		}, func(_ core.WsUserDataEvent) {}); err != nil {
			log.Error("订阅失败: " + err.Error())
			os.Exit(1)
		}
		log.Info("[" + label + "] 已订阅用户数据流")
	}

	log.Info("等待用户数据事件...")
	log.Info("按 Ctrl+C 退出")
	exampleutil.WaitForShutdown(context.Background(), log, func(ctx context.Context) error {
		for _, a := range adapters {
			_ = a.Close(ctx)
		}
		return nil
	})
}

func handleOrder(log exampleutil.Logger) func(core.WsUserDataEvent) {
	return func(event core.WsUserDataEvent) {
		e, ok := event.(core.WsOrderUpdate)
		if !ok {
			return
		}
		log.Info("[订单更新] " + e.Symbol)
		log.Info("  订单ID:", e.OrderID)
		log.Info("  方向:", string(e.Side), derefPositionSide(e.PositionSide))
		log.Info("  类型:", string(e.OrderType))
		log.Info("  状态:", string(e.Status))
		log.Info("  价格:", e.Price)
		log.Info("  数量:", e.Quantity, "/ 已成交:", e.FilledQuantity)
		if e.AvgPrice != "" {
			log.Info("  均价:", e.AvgPrice)
		}
		if e.Fee != "" {
			log.Info("  手续费:", e.Fee, e.FeeAsset)
		}
	}
}

func handleStrategyOrder(log exampleutil.Logger) func(core.WsUserDataEvent) {
	return func(event core.WsUserDataEvent) {
		e, ok := event.(core.WsStrategyOrderUpdate)
		if !ok {
			return
		}
		log.Info("[策略订单更新] " + e.Symbol)
		log.Info("  策略ID:", e.AlgoID)
		log.Info("  类型:", string(e.StrategyType))
		log.Info("  方向:", string(e.Side), derefPositionSide(e.PositionSide))
		log.Info("  状态:", string(e.Status))
		log.Info("  触发价:", e.TriggerPrice)
		if e.OrderPrice != "" {
			log.Info("  委托价:", e.OrderPrice)
		}
		log.Info("  数量:", e.Quantity)
	}
}

func handlePosition(log exampleutil.Logger) func(core.WsUserDataEvent) {
	return func(event core.WsUserDataEvent) {
		e, ok := event.(core.WsPositionUpdate)
		if !ok {
			return
		}
		log.Info("[持仓更新] " + e.Symbol)
		log.Info("  方向:", string(e.PositionSide))
		log.Info("  数量:", e.Quantity)
		log.Info("  开仓均价:", e.EntryPrice)
		log.Info("  未实现盈亏:", e.UnrealizedPnl)
		if e.Leverage != "" {
			log.Info("  杠杆:", e.Leverage+"x")
		}
		if e.LiquidationPrice != "" {
			log.Info("  强平价:", e.LiquidationPrice)
		}
	}
}

func handleBalance(log exampleutil.Logger) func(core.WsUserDataEvent) {
	return func(event core.WsUserDataEvent) {
		e, ok := event.(core.WsBalanceUpdate)
		if !ok {
			return
		}
		log.Info("[余额更新] " + e.Asset)
		log.Info("  可用:", e.Available)
		if e.Total != "" {
			log.Info("  总额:", e.Total)
		}
		if e.Frozen != "" {
			log.Info("  冻结:", e.Frozen)
		}
		if e.UnrealizedPnl != "" {
			log.Info("  未实现盈亏:", e.UnrealizedPnl)
		}
	}
}

func ptrBool(v bool) *bool { return &v }

func derefPositionSide(v *core.PositionSide) string {
	if v == nil {
		return ""
	}
	return string(*v)
}
