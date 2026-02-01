package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/example/internal/exampleutil"
)

func main() {
	var enableWs bool
	var wsOnly bool
	var wsTradeType string

	flag.BoolVar(&enableWs, "ws", false, "enable WebSocket user data monitoring")
	flag.BoolVar(&wsOnly, "ws-only", false, "only run WebSocket user data monitoring")
	flag.StringVar(&wsTradeType, "ws-trade-type", "", "tradeType for ws (spot|futures|delivery); default uses EnabledTradeTypes[0]")
	flag.Parse()

	log := exampleutil.NewLogger("")
	_ = exampleutil.LoadDotEnvFiles(".env", ".env.local")
	env := exampleutil.LoadEnv()
	opts := exampleutil.AdapterOptionsFromEnv(env)

	if !exampleutil.TestModules.Trade && !wsOnly {
		log.Warn("交易 API 测试模块已禁用")
		return
	}

	if (enableWs || wsOnly) && !exampleutil.TestModules.WsUserData {
		log.Warn("WebSocket 用户数据流测试模块已禁用")
		return
	}

	if !env.Simulated {
		log.Warn("SIMULATED=false：将发送真实下单请求，请确保账户/演示网配置正确。")
	} else {
		log.Info("模拟模式 = true（仅构建请求，跳过真实下单）")
	}

	wsTT := core.TradeTypeFutures
	if len(exampleutil.EnabledTradeTypes) > 0 {
		wsTT = exampleutil.EnabledTradeTypes[0]
	}
	if wsTradeType != "" {
		parsed, err := exampleutil.ParseTradeType(wsTradeType)
		if err != nil {
			log.Error(err.Error())
			os.Exit(1)
		}
		wsTT = parsed
	}

	var wsAdapters map[core.Exchange]core.WsUserDataAdapter
	if enableWs || wsOnly {
		var err error
		wsAdapters, err = exampleutil.NewWsUserDataAdapters(env, exampleutil.EnabledExchanges, opts)
		if err != nil {
			log.Error(err.Error())
			os.Exit(1)
		}
		if err := subscribeWsUserData(exampleutil.EnabledExchanges, wsAdapters, wsTT, log); err != nil {
			log.Error(err.Error())
			os.Exit(1)
		}
		log.Info("WebSocket 连接已建立，等待用户数据事件...")
	}

	if wsOnly {
		log.Info("按 Ctrl+C 退出")
		exampleutil.WaitForShutdown(context.Background(), log, func(ctx context.Context) error {
			for _, a := range wsAdapters {
				_ = a.Close(ctx)
			}
			return nil
		})
		return
	}

	tradeAdapters, err := exampleutil.NewTradeAdapters(env, exampleutil.EnabledExchanges, opts)
	if err != nil {
		log.Error(err.Error())
		os.Exit(1)
	}

	// Init adapters (best-effort).
	for _, a := range tradeAdapters {
		ctx, cancel := exampleutil.Ctx(context.Background(), env)
		_, _ = exampleutil.AssertOK(a.Init(ctx), "Init")
		cancel()
	}

	// Single orders
	singleScenarios := exampleutil.FilterOrderScenarios(exampleutil.SingleOrderScenarios)
	if len(singleScenarios) > 0 {
		log.Banner("单笔下单测试")
		for _, scenario := range singleScenarios {
			adapter := tradeAdapters[scenario.Exchange]
			label := exampleutil.FormatLabel(scenario.Exchange, scenario.TradeType)

			if err := log.Timed(label, func() error {
				return executeSingleOrder(env, adapter, scenario, log)
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()
		}
	}

	// Batch orders
	batchScenarios := exampleutil.FilterBatchOrderScenarios(exampleutil.BatchOrderScenarios)
	if len(batchScenarios) > 0 {
		log.Banner("批量下单测试")
		for _, scenario := range batchScenarios {
			adapter := tradeAdapters[scenario.Exchange]
			label := exampleutil.FormatLabel(scenario.Exchange, scenario.TradeType)

			limits := adapter.GetBatchOrderLimits()
			if !supportsTradeType(limits.SupportedTradeTypes, scenario.TradeType) {
				log.Warn(label + " 不支持批量下单，已跳过。")
				continue
			}

			capped := scenario
			if capped.Count > limits.MaxBatchSize {
				log.Warn(fmt.Sprintf("%s 批量数量 %d 超出上限 %d，改用 %d 单。", string(scenario.Exchange), scenario.Count, limits.MaxBatchSize, limits.MaxBatchSize))
				capped.Count = limits.MaxBatchSize
			}

			if err := log.Timed(label, func() error {
				return executeBatchOrders(env, adapter, capped, log)
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()
		}
	}

	if enableWs && wsAdapters != nil {
		log.Banner("等待 WebSocket 事件")
		log.Info("下单完成，继续监听 WebSocket 事件...")
		log.Info("按 Ctrl+C 退出")
		exampleutil.WaitForShutdown(context.Background(), log, func(ctx context.Context) error {
			for _, a := range wsAdapters {
				_ = a.Close(ctx)
			}
			return nil
		})
	}
}

func executeSingleOrder(env exampleutil.Env, adapter core.TradeAdapter, scenario exampleutil.OrderScenario, log exampleutil.Logger) error {
	symbol := exampleutil.GetSymbol(scenario.Exchange, scenario.TradeType)

	ctx, cancel := exampleutil.Ctx(context.Background(), env)
	defer cancel()

	params, err := exampleutil.BuildLimitOrder(ctx, adapter, symbol, scenario.TradeType, scenario.Side, scenario.PositionSide, 1)
	if err != nil {
		return err
	}

	label := exampleutil.FormatLabel(scenario.Exchange, scenario.TradeType)
	log.Section(label + " 单笔下单")
	log.JSON("请求参数", params)

	if env.Simulated {
		log.Warn(label + " 处于模拟模式：跳过下单请求")
		return nil
	}

	res := adapter.PlaceOrder(ctx, params)
	if res.Ok {
		log.Success(label+" 下单成功", res.Data)
		return nil
	}
	log.Error(label+" 下单失败", res.Error)
	return nil
}

func executeBatchOrders(env exampleutil.Env, adapter core.TradeAdapter, scenario exampleutil.BatchOrderScenario, log exampleutil.Logger) error {
	symbol := exampleutil.GetSymbol(scenario.Exchange, scenario.TradeType)

	ctx, cancel := exampleutil.Ctx(context.Background(), env)
	defer cancel()

	paramsList := make([]core.PlaceOrderParams, 0, scenario.Count)
	for i := 0; i < scenario.Count; i++ {
		multiplier := 1 + float64(i)*0.5
		params, err := exampleutil.BuildLimitOrder(ctx, adapter, symbol, scenario.TradeType, scenario.Side, scenario.PositionSide, multiplier)
		if err != nil {
			return err
		}
		paramsList = append(paramsList, params)
	}

	label := exampleutil.FormatLabel(scenario.Exchange, scenario.TradeType)
	log.Section(label + " 批量下单")
	log.JSON("批量请求参数", paramsList)

	if env.Simulated {
		log.Warn(label + " 处于模拟模式：跳过批量下单请求")
		return nil
	}

	batch := adapter.PlaceOrders(ctx, paramsList)
	summarizeBatch(label, batch, log)
	return nil
}

func summarizeBatch(label string, batch core.BatchPlaceOrderResult, log exampleutil.Logger) {
	log.Info(label+" 批量执行汇总", "successCount", batch.SuccessCount, "failedCount", batch.FailedCount)
	for i, r := range batch.Results {
		if r.Ok {
			log.Success(fmt.Sprintf("%s 第%d单成功", label, i+1), r.Data)
			continue
		}
		log.Error(fmt.Sprintf("%s 第%d单失败", label, i+1), r.Error)
	}
}

func supportsTradeType(tradeTypes []core.TradeType, v core.TradeType) bool {
	for _, tt := range tradeTypes {
		if tt == v {
			return true
		}
	}
	return false
}

func subscribeWsUserData(exchanges []core.Exchange, adapters map[core.Exchange]core.WsUserDataAdapter, tradeType core.TradeType, log exampleutil.Logger) error {
	for _, exchange := range exchanges {
		adapter := adapters[exchange]
		if adapter == nil {
			continue
		}

		label := exampleutil.FormatLabel(exchange, tradeType)
		tt := tradeType

		adapter.On(core.WsEventConnected, func(_ core.WsUserDataEvent) {
			log.Success("[" + label + "] WebSocket 连接成功")
		})
		adapter.On(core.WsEventDisconnected, func(event core.WsUserDataEvent) {
			if e, ok := event.(core.WsConnectionEvent); ok {
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
		adapter.On(core.WsEventOrder, handleOrderUpdate(log))
		adapter.On(core.WsEventPosition, handlePositionUpdate(log))
		adapter.On(core.WsEventBalance, handleBalanceUpdate(log))

		if err := adapter.Subscribe(context.Background(), core.WsSubscribeOptions{
			TradeType:     tt,
			AutoReconnect: ptrBool(true),
		}, func(_ core.WsUserDataEvent) {}); err != nil {
			return err
		}
		log.Info("[" + label + "] 已订阅用户数据流")
	}
	return nil
}

func handleOrderUpdate(log exampleutil.Logger) func(core.WsUserDataEvent) {
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

func handlePositionUpdate(log exampleutil.Logger) func(core.WsUserDataEvent) {
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

func handleBalanceUpdate(log exampleutil.Logger) func(core.WsUserDataEvent) {
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
