-- normalized_candles 主表
CREATE TABLE IF NOT EXISTS normalized_candles (
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
);

CREATE INDEX IF NOT EXISTS idx_candles_query
ON normalized_candles(exchange, symbol, period, timestamp DESC);
