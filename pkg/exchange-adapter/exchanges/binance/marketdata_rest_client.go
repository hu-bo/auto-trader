package binance

import (
	"context"
	"fmt"
	"strings"

	binanceapi "github.com/pkg/binance-api"
	btypes "github.com/pkg/binance-api/types"
	"github.com/pkg/exchange-adapter/marketdata"
)

type MarketDataRESTClientOptions struct {
	HTTPSProxy string
	Testnet    bool
}

// MarketDataRESTClient implements `marketdata.RESTClient` for exchange-sync.
type MarketDataRESTClient struct {
	testnet bool

	spot    *binanceapi.MainClient
	futures *binanceapi.USDMClient
}

func NewMarketDataRESTClient(opts MarketDataRESTClientOptions) *MarketDataRESTClient {
	return &MarketDataRESTClient{
		testnet: opts.Testnet,
		spot:    binanceapi.NewMainClient(binanceapi.MainClientOptions{Testnet: opts.Testnet, Proxy: opts.HTTPSProxy}),
		futures: binanceapi.NewUSDMClient(binanceapi.USDMClientOptions{Testnet: opts.Testnet, Proxy: opts.HTTPSProxy}),
	}
}

func (c *MarketDataRESTClient) Name() marketdata.ExchangeName { return marketdata.Binance }

func (c *MarketDataRESTClient) GetSymbols(ctx context.Context, tradeType marketdata.TradeType) ([]marketdata.SymbolInfo, error) {
	switch tradeType {
	case marketdata.Spot:
		info, err := c.spot.GetExchangeInfo(ctx)
		if err != nil {
			return nil, err
		}

		out := make([]marketdata.SymbolInfo, 0, len(info.Symbols))
		for _, s := range info.Symbols {
			if !strings.HasSuffix(s.Symbol, "USDT") {
				continue
			}
			if s.Status != "TRADING" {
				continue
			}

			tickSize, stepSize, minQty, maxQty := "", "", "", ""
			for _, f := range s.Filters {
				switch f.FilterType {
				case "PRICE_FILTER":
					tickSize = f.TickSize
				case "LOT_SIZE":
					stepSize = f.StepSize
					minQty = f.MinQty
					maxQty = f.MaxQty
				}
			}

			unified := marketdata.NormalizeSymbol(marketdata.Binance, s.Symbol, tradeType)
			out = append(out, marketdata.SymbolInfo{
				Symbol:            unified,
				RawSymbol:         s.Symbol,
				BaseCurrency:      s.BaseAsset,
				QuoteCurrency:     s.QuoteAsset,
				TradeType:         string(tradeType),
				TickSize:          tickSize,
				StepSize:          stepSize,
				MinQty:            minQty,
				MaxQty:            maxQty,
				QuantityPrecision: marketdata.CalculatePrecision(stepSize),
				PricePrecision:    marketdata.CalculatePrecision(tickSize),
				Status:            s.Status,
			})
		}
		return out, nil

	case marketdata.Futures:
		info, err := c.futures.GetExchangeInfo(ctx)
		if err != nil {
			return nil, err
		}

		out := make([]marketdata.SymbolInfo, 0, len(info.Symbols))
		for _, s := range info.Symbols {
			if !strings.HasSuffix(s.Symbol, "USDT") {
				continue
			}
			if s.Status != "TRADING" {
				continue
			}

			tickSize, stepSize, minQty, maxQty := "", "", "", ""
			for _, f := range s.Filters {
				switch f.FilterType {
				case "PRICE_FILTER":
					tickSize = f.TickSize
				case "LOT_SIZE":
					stepSize = f.StepSize
					minQty = f.MinQty
					maxQty = f.MaxQty
				}
			}

			unified := marketdata.NormalizeSymbol(marketdata.Binance, s.Symbol, tradeType)
			out = append(out, marketdata.SymbolInfo{
				Symbol:            unified,
				RawSymbol:         s.Symbol,
				BaseCurrency:      s.BaseAsset,
				QuoteCurrency:     s.QuoteAsset,
				TradeType:         string(tradeType),
				TickSize:          tickSize,
				StepSize:          stepSize,
				MinQty:            minQty,
				MaxQty:            maxQty,
				QuantityPrecision: s.QuantityPrecision,
				PricePrecision:    s.PricePrecision,
				Status:            s.Status,
			})
		}
		return out, nil

	default:
		return nil, fmt.Errorf("invalid tradeType: %s", tradeType)
	}
}

func (c *MarketDataRESTClient) GetCandles(ctx context.Context, symbol string, tradeType marketdata.TradeType, period marketdata.Period, startTime, endTime int64, limit int) ([]marketdata.NormalizedCandle, error) {
	rawSymbol := marketdata.ToExchangeSymbol(marketdata.Binance, symbol, tradeType)
	interval := btypes.KlineInterval(period)

	params := btypes.KlinesParams{
		Symbol:    rawSymbol,
		Interval:  interval,
		StartTime: startTime,
		EndTime:   endTime,
		Limit:     limit,
	}

	var rows [][]interface{}
	var err error
	switch tradeType {
	case marketdata.Spot:
		rows, err = c.spot.GetKlines(ctx, params)
	case marketdata.Futures:
		rows, err = c.futures.GetKlines(ctx, params)
	default:
		return nil, fmt.Errorf("invalid tradeType: %s", tradeType)
	}
	if err != nil {
		return nil, err
	}

	normalizedSymbol := marketdata.NormalizeSymbol(marketdata.Binance, rawSymbol, tradeType)
	out := make([]marketdata.NormalizedCandle, 0, len(rows))

	for _, k := range rows {
		if len(k) < 11 {
			continue
		}

		openTime := int64FromAny(k[0])
		openStr := stringFromAny(k[1])
		highStr := stringFromAny(k[2])
		lowStr := stringFromAny(k[3])
		closeStr := stringFromAny(k[4])
		volumeStr := stringFromAny(k[5])
		takerBuyVolumeStr := stringFromAny(k[9])

		out = append(out, marketdata.NormalizedCandle{
			Symbol:       normalizedSymbol,
			Exchange:     string(marketdata.Binance),
			TradeType:    string(tradeType),
			Period:       string(period),
			Timestamp:    openTime,
			Open:         parseFloat(openStr),
			High:         parseFloat(highStr),
			Low:          parseFloat(lowStr),
			Close:        parseFloat(closeStr),
			Volume:       parseFloat(volumeStr),
			BuyVolume:    parseFloat(takerBuyVolumeStr),
			SymbolFamily: marketdata.ExtractSymbolFamily(normalizedSymbol),
		})
	}
	return out, nil
}
