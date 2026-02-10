# Repository Guidelines

## Project Structure & Module Organization
- `core/`: shared contracts, `Result[T]`, base adapter abstractions, and math/cache utilities.
- `exchanges/binance/` and `exchanges/okx/`: exchange-specific REST/WS adapters and mapper logic.
- `aggregator/`: kline/trade aggregation and websocket aggregation helpers.
- `marketdata/`: common market-data types and period enums used across packages.
- `example/`: runnable demos (`public`, `trader`, `ws_user_data`, `ticker_stream`) plus helpers in `example/internal/exampleutil`.
- `go.mod` uses local `replace` directives (`../binance-api`, `../okx-api`); keep sibling modules present when building.

## Build, Test, and Development Commands
- `go build ./...` — compile all packages.
- `go test ./...` — run unit tests (currently concentrated in `core/` and `aggregator/`).
- `go test -cover ./...` — check package coverage before opening a PR.
- `go run ./example/public` — smoke-test public market data paths.
- `go run ./example/trader --ws` and `go run ./example/ws_user_data binance` — manual checks for trading and WS flows.
- `cp .env.example .env.local` — initialize local config for examples.

## Coding Style & Naming Conventions
- Format every touched Go file with `gofmt -w` (tabs, standard imports, canonical spacing).
- Follow Go naming: exported identifiers in `PascalCase`, unexported in `camelCase`; file names stay lowercase with underscores (for example, `ws_public_adapter.go`).
- Reuse unified domain types from `core/types.go`; prefer returning `core.Result[T]` and `core.ErrorInfo` instead of ad-hoc shapes.
- Keep symbols in unified format (`BTC-USDT`) and convert with adapter helpers.

## Testing Guidelines
- Use Go’s built-in `testing` package with colocated `*_test.go` files.
- Prefer deterministic, table-driven tests for mappers/math and explicit timestamp fixtures for aggregation logic.
- No enforced coverage threshold is configured; do not reduce meaningful coverage in `core` or `aggregator`.
- Add at least one regression test for each bug fix.

## Commit & Pull Request Guidelines
- Recent history includes `feat:`, `refactor:`, and `doc:` prefixes; use clear Conventional Commit style (`feat:`, `fix:`, `refactor:`, `docs:`).
- Keep commits scoped to one change area and avoid placeholder subjects (for example, `1`).
- PRs should include purpose, impacted exchanges/trade types, config/env updates, and `go test ./...` output.
- For WS/order-flow changes, attach a short reproduction note using commands from `example/README.md`.

## Security & Configuration Tips
- Never commit API keys or `.env.local`; start from `.env.example`.
- Keep `SIMULATED=true` and `DEMONET=true` for safe local validation unless a real-trade test is explicitly required.
