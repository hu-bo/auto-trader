package risk

import "fmt"

// AccountRiskEvaluator evaluates account-level risk
// This is a system-level hard gate that blocks all trading when breached
type AccountRiskEvaluator struct {
	config AccountRiskConfig
}

// NewAccountRiskEvaluator creates a new AccountRiskEvaluator
func NewAccountRiskEvaluator(config AccountRiskConfig) *AccountRiskEvaluator {
	return &AccountRiskEvaluator{
		config: config,
	}
}

// Evaluate performs account-level risk evaluation
func (e *AccountRiskEvaluator) Evaluate(ctx RiskContext, state *RiskState) []EvaluationResult {
	var results []EvaluationResult

	// If account is already blocked, don't trigger again
	if state.AccountBlocked {
		return results
	}

	// Check daily loss limit
	dailyLossResult := e.checkDailyLoss(ctx)
	if dailyLossResult.Triggered {
		results = append(results, dailyLossResult)
		// Once account-level risk is triggered, return immediately
		return results
	}

	// Check margin usage
	marginUsageResult := e.checkMarginUsage(ctx)
	if marginUsageResult.Triggered {
		results = append(results, marginUsageResult)
	}

	return results
}

// checkDailyLoss checks if daily loss exceeds the maximum allowed
func (e *AccountRiskEvaluator) checkDailyLoss(ctx RiskContext) EvaluationResult {
	dailyPnl := ctx.Account.DailyPnl
	maxDailyLoss := e.config.MaxDailyLoss

	if dailyPnl <= -maxDailyLoss {
		decision := RiskDecision{
			Level:  RiskLevelAccount,
			Action: RiskAction(e.config.OnBreach),
			Reason: fmt.Sprintf("Daily loss %.2f USDT exceeded max allowed -%.2f USDT",
				dailyPnl, maxDailyLoss),
			Timestamp: ctx.Now,
		}

		return EvaluationResult{
			Triggered: true,
			Decision:  &decision,
		}
	}

	return EvaluationResult{Triggered: false}
}

// checkMarginUsage checks if margin usage exceeds the maximum allowed
func (e *AccountRiskEvaluator) checkMarginUsage(ctx RiskContext) EvaluationResult {
	marginUsagePct := CalculateMarginUsagePct(ctx.Account)
	maxMarginUsagePct := e.config.MaxMarginUsagePct

	if marginUsagePct >= maxMarginUsagePct {
		decision := RiskDecision{
			Level:  RiskLevelAccount,
			Action: RiskAction(e.config.OnBreach),
			Reason: fmt.Sprintf("Margin usage %s exceeded max allowed %s",
				FormatPct(marginUsagePct, 2), FormatPct(maxMarginUsagePct, 2)),
			Timestamp: ctx.Now,
		}

		return EvaluationResult{
			Triggered: true,
			Decision:  &decision,
		}
	}

	return EvaluationResult{Triggered: false}
}
