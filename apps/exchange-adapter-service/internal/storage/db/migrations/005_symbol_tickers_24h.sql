-- symbol_tickers_24h 24h Ticker 缓存表
-- 用于 /api/symbols 的交易额(quoteVolume)与涨幅排序

CREATE TABLE IF NOT EXISTS symbol_tickers_24h (
    exchange VARCHAR(16) NOT NULL,
    symbol VARCHAR(24) NOT NULL,
    trade_type VARCHAR(10) NOT NULL,

    open_price_24h DOUBLE PRECISION,
    last_price DOUBLE PRECISION,
    quote_volume_24h DOUBLE PRECISION,
    event_time_ms BIGINT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (exchange, symbol, trade_type)
);

CREATE INDEX IF NOT EXISTS idx_symbol_tickers_24h_exchange_trade_type
    ON symbol_tickers_24h (exchange, trade_type);
