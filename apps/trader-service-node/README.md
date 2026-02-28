# my_midway_project

## QuickStart

<!-- add docs here for user -->

see [midway docs][midway] for more detail.

### Development

```bash
$ npm i
$ npm run dev
$ open http://localhost:7001/
```

### Deploy

```bash
$ npm start
```

### npm scripts

- Use `npm run lint` to check code style.
- Use `npm test` to run unit test.


[midway]: https://midwayjs.org



apps/exchange-adapter-service/internal/grpc/server.go 
apps/trader-service-node/src/controller/order.controller.ts
apps/trader-service-node/src/entity/order.entity.ts
/batch-strategy 成功的订单需要记录订单信息到 order table

signal 不用(因为是手动触发)

下面的字段创建成功后不用写入
filledQty  
avgPrice
fee
创建成功后需要通过nats订阅（参考信号推送）
exchange-adapter-service 提供order更新信息(初始化账户时就开始监听)，使用sdk exchange-adapter
pkg/exchange-adapter/exchanges/binance/ws_user_data_adapter.go
pkg/exchange-adapter/exchanges/okx/ws_user_data_adapter.go


apps/exchange-adapter-service同时也需要支持低频的grpc接口同步(GetOrder等)

如果sdk exchange-adapter有缺失的功能可以顺便完善(代码精简功能完整)