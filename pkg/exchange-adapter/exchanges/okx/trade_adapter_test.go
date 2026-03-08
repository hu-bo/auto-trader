package okx

import (
	"testing"

	"github.com/pkg/exchange-adapter/core"
)

func floatPtr(v float64) *float64 {
	return &v
}

func TestBuildOkxAttachAlgoOrd_DefaultsOrderPxToMarket(t *testing.T) {
	trigger := 123.45
	order := buildOkxAttachAlgoOrd(core.StrategyAttachedOrder{
		TPTriggerPrice: &trigger,
	})

	if order.TPTriggerPx != "123.45" {
		t.Fatalf("expected TPTriggerPx=123.45, got %q", order.TPTriggerPx)
	}
	if order.TPOrdPx != "-1" {
		t.Fatalf("expected TPOrdPx=-1, got %q", order.TPOrdPx)
	}
}

func TestBuildOkxAttachAlgoOrd_RespectsExplicitOrderPx(t *testing.T) {
	trigger := 200.0
	order := buildOkxAttachAlgoOrd(core.StrategyAttachedOrder{
		TPTriggerPrice: &trigger,
		TPOrderPrice:   floatPtr(199.9),
	})

	if order.TPOrdPx != "199.9" {
		t.Fatalf("expected TPOrdPx=199.9, got %q", order.TPOrdPx)
	}
}

func TestBuildOkxAttachAlgoOrd_NegativeOrderPxBecomesMarket(t *testing.T) {
	trigger := 200.0
	order := buildOkxAttachAlgoOrd(core.StrategyAttachedOrder{
		TPTriggerPrice: &trigger,
		TPOrderPrice:   floatPtr(-1),
	})

	if order.TPOrdPx != "-1" {
		t.Fatalf("expected TPOrdPx=-1, got %q", order.TPOrdPx)
	}
}

func TestBuildOkxAttachAlgoOrd_StopLossDefaults(t *testing.T) {
	slTrigger := 88.0
	order := buildOkxAttachAlgoOrd(core.StrategyAttachedOrder{
		SLTriggerPrice: &slTrigger,
	})

	if order.SLTriggerPx != "88" {
		t.Fatalf("expected SLTriggerPx=88, got %q", order.SLTriggerPx)
	}
	if order.SLOrdPx != "-1" {
		t.Fatalf("expected SLOrdPx=-1, got %q", order.SLOrdPx)
	}
}

func TestBuildOkxAttachAlgoOrd_TriggerPriceType(t *testing.T) {
	trigger := 150.5
	tpt := core.TriggerPriceTypeMark
	order := buildOkxAttachAlgoOrd(core.StrategyAttachedOrder{
		TPTriggerPrice:     &trigger,
		TPTriggerPriceType: &tpt,
	})

	if order.TPTriggerPxType != "mark" {
		t.Fatalf("expected TPTriggerPxType=mark, got %q", order.TPTriggerPxType)
	}
}
