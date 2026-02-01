package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/pkg/exchange-adapter/core"
	"github.com/pkg/exchange-adapter/example/internal/exampleutil"
)

func previewSymbol(info core.SymbolInfo) string {
	return exampleutil.FormatList([]exampleutil.ListItem{
		{Key: "统一交易对", Value: info.Symbol},
		{Key: "原始交易对", Value: info.RawSymbol},
		{Key: "交易类型", Value: string(info.TradeType)},
		{Key: "基础/计价", Value: info.BaseCurrency + "/" + info.QuoteCurrency},
		{Key: "价格精度", Value: info.TickSize},
		{Key: "数量精度", Value: info.StepSize},
		{Key: "最小下单量", Value: info.MinQty},
		{Key: "最大下单量", Value: defaultStr(info.MaxQty, "暂无")},
	})
}

func previewTicker(ticker core.Ticker) string {
	ts := time.UnixMilli(ticker.Timestamp).Format(time.RFC3339)
	return exampleutil.FormatList([]exampleutil.ListItem{
		{Key: "最新价", Value: ticker.Last},
		{Key: "24 小时最高", Value: ticker.High},
		{Key: "24 小时最低", Value: ticker.Low},
		{Key: "24 小时成交量", Value: ticker.Volume},
		{Key: "计价币成交量", Value: ticker.QuoteVolume},
		{Key: "时间戳", Value: ts},
	})
}

func previewOrderBook(orderBook core.OrderBook) string {
	ts := time.UnixMilli(orderBook.Timestamp).Format(time.RFC3339)
	bestBids := bestLevels(orderBook.Bids)
	bestAsks := bestLevels(orderBook.Asks)
	return exampleutil.FormatList([]exampleutil.ListItem{
		{Key: "最优买单", Value: defaultStr(bestBids, "暂无")},
		{Key: "最优卖单", Value: defaultStr(bestAsks, "暂无")},
		{Key: "时间戳", Value: ts},
	})
}

func bestLevels(levels [][2]string) string {
	if len(levels) == 0 {
		return ""
	}
	n := 3
	if len(levels) < n {
		n = len(levels)
	}
	parts := make([]string, 0, n)
	for i := 0; i < n; i++ {
		parts = append(parts, fmt.Sprintf("%s x %s", levels[i][0], levels[i][1]))
	}
	return strings.Join(parts, " | ")
}

func defaultStr(v string, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

func main() {
	log := exampleutil.NewLogger("")

	_ = exampleutil.LoadDotEnvFiles(".env", ".env.local")
	env := exampleutil.LoadEnv()
	opts := exampleutil.AdapterOptionsFromEnv(env)

	if !exampleutil.TestModules.Public {
		log.Warn("公共 API 测试模块已禁用")
		return
	}

	publicAdapters := exampleutil.NewPublicAdapters(opts)
	log.Banner("公共 API 队列测试")

	for _, exchange := range exampleutil.EnabledExchanges {
		adapter := publicAdapters[exchange]
		if adapter == nil {
			continue
		}

		for _, tradeType := range exampleutil.EnabledTradeTypes {
			symbol := exampleutil.GetSymbol(exchange, tradeType)
			label := exampleutil.FormatLabel(exchange, tradeType)

			if err := log.Timed(label+" :: 加载交易对", func() error {
				ctx, cancel := exampleutil.Ctx(context.Background(), env)
				defer cancel()

				all, err := exampleutil.AssertOK(adapter.GetAllSymbols(ctx, tradeType), label+" 加载交易对")
				if err != nil {
					return err
				}
				log.Info(label+" 交易对加载完成", "count", len(all))
				return nil
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()

			if err := log.Timed(label+" :: 交易对信息 ("+symbol+")", func() error {
				ctx, cancel := exampleutil.Ctx(context.Background(), env)
				defer cancel()

				info, err := exampleutil.EnsureSymbolLoaded(ctx, adapter, symbol, tradeType)
				if err != nil {
					return err
				}
				log.Section(label + " 交易对快照")
				fmt.Println(previewSymbol(info))
				return nil
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()

			if err := log.Timed(label+" :: 价格数据", func() error {
				ctx, cancel := exampleutil.Ctx(context.Background(), env)
				defer cancel()
				lastPrice, err := exampleutil.AssertOK(adapter.GetPrice(ctx, symbol, tradeType), label+" 获取最新价")
				if err != nil {
					return err
				}
				log.KV(label+" 最新价", lastPrice)

				if tradeType != core.TradeTypeSpot {
					markPrice, err := exampleutil.AssertOK(adapter.GetMarkPrice(ctx, symbol, tradeType), label+" 获取标记价")
					if err != nil {
						return err
					}
					log.KV(label+" 标记价", markPrice)
				}
				return nil
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()

			if err := log.Timed(label+" :: 行情快照", func() error {
				ctx, cancel := exampleutil.Ctx(context.Background(), env)
				defer cancel()

				ticker, err := exampleutil.AssertOK(adapter.GetTicker(ctx, symbol, tradeType), label+" 获取行情")
				if err != nil {
					return err
				}
				log.Section(label + " 行情")
				fmt.Println(previewTicker(ticker))
				return nil
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()

			if err := log.Timed(label+" :: 深度数据", func() error {
				ctx, cancel := exampleutil.Ctx(context.Background(), env)
				defer cancel()

				book, err := exampleutil.AssertOK(adapter.GetOrderBook(ctx, symbol, tradeType, 20), label+" 获取深度")
				if err != nil {
					return err
				}
				log.Section(label + " 委托簿")
				fmt.Println(previewOrderBook(book))
				return nil
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()

			if err := log.Timed(label+" :: 交易对转换", func() error {
				ctx, cancel := exampleutil.Ctx(context.Background(), env)
				defer cancel()

				info, err := exampleutil.EnsureSymbolLoaded(ctx, adapter, symbol, tradeType)
				if err != nil {
					return err
				}
				raw := adapter.ToRawSymbol(symbol, tradeType)
				unified := adapter.FromRawSymbol(info.RawSymbol, tradeType)
				log.Info(label+" 转换结果", "raw", raw, "unified", unified)
				return nil
			}); err != nil {
				os.Exit(1)
			}
			log.Divider()
		}
	}
}
