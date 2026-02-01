// Package risk provides a pluggable, replayable, and explainable risk control engine for trading systems.
package risk

import "time"

// ============================================
// Market Types
// ============================================

// Market represents the market type
type Market string

const (
	MarketFutures  Market = "FUTURES"
	MarketDelivery Market = "DELIVERY"
	MarketSpot     Market = "SPOT"
)

// PositionSide represents the position direction
type PositionSide string

const (
	PositionSideLong  PositionSide = "LONG"
	PositionSideShort PositionSide = "SHORT"
)

// ============================================
// Account Breach Actions
// ============================================

// AccountBreachAction represents account-level breach actions
type AccountBreachAction string

const (
	AccountBreachBlockTrading AccountBreachAction = "BLOCK_TRADING"
	AccountBreachCloseAll     AccountBreachAction = "CLOSE_ALL"
)

// PositionBreachAction represents position-level breach actions
type PositionBreachAction string

const (
	PositionBreachClosePosition  PositionBreachAction = "CLOSE_POSITION"
	PositionBreachReducePosition PositionBreachAction = "REDUCE_POSITION"
)

// ============================================
// Risk Decision
// ============================================

// RiskAction represents all possible risk actions
type RiskAction string

const (
	RiskActionBlockTrading   RiskAction = "BLOCK_TRADING"
	RiskActionCloseAll       RiskAction = "CLOSE_ALL"
	RiskActionClosePosition  RiskAction = "CLOSE_POSITION"
	RiskActionReducePosition RiskAction = "REDUCE_POSITION"
)

// RiskLevel represents the risk evaluation level
type RiskLevel string

const (
	RiskLevelAccount  RiskLevel = "ACCOUNT"
	RiskLevelPosition RiskLevel = "POSITION"
)

// RiskDecision represents the output of risk engine evaluation
type RiskDecision struct {
	// Risk level
	Level RiskLevel `json:"level"`
	// Triggered symbol (only for POSITION level)
	Symbol *string `json:"symbol,omitempty"`
	// Risk action
	Action RiskAction `json:"action"`
	// Action parameters
	Params *RiskDecisionParams `json:"params,omitempty"`
	// Trigger reason
	Reason string `json:"reason"`
	// Trigger timestamp
	Timestamp time.Time `json:"timestamp"`
}

// RiskDecisionParams contains optional parameters for risk decisions
type RiskDecisionParams struct {
	// Reduce ratio (for REDUCE_POSITION action)
	ReduceRatio *float64 `json:"reduceRatio,omitempty"`
}

// ============================================
// Position Snapshot
// ============================================

// PositionSnapshot represents a unified position abstraction (across futures/delivery/spot)
type PositionSnapshot struct {
	// Trading pair symbol
	Symbol string `json:"symbol"`
	// Market type
	Market Market `json:"market"`
	// Position side
	Side PositionSide `json:"side"`
	// Position quantity
	Qty float64 `json:"qty"`
	// Average entry price
	EntryPrice float64 `json:"entryPrice"`
	// Current mark price
	MarkPrice float64 `json:"markPrice"`
	// Margin used
	MarginUsed float64 `json:"marginUsed"`
	// Unrealized PnL
	UnrealizedPnl float64 `json:"unrealizedPnl"`
	// Leverage (optional)
	Leverage *float64 `json:"leverage,omitempty"`
}

// ============================================
// Account Snapshot
// ============================================

// AccountSnapshot represents account state snapshot
type AccountSnapshot struct {
	// Account equity
	Equity float64 `json:"equity"`
	// Daily PnL
	DailyPnl float64 `json:"dailyPnl"`
	// Used margin
	MarginUsed float64 `json:"marginUsed"`
	// Available margin
	MarginAvailable float64 `json:"marginAvailable"`
}

// ============================================
// Risk Context (Engine Input)
// ============================================

// RiskContext represents the input context for risk evaluation
type RiskContext struct {
	// Current timestamp
	Now time.Time `json:"now"`
	// Account snapshot
	Account AccountSnapshot `json:"account"`
	// Position snapshots
	Positions []PositionSnapshot `json:"positions"`
}

// ============================================
// Risk Configuration
// ============================================

// AccountRiskConfig represents account-level risk configuration
type AccountRiskConfig struct {
	// Maximum daily loss (USDT)
	MaxDailyLoss float64 `json:"maxDailyLoss"`
	// Maximum margin usage percentage (0-1)
	MaxMarginUsagePct float64 `json:"maxMarginUsagePct"`
	// Breach action
	OnBreach AccountBreachAction `json:"onBreach"`
}

// PositionRiskConfig represents position-level risk configuration
type PositionRiskConfig struct {
	// Take profit percentage (based on margin PnL ratio)
	StopProfitPct float64 `json:"stopProfitPct"`
	// Stop loss percentage (based on margin PnL ratio)
	StopLossPct float64 `json:"stopLossPct"`
	// Maximum loss per position (USDT, optional)
	MaxLossPerPosition *float64 `json:"maxLossPerPosition,omitempty"`
	// Breach action
	OnBreach PositionBreachAction `json:"onBreach"`
	// Reduce ratio (only used for REDUCE_POSITION, 0-1)
	ReduceRatio *float64 `json:"reduceRatio,omitempty"`
	// Cooldown duration (milliseconds or duration string like "15m")
	Cooldown interface{} `json:"cooldown"` // Can be int64 (milliseconds) or string ("15m", "1h", etc.)
}

// SymbolRiskOverride represents symbol-specific risk configuration override
type SymbolRiskOverride struct {
	Position *PositionRiskConfig `json:"position,omitempty"`
}

// RiskConfig represents the complete risk configuration
type RiskConfig struct {
	// Account-level risk configuration
	Account AccountRiskConfig `json:"account"`
	// Position-level risk configuration (default)
	Position PositionRiskConfig `json:"position"`
	// Symbol-specific overrides
	Symbols map[string]SymbolRiskOverride `json:"symbols,omitempty"`
}

// ============================================
// Risk State (Internal)
// ============================================

// PositionRiskState represents position risk state
type PositionRiskState struct {
	// Last breach timestamp
	LastBreachAt time.Time `json:"lastBreachAt"`
}

// RiskState represents risk state storage
type RiskState struct {
	// Whether account is blocked
	AccountBlocked bool `json:"accountBlocked"`
	// Account block timestamp
	AccountBlockedAt *time.Time `json:"accountBlockedAt,omitempty"`
	// Position risk states (key: "SYMBOL:SIDE")
	Positions map[string]*PositionRiskState `json:"positions"`
}

// ============================================
// Audit Log
// ============================================

// RiskAuditEntry represents an audit log entry
type RiskAuditEntry struct {
	// Timestamp
	Timestamp time.Time `json:"timestamp"`
	// Input snapshot
	InputSnapshot RiskContext `json:"inputSnapshot"`
	// Triggered rule
	TriggeredRule string `json:"triggeredRule"`
	// Decision output
	Decision RiskDecision `json:"decision"`
}

// ============================================
// Evaluator Interface
// ============================================

// EvaluationResult represents the result of risk evaluation
type EvaluationResult struct {
	// Whether risk was triggered
	Triggered bool `json:"triggered"`
	// Decision (when triggered)
	Decision *RiskDecision `json:"decision,omitempty"`
}

// RiskEvaluator defines the interface for risk evaluators
type RiskEvaluator interface {
	// Evaluate performs risk evaluation
	Evaluate(ctx RiskContext, state *RiskState) []EvaluationResult
}
