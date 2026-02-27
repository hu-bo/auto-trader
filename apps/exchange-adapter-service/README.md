# exchange-adapter-service

Implements the gRPC `exchange.ExchangeService` contract defined in `packages/contracts/proto/exchange.proto`.

## Run

```bash
cd apps/exchange-adapter-service
go run ./cmd
```

## Proto generation

- Install plugins (one-time): `make tools`
- Generate Go stubs: `make proto`

Proto definitions are in `packages/contracts/proto/exchange.proto`.

## SQLc (database queries)

SQL queries are in `internal/storage/db/queries/*.sql`，Go 代码由 sqlc 自动生成到 `internal/storage/db/*.sql.go`。

**修改数据库查询的流程：**

1. 编辑 `internal/storage/db/queries/` 下的 `.sql` 源文件
2. 运行 `sqlc generate` 重新生成 Go 代码
3. **不要直接修改 `*.sql.go` 文件**，它们会被覆盖

```bash
cd apps/exchange-adapter-service
sqlc generate
```

## Database migrations

Migration 文件在 `internal/storage/db/migrations/`，按编号顺序执行。
