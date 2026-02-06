-- name: GetSymbolSyncStatus :one
SELECT exchange, symbol, trade_type, earliest_data_ts, latest_sync_ts
FROM symbol_sync_status
WHERE exchange = $1 AND symbol = $2 AND trade_type = $3;

-- name: UpsertSymbolSyncStatus :exec
INSERT INTO symbol_sync_status (exchange, symbol, trade_type, earliest_data_ts, latest_sync_ts)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (exchange, symbol, trade_type)
DO UPDATE SET
    earliest_data_ts = EXCLUDED.earliest_data_ts,
    latest_sync_ts = EXCLUDED.latest_sync_ts,
    updated_at = NOW();

-- name: ListSymbolSyncStatus :many
SELECT exchange, symbol, trade_type, earliest_data_ts, latest_sync_ts
FROM symbol_sync_status
WHERE exchange = $1
ORDER BY symbol;
