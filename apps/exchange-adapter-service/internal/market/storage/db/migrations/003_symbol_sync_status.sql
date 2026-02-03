-- symbol_sync_status 同步状态表
CREATE TABLE IF NOT EXISTS symbol_sync_status (
    id BIGSERIAL PRIMARY KEY,
    exchange VARCHAR(16) NOT NULL,
    symbol VARCHAR(24) NOT NULL,
    trade_type VARCHAR(10) NOT NULL,
    earliest_data_ts BIGINT DEFAULT 0,
    latest_sync_ts BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (exchange, symbol, trade_type)
);
