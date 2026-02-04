-- symbol_infos 交易对信息表
CREATE TABLE IF NOT EXISTS symbol_infos (
    id BIGSERIAL PRIMARY KEY,
    exchange VARCHAR(16) NOT NULL,
    symbol VARCHAR(24) NOT NULL,
    raw_symbol VARCHAR(30) NOT NULL,
    base_currency VARCHAR(20) NOT NULL,
    quote_currency VARCHAR(10) NOT NULL,
    trade_type VARCHAR(10) NOT NULL,
    tick_size VARCHAR(20),
    step_size VARCHAR(20),
    min_qty VARCHAR(30),
    max_qty VARCHAR(30),
    quantity_precision INT,
    price_precision INT,
    status VARCHAR(20),
    contract_value NUMERIC,
    max_leverage NUMERIC,
    sync_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (exchange, symbol, trade_type)
);
