import { Body, Config, Controller, Get, Inject, Logger, Param, Post, Query, httpError } from '@midwayjs/core';
import type { ILogger } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from '../service/exchange.service.js';
import { OrderService } from '../service/order.service.js';
import { OrderUpdateService } from '../service/order-update.service.js';
import { UserService } from '../service/user.service.js';
import { exchangeSync } from '../common/exchange-sync.js';
import { apiOk } from '../util/api-response.js';
import { OrderStatus } from '../entity/order.entity.js';
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

  @Inject()
  orderUpdateService!: OrderUpdateService;

  @Logger()
  logger!: ILogger;

  @Config('exchangeAdapter')
  exchangeAdapterConfig!: ExchangeAdapterConfig;

  private normalizeTradeTypeForGrpc(tradeType: string): string {
    return tradeType === 'usdm-algo' ? 'futures' : tradeType;
  }

  private requireGrpcSuccess(resp: any, fallbackMessage: string): void {
    if (!resp?.success) {
      const errMsg = resp?.error?.message;
      const errCode = resp?.error?.code;
      const detail = errMsg || (errCode ? `error code: ${errCode}` : null) || fallbackMessage;
      throw new httpError.BadRequestError(detail);
    }
  }

  private requireGrpcNoError(resp: any, fallbackMessage: string): void {
    if (resp?.error) {
      throw new httpError.BadRequestError(resp.error?.message || fallbackMessage);
    }
  }

  private isStrategyAlgoOrder(order: { tradeType?: string | null; orderType?: string | null; source?: string | null }): boolean {
    const tradeType = (order.tradeType || '').toLowerCase();
    if (tradeType === 'usdm-algo') return true;

    const orderType = (order.orderType || '').toLowerCase();
    if (orderType === 'stop_market' || orderType === 'stop_limit') return true;

    return (order.source || '').toLowerCase() === 'strategy';
  }

  private async getTokenForExchange(exchangeId: number): Promise<string> {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const exchange = await this.exchangeService.get(user.id, exchangeId);
    const creds = await this.exchangeService.getApiCredentials(user.id, exchangeId);
    const initResp = await this.exchangeGrpc.initAccount({
      exchangeType: exchange.exchangeType,
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
      passphrase: creds.passphrase,
      demonet: exchange.isTestnet,
      name: exchange.name,
      accountId: exchangeId.toString(),
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
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
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
    this.requireGrpcSuccess(resp, '下单失败');

    const order = resp?.order;
    if (!order) {
      throw new httpError.BadGatewayError('下单成功但未返回订单信息');
    }

    const exchangeOrderId = order.exchange_order_id || order.id;
    if (!exchangeOrderId) {
      throw new httpError.BadGatewayError('下单成功但未返回交易所订单ID');
    }

    await this.orderService.createBatch([{
      userid: user.id,
      exchangeId: body.exchangeId,
      source: 'manual',
      exchangeOrderId,
      symbol: body.symbol,
      tradeType: body.tradeType,
      side: body.side,
      orderType: body.orderType,
      status: OrderStatus.NEW,
      quantity: String(body.quantity),
      price: body.price == null ? null : String(body.price),
      positionSide: body.positionSide ?? null,
      reduceOnly: body.reduceOnly ?? false,
    }]);
    this.orderUpdateService.subscribeForExchange(body.exchangeId);

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
    const grpcTradeType = this.normalizeTradeTypeForGrpc(body.tradeType);
    const tickerMap = await exchangeSync.getTickerPriceMap(exchangeType, grpcTradeType);

    // 4. Compute orders with precision truncation
    const offsetMultiplier = 1 + body.priceOffsetPercent / 100;
    const orders: Array<{
      symbol: string; tradeType: string; side: string; strategyType: string;
      quantity: number; triggerPrice: number; positionSide: string;
      triggerPriceType: string; reduceOnly: boolean;
      tpTriggerPrice?: number;
    }> = [];

    const tp = (price: number, sym: string) =>
      exchangeSync.truncatePrice(price, exchangeType, grpcTradeType, sym);
    const tq = (qty: number, sym: string) =>
      exchangeSync.truncateQuantity(qty, exchangeType, grpcTradeType, sym);

    for (const symbol of body.symbols) {
      const lastPrice = tickerMap.get(symbol);
      if (!lastPrice) {
        this.logger.warn('[BatchStrategy] No price data for symbol %s, skipping', symbol);
        continue;
      };
      
      const entryPrice = lastPrice * offsetMultiplier;
      const quantity = tq(body.amountUSDT / entryPrice, symbol);
      if (quantity <= 0) {
        this.logger.warn('[BatchStrategy] Computed quantity %.8f for symbol %s is too small, skipping', quantity, symbol);
        continue;
      };

      if (body.direction === 'buy_long') {
        orders.push({
          symbol,
          tradeType: grpcTradeType,
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
          tradeType: grpcTradeType,
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
    const results: any[] = Array.isArray(resp?.results) ? resp.results : [];
    if (results.length === 0) {
      throw new httpError.BadGatewayError('批量下单返回为空');
    }
    if ((resp?.success_count ?? 0) <= 0) {
      const firstErr = results.find(r => !r?.success)?.error?.message;
      throw new httpError.BadRequestError(firstErr || '批量下单失败');
    }

    // 6. Persist successful orders to DB (best-effort, don't fail the response)
    try {
      const orderRecords: Array<Record<string, unknown>> = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r?.success || !r?.order) continue;
        orderRecords.push({
          userid: user.id,
          exchangeId: body.exchangeId,
          source: 'manual',
          exchangeOrderId: r.order.algo_id,
          symbol: r.order.symbol,
          tradeType: body.tradeType,
          side: orders[i].side,
          orderType: 'stop_market',
          status: OrderStatus.NEW,
          quantity: String(orders[i].quantity),
          price: String(orders[i].triggerPrice),
          positionSide: orders[i].positionSide,
          reduceOnly: orders[i].reduceOnly,
        });
      }
      if (orderRecords.length > 0) {
        await this.orderService.createBatch(orderRecords);
        this.orderUpdateService.subscribeForExchange(body.exchangeId);
      }
    } catch (err) {
      this.logger.error('[BatchStrategy] Failed to persist orders to DB: %s', err);
    }

    return apiOk(resp);
  }

  @Post('/batch-strategy/check-duplicates')
  async checkDuplicates(@Body() body: CheckDuplicatesBodyDTO) {
    const token = await this.getTokenForExchange(body.exchangeId);
    const grpcTradeType = this.normalizeTradeTypeForGrpc(body.tradeType);
    const resp = await this.exchangeGrpc.getOpenStrategyOrders({
      token,
      tradeType: grpcTradeType,
    });
    this.requireGrpcNoError(resp, '查询策略单失败');
    return apiOk({ openOrders: resp?.orders || [] });
  }

  @Get('/:orderId')
  async get(
    @Param() params: OrderIdParamDTO,
    @Query() query: OrderTokenQueryDTO
  ) {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const order = await this.orderService.get(user.id, params.orderId);
    if (!order.exchangeOrderId) {
      throw new httpError.BadRequestError('该订单没有交易所订单ID，无法查询');
    }

    const token = await this.getTokenForExchange(query.exchangeId);
    const grpcTradeType = this.normalizeTradeTypeForGrpc(order.tradeType);
    const resp = this.isStrategyAlgoOrder(order)
      ? await this.exchangeGrpc.getStrategyOrder({
          token,
          algoId: order.exchangeOrderId,
          tradeType: grpcTradeType,
        })
      : await this.exchangeGrpc.getOrder({
          token,
          orderId: order.exchangeOrderId,
        });
    this.requireGrpcNoError(resp, '查询订单失败');
    if (!resp?.order) {
      throw new httpError.NotFoundError('订单不存在');
    }
    return apiOk(resp);
  }

  @Post('/:orderId/cancel')
  async cancel(
    @Param() params: OrderIdParamDTO,
    @Body() body: CancelOrderBodyDTO
  ) {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const order = await this.orderService.get(user.id, params.orderId);
    if (!order.exchangeOrderId) {
      throw new httpError.BadRequestError('该订单没有交易所订单ID，无法取消');
    }

    const token = await this.getTokenForExchange(body.exchangeId);
    const grpcTradeType = this.normalizeTradeTypeForGrpc(order.tradeType);
    const resp = this.isStrategyAlgoOrder(order)
      ? await this.exchangeGrpc.cancelStrategyOrder({
          token,
          symbol: order.symbol,
          algoId: order.exchangeOrderId,
          tradeType: grpcTradeType,
        })
      : await this.exchangeGrpc.cancelOrder({
          token,
          orderId: order.exchangeOrderId,
        });
    console.log(this.isStrategyAlgoOrder(order), resp)
    this.requireGrpcSuccess(resp, '取消订单失败');
    return apiOk(resp);
  }
}
