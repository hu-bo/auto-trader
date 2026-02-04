package storage

import (
	"context"

	exchange "github.com/pkg/exchange-adapter/marketdata"
)

// Repository 存储接口
type Repository interface {
	// SaveCandles 批量保存K线数据 (Upsert)
	SaveCandles(ctx context.Context, candles []exchange.NormalizedCandle) error

	// SaveCandle 保存单条K线数据 (Upsert)
	SaveCandle(ctx context.Context, candle exchange.NormalizedCandle) error

	// UpdateCandleIfExists 仅在数据存在时更新K线数据，不存在则忽略
	// 返回值：是否更新成功（数据是否存在）
	UpdateCandleIfExists(ctx context.Context, candle exchange.NormalizedCandle) (bool, error)

	// GetCandles 查询历史K线
	GetCandles(ctx context.Context, exchangeName, symbol, period string, startTime, endTime int64, limit int) ([]exchange.NormalizedCandle, error)

	// GetLatestCandle 获取最新K线
	GetLatestCandle(ctx context.Context, exchangeName, symbol, tradeType, period string) (*exchange.NormalizedCandle, error)

	// GetMissingPeriods 获取缺失的周期时间戳
	GetMissingPeriods(ctx context.Context, exchangeName, symbol, tradeType, period string, startTime, endTime int64) ([]int64, error)

	// SaveSymbolInfo 保存交易对信息
	SaveSymbolInfo(ctx context.Context, exchangeName string, info exchange.SymbolInfo) error

	// GetSymbolInfos 获取所有需要同步的交易对
	GetSymbolInfos(ctx context.Context, exchangeName string) ([]exchange.SymbolInfo, error)

	// UpsertMiniTicker24h 缓存 24h Ticker (用于交易额/涨幅排序)
	UpsertMiniTicker24h(ctx context.Context, ticker exchange.MiniTicker) error

	// DeleteSymbolInfo 删除单个交易对
	DeleteSymbolInfo(ctx context.Context, exchangeName, symbol, tradeType string) error

	// GetSymbolInfo 获取单个交易对信息
	GetSymbolInfo(ctx context.Context, exchangeName, symbol, tradeType string) (*exchange.SymbolInfo, error)

	// GetSyncEnabledSymbolInfos 获取开启同步的交易对
	GetSyncEnabledSymbolInfos(ctx context.Context, exchangeName string) ([]exchange.SymbolInfo, error)

	// UpdateSymbolSyncEnabled 更新交易对同步开关
	UpdateSymbolSyncEnabled(ctx context.Context, exchangeName, symbol, tradeType string, syncEnabled bool) error

	// GetSymbolSyncStatus 获取交易对同步状态
	GetSymbolSyncStatus(ctx context.Context, exchangeName, symbol, tradeType string) (*SymbolSyncStatus, error)

	// UpdateSymbolSyncStatus 更新交易对同步状态
	UpdateSymbolSyncStatus(ctx context.Context, status *SymbolSyncStatus) error

	// InitSchema 初始化数据库 schema
	InitSchema(ctx context.Context) error

	// Close 关闭连接
	Close() error
}

// SymbolSyncStatus 交易对同步状态
type SymbolSyncStatus struct {
	Exchange       string `json:"exchange"`
	Symbol         string `json:"symbol"`
	TradeType      string `json:"trade_type"`
	EarliestDataTs int64  `json:"earliest_data_ts"` // 最早有数据的时间戳
	LatestSyncTs   int64  `json:"latest_sync_ts"`   // 最近一次同步到的时间戳
}
