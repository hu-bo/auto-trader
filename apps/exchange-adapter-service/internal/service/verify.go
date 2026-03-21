package service

import (
	"context"
	"time"

	"exchange-adapter-service/internal/config"
	"exchange-adapter-service/internal/storage"
	"exchange-adapter-service/internal/utils"

	exbinance "github.com/pkg/exchange-adapter/exchanges/binance"
	exokx "github.com/pkg/exchange-adapter/exchanges/okx"
	exchange "github.com/pkg/exchange-adapter/marketdata"
	"github.com/pkg/logger"
)

var logVerify = logger.Module("verify")

// CandleDiff 单条K线差异
type CandleDiff struct {
	Timestamp   int64   `json:"timestamp"`
	Field       string  `json:"field"`        // open/high/low/close/volume
	LocalValue  float64 `json:"local_value"`  // 本地值
	RemoteValue float64 `json:"remote_value"` // 远程值
	DiffPercent float64 `json:"diff_percent"` // 差异百分比
}

// VerifyResult 验证结果
type VerifyResult struct {
	Exchange    string       `json:"exchange"`
	Symbol      string       `json:"symbol"`
	TradeType   string       `json:"trade_type"`
	Period      string       `json:"period"`
	StartTime   int64        `json:"start_time"`
	EndTime     int64        `json:"end_time"`
	TotalCount  int          `json:"total_count"`  // 远程返回的总数
	MatchCount  int          `json:"match_count"`  // 匹配的数量
	MissCount   int          `json:"miss_count"`   // 本地缺失的数量
	DiffCount   int          `json:"diff_count"`   // 有差异的数量
	UpdateCount int          `json:"update_count"` // 更新/插入的数量
	Diffs       []CandleDiff `json:"diffs"`        // 差异详情
	MissList    []int64      `json:"miss_list"`    // 缺失的时间戳列表
	Success     bool         `json:"success"`      // 是否通过验证
	Message     string       `json:"message"`      // 验证消息
}

// VerifyService K线数据验证服务
type VerifyService struct {
	cfg         *config.Config
	repo        storage.Repository
	restClients map[exchange.ExchangeName]exchange.RESTClient
}

// NewVerifyService 创建验证服务
func NewVerifyService(cfg *config.Config, repo storage.Repository) (*VerifyService, error) {
	s := &VerifyService{
		cfg:         cfg,
		repo:        repo,
		restClients: make(map[exchange.ExchangeName]exchange.RESTClient),
	}

	// 初始化 REST 客户端 (使用 HTTP 代理)
	s.restClients[exchange.Binance] = exbinance.NewMarketDataRESTClient(exbinance.MarketDataRESTClientOptions{
		HTTPSProxy: cfg.Proxy.HTTP,
	})
	okxClient, err := exokx.NewMarketDataRESTClient(exokx.MarketDataRESTClientOptions{
		HTTPSProxy: cfg.Proxy.HTTP,
	})
	if err != nil {
		return nil, err
	}
	s.restClients[exchange.OKX] = okxClient

	return s, nil
}

// VerifyCandles 验证K线数据
// 从交易所 REST API 获取历史数据，与本地数据库对比
// OHLC 必须严格一致，Volume 允许 5% 误差
func (s *VerifyService) VerifyCandles(ctx context.Context, exchangeName exchange.ExchangeName, symbol string, tradeType exchange.TradeType, period exchange.Period, limit int) (*VerifyResult, error) {
	// 默认参数
	if limit <= 0 {
		limit = 100
	}

	// 默认查询最近1天的数据
	endTime := time.Now().UnixMilli()
	startTime := endTime - 24*60*60*1000 // 1天

	result := &VerifyResult{
		Exchange:  string(exchangeName),
		Symbol:    symbol,
		TradeType: string(tradeType),
		Period:    string(period),
		StartTime: startTime,
		EndTime:   endTime,
		Diffs:     make([]CandleDiff, 0),
		MissList:  make([]int64, 0),
		Success:   true,
	}

	// 获取 REST 客户端
	restClient, ok := s.restClients[exchangeName]
	if !ok {
		result.Success = false
		result.Message = "unsupported exchange"
		return result, nil
	}

	// 从交易所获取历史K线
	remoteCandles, err := restClient.GetCandles(ctx, symbol, tradeType, period, startTime, endTime, limit)
	if err != nil {
		result.Success = false
		result.Message = "failed to fetch remote candles: " + err.Error()
		return result, nil
	}

	result.TotalCount = len(remoteCandles)

	if len(remoteCandles) == 0 {
		result.Message = "no remote candles found"
		return result, nil
	}

	// 逐条对比
	for _, remote := range remoteCandles {
		// 从数据库查询对应时间的本地数据
		localCandles, err := s.repo.GetCandles(ctx, string(exchangeName), symbol, string(tradeType), string(period), remote.Timestamp, remote.Timestamp+1, 1)
		if err != nil {
			logVerify.Warn().Err(err).
				Str("symbol", symbol).
				Int64("timestamp", remote.Timestamp).
				Msg("Failed to query local candle")
			continue
		}

		if len(localCandles) == 0 {
			// 本地缺失，插入数据
			result.MissCount++
			result.MissList = append(result.MissList, remote.Timestamp)

			// 插入缺失的数据
			if err := s.repo.SaveCandle(ctx, remote); err != nil {
				logVerify.Warn().Err(err).
					Str("symbol", symbol).
					Int64("timestamp", remote.Timestamp).
					Msg("Failed to insert missing candle")
			} else {
				result.UpdateCount++
				logVerify.Info().
					Str("exchange", string(exchangeName)).
					Str("symbol", symbol).
					Int64("timestamp", remote.Timestamp).
					Msg("Inserted missing candle")
			}
			continue
		}

		local := localCandles[0]

		// 对比 OHLC (必须严格一致)
		hasDiff := false

		if local.Open != remote.Open {
			hasDiff = true
			result.Diffs = append(result.Diffs, CandleDiff{
				Timestamp:   remote.Timestamp,
				Field:       "open",
				LocalValue:  local.Open,
				RemoteValue: remote.Open,
				DiffPercent: utils.DiffPercent(local.Open, remote.Open),
			})
		}

		if local.High != remote.High {
			hasDiff = true
			result.Diffs = append(result.Diffs, CandleDiff{
				Timestamp:   remote.Timestamp,
				Field:       "high",
				LocalValue:  local.High,
				RemoteValue: remote.High,
				DiffPercent: utils.DiffPercent(local.High, remote.High),
			})
		}

		if local.Low != remote.Low {
			hasDiff = true
			result.Diffs = append(result.Diffs, CandleDiff{
				Timestamp:   remote.Timestamp,
				Field:       "low",
				LocalValue:  local.Low,
				RemoteValue: remote.Low,
				DiffPercent: utils.DiffPercent(local.Low, remote.Low),
			})
		}

		if local.Close != remote.Close {
			hasDiff = true
			result.Diffs = append(result.Diffs, CandleDiff{
				Timestamp:   remote.Timestamp,
				Field:       "close",
				LocalValue:  local.Close,
				RemoteValue: remote.Close,
				DiffPercent: utils.DiffPercent(local.Close, remote.Close),
			})
		}

		// 对比 Volume (允许 5% 误差)
		volumeDiff := utils.DiffPercent(local.Volume, remote.Volume)
		if volumeDiff > 5 {
			hasDiff = true
			result.Diffs = append(result.Diffs, CandleDiff{
				Timestamp:   remote.Timestamp,
				Field:       "volume",
				LocalValue:  local.Volume,
				RemoteValue: remote.Volume,
				DiffPercent: volumeDiff,
			})
		}

		if hasDiff {
			result.DiffCount++
			result.Success = false

			// 记录告警日志
			logVerify.Warn().
				Str("exchange", string(exchangeName)).
				Str("symbol", symbol).
				Str("period", string(period)).
				Int64("timestamp", remote.Timestamp).
				Time("time", time.UnixMilli(remote.Timestamp)).
				Float64("local_open", local.Open).
				Float64("remote_open", remote.Open).
				Float64("local_close", local.Close).
				Float64("remote_close", remote.Close).
				Msg("Candle data mismatch detected")

			// 用远程数据更新本地
			// if err := s.repo.SaveCandle(ctx, remote); err != nil {
			// 	logVerify.Warn().Err(err).
			// 		Str("symbol", symbol).
			// 		Int64("timestamp", remote.Timestamp).
			// 		Msg("Failed to update mismatched candle")
			// } else {
			// 	result.UpdateCount++
			// }
		} else {
			result.MatchCount++
		}
	}

	// 生成验证消息
	if result.Success {
		result.Message = "all candles verified successfully"
	} else {
		result.Message = "candle data mismatch detected"
	}

	logVerify.Info().
		Str("exchange", string(exchangeName)).
		Str("symbol", symbol).
		Str("period", string(period)).
		Int("total", result.TotalCount).
		Int("match", result.MatchCount).
		Int("miss", result.MissCount).
		Int("diff", result.DiffCount).
		Int("updated", result.UpdateCount).
		Bool("success", result.Success).
		Msg("Candle verification completed")

	return result, nil
}
