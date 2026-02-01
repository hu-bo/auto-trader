package storage

import (
	"context"
	"fmt"
	"sync"
	"time"

	"exchange-sync/pkg/logger"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

var logPartition = logger.Module("partition")

const (
	// DefaultPreCreateDays 默认提前创建天数
	DefaultPreCreateDays = 7
)

// PartitionManager 分表管理器
// 负责按年份动态创建和路由 K 线数据表
type PartitionManager struct {
	pool          *pgxpool.Pool
	mu            sync.RWMutex
	tables        map[int]string // year -> table_name
	preCreateDays int            // 提前创建下一年分表的天数
	cron          *cron.Cron     // cron 调度器
}

// NewPartitionManager 创建分表管理器
func NewPartitionManager(pool *pgxpool.Pool) *PartitionManager {
	return &PartitionManager{
		pool:          pool,
		tables:        make(map[int]string),
		preCreateDays: DefaultPreCreateDays,
	}
}

// NewPartitionManagerWithOptions 创建分表管理器 (可配置)
func NewPartitionManagerWithOptions(pool *pgxpool.Pool, preCreateDays int) *PartitionManager {
	if preCreateDays <= 0 {
		preCreateDays = DefaultPreCreateDays
	}
	return &PartitionManager{
		pool:          pool,
		tables:        make(map[int]string),
		preCreateDays: preCreateDays,
	}
}

// Init 初始化分表管理器，加载已存在的分表信息
func (pm *PartitionManager) Init(ctx context.Context) error {
	// 确保 partition_registry 表存在
	_, err := pm.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS partition_registry (
			id BIGSERIAL PRIMARY KEY,
			table_name VARCHAR(50) NOT NULL UNIQUE,
			year INT NOT NULL UNIQUE,
			created_at TIMESTAMP DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create partition_registry: %w", err)
	}

	// 加载已有的分表
	rows, err := pm.pool.Query(ctx, `SELECT year, table_name FROM partition_registry`)
	if err != nil {
		return fmt.Errorf("load partition_registry: %w", err)
	}
	defer rows.Close()

	pm.mu.Lock()
	defer pm.mu.Unlock()

	for rows.Next() {
		var year int
		var tableName string
		if err := rows.Scan(&year, &tableName); err != nil {
			return err
		}
		pm.tables[year] = tableName
	}

	// 验证缓存中的分表在数据库中确实存在，清理无效记录
	for year, tableName := range pm.tables {
		if !pm.tableExistsInDB(ctx, tableName) {
			logPartition.Warn().
				Int("year", year).
				Str("table", tableName).
				Msg("Partition table missing in DB, removing from cache")
			delete(pm.tables, year)
		}
	}

	return nil
}

// GetTableName 根据时间戳获取对应的分表名
// timestamp: 毫秒级时间戳
func (pm *PartitionManager) GetTableName(timestamp int64) string {
	year := pm.getYearFromTimestamp(timestamp)
	return pm.GetTableNameByYear(year)
}

// GetTableNameByYear 根据年份获取分表名
func (pm *PartitionManager) GetTableNameByYear(year int) string {
	pm.mu.RLock()
	tableName, exists := pm.tables[year]
	pm.mu.RUnlock()

	if exists {
		return tableName
	}
	return fmt.Sprintf("normalized_candles_%d", year)
}

// EnsurePartition 确保指定年份的分表存在
func (pm *PartitionManager) EnsurePartition(ctx context.Context, timestamp int64) (string, error) {
	year := pm.getYearFromTimestamp(timestamp)
	return pm.EnsurePartitionByYear(ctx, year)
}

// EnsurePartitionByYear 确保指定年份的分表存在
func (pm *PartitionManager) EnsurePartitionByYear(ctx context.Context, year int) (string, error) {
	tableName := fmt.Sprintf("normalized_candles_%d", year)

	pm.mu.RLock()
	_, existsInCache := pm.tables[year]
	pm.mu.RUnlock()

	// 缓存中存在，直接返回（启动时已验证过）
	if existsInCache {
		return tableName, nil
	}

	pm.mu.Lock()
	defer pm.mu.Unlock()

	// 双重检查
	if _, exists := pm.tables[year]; exists {
		return tableName, nil
	}

	// 创建分表 (复制主表结构)
	createSQL := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			id BIGSERIAL PRIMARY KEY,
			symbol VARCHAR(24) NOT NULL,
			exchange VARCHAR(16) NOT NULL,
			trade_type VARCHAR(10) NOT NULL,
			period VARCHAR(5) NOT NULL,
			timestamp BIGINT NOT NULL,
			open NUMERIC NOT NULL,
			high NUMERIC NOT NULL,
			low NUMERIC NOT NULL,
			close NUMERIC NOT NULL,
			volume NUMERIC NOT NULL,
			buy_volume NUMERIC NOT NULL,
			symbol_family VARCHAR(20),
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE (symbol, exchange, trade_type, period, timestamp)
		)
	`, tableName)

	if _, err := pm.pool.Exec(ctx, createSQL); err != nil {
		return "", fmt.Errorf("create partition table %s: %w", tableName, err)
	}

	// 创建索引
	indexSQL := fmt.Sprintf(`
		CREATE INDEX IF NOT EXISTS idx_%s_query
		ON %s(exchange, symbol, period, timestamp DESC);

		CREATE INDEX IF NOT EXISTS idx_%s_timestamp
		ON %s(timestamp);
	`, tableName, tableName, tableName, tableName)

	if _, err := pm.pool.Exec(ctx, indexSQL); err != nil {
		return "", fmt.Errorf("create indexes for %s: %w", tableName, err)
	}

	// 注册分表
	_, err := pm.pool.Exec(ctx, `
		INSERT INTO partition_registry (table_name, year)
		VALUES ($1, $2)
		ON CONFLICT (year) DO NOTHING
	`, tableName, year)
	if err != nil {
		return "", fmt.Errorf("register partition %s: %w", tableName, err)
	}

	pm.tables[year] = tableName
	return tableName, nil
}

// GetYearsInRange 获取时间范围内涉及的年份列表
func (pm *PartitionManager) GetYearsInRange(startTime, endTime int64) []int {
	startYear := pm.getYearFromTimestamp(startTime)
	endYear := pm.getYearFromTimestamp(endTime)

	years := make([]int, 0, endYear-startYear+1)
	for y := startYear; y <= endYear; y++ {
		years = append(years, y)
	}
	return years
}

// GetAllPartitions 获取所有已创建的分表
func (pm *PartitionManager) GetAllPartitions() map[int]string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make(map[int]string, len(pm.tables))
	for k, v := range pm.tables {
		result[k] = v
	}
	return result
}

// getYearFromTimestamp 从毫秒时间戳提取年份
func (pm *PartitionManager) getYearFromTimestamp(timestamp int64) int {
	t := time.UnixMilli(timestamp)
	return t.Year()
}

// CurrentYear 返回当前年份
func (pm *PartitionManager) CurrentYear() int {
	return time.Now().Year()
}

// EnsureCurrentYearPartition 确保当前年份的分表存在
func (pm *PartitionManager) EnsureCurrentYearPartition(ctx context.Context) (string, error) {
	return pm.EnsurePartitionByYear(ctx, pm.CurrentYear())
}

// StartCronPreCreate 启动 cron 定时预创建任务
// cronExpr: cron 表达式，如 "0 1 * * *" 表示每天凌晨 1 点执行
// 默认使用 "0 1 * * *"
func (pm *PartitionManager) StartCronPreCreate(cronExpr string) error {
	if cronExpr == "" {
		cronExpr = "0 1 * * *" // 默认每天凌晨 1 点
	}

	pm.cron = cron.New()

	_, err := pm.cron.AddFunc(cronExpr, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		pm.checkAndPreCreate(ctx)
	})
	if err != nil {
		return fmt.Errorf("add cron job: %w", err)
	}

	pm.cron.Start()
	logPartition.Info().
		Str("cron", cronExpr).
		Int("pre_create_days", pm.preCreateDays).
		Msg("Partition cron started")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		pm.checkAndPreCreate(ctx)
	}()

	return nil
}

// Stop 停止 cron 调度器
func (pm *PartitionManager) Stop() {
	if pm.cron != nil {
		pm.cron.Stop()
		logPartition.Info().Msg("Partition cron stopped")
	}
}

// checkAndPreCreate 检查并预创建分表
// 1. 确保当前年份分表存在
// 2. 如果距离年底不足 preCreateDays 天，提前创建下一年分表
func (pm *PartitionManager) checkAndPreCreate(ctx context.Context) {
	now := time.Now()
	currentYear := now.Year()

	// 首先确保当前年份分表存在
	if _, err := pm.EnsurePartitionByYear(ctx, currentYear); err != nil {
		logPartition.Error().Err(err).Int("year", currentYear).Msg("Failed to ensure current year partition")
	} else {
		logPartition.Info().Int("year", currentYear).Msg("Current year partition ensured")
	}

	// 计算距离年底的天数
	yearEnd := time.Date(currentYear, 12, 31, 23, 59, 59, 0, now.Location())
	daysToYearEnd := int(yearEnd.Sub(now).Hours() / 24)

	// 如果距离年底不足 preCreateDays 天，提前创建下一年分表
	if daysToYearEnd <= pm.preCreateDays {
		nextYear := currentYear + 1

		// 检查是否已存在
		pm.mu.RLock()
		_, exists := pm.tables[nextYear]
		pm.mu.RUnlock()

		if exists {
			logPartition.Debug().Int("year", nextYear).Msg("Next year partition already exists")
			return
		}

		if _, err := pm.EnsurePartitionByYear(ctx, nextYear); err != nil {
			logPartition.Error().Err(err).Int("year", nextYear).Msg("Failed to pre-create next year partition")
		} else {
			logPartition.Info().
				Int("year", nextYear).
				Int("days_to_year_end", daysToYearEnd).
				Msg("Pre-created next year partition")
		}
	} else {
		logPartition.Debug().Int("days_to_year_end", daysToYearEnd).Msg("No need to pre-create next year")
	}
}

// ShouldPreCreate 检查是否应该预创建下一年分表
func (pm *PartitionManager) ShouldPreCreate() bool {
	now := time.Now()
	yearEnd := time.Date(now.Year(), 12, 31, 23, 59, 59, 0, now.Location())
	daysToYearEnd := int(yearEnd.Sub(now).Hours() / 24)
	return daysToYearEnd <= pm.preCreateDays
}

// PreCreateNextYear 手动预创建下一年分表
func (pm *PartitionManager) PreCreateNextYear(ctx context.Context) (string, error) {
	nextYear := time.Now().Year() + 1
	return pm.EnsurePartitionByYear(ctx, nextYear)
}

// GetPreCreateDays 获取提前创建天数配置
func (pm *PartitionManager) GetPreCreateDays() int {
	return pm.preCreateDays
}

// tableExistsInDB 检查表是否在数据库中存在
func (pm *PartitionManager) tableExistsInDB(ctx context.Context, tableName string) bool {
	var exists bool
	err := pm.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = $1
		)
	`, tableName).Scan(&exists)
	return err == nil && exists
}
