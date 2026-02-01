# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Exchange Sync is a Go service that aggregates real-time cryptocurrency data from Binance and OKX exchanges. It receives WebSocket streams (5m K-lines, trades, depth), aggregates them into standardized candles (15m/4h/1d), filters large orders (≥$5000 USDT), and exposes data via HTTP API and NATS message queue.

## Development Commands

```bash
make build       # Build to ./bin/exchange-sync
make run         # Build and run
make dev         # Hot reload with Air
make test        # Run tests
make test-cover  # Test with coverage report
make lint        # Run golangci-lint
make fmt         # Format code
make sqlc        # Generate sqlc code from SQL queries
make docker-up   # Start local PostgreSQL
make docker-down # Stop local PostgreSQL
```

## Configuration

Copy `config.yaml` to `config.local.yaml` for local development. Key settings:
- `server.http_port`: HTTP API port (default 9003)
- `nats.*`: NATS message queue settings (url, subject_prefix, batch_window_ms)
- `database.*`: PostgreSQL connection (leave host empty to skip persistence)
- `proxy`: Optional SOCKS5/HTTP proxy for exchange connections

## Architecture

**Data Flow:**
```
Binance/OKX WebSocket → SyncService → PeriodAggregator → Batch Writer → PostgreSQL
                                    → OrderBookManager → NATS Publish
```

**Key Components:**

- `internal/service/ws_sync.go` - Core orchestration: manages exchange connections, creates aggregators per exchange
- `internal/service/sync.go` - History sync service: fills missing data via REST API
- `internal/aggregator/period.go` - Aggregates 5m → 15m/4h/1d candles, tracks OHLCV + buy/sell volume
- `internal/aggregator/orderbook.go` - Filters large orders (≥$5000), uses TreeMap for price sorting
- `internal/exchange/types.go` - Core interfaces (`Exchange`, `RESTClient`) and data types
- `internal/exchange/binance/` & `internal/exchange/okx/` - Exchange-specific WebSocket/REST clients
- `internal/storage/db/` - sqlc-generated database code

**Symbol Format Convention:**
- Internal/Unified: `BTC-USDT`
- Binance: `BTCUSDT` (uppercase, no separator)
- OKX Spot: `BTC-USDT`, OKX Futures: `BTC-USDT-SWAP`

Use `NormalizeSymbol()` and `ToExchangeSymbol()` from `internal/exchange/types.go` for conversions.

## Tech Stack

- Go 1.23, Echo v4 (HTTP), gorilla/websocket, NATS
- PostgreSQL with pgx/v5, sqlc for query generation
- ByteDance Sonic for JSON, emirpasic/gods TreeMap for orderbook
- Viper for config (YAML + ENV), zerolog for logging

## NATS Message Topics

- `{prefix}.candle.{exchange}.{tradeType}.{symbol}.{period}` - K-line updates (e.g. `exchange.candle.binance.spot.BTC-USDT.15m`)
- `{prefix}.orderbook.{exchange}.{tradeType}.{symbol}` - OrderBook updates

Default prefix: `exchange`

## Code Style Guidelines

- Extract reusable logic into `pkg/utils/` for maintainability
- Use batch processing with configurable `batch_size` and `batch_interval` for database writes
- Implement graceful shutdown with context cancellation
- Follow callback pattern for event handling (OnKline, OnTrade, OnDepth, OnError)
