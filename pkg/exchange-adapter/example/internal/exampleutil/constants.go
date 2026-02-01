package exampleutil

import (
	"strings"

	"github.com/pkg/exchange-adapter/core"
)

var TradeTypeLabels = map[core.TradeType]string{
	core.TradeTypeSpot:     "现货",
	core.TradeTypeFutures:  "永续合约",
	core.TradeTypeDelivery: "交割合约",
}

func TradeTypeLabel(tradeType core.TradeType) string {
	if v, ok := TradeTypeLabels[tradeType]; ok {
		return v
	}
	return string(tradeType)
}

func FormatLabel(exchange core.Exchange, tradeType core.TradeType) string {
	return strings.ToUpper(string(exchange)) + " " + TradeTypeLabel(tradeType)
}
