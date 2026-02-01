package exampleutil

import (
	"context"
	"fmt"
	"math"
	"strconv"

	"github.com/pkg/exchange-adapter/core"
)

func Ctx(parent context.Context, env Env) (context.Context, context.CancelFunc) {
	if env.Timeout <= 0 {
		return context.WithCancel(parent)
	}
	return context.WithTimeout(parent, env.Timeout)
}

func AssertOK[T any](res core.Result[T], contextLabel string) (T, error) {
	if res.Ok {
		return res.Data, nil
	}
	var zero T
	if res.Error == nil {
		return zero, fmt.Errorf("%s failed: unknown error", contextLabel)
	}
	return zero, fmt.Errorf("%s failed: %s - %s", contextLabel, res.Error.Code, res.Error.Message)
}

func EnsureSymbolLoaded(ctx context.Context, adapter core.PublicAdapter, symbol string, tradeType core.TradeType) (core.SymbolInfo, error) {
	infoRes := adapter.GetSymbolInfo(ctx, symbol, tradeType)
	return AssertOK(infoRes, fmt.Sprintf("load symbol info %s (%s)", symbol, tradeType))
}

func BuildLimitOrder(
	ctx context.Context,
	adapter core.TradeAdapter,
	symbol string,
	tradeType core.TradeType,
	side core.OrderSide,
	positionSide *core.PositionSide,
	multiplier float64,
) (core.PlaceOrderParams, error) {
	info, err := EnsureSymbolLoaded(ctx, adapter, symbol, tradeType)
	if err != nil {
		return core.PlaceOrderParams{}, err
	}

	priceRes := adapter.GetPrice(ctx, symbol, tradeType)
	lastPriceStr, err := AssertOK(priceRes, fmt.Sprintf("%s 价格查询", FormatLabel(adapter.Exchange(), tradeType)))
	if err != nil {
		return core.PlaceOrderParams{}, err
	}

	lastPrice, err := strconv.ParseFloat(lastPriceStr, 64)
	if err != nil || !(lastPrice > 0) {
		return core.PlaceOrderParams{}, fmt.Errorf("invalid last price: %q", lastPriceStr)
	}

	offset := OrderConfig.BuyPriceOffset
	if side == core.OrderSideSell {
		offset = OrderConfig.SellPriceOffset
	}
	price := lastPrice * offset

	minQty, _ := strconv.ParseFloat(info.MinQty, 64)
	stepSize, _ := strconv.ParseFloat(info.StepSize, 64)
	baseQty := stepSize
	if baseQty <= 0 {
		baseQty = minQty
	}
	if baseQty <= 0 {
		baseQty = 0.0001
	}

	if multiplier <= 0 {
		multiplier = 1
	}
	qty := math.Max(minQty, baseQty) * multiplier

	var leverage *float64
	if tradeType != core.TradeTypeSpot {
		lv := OrderConfig.DefaultLeverage
		leverage = &lv
	}

	return core.PlaceOrderParams{
		Symbol:       symbol,
		TradeType:    tradeType,
		Side:         side,
		OrderType:    core.OrderTypeLimit,
		Quantity:     qty,
		Price:        &price,
		PositionSide: positionSide,
		Leverage:     leverage,
	}, nil
}
