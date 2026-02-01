# Bybit API 目录结构映射

## TypeScript -> Go 映射

```
node-pkg/bybit-api/src/          ->  pkg/bybit-api/

核心文件:
rest-client-v5.ts                ->  rest_client.go
websocket-client.ts              ->  websocket_client.go
websocket-api-client.ts          ->  websocket_api_client.go

类型定义:
types/request/v5-market.ts       ->  types/request/v5_market.go
types/request/v5-trade.ts        ->  types/request/v5_trade.go
types/request/v5-position.ts     ->  types/request/v5_position.go
types/request/v5-account.ts      ->  types/request/v5_account.go
types/request/v5-asset.ts        ->  types/request/v5_asset.go

types/response/v5-market.ts      ->  types/response/v5_market.go
types/response/v5-trade.ts       ->  types/response/v5_trade.go
types/response/v5-position.ts    ->  types/response/v5_position.go
types/response/v5-account.ts     ->  types/response/v5_account.go
types/response/v5-asset.ts       ->  types/response/v5_asset.go

工具类:
util/BaseRestClient.ts           ->  util/base_rest_client.go
util/requestUtils.ts             ->  util/request_utils.go
util/webCryptoAPI.ts             ->  util/crypto.go
```

## 实现优先级

**P0 (必须)**: 市场数据 + 交易
**P1 (重要)**: 持仓 + 账户 + 资产
**P2 (可选)**: WebSocket + 高级功能
