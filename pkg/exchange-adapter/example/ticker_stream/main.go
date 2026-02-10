// ticker_stream 示例: 订阅 Ticker 数据流，聚合成 15m/4h/1d K线
//
// 使用方法:
//
//	go run ./example/ticker_stream
//
// 环境变量:
//
//	SOCKS_PROXY     - SOCKS5 代理地址，如 127.0.0.1:7891 (WebSocket 只支持 SOCKS5，不支持 HTTP 代理)
//	EXCHANGE        - 交易所: binance | okx (默认: binance)
//	TRADE_TYPE      - 交易类型: spot | futures (默认: futures)
//	MODE            - 订阅模式: multi | kline (默认: multi，兼容 quant)
//	VOLUME_FILTER   - 交易量过滤百分比，过滤后 30% 低交易量 (默认: 0.3)
//	BLACKLIST       - 黑名单交易对，逗号分隔（支持 BTCUSDT/BTC-USDT/BTC-USDT-SWAP）
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/pkg/exchange-adapter/aggregator"
	"github.com/pkg/exchange-adapter/example/internal/exampleutil"
	exbinance "github.com/pkg/exchange-adapter/exchanges/binance"
	exokx "github.com/pkg/exchange-adapter/exchanges/okx"
	md "github.com/pkg/exchange-adapter/marketdata"
)

func main() {
	log := exampleutil.NewLogger("ticker_stream")
	_ = exampleutil.LoadDotEnvFiles(".env", ".env.local")
	env := exampleutil.LoadEnv()

	// 解析配置
	exchange := getEnv("EXCHANGE", "binance")
	tradeTypeStr := getEnv("TRADE_TYPE", "futures")
	mode := strings.ToLower(getEnv("MODE", "multi")) // multi | kline (quant => multi)
	if mode == "quant" {
		mode = "multi"
	}
	volumeFilterStr := getEnv("VOLUME_FILTER", "0.1")
	blacklist := parseSymbolList(getEnv("BLACKLIST", ""))
	socksProxy := env.SOCKSProxy

	volumeFilter, _ := strconv.ParseFloat(volumeFilterStr, 64)
	if volumeFilter <= 0 || volumeFilter >= 1 {
		volumeFilter = 0.3
	}

	exchangeName := md.ExchangeName(strings.ToLower(exchange))
	tradeType := md.TradeType(strings.ToLower(tradeTypeStr))

	log.Banner("Ticker Stream 示例 (v2)")
	log.Info("配置",
		"exchange", exchangeName,
		"tradeType", tradeType,
		"mode", mode,
		"volumeFilter", volumeFilter,
		"blacklistCount", len(blacklist),
		"proxy", socksProxy,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 创建交易所客户端
	var binanceAdapter *exbinance.WsPublicAdapter
	var okxAdapter *exokx.WsPublicAdapter
	var client md.Exchange

	switch exchangeName {
	case md.Binance:
		binanceAdapter = exbinance.NewWsPublicAdapter(exbinance.WsPublicAdapterOptions{
			SocksProxy:        socksProxy,
			HeartbeatInterval: 30 * time.Second,
			ReconnectInterval: 15 * time.Second,
			Proxy:             socksProxy, // REST API 代理
		})
		client = binanceAdapter
	case md.OKX:
		okxAdapter = exokx.NewWsPublicAdapter(exokx.WsPublicAdapterOptions{
			SocksProxy:        socksProxy,
			ReconnectInterval: 15 * time.Second,
			Proxy:             socksProxy, // REST API 代理
		})
		client = okxAdapter
	default:
		log.Error("不支持的交易所", "exchange", exchangeName)
		os.Exit(1)
	}

	// 连接
	if err := client.Connect(ctx); err != nil {
		log.Error("连接失败", "error", err)
		os.Exit(1)
	}
	log.Info("WebSocket 已连接", "exchange", exchangeName)

	tradeTypes := []md.TradeType{tradeType}

	// 初始化活跃交易对 (过滤低交易量)
	log.Info("初始化活跃交易对...", "volumeFilter", fmt.Sprintf("%.0f%%", volumeFilter*100))

	switch exchangeName {
	case md.Binance:
		if err := binanceAdapter.InitSymbols(ctx, tradeTypes, blacklist, volumeFilter); err != nil {
			log.Error("初始化交易对失败", "error", err)
			os.Exit(1)
		}
		symbols := binanceAdapter.GetActiveSymbols(tradeType)
		log.Info("活跃交易对已初始化", "count", len(symbols))
		log.Info("所有交易对", "symbols", symbols)
	case md.OKX:
		if err := okxAdapter.InitSymbols(ctx, tradeTypes, blacklist, volumeFilter); err != nil {
			log.Error("初始化交易对失败", "error", err)
			os.Exit(1)
		}
		symbols := okxAdapter.GetActiveSymbols(tradeType)
		log.Info("活跃交易对已初始化", "count", len(symbols))
		log.Info("所有交易对", "symbols", symbols)
	}

	// 创建聚合器
	agg := aggregator.NewWSAggregator(client, aggregator.WSAggregatorOptions{
		BigOrderThresholdUSD: 5000,
		BigOrderExpireHours:  48,
	})
	defer agg.Close()

	// 错误处理
	agg.OnError(func(err error) {
		log.Error("聚合器错误", "error", err)
	})

	if mode == "multi" {
		// 量化数据流模式: 仅 ticker（按 15m/4h/1d 聚合）
		log.Info("订阅多周期 K线 数据流 (Ticker Only)...")

		if err := agg.SubMultiPeriodCandles(tradeTypes,
			func(event aggregator.Candle15mEvent) {
				candle := event.Candle
				status := "更新"
				if event.Closed {
					status = "闭合"
					log.Info(fmt.Sprintf("[%s] K线 %s", status, candle.Period),
						"symbol", candle.Symbol,
						"O", fmt.Sprintf("%.4f", candle.Open),
						"H", fmt.Sprintf("%.4f", candle.High),
						"L", fmt.Sprintf("%.4f", candle.Low),
						"C", fmt.Sprintf("%.4f", candle.Close),
					)
				}
			},
		); err != nil {
			log.Error("订阅多周期 K线 数据流失败", "error", err)
			os.Exit(1)
		}

		log.Info("已订阅多周期 K线 数据流", "tradeTypes", tradeTypes)
	} else if mode == "kline" {
		// K线独立订阅模式
		log.Info("订阅 K线 (独立模式)...")

		// 订阅 BTC-USDT 的 15m/4h/1d K线
		symbols := []md.SubscribeRequest{
			{Symbol: "BTC-USDT", TradeType: tradeType},
			{Symbol: "ETH-USDT", TradeType: tradeType},
		}
		periods := []md.Period{md.Period15m, md.Period4h, md.Period1d}

		if err := agg.SubKline(symbols, periods, func(event aggregator.Candle15mEvent) {
			candle := event.Candle
			status := "更新"
			if event.Closed {
				status = "闭合"
			}
			log.Info(fmt.Sprintf("[K线] %s %s", candle.Period, status),
				"symbol", candle.Symbol,
				"O", fmt.Sprintf("%.2f", candle.Open),
				"H", fmt.Sprintf("%.2f", candle.High),
				"L", fmt.Sprintf("%.2f", candle.Low),
				"C", fmt.Sprintf("%.2f", candle.Close),
			)
		}); err != nil {
			log.Error("订阅 K线 失败", "error", err)
			os.Exit(1)
		}

		log.Info("已订阅 K线", "symbols", symbols, "periods", periods)
	} else {
		log.Error("无效 MODE", "mode", mode, "valid", "multi|kline")
		os.Exit(1)
	}

	log.Divider()
	log.Info("等待数据... 按 Ctrl+C 退出")

	// 等待退出信号
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Info("正在关闭...")
	cancel()

	if err := client.Close(); err != nil {
		log.Error("关闭失败", "error", err)
	}
	log.Info("已退出")
}

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func parseSymbolList(csv string) []string {
	if csv == "" {
		return nil
	}
	parts := strings.Split(csv, ",")
	result := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		symbol := strings.ToUpper(strings.TrimSpace(part))
		if symbol == "" {
			continue
		}
		if _, ok := seen[symbol]; ok {
			continue
		}
		seen[symbol] = struct{}{}
		result = append(result, symbol)
	}
	return result
}
