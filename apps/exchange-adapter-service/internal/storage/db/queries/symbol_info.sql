-- name: UpsertSymbolInfo :exec
-- Insert new symbol or update existing (without overwriting symbol, base_currency, quote_currency)
INSERT INTO
    symbol_infos (
        exchange,
        symbol,
        raw_symbol,
        base_currency,
        quote_currency,
        trade_type,
        tick_size,
        step_size,
        min_qty,
        max_qty,
        quantity_precision,
        price_precision,
        status,
        contract_value,
        max_leverage
    )
VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15
    ) ON CONFLICT (exchange, symbol, trade_type) DO
UPDATE
SET
    raw_symbol = EXCLUDED.raw_symbol,
    tick_size = EXCLUDED.tick_size,
    step_size = EXCLUDED.step_size,
    min_qty = EXCLUDED.min_qty,
    max_qty = EXCLUDED.max_qty,
    quantity_precision = EXCLUDED.quantity_precision,
    price_precision = EXCLUDED.price_precision,
    status = EXCLUDED.status,
    contract_value = EXCLUDED.contract_value,
    max_leverage = EXCLUDED.max_leverage,
    updated_at = NOW();

-- name: DeleteSymbolInfo :exec
-- Delete a symbol and return for unsubscribe handling
DELETE FROM symbol_infos
WHERE
    exchange = $1
    AND symbol = $2
    AND trade_type = $3;

-- name: DeleteSymbolInfosByExchange :exec
-- Delete all symbols for an exchange and trade type
DELETE FROM symbol_infos WHERE exchange = $1 AND trade_type = $2;

-- name: GetSymbolInfoByKey :one
-- Get single symbol info
SELECT
    id,
    exchange,
    symbol,
    raw_symbol,
    base_currency,
    quote_currency,
    trade_type,
    COALESCE(tick_size, '') as tick_size,
    COALESCE(step_size, '') as step_size,
    COALESCE(min_qty, '') as min_qty,
    COALESCE(max_qty, '') as max_qty,
    COALESCE(quantity_precision, 0) as quantity_precision,
    COALESCE(price_precision, 0) as price_precision,
    COALESCE(status, '') as status,
    contract_value,
    max_leverage,
    COALESCE(sync_enabled, true) as sync_enabled
FROM symbol_infos
WHERE
    exchange = $1
    AND symbol = $2
    AND trade_type = $3;

-- name: GetSymbolInfos :many
SELECT
    symbol,
    raw_symbol,
    base_currency,
    quote_currency,
    trade_type,
    COALESCE(tick_size, '') as tick_size,
    COALESCE(step_size, '') as step_size,
    COALESCE(min_qty, '') as min_qty,
    COALESCE(max_qty, '') as max_qty,
    COALESCE(quantity_precision, 0) as quantity_precision,
    COALESCE(price_precision, 0) as price_precision,
    COALESCE(status, '') as status,
    contract_value,
    max_leverage,
    COALESCE(sync_enabled, true) as sync_enabled
FROM symbol_infos
WHERE
    exchange = $1
ORDER BY symbol;

-- name: GetSyncEnabledSymbolInfos :many
-- Get symbols with sync_enabled = true for WS subscription
SELECT
    symbol,
    raw_symbol,
    base_currency,
    quote_currency,
    trade_type,
    COALESCE(tick_size, '') as tick_size,
    COALESCE(step_size, '') as step_size,
    COALESCE(min_qty, '') as min_qty,
    COALESCE(max_qty, '') as max_qty,
    COALESCE(quantity_precision, 0) as quantity_precision,
    COALESCE(price_precision, 0) as price_precision,
    COALESCE(status, '') as status,
    contract_value,
    max_leverage,
    COALESCE(sync_enabled, true) as sync_enabled
FROM symbol_infos
WHERE
    exchange = $1
    AND COALESCE(sync_enabled, true) = true
ORDER BY symbol;

-- name: GetSymbolInfo :one
SELECT
    symbol,
    raw_symbol,
    base_currency,
    quote_currency,
    trade_type,
    COALESCE(tick_size, '') as tick_size,
    COALESCE(step_size, '') as step_size,
    COALESCE(min_qty, '') as min_qty,
    COALESCE(max_qty, '') as max_qty,
    COALESCE(quantity_precision, 0) as quantity_precision,
    COALESCE(price_precision, 0) as price_precision,
    COALESCE(status, '') as status,
    contract_value,
    max_leverage,
    COALESCE(sync_enabled, true) as sync_enabled
FROM symbol_infos
WHERE
    exchange = $1
    AND symbol = $2
    AND trade_type = $3;

-- name: UpdateSymbolSyncEnabled :exec
-- Update sync_enabled flag for a symbol
UPDATE symbol_infos
SET
    sync_enabled = $4,
    updated_at = NOW()
WHERE
    exchange = $1
    AND symbol = $2
    AND trade_type = $3;