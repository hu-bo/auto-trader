package exampleutil

import "github.com/pkg/exchange-adapter/core"

// ============================================================================
// Test scope config (edit to fit your needs)
// ============================================================================

var EnabledExchanges = []core.Exchange{
	core.ExchangeBinance,
	core.ExchangeOKX,
}

var EnabledTradeTypes = []core.TradeType{
	core.TradeTypeSpot,
	core.TradeTypeFutures,
	core.TradeTypeDelivery,
}

var TestModules = struct {
	Public     bool
	Trade      bool
	WsUserData bool
}{
	Public:     true,
	Trade:      true,
	WsUserData: true,
}

// ============================================================================
// Symbols
// ============================================================================

var SampleSymbols = map[core.TradeType]map[core.Exchange]string{
	core.TradeTypeSpot: {
		core.ExchangeBinance: "BTC-USDT",
		core.ExchangeOKX:     "BTC-USDT",
	},
	core.TradeTypeFutures: {
		core.ExchangeBinance: "BTC-USDT",
		core.ExchangeOKX:     "BTC-USDT",
	},
	core.TradeTypeDelivery: {
		core.ExchangeBinance: "BTC-USD",
		core.ExchangeOKX:     "BTC-USD",
	},
}

func GetSymbol(exchange core.Exchange, tradeType core.TradeType) string {
	if byTradeType, ok := SampleSymbols[tradeType]; ok {
		if symbol, ok := byTradeType[exchange]; ok {
			return symbol
		}
	}
	return ""
}

// ============================================================================
// Order config
// ============================================================================

var OrderConfig = struct {
	DefaultLeverage float64
	BuyPriceOffset  float64
	SellPriceOffset float64
	BatchOrderCount int
}{
	DefaultLeverage: 5,
	BuyPriceOffset:  0.995,
	SellPriceOffset: 1.005,
	BatchOrderCount: 2,
}

// ============================================================================
// Order scenarios
// ============================================================================

type OrderScenario struct {
	Exchange     core.Exchange
	TradeType    core.TradeType
	Side         core.OrderSide
	PositionSide *core.PositionSide
}

type BatchOrderScenario struct {
	OrderScenario
	Count int
}

func ptrPositionSide(v core.PositionSide) *core.PositionSide { return &v }

var SingleOrderScenarios = []OrderScenario{
	// Binance
	{Exchange: core.ExchangeBinance, TradeType: core.TradeTypeSpot, Side: core.OrderSideBuy},
	{Exchange: core.ExchangeBinance, TradeType: core.TradeTypeFutures, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)},
	{Exchange: core.ExchangeBinance, TradeType: core.TradeTypeDelivery, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)},

	// OKX
	{Exchange: core.ExchangeOKX, TradeType: core.TradeTypeSpot, Side: core.OrderSideBuy},
	{Exchange: core.ExchangeOKX, TradeType: core.TradeTypeFutures, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)},
	{Exchange: core.ExchangeOKX, TradeType: core.TradeTypeDelivery, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)},
}

var BatchOrderScenarios = []BatchOrderScenario{
	// Binance
	{OrderScenario: OrderScenario{Exchange: core.ExchangeBinance, TradeType: core.TradeTypeSpot, Side: core.OrderSideBuy}, Count: OrderConfig.BatchOrderCount},
	{OrderScenario: OrderScenario{Exchange: core.ExchangeBinance, TradeType: core.TradeTypeFutures, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)}, Count: OrderConfig.BatchOrderCount},
	{OrderScenario: OrderScenario{Exchange: core.ExchangeBinance, TradeType: core.TradeTypeDelivery, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)}, Count: OrderConfig.BatchOrderCount},

	// OKX
	{OrderScenario: OrderScenario{Exchange: core.ExchangeOKX, TradeType: core.TradeTypeSpot, Side: core.OrderSideBuy}, Count: OrderConfig.BatchOrderCount},
	{OrderScenario: OrderScenario{Exchange: core.ExchangeOKX, TradeType: core.TradeTypeFutures, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)}, Count: OrderConfig.BatchOrderCount},
	{OrderScenario: OrderScenario{Exchange: core.ExchangeOKX, TradeType: core.TradeTypeDelivery, Side: core.OrderSideBuy, PositionSide: ptrPositionSide(core.PositionSideLong)}, Count: OrderConfig.BatchOrderCount},
}

func IsExchangeEnabled(exchange core.Exchange) bool {
	for _, e := range EnabledExchanges {
		if e == exchange {
			return true
		}
	}
	return false
}

func IsTradeTypeEnabled(tradeType core.TradeType) bool {
	for _, tt := range EnabledTradeTypes {
		if tt == tradeType {
			return true
		}
	}
	return false
}

func FilterOrderScenarios(scenarios []OrderScenario) []OrderScenario {
	out := make([]OrderScenario, 0, len(scenarios))
	for _, s := range scenarios {
		if IsExchangeEnabled(s.Exchange) && IsTradeTypeEnabled(s.TradeType) {
			out = append(out, s)
		}
	}
	return out
}

func FilterBatchOrderScenarios(scenarios []BatchOrderScenario) []BatchOrderScenario {
	out := make([]BatchOrderScenario, 0, len(scenarios))
	for _, s := range scenarios {
		if IsExchangeEnabled(s.Exchange) && IsTradeTypeEnabled(s.TradeType) {
			out = append(out, s)
		}
	}
	return out
}
