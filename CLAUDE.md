# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auto Trader is a quantitative trading platform using a polyglot microservices architecture. It's a monorepo supporting Go, Node.js/TypeScript, Python, and Rust with hybrid package management.

## Build & Development Commands

### Node.js/TypeScript (pnpm monorepo with Turbo)
```bash
pnpm install              # Install all dependencies
pnpm build                # Build all workspaces (Turbo-orchestrated)
pnpm test                 # Test all workspaces
pnpm lint                 # Lint all workspaces
pnpm clean                # Remove all node_modules

# Single package operations
pnpm --filter <package-name> build
pnpm --filter <package-name> test
pnpm --filter trader-web dev     # Run frontend dev server
```

### Go (workspace mode)
```bash
# From repository root (uses go.work)
go build ./...            # Build all Go modules
go test ./...             # Test all Go modules

# Single module
cd pkg/exchange-adapter && go test ./...
cd apps/exchange-adapter-service && go run ./cmd

# Proto generation (exchange-adapter-service)
cd apps/exchange-adapter-service
make tools                # Install protoc plugins (one-time)
make proto                # Generate Go stubs from proto
```

### Python (Poetry)
```bash
cd apps/strategy-engine
poetry install
poetry run pytest tests/unit/
poetry run uvicorn app.main:app --reload
```

### Rust (hquant-rs)
```bash
cd packages/hquant-rs
cargo build --release
cargo test
```

## Architecture

### Service Communication
- **gRPC**: exchange-adapter-service ↔ trader-service-node (contracts in `packages/contracts/proto/`)
- **NATS**: Message broker for market data and signals between all services
- **REST/WebSocket**: trader-web ↔ trader-service-node

### Directory Structure
```
apps/                           # Deployable services
├── exchange-adapter-service/   # Go - Exchange API bridge, gRPC server
├── trader-service-node/        # Midway.js - Main trading/user API backend
├── trader-web/                 # React+Vite - Frontend
└── strategy-engine/            # Python FastAPI - ML/strategy engine

pkg/                            # Go shared libraries
├── exchange-adapter/           # Unified exchange interface (Binance, OKX, Bybit)
├── binance-api/                # Binance SDK
├── okx-api/                    # OKX SDK
├── bybit-api/                  # Bybit SDK
├── logger/                     # Structured logging (zerolog wrapper)
└── risk/                       # Risk control engine

packages/                       # TypeScript/Rust/Python shared packages
├── contracts/                  # Proto definitions (source of truth for types)
├── hquant-rs/                  # Rust - High-perf indicators/backtesting
├── hquant-js/                  # TypeScript bindings for hquant-rs
├── klinecharts-pro/            # Custom K-line charting component
└── casdoor/                    # Auth/SSO integration
```

### Data Flow
```
Market Data (NATS) → strategy-engine → Signal → NATS
  → exchange-adapter-service (gRPC) → Risk Engine → Order Execution
```

### Key Patterns
- **Contracts-first**: Proto definitions in `packages/contracts/` generate all language stubs
- **Go modules use `replace` directives** for local dependencies (see go.mod files)
- **pnpm workspaces** with Turbo for Node.js build caching
- **Go workspace** (`go.work`) for local Go development

## Configuration

- **Go services**: YAML config files (`config.yaml`, `config.local.yaml`)
- **Node.js services**: TypeScript config classes in `src/config/`
- **Environment**: `.env` files (copy from `.env.example`)

## Key Files

- `go.work` - Go workspace definition
- `pnpm-workspace.yaml` - pnpm workspace config
- `turbo.json` - Turbo build pipeline
- `packages/contracts/proto/*.proto` - gRPC/data structure definitions

