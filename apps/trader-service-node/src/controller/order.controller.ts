import { Body, Config, Controller, Get, Inject, Param, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from '../service/exchange.service.js';
import { OrderService } from '../service/order.service.js';
import { UserService } from '../service/user.service.js';
import { exchangeSync } from '../common/exchange-sync.js';
import { apiOk } from '../util/api-response.js';
import { CancelOrderBodyDTO, ListOrdersQueryDTO, OrderIdParamDTO, OrderTokenQueryDTO, PlaceOrderBodyDTO } from '../dto/order.dto.js';
import { PlaceBatchStrategyOrderBodyDTO, CheckDuplicatesBodyDTO } from '../dto/batch-order.dto.js';
import type { ExchangeAdapterConfig } from '../types/config.js';

@Controller('/api/v1/orders')
export class OrderController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  exchangeService!: ExchangeService;

  @Inject()
  userService!: UserService;

  @Inject()
  orderService!: OrderService;

  @Config('exchangeAdapter')
  exchangeAdapterConfig!: ExchangeAdapterConfig;

  private async getTokenForExchange(exchangeId: number): Promise<string> {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const exchange = await this.exchangeService.get(user.id, exchangeId);
    const creds = await this.exchangeService.getApiCredentials(user.id, exchangeId);
    console.log(creds)
    const initResp = await this.exchangeGrpc.initAccount({
      exchangeType: exchange.exchangeType,
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
      passphrase: creds.passphrase,
      demonet: exchange.isTestnet,
      name: exchange.name,
    });

    if (!initResp?.success || !initResp?.token) {
      const msg = initResp?.error?.message || 'InitAccount failed';
      throw new httpError.BadGatewayError(msg);
    }

    return initResp.token;
  }

  @Get('/')
  async list(@Query() query: ListOrdersQueryDTO) {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const result = await this.orderService.listPending({
      userid: user.id,
      exchangeId: query.exchangeId,
      symbol: query.symbol,
      limit: query.limit,
      offset: query.offset,
    });
    return apiOk(result);
  }

  @Post('/')
  async create(@Body() body: PlaceOrderBodyDTO) {
    const token = await this.getTokenForExchange(body.exchangeId);
    const resp = await this.exchangeGrpc.placeOrder({
      token,
      symbol: body.symbol,
      tradeType: body.tradeType,
      side: body.side,
      orderType: body.orderType,
      quantity: body.quantity,
      price: body.price,
      positionSide: body.positionSide,
      leverage: body.leverage,
      clientOrderId: body.clientOrderId,
      reduceOnly: body.reduceOnly,
    });
    return apiOk(resp);
  }

  @Post('/batch-strategy')
  async placeBatchStrategy(@Body() body: PlaceBatchStrategyOrderBodyDTO) {
    // 1. Get exchange type to fetch tickers
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const exchange = await this.exchangeService.get(user.id, body.exchangeId);
    const exchangeType = exchange.exchangeType.toLowerCase();

    // 2. Ensure precision cache is ready
    await exchangeSync.init(this.exchangeAdapterConfig);

    // 3. Fetch price map from exchange-sync (symbol -> lastPrice)
    const tickerMap = await exchangeSync.getTickerPriceMap(exchangeType, body.tradeType);

    // 4. Compute orders with precision truncation
    const offsetMultiplier = 1 + body.priceOffsetPercent / 100;
    const orders: Array<{
      symbol: string; tradeType: string; side: string; strategyType: string;
      quantity: number; triggerPrice: number; positionSide: string;
      triggerPriceType: string; reduceOnly: boolean;
      tpTriggerPrice?: number;
    }> = [];

    const tp = (price: number, sym: string) =>
      exchangeSync.truncatePrice(price, exchangeType, body.tradeType, sym);
    const tq = (qty: number, sym: string) =>
      exchangeSync.truncateQuantity(qty, exchangeType, body.tradeType, sym);

    for (const symbol of body.symbols) {
      const lastPrice = tickerMap.get(symbol);
      if (!lastPrice) continue;

      const entryPrice = lastPrice * offsetMultiplier;
      const quantity = tq(body.amountUSDT / entryPrice, symbol);
      if (quantity <= 0) continue;

      if (body.direction === 'buy_long') {
        orders.push({
          symbol,
          tradeType: body.tradeType,
          side: 'sell',
          positionSide: 'long',
          strategyType: 'stop-loss',
          quantity,
          triggerPrice: tp(entryPrice * (1 - Math.abs(body.stopLossPercent) / 100), symbol),
          triggerPriceType: 'last',
          reduceOnly: true,
          tpTriggerPrice: tp(entryPrice * (1 + body.takeProfitPercent / 100), symbol),
        });
      } else {
        orders.push({
          symbol,
          tradeType: body.tradeType,
          side: 'buy',
          positionSide: 'short',
          strategyType: 'stop-loss',
          quantity,
          triggerPrice: tp(entryPrice * (1 + Math.abs(body.stopLossPercent) / 100), symbol),
          triggerPriceType: 'last',
          reduceOnly: true,
          tpTriggerPrice: tp(entryPrice * (1 - body.takeProfitPercent / 100), symbol),
        });
      }
    }

    if (orders.length === 0) {
      throw new httpError.BadRequestError('没有找到所选交易对的价格数据');
    }

    // 5. Place via gRPC
    const token = await this.getTokenForExchange(body.exchangeId);
    const resp = await this.exchangeGrpc.placeStrategyOrders({ token, orders });
    return apiOk(resp);
  }

  @Post('/batch-strategy/check-duplicates')
  async checkDuplicates(@Body() body: CheckDuplicatesBodyDTO) {
    const token = await this.getTokenForExchange(body.exchangeId);
    const resp = await this.exchangeGrpc.getOpenStrategyOrders({
      token,
      tradeType: body.tradeType,
    });
    return apiOk({ openOrders: resp?.orders || [] });
  }

  @Get('/:orderId')
  async get(
    @Param() params: OrderIdParamDTO,
    @Query() query: OrderTokenQueryDTO
  ) {
    const token = await this.getTokenForExchange(query.exchangeId);
    const resp = await this.exchangeGrpc.getOrder({
      token,
      orderId: params.orderId,
    });
    return apiOk(resp);
  }

  @Post('/:orderId/cancel')
  async cancel(
    @Param() params: OrderIdParamDTO,
    @Body() body: CancelOrderBodyDTO
  ) {
    const token = await this.getTokenForExchange(body.exchangeId);
    const resp = await this.exchangeGrpc.cancelOrder({
      token,
      orderId: params.orderId,
    });
    return apiOk(resp);
  }
}
