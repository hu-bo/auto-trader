package risk

import (
	"testing"
	"time"
)

func TestParseDuration(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected int64
		wantErr  bool
	}{
		{"milliseconds", 1000, 1000, false},
		{"15 minutes", "15m", 900000, false},
		{"1 hour", "1h", 3600000, false},
		{"2 days", "2d", 172800000, false},
		{"30 seconds", "30s", 30000, false},
		{"500 milliseconds string", "500ms", 500, false},
		{"invalid format", "15x", 0, true},
		{"invalid type", true, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseDuration(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}
			if result != tt.expected {
				t.Errorf("Expected %d, got %d", tt.expected, result)
			}
		})
	}
}

func TestGetPositionKey(t *testing.T) {
	tests := []struct {
		symbol   string
		side     PositionSide
		expected string
	}{
		{"BTCUSDT", PositionSideLong, "BTCUSDT:LONG"},
		{"ETHUSDT", PositionSideShort, "ETHUSDT:SHORT"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := GetPositionKey(tt.symbol, tt.side)
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestCalculatePnlPct(t *testing.T) {
	tests := []struct {
		name     string
		position PositionSnapshot
		expected float64
	}{
		{
			name: "positive PnL",
			position: PositionSnapshot{
				MarginUsed:    1000,
				UnrealizedPnl: 500,
			},
			expected: 0.5,
		},
		{
			name: "negative PnL",
			position: PositionSnapshot{
				MarginUsed:    1000,
				UnrealizedPnl: -200,
			},
			expected: -0.2,
		},
		{
			name: "zero margin",
			position: PositionSnapshot{
				MarginUsed:    0,
				UnrealizedPnl: 100,
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculatePnlPct(tt.position)
			if result != tt.expected {
				t.Errorf("Expected %f, got %f", tt.expected, result)
			}
		})
	}
}

func TestCalculateMarginUsagePct(t *testing.T) {
	tests := []struct {
		name     string
		account  AccountSnapshot
		expected float64
	}{
		{
			name: "50% margin usage",
			account: AccountSnapshot{
				Equity:     10000,
				MarginUsed: 5000,
			},
			expected: 0.5,
		},
		{
			name: "80% margin usage",
			account: AccountSnapshot{
				Equity:     10000,
				MarginUsed: 8000,
			},
			expected: 0.8,
		},
		{
			name: "zero equity",
			account: AccountSnapshot{
				Equity:     0,
				MarginUsed: 1000,
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateMarginUsagePct(tt.account)
			if result != tt.expected {
				t.Errorf("Expected %f, got %f", tt.expected, result)
			}
		})
	}
}

func TestFormatPct(t *testing.T) {
	tests := []struct {
		name     string
		value    float64
		decimals int
		expected string
	}{
		{"50%", 0.5, 2, "50.00%"},
		{"80.5%", 0.805, 2, "80.50%"},
		{"100%", 1.0, 2, "100.00%"},
		{"12.345%", 0.12345, 3, "12.345%"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatPct(tt.value, tt.decimals)
			if result != tt.expected {
				t.Errorf("Expected %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestDeepMerge(t *testing.T) {
	target := PositionRiskConfig{
		StopProfitPct: 1.5,
		StopLossPct:   0.8,
		OnBreach:      PositionBreachClosePosition,
		Cooldown:      "15m",
	}

	override := PositionRiskConfig{
		StopProfitPct: 2.0,
		StopLossPct:   1.0,
	}

	result := DeepMerge(target, override)

	if result.StopProfitPct != 2.0 {
		t.Errorf("Expected StopProfitPct 2.0, got %f", result.StopProfitPct)
	}
	if result.StopLossPct != 1.0 {
		t.Errorf("Expected StopLossPct 1.0, got %f", result.StopLossPct)
	}
	if result.OnBreach != PositionBreachClosePosition {
		t.Errorf("Expected OnBreach to remain as CLOSE_POSITION")
	}
}

func TestParseCooldown(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected time.Duration
		wantErr  bool
	}{
		{"15 minutes", "15m", 15 * time.Minute, false},
		{"1 hour", "1h", 1 * time.Hour, false},
		{"milliseconds", 60000, 60 * time.Second, false},
		{"invalid", "invalid", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseCooldown(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}
			if result != tt.expected {
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestCreateInitialState(t *testing.T) {
	state := CreateInitialState()

	if state.AccountBlocked {
		t.Errorf("Expected AccountBlocked to be false")
	}
	if state.Positions == nil {
		t.Errorf("Expected Positions map to be initialized")
	}
	if len(state.Positions) != 0 {
		t.Errorf("Expected Positions map to be empty")
	}
}
