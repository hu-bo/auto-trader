前端 → Node

提交的是 策略意图

{
  "exchangeId": 2,
  "tradeType": "futures",
  "symbols": ["RESOLV-USDT","OKB-USDT"],
  "side": "buy",
  "orderType": "algo",
  "amountUSDT": 100,
  "priceOffsetPercent": 1,
  "stopLossPercent": 5,
  "takeProfitPercent": 10,
  "positionSide": "long",
  "leverage": 10
}
Node 做的事情

1️⃣ 获取行情

lastPrice

2️⃣ 计算 entryPrice

你现在代码：

entryPrice = lastPrice * (1 + offset)

⚠️ 这里有个问题：

buy 应该 lower price
sell 应该 higher price

建议：

buy  entry = last * (1 - offset)
sell entry = last * (1 + offset)

否则买单会追涨。

3️⃣ 计算 quantity

现在：

quantity = amountUSDT / entryPrice

如果 futures 有 leverage：

建议：

quantity = amountUSDT * leverage / entryPrice

否则杠杆没用。

4️⃣ 计算止损

你现在做的是：

strategyType = stop-loss

trigger price：

buy  -> entry * (1 - SL%)
sell -> entry * (1 + SL%)

5️⃣ 计算止盈

tpTriggerPrice
buy  -> entry * (1 + TP%)
sell -> entry * (1 - TP%)
当前 Node 发给 Go 的订单

现在你的 orders 实际结构是：

{
  symbol: string
  tradeType: string
  side: string
  positionSide?: string
  strategyType: string

  quantity: number

  triggerPrice: number
  triggerPriceType: string

  reduceOnly: boolean

  tpTriggerPrice?: number
}

问题是：

1 缺少 entry order

你只下了：

stop-loss

而没有下：

entry trigger

这意味着：

实际上是直接挂止损单。

2 TP 结构不统一
tpTriggerPrice

是单字段。

但是未来：

TP
SL
Trailing
Multi TP

会炸。

推荐统一参数结构（Node → Go）

我建议 Go 只接收一种统一结构：

StrategyOrderParams

如下：

{
  "symbol": "RESOLV-USDT",
  "tradeType": "futures",
  "side": "buy",
  "positionSide": "long",

  "strategyType": "trigger",

  "quantity": 12.4,

  "triggerPrice": 0.152,
  "triggerPriceType": "last",

  "orderPrice": 0.152,

  "reduceOnly": false,

  "attachedOrders": [
    {
      "type": "take_profit",
      "triggerPrice": 0.168,
      "orderPrice": -1
    },
    {
      "type": "stop_loss",
      "triggerPrice": 0.145,
      "orderPrice": -1
    }
  ]
}
Node 最终 orders 结构

建议 Node 改为：

const orders: StrategyOrderParams[] = []

结构：

interface StrategyOrderParams {

  symbol: string
  tradeType: string

  side: "buy" | "sell"

  positionSide?: "long" | "short"

  strategyType: "trigger"

  quantity: number

  triggerPrice: number

  triggerPriceType: "last" | "mark" | "index"

  orderPrice?: number

  reduceOnly: boolean

  attachedOrders?: AttachedOrder[]
}

interface AttachedOrder {

  type: "take_profit" | "stop_loss"

  triggerPrice: number

  orderPrice?: number
}
Node 改造后的 orders.push

你当前代码：

orders.push({
  symbol,
  tradeType: grpcTradeType,
  side,
  positionSide: posSide,
  strategyType: 'stop-loss',
  quantity,
  triggerPrice,
  triggerPriceType: 'last',
  reduceOnly: false,
  tpTriggerPrice
});

建议改为：

orders.push({

  symbol,
  tradeType: grpcTradeType,

  side,
  positionSide: posSide,

  strategyType: 'trigger',

  quantity,

  triggerPrice: entryPrice,
  triggerPriceType: 'last',

  orderPrice: entryPrice,

  reduceOnly: false,

  attachedOrders: [
    {
      type: "take_profit",
      triggerPrice: tpPrice,
      orderPrice: -1
    },
    {
      type: "stop_loss",
      triggerPrice: slPrice,
      orderPrice: -1
    }
  ]
});
最终系统架构
Frontend

   ↓
NodeJS trader-service-node
   ↓
StrategyOrderParams
   ↓
Go exchange-adapter-service
   ↓
exchange-adapter
   ↓
Binance / OKX 适配


OKX

直接：

trigger + attachAlgoOrds
Binance

拆单：

1 entry trigger
1 stop loss
1 take profit