apps/trader-web/src/routes/index.tsx新增一个Batch Trading                                                                                              
  支持批量选币，选币api复用apps/trader-web/src/api/market.ts，列表展示字段symbol close priceChangePct quoteVolume24h                                     
  选币前端选，条件 exchange tradeType，固定条件，涨幅前N，跌幅前N 可以任意填写1 ～ 100                                                                   
  下单交易：多少个选中，buy_long sell_short, amount(usdt), stop loss(注意处理负数) take profit                                                           
  提交后显示成功数，失败数，然后都跳到apps/trader-web/src/pages/order/Orders.tsx                                                                         
  条件订单，一个exchange tradeType  symbol 不能重复下单，需要提示                                                                                        
  使用批量下单接口/批量取消(诺没有实现前端循环调用)  

  apps/trader-web -> apps/trader-service-node -> apps/exchange-adapter-service -> pkg/exchange-adapter (PlaceStrategyOrder/CancelStrategyOrder)
相关目录/文件
  apps/trader-service-node/src/controller/order.controller.ts
  apps/exchange-adapter-service/internal/grpc