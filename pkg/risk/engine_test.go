package risk

import (
	"testing"
	"time"
)

func TestRiskEngine_AccountRisk_DailyLoss(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := NewRiskEngine(config, nil)

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -600, // Exceeds max daily loss
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{},
	}

	decisions := engine.Evaluate(ctx)

	if len(decisions) != 1 {
		t.Fatalf("Expected 1 decision, got %d", len(decisions))
	}

	decision := decisions[0]
	if decision.Level != RiskLevelAccount {
		t.Errorf("Expected ACCOUNT level, got %s", decision.Level)
	}
	if decision.Action != RiskActionBlockTrading {
		t.Errorf("Expected BLOCK_TRADING action, got %s", decision.Action)
	}
	if !engine.IsAccountBlocked() {
		t.Errorf("Expected account to be blocked")
	}
}

func TestRiskEngine_AccountRisk_MarginUsage(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachCloseAll,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := NewRiskEngine(config, nil)

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -100,
			MarginUsed:      9000, // 90% usage, exceeds 80%
			MarginAvailable: 1000,
		},
		Positions: []PositionSnapshot{},
	}

	decisions := engine.Evaluate(ctx)

	if len(decisions) != 1 {
		t.Fatalf("Expected 1 decision, got %d", len(decisions))
	}

	decision := decisions[0]
	if decision.Action != RiskActionCloseAll {
		t.Errorf("Expected CLOSE_ALL action, got %s", decision.Action)
	}
}

func TestRiskEngine_PositionRisk_TakeProfit(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := NewRiskEngine(config, nil)

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        500,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{
			{
				Symbol:        "BTCUSDT",
				Market:        MarketFutures,
				Side:          PositionSideLong,
				Qty:           0.1,
				EntryPrice:    50000,
				MarkPrice:     55000,
				MarginUsed:    1000,
				UnrealizedPnl: 1600, // 160% profit, exceeds 150%
			},
		},
	}

	decisions := engine.Evaluate(ctx)

	if len(decisions) != 1 {
		t.Fatalf("Expected 1 decision, got %d", len(decisions))
	}

	decision := decisions[0]
	if decision.Level != RiskLevelPosition {
		t.Errorf("Expected POSITION level, got %s", decision.Level)
	}
	if decision.Action != RiskActionClosePosition {
		t.Errorf("Expected CLOSE_POSITION action, got %s", decision.Action)
	}
	if decision.Symbol == nil || *decision.Symbol != "BTCUSDT" {
		t.Errorf("Expected symbol BTCUSDT")
	}
}

func TestRiskEngine_PositionRisk_StopLoss(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := NewRiskEngine(config, nil)

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -300,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{
			{
				Symbol:        "ETHUSDT",
				Market:        MarketFutures,
				Side:          PositionSideShort,
				Qty:           1.0,
				EntryPrice:    3000,
				MarkPrice:     3200,
				MarginUsed:    1000,
				UnrealizedPnl: -900, // -90% loss, exceeds -80%
			},
		},
	}

	decisions := engine.Evaluate(ctx)

	if len(decisions) != 1 {
		t.Fatalf("Expected 1 decision, got %d", len(decisions))
	}

	decision := decisions[0]
	if decision.Level != RiskLevelPosition {
		t.Errorf("Expected POSITION level, got %s", decision.Level)
	}
	if decision.Symbol == nil || *decision.Symbol != "ETHUSDT" {
		t.Errorf("Expected symbol ETHUSDT")
	}
}

func TestRiskEngine_SymbolOverride(t *testing.T) {
	reduceRatio := 0.5
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
		Symbols: map[string]SymbolRiskOverride{
			"BTCUSDT": {
				Position: &PositionRiskConfig{
					StopProfitPct: 2.0, // Override: 200%
					StopLossPct:   1.0, // Override: 100%
					OnBreach:      PositionBreachReducePosition,
					ReduceRatio:   &reduceRatio,
					Cooldown:      "15m",
				},
			},
		},
	}

	engine := NewRiskEngine(config, nil)

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        500,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{
			{
				Symbol:        "BTCUSDT",
				Market:        MarketFutures,
				Side:          PositionSideLong,
				Qty:           0.1,
				EntryPrice:    50000,
				MarkPrice:     55000,
				MarginUsed:    1000,
				UnrealizedPnl: 2100, // 210% profit, exceeds 200% override
			},
		},
	}

	decisions := engine.Evaluate(ctx)

	if len(decisions) != 1 {
		t.Fatalf("Expected 1 decision, got %d", len(decisions))
	}

	decision := decisions[0]
	if decision.Action != RiskActionReducePosition {
		t.Errorf("Expected REDUCE_POSITION action, got %s", decision.Action)
	}
	if decision.Params == nil || decision.Params.ReduceRatio == nil {
		t.Errorf("Expected reduce ratio parameter")
	} else if *decision.Params.ReduceRatio != 0.5 {
		t.Errorf("Expected reduce ratio 0.5, got %f", *decision.Params.ReduceRatio)
	}
}

func TestRiskEngine_EventHandler(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := NewRiskEngine(config, nil)

	var receivedDecisions []RiskDecision
	unsubscribe := engine.OnDecision(func(decisions []RiskDecision) {
		receivedDecisions = append(receivedDecisions, decisions...)
	})
	defer unsubscribe()

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -600,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{},
	}

	engine.Evaluate(ctx)

	if len(receivedDecisions) != 1 {
		t.Fatalf("Expected 1 decision in handler, got %d", len(receivedDecisions))
	}
}

func TestRiskEngine_AuditLog(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	opts := &RiskEngineOptions{
		EnableAudit:     true,
		MaxAuditEntries: 100,
	}

	engine := NewRiskEngine(config, opts)

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -600,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{},
	}

	engine.Evaluate(ctx)

	auditLog := engine.GetAuditLog()
	if len(auditLog) != 1 {
		t.Fatalf("Expected 1 audit entry, got %d", len(auditLog))
	}

	entry := auditLog[0]
	if entry.TriggeredRule != "ACCOUNT" {
		t.Errorf("Expected triggered rule ACCOUNT, got %s", entry.TriggeredRule)
	}
}

func TestRiskEngine_Cooldown(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := NewRiskEngine(config, nil)

	now := time.Now()

	ctx := RiskContext{
		Now: now,
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        500,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{
			{
				Symbol:        "BTCUSDT",
				Market:        MarketFutures,
				Side:          PositionSideLong,
				Qty:           0.1,
				EntryPrice:    50000,
				MarkPrice:     55000,
				MarginUsed:    1000,
				UnrealizedPnl: 1600, // 160% profit
			},
		},
	}

	// First evaluation - should trigger
	decisions := engine.Evaluate(ctx)
	if len(decisions) != 1 {
		t.Fatalf("Expected 1 decision on first evaluation, got %d", len(decisions))
	}

	// Second evaluation 5 minutes later - should NOT trigger (still in cooldown)
	ctx.Now = now.Add(5 * time.Minute)
	decisions = engine.Evaluate(ctx)
	if len(decisions) != 0 {
		t.Fatalf("Expected 0 decisions during cooldown, got %d", len(decisions))
	}

	// Third evaluation 20 minutes later - should trigger again (cooldown expired)
	ctx.Now = now.Add(20 * time.Minute)
	decisions = engine.Evaluate(ctx)
	if len(decisions) != 1 {
		t.Fatalf("Expected 1 decision after cooldown, got %d", len(decisions))
	}
}

func TestRiskEngine_ResetAccountBlock(t *testing.T) {
	config := RiskConfig{
		Account: AccountRiskConfig{
			MaxDailyLoss:      500,
			MaxMarginUsagePct: 0.8,
			OnBreach:          AccountBreachBlockTrading,
		},
		Position: PositionRiskConfig{
			StopProfitPct: 1.5,
			StopLossPct:   0.8,
			OnBreach:      PositionBreachClosePosition,
			Cooldown:      "15m",
		},
	}

	engine := NewRiskEngine(config, nil)

	ctx := RiskContext{
		Now: time.Now(),
		Account: AccountSnapshot{
			Equity:          10000,
			DailyPnl:        -600,
			MarginUsed:      5000,
			MarginAvailable: 5000,
		},
		Positions: []PositionSnapshot{},
	}

	engine.Evaluate(ctx)

	if !engine.IsAccountBlocked() {
		t.Errorf("Expected account to be blocked")
	}

	engine.ResetAccountBlock()

	if engine.IsAccountBlocked() {
		t.Errorf("Expected account to be unblocked after reset")
	}
}
