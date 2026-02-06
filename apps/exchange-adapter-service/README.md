# exchange-adapter-service

Implements the gRPC `exchange.ExchangeService` contract defined in `packages/contracts/proto/exchange.proto`.

## Proto generation

- Install plugins: `make tools`
- Generate stubs: `make proto`

## Run

```bash
cd apps/exchange-adapter-service
go run ./cmd
```
