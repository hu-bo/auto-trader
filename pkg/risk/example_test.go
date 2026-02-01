package risk_test

import (
	"fmt"
	"time"

	risk "github.com/pkg/risk"
)

func Example() {
	// 1. Define risk configuration
	reduceRatio := 0.5
	config := risk.RiskConfig{
		Account: risk.AccountRiskConfig{
			MaxDailyLoss:      500,   // Maximum daily loss (USDT)
			MaxMarginUsagePct: 0.8,   // Maximum margin usage (80%)
			OnBreach:          risk.AccountBreachBlockTrading,
		},
		Position: risk.PositionRiskConfig{
			StopProfitPct: 1.5,  // Take profit at 150% (based on margin)
			StopLossPct:   0.8,  // Stop loss at 80% (based on margin)
			OnBreach:      risk.PositionBreachClosePosition,
			Cooldown:      "15m", // 15 minutes cooldown
		},
		Symbols: map[string]risk.SymbolRiskOverride{
			"BTCUSDT": {
				Position: &risk.PositionRiskConfig{
					StopProfitPct: 2.0, // Override: 200% for BTC
					StopLossPct:   1.0, // Override: 100% for BTC
				},
			},
			"ETHUSDT": {
				Position: &risk.PositionRiskConfig{
					OnBreach:    risk.PositionBreachReducePosition,
					ReduceRatio: &reduceRatio, // Reduce by 50%
				},
			},
		},
	}

	// 2. Create engine
	opts := &risk.RiskEngineOptions{
		EnableAudit:     true,
		MaxAuditEntries: 1000,
	}
	engine := risk.NewRiskEngine(config, opts)

	// 3. Subscribe to decision events
	unsubscribe := engine.OnDecision(func(decisions []risk.RiskDecision) {
		for _, d := range decisions {
			fmt.Printf("[%s] %s: %s\n", d.Level, d.Action, d.Reason)
		}
	})
	defer unsubscribe()

	// 4. Evaluate risk
	ctx := risk.RiskContext{
		Now: time.Now(),
		Account: risk.AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -100,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []risk.PositionSnapshot{
			{
				Symbol:        "BTCUSDT",
				Market:        risk.MarketFutures,
				Side:          risk.PositionSideLong,
				Qty:           0.1,
				EntryPrice:    50000,
				MarkPrice:     55000,
				MarginUsed:    1000,
				UnrealizedPnl: 500,
			},
		},
	}

	decisions := engine.Evaluate(ctx)

	// 5. Process decisions
	for _, decision := range decisions {
		switch decision.Action {
		case risk.RiskActionBlockTrading:
			fmt.Println("Action: Block all trading")
		case risk.RiskActionCloseAll:
			fmt.Println("Action: Close all positions")
		case risk.RiskActionClosePosition:
			if decision.Symbol != nil {
				fmt.Printf("Action: Close position %s\n", *decision.Symbol)
			}
		case risk.RiskActionReducePosition:
			if decision.Symbol != nil && decision.Params != nil && decision.Params.ReduceRatio != nil {
				fmt.Printf("Action: Reduce position %s by %.0f%%\n",
					*decision.Symbol, *decision.Params.ReduceRatio*100)
			}
		}
	}

	// 6. Check audit log
	auditLog := engine.GetAuditLog()
	fmt.Printf("Audit log entries: %d\n", len(auditLog))
}

func ExampleRiskEngine_accountRisk() {
	config := risk.RiskConfig{
		Account: risk.AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          risk.AccountBreachBlockTrading,
		},
		Position: risk.PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      risk.PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := risk.NewRiskEngine(config, nil)

	ctx := risk.RiskContext{
		Now: time.Now(),
		Account: risk.AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -600, // Exceeds max daily loss
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []risk.PositionSnapshot{},
	}

	decisions := engine.Evaluate(ctx)

	for _, d := range decisions {
		fmt.Printf("%s: %s\n", d.Action, d.Reason)
	}

	// Output:
	// BLOCK_TRADING: Daily loss -600.00 USDT exceeded max allowed -500.00 USDT
}

func ExampleRiskEngine_positionRisk() {
	config := risk.RiskConfig{
		Account: risk.AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          risk.AccountBreachBlockTrading,
		},
		Position: risk.PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      risk.PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := risk.NewRiskEngine(config, nil)

	ctx := risk.RiskContext{
		Now: time.Now(),
		Account: risk.AccountSnapshot{
			Equity:          10000,
			DailyPnl:        500,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []risk.PositionSnapshot{
			{
				Symbol:        "BTCUSDT",
				Market:        risk.MarketFutures,
				Side:          risk.PositionSideLong,
				Qty:           0.1,
				EntryPrice:    50000,
				MarkPrice:     55000,
				MarginUsed:    1000,
				UnrealizedPnl: 1600, // 160% profit
			},
		},
	}

	decisions := engine.Evaluate(ctx)

	for _, d := range decisions {
		fmt.Printf("%s: %s\n", d.Action, d.Reason)
	}

	// Output:
	// CLOSE_POSITION: [BTCUSDT] Take profit triggered: PnL 160.00% >= 150.00%
}
