package risk

import (
	"fmt"
	"time"
)

// PositionRiskEvaluator evaluates position-level risk
// Supports take profit, stop loss, and position reduction
type PositionRiskEvaluator struct {
	defaultConfig   PositionRiskConfig
	symbolOverrides map[string]SymbolRiskOverride
}

// NewPositionRiskEvaluator creates a new PositionRiskEvaluator
func NewPositionRiskEvaluator(
	defaultConfig PositionRiskConfig,
	symbolOverrides map[string]SymbolRiskOverride,
) *PositionRiskEvaluator {
	if symbolOverrides == nil {
		symbolOverrides = make(map[string]SymbolRiskOverride)
	}
	return &PositionRiskEvaluator{
		defaultConfig:   defaultConfig,
		symbolOverrides: symbolOverrides,
	}
}

// Evaluate performs position-level risk evaluation
func (e *PositionRiskEvaluator) Evaluate(ctx RiskContext, state *RiskState) []EvaluationResult {
	var results []EvaluationResult

	for _, position := range ctx.Positions {
		// Skip empty positions
		if position.Qty == 0 {
			continue
		}

		result := e.evaluatePosition(position, ctx, state)
		if result.Triggered {
			results = append(results, result)
		}
	}

	return results
}

// evaluatePosition evaluates a single position
func (e *PositionRiskEvaluator) evaluatePosition(
	position PositionSnapshot,
	ctx RiskContext,
	state *RiskState,
) EvaluationResult {
	config := e.getConfigForSymbol(position.Symbol)
	positionKey := GetPositionKey(position.Symbol, position.Side)

	// Check cooldown period
	if e.isInCooldown(positionKey, ctx.Now, config, state) {
		return EvaluationResult{Triggered: false}
	}

	// Calculate PnL percentage (based on margin)
	pnlPct := CalculatePnlPct(position)

	// Check take profit
	if pnlPct >= config.StopProfitPct {
		return e.createDecision(position, config, ctx.Now, "STOP_PROFIT", pnlPct)
	}

	// Check stop loss
	if pnlPct <= -config.StopLossPct {
		return e.createDecision(position, config, ctx.Now, "STOP_LOSS", pnlPct)
	}

	// Check max loss per position
	if config.MaxLossPerPosition != nil &&
		position.UnrealizedPnl <= -*config.MaxLossPerPosition {
		return e.createDecision(position, config, ctx.Now, "MAX_LOSS_PER_POSITION", pnlPct)
	}

	return EvaluationResult{Triggered: false}
}

// getConfigForSymbol returns the configuration for a specific symbol
// Merges default config with symbol-specific overrides
func (e *PositionRiskEvaluator) getConfigForSymbol(symbol string) PositionRiskConfig {
	override, exists := e.symbolOverrides[symbol]
	if !exists || override.Position == nil {
		return e.defaultConfig
	}
	return DeepMerge(e.defaultConfig, *override.Position)
}

// isInCooldown checks if a position is still in cooldown period
func (e *PositionRiskEvaluator) isInCooldown(
	positionKey string,
	now time.Time,
	config PositionRiskConfig,
	state *RiskState,
) bool {
	positionState, exists := state.Positions[positionKey]
	if !exists {
		return false
	}

	cooldownDuration, err := ParseCooldown(config.Cooldown)
	if err != nil {
		// If cooldown parsing fails, consider it not in cooldown
		return false
	}

	return now.Sub(positionState.LastBreachAt) < cooldownDuration
}

// createDecision creates a risk decision based on trigger type
func (e *PositionRiskEvaluator) createDecision(
	position PositionSnapshot,
	config PositionRiskConfig,
	now time.Time,
	triggerType string,
	pnlPct float64,
) EvaluationResult {
	var reason string

	switch triggerType {
	case "STOP_PROFIT":
		reason = fmt.Sprintf("[%s] Take profit triggered: PnL %s >= %s",
			position.Symbol,
			FormatPct(pnlPct, 2),
			FormatPct(config.StopProfitPct, 2))
	case "STOP_LOSS":
		reason = fmt.Sprintf("[%s] Stop loss triggered: PnL %s <= -%s",
			position.Symbol,
			FormatPct(pnlPct, 2),
			FormatPct(config.StopLossPct, 2))
	case "MAX_LOSS_PER_POSITION":
		reason = fmt.Sprintf("[%s] Max loss per position triggered: Loss %.2f USDT >= %.2f USDT",
			position.Symbol,
			position.UnrealizedPnl,
			*config.MaxLossPerPosition)
	}

	decision := RiskDecision{
		Level:     RiskLevelPosition,
		Symbol:    StringPtr(position.Symbol),
		Action:    RiskAction(config.OnBreach),
		Reason:    reason,
		Timestamp: now,
	}

	if config.OnBreach == PositionBreachReducePosition && config.ReduceRatio != nil {
		decision.Params = &RiskDecisionParams{
			ReduceRatio: config.ReduceRatio,
		}
	}

	return EvaluationResult{
		Triggered: true,
		Decision:  &decision,
	}
}
