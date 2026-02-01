package okx

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/pkg/exchange-adapter/marketdata"
	okxapi "github.com/pkg/okx-api"
	okxtypes "github.com/pkg/okx-api/types"
	okxrest "github.com/pkg/okx-api/types/rest"
)

type MarketDataRESTClientOptions struct {
	HTTPSProxy  string
	SOCKSProxy  string
	DemoTrading bool
}

// MarketDataRESTClient implements `marketdata.RESTClient` for exchange-sync.
type MarketDataRESTClient struct {
	client *okxapi.RestClient
}

func NewMarketDataRESTClient(opts MarketDataRESTClientOptions) (*MarketDataRESTClient, error) {
	client, err := okxapi.NewRestClient(okxrest.RestClientOptions{
		Market:          okxtypes.APIMarketGLOBAL,
		DemoTrading:     opts.DemoTrading,
		ParseExceptions: true,
		Proxy:           opts.HTTPSProxy,
		SocksProxy:      opts.SOCKSProxy,
	})
	if err != nil {
		return nil, err
	}
	return &MarketDataRESTClient{client: client}, nil
}

func (c *MarketDataRESTClient) Name() marketdata.ExchangeName { return marketdata.OKX }

type okxInstrument struct {
	InstID   string `json:"instId"`
	BaseCcy  string `json:"baseCcy"`
	QuoteCcy string `json:"quoteCcy"`
	TickSz   string `json:"tickSz"`
	LotSz    string `json:"lotSz"`
	MinSz    string `json:"minSz"`
	MaxLmtSz string `json:"maxLmtSz"`
	State    string `json:"state"`
	CtVal    string `json:"ctVal,omitempty"`
	Lever    string `json:"lever,omitempty"`
}

type getInstrumentsParams struct {
	InstType string `json:"instType"`
}

func (c *MarketDataRESTClient) GetSymbols(ctx context.Context, tradeType marketdata.TradeType) ([]marketdata.SymbolInfo, error) {
	instType := "SPOT"
	if tradeType == marketdata.Futures {
		instType = "SWAP"
	}

	raw, err := c.client.GetInstruments(ctx, getInstrumentsParams{InstType: instType})
	if err != nil {
		return nil, err
	}

	var insts []okxInstrument
	if err := json.Unmarshal(raw, &insts); err != nil {
		return nil, err
	}

	out := make([]marketdata.SymbolInfo, 0, len(insts))
	for _, inst := range insts {
		if !strings.Contains(inst.InstID, "-USDT") {
			continue
		}
		if inst.State != "live" {
			continue
		}

		base := inst.BaseCcy
		quote := inst.QuoteCcy
		if base == "" || quote == "" {
			parts := strings.Split(inst.InstID, "-")
			if base == "" && len(parts) > 0 {
				base = parts[0]
			}
			if quote == "" && len(parts) > 1 {
				quote = parts[1]
			}
		}

		info := marketdata.SymbolInfo{
			Symbol:            marketdata.NormalizeSymbol(marketdata.OKX, inst.InstID, tradeType),
			RawSymbol:         inst.InstID,
			BaseCurrency:      base,
			QuoteCurrency:     quote,
			TradeType:         string(tradeType),
			TickSize:          inst.TickSz,
			StepSize:          inst.LotSz,
			MinQty:            inst.MinSz,
			MaxQty:            inst.MaxLmtSz,
			PricePrecision:    marketdata.CalculatePrecision(inst.TickSz),
			QuantityPrecision: marketdata.CalculatePrecision(inst.LotSz),
			Status:            inst.State,
		}

		if inst.CtVal != "" {
			if v, err := strconv.ParseFloat(inst.CtVal, 64); err == nil {
				info.ContractValue = &v
			}
		}
		if inst.Lever != "" {
			if v, err := strconv.ParseFloat(inst.Lever, 64); err == nil {
				info.MaxLeverage = &v
			}
		}

		out = append(out, info)
	}

	return out, nil
}

type getHistoryCandlesParams struct {
	InstID string `json:"instId"`
	Bar    string `json:"bar,omitempty"`
	After  string `json:"after,omitempty"`
	Before string `json:"before,omitempty"`
	Limit  string `json:"limit,omitempty"`
}

func (c *MarketDataRESTClient) GetCandles(ctx context.Context, symbol string, tradeType marketdata.TradeType, period marketdata.Period, startTime, endTime int64, limit int) ([]marketdata.NormalizedCandle, error) {
	instID := marketdata.ToExchangeSymbol(marketdata.OKX, symbol, tradeType)

	bar := map[marketdata.Period]string{
		marketdata.Period5m:  "5m",
		marketdata.Period15m: "15m",
		marketdata.Period4h:  "4H",
		marketdata.Period1d:  "1D",
	}[period]
	if bar == "" {
		bar = "15m"
	}

	params := getHistoryCandlesParams{
		InstID: instID,
		Bar:    bar,
		Limit:  fmt.Sprintf("%d", limit),
	}
	if endTime > 0 {
		params.After = fmt.Sprintf("%d", endTime)
	}
	if startTime > 0 {
		params.Before = fmt.Sprintf("%d", startTime)
	}

	raw, err := c.client.GetHistoryCandles(ctx, params)
	if err != nil {
		return nil, err
	}

	var rows [][]string
	if err := json.Unmarshal(raw, &rows); err != nil {
		var anyRows [][]any
		if err2 := json.Unmarshal(raw, &anyRows); err2 != nil {
			return nil, err
		}
		rows = make([][]string, 0, len(anyRows))
		for _, r := range anyRows {
			ss := make([]string, 0, len(r))
			for _, v := range r {
				ss = append(ss, fmt.Sprintf("%v", v))
			}
			rows = append(rows, ss)
		}
	}

	normalizedSymbol := marketdata.NormalizeSymbol(marketdata.OKX, instID, tradeType)
	out := make([]marketdata.NormalizedCandle, 0, len(rows))

	for _, k := range rows {
		if len(k) < 6 {
			continue
		}
		ts := parseInt64(k[0])

		out = append(out, marketdata.NormalizedCandle{
			Symbol:       normalizedSymbol,
			Exchange:     string(marketdata.OKX),
			TradeType:    string(tradeType),
			Period:       string(period),
			Timestamp:    ts,
			Open:         parseFloat(k[1]),
			High:         parseFloat(k[2]),
			Low:          parseFloat(k[3]),
			Close:        parseFloat(k[4]),
			Volume:       parseFloat(k[5]),
			BuyVolume:    0,
			SymbolFamily: marketdata.ExtractSymbolFamily(normalizedSymbol),
		})
	}

	// OKX returns newest-first; reverse to ascending time.
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}

	return out, nil
}
