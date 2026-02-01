package core

import "testing"

func TestGetDecimalPlaces(t *testing.T) {
	tests := []struct {
		in   string
		want int
	}{
		{"1", 0},
		{"1.0", 1},
		{"0.001", 3},
		{"0.0100", 4},
	}
	for _, tt := range tests {
		if got := GetDecimalPlaces(tt.in); got != tt.want {
			t.Fatalf("GetDecimalPlaces(%q)=%d want %d", tt.in, got, tt.want)
		}
	}
}

func TestAdjustByStep(t *testing.T) {
	tests := []struct {
		value    string
		stepSize string
		want     string
	}{
		{"1.2345", "0.001", "1.234"},
		{"123.456", "0.01", "123.45"},
		{"123.456", "1", "123"},
		{"1.2345", "0.0100", "1.2300"},
		{"0", "0.001", "0.000"},
	}
	for _, tt := range tests {
		got, err := AdjustByStep(tt.value, tt.stepSize)
		if err != nil {
			t.Fatalf("AdjustByStep(%q,%q) err=%v", tt.value, tt.stepSize, err)
		}
		if got != tt.want {
			t.Fatalf("AdjustByStep(%q,%q)=%q want %q", tt.value, tt.stepSize, got, tt.want)
		}
	}
}
