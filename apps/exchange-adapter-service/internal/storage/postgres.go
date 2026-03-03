package storage

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"exchange-adapter-service/internal/config"
	"exchange-adapter-service/internal/storage/db"
	"exchange-adapter-service/internal/utils"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	exchange "github.com/pkg/exchange-adapter/marketdata"
	"github.com/shopspring/decimal"
)

const (
	defaultPoolMaxConns = 20
	defaultPoolMinConns = 5
)

//go:embed db/migrations/*.sql
var migrationsFS embed.FS

// PostgresRepository PostgreSQL 存储实现
type PostgresRepository struct {
	pool      *pgxpool.Pool
	queries   *db.Queries
	partition *PartitionManager
}

// NewPostgresRepository 创建 PostgreSQL 存储实例
func NewPostgresRepository(ctx context.Context, cfg *config.DatabaseConfig) (*PostgresRepository, error) {
	connString := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s&pool_max_conns=%d&pool_min_conns=%d",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Database, cfg.SSLMode,
		defaultPoolMaxConns, defaultPoolMinConns,
	)

	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		return nil, fmt.Errorf("failed to create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	pm := NewPartitionManager(pool)
	if err := pm.Init(ctx); err != nil {
		return nil, fmt.Errorf("failed to init partition manager: %w", err)
	}

	return &PostgresRepository{
		pool:      pool,
		queries:   db.New(pool),
		partition: pm,
	}, nil
}

// InitSchema 初始化数据库表结构 (读取 migrations/*.sql 文件)
func (r *PostgresRepository) InitSchema(ctx context.Context) error {
	// 读取 migrations 目录下的所有 SQL 文件
	entries, err := fs.ReadDir(migrationsFS, "db/migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	// 过滤并排序 SQL 文件
	var sqlFiles []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			sqlFiles = append(sqlFiles, entry.Name())
		}
	}
	sort.Strings(sqlFiles) // 按文件名排序: 001_, 002_, 003_, ...

	// 按顺序执行每个 SQL 文件
	for _, fileName := range sqlFiles {
		content, err := fs.ReadFile(migrationsFS, "db/migrations/"+fileName)
		if err != nil {
			return fmt.Errorf("read migration file %s: %w", fileName, err)
		}

		if _, err := r.pool.Exec(ctx, string(content)); err != nil {
			return fmt.Errorf("exec migration %s: %w", fileName, err)
		}
	}

	// 确保当前年份分表存在
	if _, err := r.partition.EnsureCurrentYearPartition(ctx); err != nil {
		return err
	}

	return nil
}

// SaveCandles 批量保存K线数据 (按年份分表)
func (r *PostgresRepository) SaveCandles(ctx context.Context, candles []exchange.NormalizedCandle) error {
	if len(candles) == 0 {
		return nil
	}

	// 按年份分组
	grouped := r.groupCandlesByYear(candles)

	for year, yearCandles := range grouped {
		tableName, err := r.partition.EnsurePartitionByYear(ctx, year)
		if err != nil {
			return fmt.Errorf("ensure partition for year %d: %w", year, err)
		}

		if err := r.batchInsertCandles(ctx, tableName, yearCandles); err != nil {
			return fmt.Errorf("batch insert to %s: %w", tableName, err)
		}
	}

	return nil
}

// batchInsertCandles 批量插入K线到指定表
func (r *PostgresRepository) batchInsertCandles(ctx context.Context, tableName string, candles []exchange.NormalizedCandle) error {
	if len(candles) == 0 {
		return nil
	}

	// 去重：同一批次中可能有相同的 candle（重连/重复数据）
	seen := make(map[string]int) // key -> index in unique slice
	unique := make([]exchange.NormalizedCandle, 0, len(candles))
	for _, c := range candles {
		key := fmt.Sprintf("%s:%s:%s:%s:%d", c.Symbol, c.Exchange, c.TradeType, c.Period, c.Timestamp)
		if idx, exists := seen[key]; exists {
			// 保留较新的数据（后来的覆盖之前的）
			unique[idx] = c
		} else {
			seen[key] = len(unique)
			unique = append(unique, c)
		}
	}
	candles = unique

	valueStrings := make([]string, 0, len(candles))
	valueArgs := make([]interface{}, 0, len(candles)*12)

	for i, c := range candles {
		base := i * 12
		valueStrings = append(valueStrings, fmt.Sprintf(
			"($%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d)",
			base+1, base+2, base+3, base+4, base+5, base+6,
			base+7, base+8, base+9, base+10, base+11, base+12,
		))
		valueArgs = append(valueArgs,
			c.Symbol, c.Exchange, c.TradeType, c.Period, c.Timestamp,
			c.Open, c.High, c.Low, c.Close, c.Volume, c.BuyVolume, c.SymbolFamily,
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO %s
		(symbol, exchange, trade_type, period, timestamp, open, high, low, close, volume, buy_volume, symbol_family)
		VALUES %s
		ON CONFLICT (symbol, exchange, trade_type, period, timestamp)
		DO UPDATE SET
			open = EXCLUDED.open,
			high = EXCLUDED.high,
			low = EXCLUDED.low,
			close = EXCLUDED.close,
			volume = EXCLUDED.volume,
			buy_volume = EXCLUDED.buy_volume
	`, tableName, strings.Join(valueStrings, ","))

	_, err := r.pool.Exec(ctx, query, valueArgs...)
	return err
}

// groupCandlesByYear 按年份分组 K 线数据
func (r *PostgresRepository) groupCandlesByYear(candles []exchange.NormalizedCandle) map[int][]exchange.NormalizedCandle {
	grouped := make(map[int][]exchange.NormalizedCandle)
	for _, c := range candles {
		year := r.partition.getYearFromTimestamp(c.Timestamp)
		grouped[year] = append(grouped[year], c)
	}
	return grouped
}

// SaveCandle 保存单条K线
func (r *PostgresRepository) SaveCandle(ctx context.Context, candle exchange.NormalizedCandle) error {
	tableName, err := r.partition.EnsurePartition(ctx, candle.Timestamp)
	if err != nil {
		return err
	}

	query := fmt.Sprintf(`
		INSERT INTO %s
		(symbol, exchange, trade_type, period, timestamp, open, high, low, close, volume, buy_volume, symbol_family)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (symbol, exchange, trade_type, period, timestamp)
		DO UPDATE SET
			open = EXCLUDED.open,
			high = EXCLUDED.high,
			low = EXCLUDED.low,
			close = EXCLUDED.close,
			volume = EXCLUDED.volume,
			buy_volume = EXCLUDED.buy_volume
	`, tableName)

	_, err = r.pool.Exec(ctx, query,
		candle.Symbol, candle.Exchange, candle.TradeType, candle.Period, candle.Timestamp,
		candle.Open, candle.High, candle.Low, candle.Close, candle.Volume, candle.BuyVolume, candle.SymbolFamily,
	)
	return err
}

// UpdateCandleIfExists 仅在数据存在时更新K线数据，不存在则忽略
func (r *PostgresRepository) UpdateCandleIfExists(ctx context.Context, candle exchange.NormalizedCandle) (bool, error) {
	tableName := r.partition.GetTableNameByYear(r.partition.getYearFromTimestamp(candle.Timestamp))

	// 检查表是否存在
	if !r.tableExists(ctx, tableName) {
		return false, nil
	}

	query := fmt.Sprintf(`
		UPDATE %s SET
			open = $6,
			high = $7,
			low = $8,
			close = $9,
			volume = $10,
			buy_volume = $11
		WHERE symbol = $1 AND exchange = $2 AND trade_type = $3 AND period = $4 AND timestamp = $5
	`, tableName)

	result, err := r.pool.Exec(ctx, query,
		candle.Symbol, candle.Exchange, candle.TradeType, candle.Period, candle.Timestamp,
		candle.Open, candle.High, candle.Low, candle.Close, candle.Volume, candle.BuyVolume,
	)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}

// GetCandles 查询历史K线 (跨年份分表查询)
func (r *PostgresRepository) GetCandles(ctx context.Context, exchangeName, symbol, period string, startTime, endTime int64, limit int) ([]exchange.NormalizedCandle, error) {
	years := r.partition.GetYearsInRange(startTime, endTime)

	var allCandles []exchange.NormalizedCandle
	hasLimit := limit > 0

	// 按年份正序查询 (旧数据优先)
	for i := 0; i < len(years); i++ {
		year := years[i]
		tableName := r.partition.GetTableNameByYear(year)

		// 检查表是否存在
		if !r.tableExists(ctx, tableName) {
			continue
		}

		baseQuery := fmt.Sprintf(`
			SELECT symbol, exchange, trade_type, period, timestamp,
			       open, high, low, close, volume, buy_volume, COALESCE(symbol_family, '')
			FROM %s
			WHERE exchange = $1 AND symbol = $2 AND period = $3
			  AND timestamp >= $4 AND timestamp <= $5
			ORDER BY timestamp ASC
		`, tableName)

		if hasLimit {
			remaining := limit - len(allCandles)
			if remaining <= 0 {
				break
			}

			query := baseQuery + "\nLIMIT $6"
			rows, err := r.pool.Query(ctx, query, exchangeName, symbol, period, startTime, endTime, remaining)
			if err != nil {
				return nil, err
			}

			for rows.Next() {
				var c exchange.NormalizedCandle
				err := rows.Scan(
					&c.Symbol, &c.Exchange, &c.TradeType, &c.Period, &c.Timestamp,
					&c.Open, &c.High, &c.Low, &c.Close, &c.Volume, &c.BuyVolume, &c.SymbolFamily,
				)
				if err != nil {
					rows.Close()
					return nil, err
				}
				allCandles = append(allCandles, c)
			}
			rows.Close()
			continue
		}

		rows, err := r.pool.Query(ctx, baseQuery, exchangeName, symbol, period, startTime, endTime)
		if err != nil {
			return nil, err
		}

		for rows.Next() {
			var c exchange.NormalizedCandle
			err := rows.Scan(
				&c.Symbol, &c.Exchange, &c.TradeType, &c.Period, &c.Timestamp,
				&c.Open, &c.High, &c.Low, &c.Close, &c.Volume, &c.BuyVolume, &c.SymbolFamily,
			)
			if err != nil {
				rows.Close()
				return nil, err
			}
			allCandles = append(allCandles, c)
		}
		rows.Close()
	}

	// 按时间戳升序排序
	sort.Slice(allCandles, func(i, j int) bool {
		return allCandles[i].Timestamp < allCandles[j].Timestamp
	})

	// 截取 limit
	if hasLimit && len(allCandles) > limit {
		allCandles = allCandles[:limit]
	}

	return allCandles, nil
}

// tableExists 检查表是否存在
func (r *PostgresRepository) tableExists(ctx context.Context, tableName string) bool {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = $1
		)
	`, tableName).Scan(&exists)
	return err == nil && exists
}

// GetLatestCandle 获取最新K线
func (r *PostgresRepository) GetLatestCandle(ctx context.Context, exchangeName, symbol, tradeType, period string) (*exchange.NormalizedCandle, error) {
	// 从最新年份开始查找
	partitions := r.partition.GetAllPartitions()
	years := make([]int, 0, len(partitions))
	for y := range partitions {
		years = append(years, y)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(years)))

	for _, year := range years {
		tableName := partitions[year]
		query := fmt.Sprintf(`
			SELECT symbol, exchange, trade_type, period, timestamp,
			       open, high, low, close, volume, buy_volume, COALESCE(symbol_family, '')
			FROM %s
			WHERE exchange = $1 AND symbol = $2 AND trade_type = $3 AND period = $4
			ORDER BY timestamp DESC
			LIMIT 1
		`, tableName)

		var c exchange.NormalizedCandle
		err := r.pool.QueryRow(ctx, query, exchangeName, symbol, tradeType, period).Scan(
			&c.Symbol, &c.Exchange, &c.TradeType, &c.Period, &c.Timestamp,
			&c.Open, &c.High, &c.Low, &c.Close, &c.Volume, &c.BuyVolume, &c.SymbolFamily,
		)
		if err == pgx.ErrNoRows {
			continue
		}
		if err != nil {
			return nil, err
		}
		return &c, nil
	}

	return nil, nil
}

// GetMissingPeriods 获取缺失的周期时间戳
func (r *PostgresRepository) GetMissingPeriods(ctx context.Context, exchangeName, symbol, tradeType, period string, startTime, endTime int64) ([]int64, error) {
	// 计算周期间隔（毫秒）
	p := utils.Period(period)
	intervalMs := p.IntervalMs()
	if intervalMs == 0 {
		intervalMs = utils.Period15m.IntervalMs() // 默认 15m
	}

	years := r.partition.GetYearsInRange(startTime, endTime)
	var allMissing []int64

	for _, year := range years {
		tableName := r.partition.GetTableNameByYear(year)

		if !r.tableExists(ctx, tableName) {
			// 表不存在，该年份所有时间戳都缺失
			yearStart := startTime
			yearEnd := endTime
			for ts := yearStart; ts <= yearEnd; ts += intervalMs {
				if r.partition.getYearFromTimestamp(ts) == year {
					allMissing = append(allMissing, ts)
				}
			}
			continue
		}

		query := fmt.Sprintf(`
			WITH expected AS (
				SELECT generate_series($4::bigint, $5::bigint, $6::bigint) AS ts
			)
			SELECT e.ts
			FROM expected e
			LEFT JOIN %s nc
				ON nc.exchange = $1
				AND nc.symbol = $2
				AND nc.trade_type = $3
				AND nc.period = $7
				AND nc.timestamp = e.ts
			WHERE nc.id IS NULL
			ORDER BY e.ts
		`, tableName)

		rows, err := r.pool.Query(ctx, query, exchangeName, symbol, tradeType, startTime, endTime, intervalMs, period)
		if err != nil {
			return nil, err
		}

		for rows.Next() {
			var ts int64
			if err := rows.Scan(&ts); err != nil {
				rows.Close()
				return nil, err
			}
			// 只添加属于该年份的时间戳
			if r.partition.getYearFromTimestamp(ts) == year {
				allMissing = append(allMissing, ts)
			}
		}
		rows.Close()
	}

	// 排序并去重
	sort.Slice(allMissing, func(i, j int) bool {
		return allMissing[i] < allMissing[j]
	})

	return allMissing, nil
}

// SaveSymbolInfo 保存交易对信息 (使用 sqlc)
func (r *PostgresRepository) SaveSymbolInfo(ctx context.Context, exchangeName string, info exchange.SymbolInfo) error {
	var contractValue, maxLeverage pgtype.Numeric
	if info.ContractValue != nil {
		contractValue = numericFromFloat64(*info.ContractValue)
	}
	if info.MaxLeverage != nil {
		maxLeverage = numericFromFloat64(*info.MaxLeverage)
	}

	return r.queries.UpsertSymbolInfo(ctx, db.UpsertSymbolInfoParams{
		Exchange:          exchangeName,
		Symbol:            info.Symbol,
		RawSymbol:         info.RawSymbol,
		BaseCurrency:      info.BaseCurrency,
		QuoteCurrency:     info.QuoteCurrency,
		TradeType:         info.TradeType,
		TickSize:          pgtype.Text{String: info.TickSize, Valid: info.TickSize != ""},
		StepSize:          pgtype.Text{String: info.StepSize, Valid: info.StepSize != ""},
		MinQty:            pgtype.Text{String: info.MinQty, Valid: info.MinQty != ""},
		MaxQty:            pgtype.Text{String: info.MaxQty, Valid: info.MaxQty != ""},
		QuantityPrecision: pgtype.Int4{Int32: int32(info.QuantityPrecision), Valid: true},
		PricePrecision:    pgtype.Int4{Int32: int32(info.PricePrecision), Valid: true},
		Status:            pgtype.Text{String: info.Status, Valid: info.Status != ""},
		ContractValue:     contractValue,
		MaxLeverage:       maxLeverage,
	})
}

// UpsertMiniTicker24h 缓存 24h Ticker (用于 /api/symbols 排序)
func (r *PostgresRepository) UpsertMiniTicker24h(ctx context.Context, ticker exchange.MiniTicker) error {
	if ticker.Exchange == "" {
		return fmt.Errorf("ticker.exchange is required")
	}
	if ticker.Symbol == "" {
		return fmt.Errorf("ticker.symbol is required")
	}
	if ticker.TradeType == "" {
		return fmt.Errorf("ticker.trade_type is required")
	}

	const q = `
		INSERT INTO symbol_tickers_24h (
			exchange,
			symbol,
			trade_type,
			open_price_24h,
			last_price,
			quote_volume_24h,
			event_time_ms
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (exchange, symbol, trade_type)
		DO UPDATE SET
			open_price_24h = EXCLUDED.open_price_24h,
			last_price = EXCLUDED.last_price,
			quote_volume_24h = EXCLUDED.quote_volume_24h,
			event_time_ms = EXCLUDED.event_time_ms,
			updated_at = NOW();
	`

	_, err := r.pool.Exec(
		ctx,
		q,
		ticker.Exchange,
		ticker.Symbol,
		string(ticker.TradeType),
		ticker.OpenPrice24h,
		ticker.LastPrice,
		ticker.QuoteVolume24h,
		ticker.EventTimeMs,
	)
	return err
}

// GetSymbolInfos 获取所有交易对 (使用 sqlc)
func (r *PostgresRepository) GetSymbolInfos(ctx context.Context, exchangeName string) ([]exchange.SymbolInfo, error) {
	const q = `
		SELECT
			si.symbol,
			si.raw_symbol,
			si.base_currency,
			si.quote_currency,
			si.trade_type,
			COALESCE(si.tick_size, '') as tick_size,
			COALESCE(si.step_size, '') as step_size,
			COALESCE(si.min_qty, '') as min_qty,
			COALESCE(si.max_qty, '') as max_qty,
			COALESCE(si.quantity_precision, 0) as quantity_precision,
			COALESCE(si.price_precision, 0) as price_precision,
			COALESCE(si.status, '') as status,
			si.contract_value,
			si.max_leverage,
			COALESCE(si.sync_enabled, true) as sync_enabled,

			st.open_price_24h,
			st.last_price,
			st.quote_volume_24h,
			st.event_time_ms,
			sss.earliest_data_ts,
			sss.latest_sync_ts
		FROM symbol_infos si
		LEFT JOIN symbol_tickers_24h st
			ON st.exchange = si.exchange
			AND st.symbol = si.symbol
			AND st.trade_type = si.trade_type
		LEFT JOIN symbol_sync_status sss
			ON sss.exchange = si.exchange
			AND sss.symbol = si.symbol
			AND sss.trade_type = si.trade_type
		WHERE si.exchange = $1
		ORDER BY si.symbol;
	`

	rows, err := r.pool.Query(ctx, q, exchangeName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	infos := make([]exchange.SymbolInfo, 0)
	for rows.Next() {
		var (
			symbol            string
			rawSymbol         string
			baseCurrency      string
			quoteCurrency     string
			tradeType         string
			tickSize          string
			stepSize          string
			minQty            string
			maxQty            string
			quantityPrecision int32
			pricePrecision    int32
			status            string
			contractValue     pgtype.Numeric
			maxLeverage       pgtype.Numeric
			syncEnabled       bool

			open24h      pgtype.Float8
			lastPrice    pgtype.Float8
			quoteVol24h  pgtype.Float8
			eventTimeMs  pgtype.Int8
			syncEarliest pgtype.Int8
			syncLatest   pgtype.Int8
		)

		if err := rows.Scan(
			&symbol,
			&rawSymbol,
			&baseCurrency,
			&quoteCurrency,
			&tradeType,
			&tickSize,
			&stepSize,
			&minQty,
			&maxQty,
			&quantityPrecision,
			&pricePrecision,
			&status,
			&contractValue,
			&maxLeverage,
			&syncEnabled,
			&open24h,
			&lastPrice,
			&quoteVol24h,
			&eventTimeMs,
			&syncEarliest,
			&syncLatest,
		); err != nil {
			return nil, err
		}

		info := exchange.SymbolInfo{
			Symbol:            symbol,
			RawSymbol:         rawSymbol,
			BaseCurrency:      baseCurrency,
			QuoteCurrency:     quoteCurrency,
			TradeType:         tradeType,
			TickSize:          tickSize,
			StepSize:          stepSize,
			MinQty:            minQty,
			MaxQty:            maxQty,
			QuantityPrecision: int(quantityPrecision),
			PricePrecision:    int(pricePrecision),
			Status:            status,
			SyncEnabled:       syncEnabled,
		}

		if contractValue.Valid {
			v := numericToFloat64(contractValue)
			info.ContractValue = &v
		}
		if maxLeverage.Valid {
			v := numericToFloat64(maxLeverage)
			info.MaxLeverage = &v
		}

		if open24h.Valid {
			v := open24h.Float64
			info.OpenPrice24h = &v
		}
		if lastPrice.Valid {
			v := lastPrice.Float64
			info.LastPrice = &v
		}
		if quoteVol24h.Valid {
			v := quoteVol24h.Float64
			info.QuoteVolume24h = &v
		}
		if eventTimeMs.Valid {
			v := eventTimeMs.Int64
			info.TickerEventTimeMs = &v
		}

		// 计算涨幅百分比 (close-open)/open * 100
		if info.OpenPrice24h != nil && info.LastPrice != nil && *info.OpenPrice24h != 0 {
			pct := (*info.LastPrice - *info.OpenPrice24h) / *info.OpenPrice24h * 100
			info.PriceChangePct24h = &pct
		}

		if syncEarliest.Valid {
			info.EarliestDataTs = syncEarliest.Int64
		}
		if syncLatest.Valid {
			info.LatestSyncTs = syncLatest.Int64
		}

		infos = append(infos, info)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return infos, nil
}

// GetSyncEnabledSymbolInfos 获取开启同步的交易对 (使用 sqlc)
func (r *PostgresRepository) GetSyncEnabledSymbolInfos(ctx context.Context, exchangeName string) ([]exchange.SymbolInfo, error) {
	rows, err := r.queries.GetSyncEnabledSymbolInfos(ctx, exchangeName)
	if err != nil {
		return nil, err
	}

	infos := make([]exchange.SymbolInfo, 0, len(rows))
	for _, row := range rows {
		info := exchange.SymbolInfo{
			Symbol:            row.Symbol,
			RawSymbol:         row.RawSymbol,
			BaseCurrency:      row.BaseCurrency,
			QuoteCurrency:     row.QuoteCurrency,
			TradeType:         row.TradeType,
			TickSize:          row.TickSize,
			StepSize:          row.StepSize,
			MinQty:            row.MinQty,
			MaxQty:            row.MaxQty,
			QuantityPrecision: int(row.QuantityPrecision),
			PricePrecision:    int(row.PricePrecision),
			Status:            row.Status,
			SyncEnabled:       row.SyncEnabled,
		}

		if row.ContractValue.Valid {
			v := numericToFloat64(row.ContractValue)
			info.ContractValue = &v
		}
		if row.MaxLeverage.Valid {
			v := numericToFloat64(row.MaxLeverage)
			info.MaxLeverage = &v
		}

		infos = append(infos, info)
	}

	return infos, nil
}

// UpdateSymbolSyncEnabled 更新交易对同步开关 (使用 sqlc)
func (r *PostgresRepository) UpdateSymbolSyncEnabled(ctx context.Context, exchangeName, symbol, tradeType string, syncEnabled bool) error {
	return r.queries.UpdateSymbolSyncEnabled(ctx, db.UpdateSymbolSyncEnabledParams{
		Exchange:    exchangeName,
		Symbol:      symbol,
		TradeType:   tradeType,
		SyncEnabled: pgtype.Bool{Bool: syncEnabled, Valid: true},
	})
}

// GetSymbolSyncStatus 获取交易对同步状态 (使用 sqlc)
func (r *PostgresRepository) GetSymbolSyncStatus(ctx context.Context, exchangeName, symbol, tradeType string) (*SymbolSyncStatus, error) {
	row, err := r.queries.GetSymbolSyncStatus(ctx, db.GetSymbolSyncStatusParams{
		Exchange:  exchangeName,
		Symbol:    symbol,
		TradeType: tradeType,
	})
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &SymbolSyncStatus{
		Exchange:       row.Exchange,
		Symbol:         row.Symbol,
		TradeType:      row.TradeType,
		EarliestDataTs: row.EarliestDataTs.Int64,
		LatestSyncTs:   row.LatestSyncTs.Int64,
	}, nil
}

// UpdateSymbolSyncStatus 更新交易对同步状态 (使用 sqlc)
func (r *PostgresRepository) UpdateSymbolSyncStatus(ctx context.Context, status *SymbolSyncStatus) error {
	return r.queries.UpsertSymbolSyncStatus(ctx, db.UpsertSymbolSyncStatusParams{
		Exchange:       status.Exchange,
		Symbol:         status.Symbol,
		TradeType:      status.TradeType,
		EarliestDataTs: pgtype.Int8{Int64: status.EarliestDataTs, Valid: true},
		LatestSyncTs:   pgtype.Int8{Int64: status.LatestSyncTs, Valid: true},
	})
}

// GetAllSymbolsSyncStatus 获取所有交易对的同步状态
func (r *PostgresRepository) GetAllSymbolsSyncStatus(ctx context.Context, exchangeName, tradeType string) ([]SymbolSyncStatusWithTime, error) {
	query := `
		SELECT 
			exchange,
			symbol,
			trade_type,
			earliest_data_ts,
			latest_sync_ts,
			created_at,
			updated_at
		FROM symbol_sync_status
		WHERE exchange = $1
	`
	
	args := []interface{}{exchangeName}
	
	if tradeType != "" {
		query += " AND trade_type = $2"
		args = append(args, tradeType)
	}
	
	query += " ORDER BY symbol"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	statuses := make([]SymbolSyncStatusWithTime, 0)
	for rows.Next() {
		var status SymbolSyncStatusWithTime
		if err := rows.Scan(
			&status.Exchange,
			&status.Symbol,
			&status.TradeType,
			&status.EarliestDataTs,
			&status.LatestSyncTs,
			&status.CreatedAt,
			&status.UpdatedAt,
		); err != nil {
			return nil, err
		}
		statuses = append(statuses, status)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return statuses, nil
}

// DeleteSymbolInfo 删除单个交易对 (使用 sqlc)
func (r *PostgresRepository) DeleteSymbolInfo(ctx context.Context, exchangeName, symbol, tradeType string) error {
	return r.queries.DeleteSymbolInfo(ctx, db.DeleteSymbolInfoParams{
		Exchange:  exchangeName,
		Symbol:    symbol,
		TradeType: tradeType,
	})
}

// GetSymbolInfo 获取单个交易对信息 (使用 sqlc)
func (r *PostgresRepository) GetSymbolInfo(ctx context.Context, exchangeName, symbol, tradeType string) (*exchange.SymbolInfo, error) {
	row, err := r.queries.GetSymbolInfoByKey(ctx, db.GetSymbolInfoByKeyParams{
		Exchange:  exchangeName,
		Symbol:    symbol,
		TradeType: tradeType,
	})
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	info := &exchange.SymbolInfo{
		Symbol:            row.Symbol,
		RawSymbol:         row.RawSymbol,
		BaseCurrency:      row.BaseCurrency,
		QuoteCurrency:     row.QuoteCurrency,
		TradeType:         row.TradeType,
		TickSize:          row.TickSize,
		StepSize:          row.StepSize,
		MinQty:            row.MinQty,
		MaxQty:            row.MaxQty,
		QuantityPrecision: int(row.QuantityPrecision),
		PricePrecision:    int(row.PricePrecision),
		Status:            row.Status,
		SyncEnabled:       row.SyncEnabled,
	}

	if row.ContractValue.Valid {
		v := numericToFloat64(row.ContractValue)
		info.ContractValue = &v
	}
	if row.MaxLeverage.Valid {
		v := numericToFloat64(row.MaxLeverage)
		info.MaxLeverage = &v
	}

	return info, nil
}

// Close 关闭连接池
func (r *PostgresRepository) Close() error {
	r.pool.Close()
	return nil
}

// GetPartitionManager 获取分表管理器
func (r *PostgresRepository) GetPartitionManager() *PartitionManager {
	return r.partition
}

// GetPool 获取数据库连接池 (用于自定义查询)
func (r *PostgresRepository) GetPool() *pgxpool.Pool {
	return r.pool
}

// helper functions

func numericFromFloat64(v float64) pgtype.Numeric {
	d := decimal.NewFromFloat(v)
	var n pgtype.Numeric
	_ = n.Scan(d.String())
	return n
}

func numericToFloat64(n pgtype.Numeric) float64 {
	if !n.Valid {
		return 0
	}
	d, err := decimal.NewFromString(n.Int.String())
	if err != nil {
		return 0
	}
	// 处理小数位
	d = d.Shift(-n.Exp)
	f, _ := d.Float64()
	return f
}
