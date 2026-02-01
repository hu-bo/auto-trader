package risk

import (
	"sync"
)

// RiskEventHandler is a callback function for risk decisions
type RiskEventHandler func(decisions []RiskDecision)

// RiskEngineOptions contains options for creating a RiskEngine
type RiskEngineOptions struct {
	// Enable audit logging
	EnableAudit bool
	// Maximum number of audit entries to keep
	MaxAuditEntries int
}

// RiskEngine is the core risk control engine
// Execution order (fixed):
// 1️⃣ Account Risk - system-level hard gate
// 2️⃣ Symbol Override Resolution
// 3️⃣ Position Risk - only executed if account is not blocked
type RiskEngine struct {
	accountEvaluator  *AccountRiskEvaluator
	positionEvaluator *PositionRiskEvaluator
	state             *RiskState
	options           RiskEngineOptions
	config            RiskConfig

	// Audit log
	auditLog   []RiskAuditEntry
	auditMutex sync.RWMutex

	// Event handlers
	eventHandlers map[int]RiskEventHandler
	handlerIDSeq  int
	handlerMutex  sync.RWMutex

	// State mutex for thread-safe operations
	stateMutex sync.RWMutex
}

// NewRiskEngine creates a new RiskEngine instance
func NewRiskEngine(config RiskConfig, opts *RiskEngineOptions) *RiskEngine {
	options := RiskEngineOptions{
		EnableAudit:     false,
		MaxAuditEntries: 1000,
	}

	if opts != nil {
		if opts.EnableAudit {
			options.EnableAudit = true
		}
		if opts.MaxAuditEntries > 0 {
			options.MaxAuditEntries = opts.MaxAuditEntries
		}
	}

	return &RiskEngine{
		accountEvaluator:  NewAccountRiskEvaluator(config.Account),
		positionEvaluator: NewPositionRiskEvaluator(config.Position, config.Symbols),
		state:             CreateInitialState(),
		options:           options,
		config:            config,
		auditLog:          make([]RiskAuditEntry, 0),
		eventHandlers:     make(map[int]RiskEventHandler),
		handlerIDSeq:      0,
	}
}

// Evaluate performs risk evaluation and returns risk decisions
func (e *RiskEngine) Evaluate(ctx RiskContext) []RiskDecision {
	decisions := make([]RiskDecision, 0)

	e.stateMutex.Lock()
	defer e.stateMutex.Unlock()

	// 1️⃣ Account Risk - system-level hard gate
	accountResults := e.accountEvaluator.Evaluate(ctx, e.state)
	for _, result := range accountResults {
		if result.Triggered && result.Decision != nil {
			decisions = append(decisions, *result.Decision)
			e.state.AccountBlocked = true
			now := ctx.Now
			e.state.AccountBlockedAt = &now

			// Record audit log
			e.recordAudit(ctx, "ACCOUNT", *result.Decision)
		}
	}

	// If account is blocked, don't execute position-level risk control
	if e.state.AccountBlocked {
		e.emitDecisions(decisions)
		return decisions
	}

	// 2️⃣ + 3️⃣ Position Risk (includes Symbol Override Resolution)
	positionResults := e.positionEvaluator.Evaluate(ctx, e.state)
	for _, result := range positionResults {
		if result.Triggered && result.Decision != nil {
			decisions = append(decisions, *result.Decision)

			// Update position risk state
			if result.Decision.Symbol != nil {
				for _, position := range ctx.Positions {
					if position.Symbol == *result.Decision.Symbol {
						key := GetPositionKey(position.Symbol, position.Side)
						e.state.Positions[key] = &PositionRiskState{
							LastBreachAt: ctx.Now,
						}
						break
					}
				}
			}

			// Record audit log
			e.recordAudit(ctx, "POSITION", *result.Decision)
		}
	}

	e.emitDecisions(decisions)
	return decisions
}

// OnDecision subscribes to risk decision events
// Returns an unsubscribe function
func (e *RiskEngine) OnDecision(handler RiskEventHandler) func() {
	e.handlerMutex.Lock()
	defer e.handlerMutex.Unlock()

	e.handlerIDSeq++
	handlerID := e.handlerIDSeq
	e.eventHandlers[handlerID] = handler

	return func() {
		e.handlerMutex.Lock()
		defer e.handlerMutex.Unlock()
		delete(e.eventHandlers, handlerID)
	}
}

// GetState returns the current risk state (read-only copy)
func (e *RiskEngine) GetState() RiskState {
	e.stateMutex.RLock()
	defer e.stateMutex.RUnlock()

	// Return a shallow copy
	stateCopy := *e.state
	stateCopy.Positions = make(map[string]*PositionRiskState)
	for k, v := range e.state.Positions {
		posCopy := *v
		stateCopy.Positions[k] = &posCopy
	}

	return stateCopy
}

// IsAccountBlocked checks if the account is blocked
func (e *RiskEngine) IsAccountBlocked() bool {
	e.stateMutex.RLock()
	defer e.stateMutex.RUnlock()
	return e.state.AccountBlocked
}

// ResetAccountBlock resets the account block status
func (e *RiskEngine) ResetAccountBlock() {
	e.stateMutex.Lock()
	defer e.stateMutex.Unlock()
	e.state.AccountBlocked = false
	e.state.AccountBlockedAt = nil
}

// ResetPositionCooldown resets the cooldown status for a specific position
func (e *RiskEngine) ResetPositionCooldown(symbol string, side PositionSide) {
	e.stateMutex.Lock()
	defer e.stateMutex.Unlock()
	key := GetPositionKey(symbol, side)
	delete(e.state.Positions, key)
}

// GetAuditLog returns the audit log (read-only copy)
func (e *RiskEngine) GetAuditLog() []RiskAuditEntry {
	e.auditMutex.RLock()
	defer e.auditMutex.RUnlock()

	// Return a copy to prevent external modification
	logCopy := make([]RiskAuditEntry, len(e.auditLog))
	copy(logCopy, e.auditLog)
	return logCopy
}

// ClearAuditLog clears the audit log
func (e *RiskEngine) ClearAuditLog() {
	e.auditMutex.Lock()
	defer e.auditMutex.Unlock()
	e.auditLog = make([]RiskAuditEntry, 0)
}

// GetConfig returns the current configuration (read-only)
func (e *RiskEngine) GetConfig() RiskConfig {
	return e.config
}

// Destroy cleans up engine resources
func (e *RiskEngine) Destroy() {
	e.handlerMutex.Lock()
	e.eventHandlers = make(map[int]RiskEventHandler)
	e.handlerMutex.Unlock()

	e.auditMutex.Lock()
	e.auditLog = make([]RiskAuditEntry, 0)
	e.auditMutex.Unlock()

	e.stateMutex.Lock()
	e.state.Positions = make(map[string]*PositionRiskState)
	e.stateMutex.Unlock()
}

// emitDecisions emits decisions to all registered event handlers
func (e *RiskEngine) emitDecisions(decisions []RiskDecision) {
	if len(decisions) == 0 {
		return
	}

	e.handlerMutex.RLock()
	handlers := make([]RiskEventHandler, 0, len(e.eventHandlers))
	for _, handler := range e.eventHandlers {
		handlers = append(handlers, handler)
	}
	e.handlerMutex.RUnlock()

	// Call handlers outside of lock to prevent deadlocks
	for _, handler := range handlers {
		// Ignore handler errors to avoid affecting the engine
		func() {
			defer func() {
				if r := recover(); r != nil {
					// Ignore panics in handlers
				}
			}()
			handler(decisions)
		}()
	}
}

// recordAudit records an audit log entry
func (e *RiskEngine) recordAudit(ctx RiskContext, triggeredRule string, decision RiskDecision) {
	if !e.options.EnableAudit {
		return
	}

	e.auditMutex.Lock()
	defer e.auditMutex.Unlock()

	// Clone the context for audit logging
	clonedCtx, err := deepCloneRiskContext(ctx)
	if err != nil {
		// If cloning fails, skip audit logging
		return
	}

	entry := RiskAuditEntry{
		Timestamp:     ctx.Now,
		InputSnapshot: clonedCtx,
		TriggeredRule: triggeredRule,
		Decision:      decision,
	}

	e.auditLog = append(e.auditLog, entry)

	// Limit audit log size
	if len(e.auditLog) > e.options.MaxAuditEntries {
		e.auditLog = e.auditLog[1:]
	}
}
