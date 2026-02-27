-- name: InsertCandle :exec
INSERT INTO normalized_candles (
    symbol, exchange, trade_type, period, timestamp,
    open, high, low, close, volume, buy_volume, symbol_family
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
)
ON CONFLICT (symbol, exchange, trade_type, period, timestamp)
DO UPDATE SET
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume = EXCLUDED.volume,
    buy_volume = EXCLUDED.buy_volume;

-- name: GetCandles :many
SELECT symbol, exchange, trade_type, period, timestamp,
       open, high, low, close, volume, buy_volume,
       COALESCE(symbol_family, '') as symbol_family
FROM normalized_candles
WHERE exchange = $1 AND symbol = $2 AND period = $3
  AND timestamp >= $4 AND timestamp <= $5
ORDER BY timestamp ASC
LIMIT $6;

-- name: GetLatestCandle :one
SELECT symbol, exchange, trade_type, period, timestamp,
       open, high, low, close, volume, buy_volume,
       COALESCE(symbol_family, '') as symbol_family
FROM normalized_candles
WHERE exchange = $1 AND symbol = $2 AND trade_type = $3 AND period = $4
ORDER BY timestamp DESC
LIMIT 1;

-- name: GetMissingPeriods :many
WITH expected AS (
    SELECT generate_series($4::bigint, $5::bigint, $6::bigint) AS ts
)
SELECT e.ts
FROM expected e
LEFT JOIN normalized_candles nc
    ON nc.exchange = $1
    AND nc.symbol = $2
    AND nc.trade_type = $3
    AND nc.period = $7
    AND nc.timestamp = e.ts
WHERE nc.id IS NULL
ORDER BY e.ts;

-- name: CountCandlesByPeriod :one
SELECT COUNT(*) FROM normalized_candles
WHERE exchange = $1 AND symbol = $2 AND period = $3
  AND timestamp >= $4 AND timestamp <= $5;
