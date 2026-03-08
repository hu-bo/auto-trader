下单数量不正确排查，条件/逻辑委托，统一使用usdt计算，前端写100数量就是100usdt
pkg/exchange-adapter/exchanges/okx/trade_adapter.go 中，确定sz=100，但是实际下单数量是100.00 USDT
fetch("https://www.okx.com/priapi/v5/trade/order-algo?t=1772980609797", {
  "headers": {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pragma": "no-cache",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  },
  "referrer": "https://www.okx.com/zh-hans/trade-swap/jup-usdt-swap",
  "body": "{\"instId\":\"JUP-USDT-SWAP\",\"ordType\":\"trigger\",\"tdMode\":\"isolated\",\"_feReq\":true,\"isTradeBorrowMode\":false,\"side\":\"buy\",\"posSide\":\"long\",\"cxlOnClosePos\":false,\"triggerPx\":\"0.1000\",\"orderPx\":\"0.1000\",\"triggerPxType\":\"last\",\"proposedPx\":\"0.1628\",\"sz\":100,\"inputPrice\":\"0.1000\",\"_last\":\"0.1628\",\"apiLogTag\":\"placeOrderNew\"}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});


pkg/exchange-adapter 希望下单相关方法的 参数支持全仓保证金 和 逐仓保证金支持，apps/
  exchange-adapter-service/internal/grpc apps/trader-service-node/src/grpc/exchange-
  grpc.client.ts、apps/trader-web/src/components/trading 都要更新，
  okx的是
  const (
        MarginModeCross    MarginMode = "cross"
        MarginModeIsolated MarginMode = "isolated"
  )
