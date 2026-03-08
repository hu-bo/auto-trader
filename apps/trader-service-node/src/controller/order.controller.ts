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

  private async ensurePrecisionReady(): Promise<void> {
    await exchangeSync.init(this.exchangeAdapterConfig);
  }

  private truncateOrderPrice(price: number, exchangeType: string, tradeType: string, symbol: string): number {
    return exchangeSync.truncatePrice(
      price,
      exchangeType.toLowerCase(),
      this.normalizeTradeTypeForGrpc(tradeType),
      symbol
    );
  }

  private truncateOrderQuantity(quantity: number, exchangeType: string, tradeType: string, symbol: string): number {
    return exchangeSync.truncateQuantity(
      quantity,
      exchangeType.toLowerCase(),
      this.normalizeTradeTypeForGrpc(tradeType),
      symbol
    );
  }

  private resolveBinanceEntryStrategyType(side: string, entryPrice: number, lastPrice: number): string | null {
    const normalizedSide = side.trim().toLowerCase();
    if (!Number.isFinite(entryPrice) || !Number.isFinite(lastPrice) || entryPrice <= 0 || lastPrice <= 0) {
      return null;
    }

    if (normalizedSide === 'buy') {
      if (entryPrice > lastPrice) return 'trigger';
      if (entryPrice < lastPrice) return 'take-profit';
      return null;
    }

    if (normalizedSide === 'sell') {
      if (entryPrice < lastPrice) return 'trigger';
      if (entryPrice > lastPrice) return 'take-profit';
      return null;
    }

    return null;
  }

  private normalizeOrderPrecision(params: {
    exchangeType: string;
    tradeType: string;
    symbol: string;
    quantity: number;
    price?: number | null;
  }): { quantity: number; price?: number | null } {
    return {
      quantity: this.truncateOrderQuantity(params.quantity, params.exchangeType, params.tradeType, params.symbol),
      price: params.price == null
        ? params.price
        : this.truncateOrderPrice(params.price, params.exchangeType, params.tradeType, params.symbol),
    };
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

  private isStrategyAlgoOrder(order: { orderType?: string | null; }): boolean {
    if (order.orderType === 'algo' || 'stop_market') return true;
    return false
  }

  private async getTokenForExchange(exchangeId: number): Promise<{ token: string; exchangeType: string }> {
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

    return { token: initResp.token, exchangeType: exchange.exchangeType };
  }

  @Get('/')
  async list(@Query() query: ListOrdersQueryDTO) {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const result = await this.orderService.list({
      userid: user.id,
      exchangeId: query.exchangeId,
      status: query.status,
      symbol: query.symbol,
      limit: query.limit,
      offset: query.offset,
    });
    if ((result?.total ?? 0) > 0 && !this.orderUpdateService.isSubscribed(query.exchangeId)) {
      try {
        const { token, exchangeType } = await this.getTokenForExchange(query.exchangeId);
        this.orderUpdateService.subscribeForToken(query.exchangeId, exchangeType, token);
      } catch (err) {
        this.logger.warn('[OrderUpdate] Failed to init token for exchangeId=%s: %s', query.exchangeId, err);
      }
    }
    return apiOk(result);
  }

  @Post('/')
  async create(@Body() body: PlaceOrderBodyDTO) {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const { token, exchangeType: tokenExchangeType } = await this.getTokenForExchange(body.exchangeId);
    await this.ensurePrecisionReady();
    const normalizedOrder = this.normalizeOrderPrecision({
      exchangeType: tokenExchangeType,
      tradeType: body.tradeType,
      symbol: body.symbol,
      quantity: body.quantity,
      price: body.price,
    });

    if (normalizedOrder.quantity <= 0) {
      throw new httpError.BadRequestError('下单数量按交易所精度处理后为 0，请调整数量');
    }
    if (normalizedOrder.price != null && normalizedOrder.price <= 0) {
      throw new httpError.BadRequestError('下单价格按交易所精度处理后为 0，请调整价格');
    }

    const resp = await this.exchangeGrpc.placeOrder({
      token,
      symbol: body.symbol,
      tradeType: body.tradeType,
      side: body.side,
      orderType: body.orderType,
      quantity: normalizedOrder.quantity,
      price: normalizedOrder.price,
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

    const exchangeOrderId = order.exchangeOrderId || order.exchange_order_id || order.id;
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
      quantity: String(normalizedOrder.quantity),
      price: normalizedOrder.price == null ? null : String(normalizedOrder.price),
      positionSide: body.positionSide ?? null,
      reduceOnly: body.reduceOnly ?? false,
    }]);
    this.orderUpdateService.subscribeForToken(body.exchangeId, tokenExchangeType, token);

    return apiOk(resp);
  }

  @Post('/batch-strategy')
  async placeBatchStrategy(@Body() body: PlaceBatchStrategyOrderBodyDTO) {
    // 1. Get exchange type to fetch tickers
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    const exchange = await this.exchangeService.get(user.id, body.exchangeId);
    const exchangeType = exchange.exchangeType.toLowerCase();

    // 2. Ensure precision cache is ready
    await this.ensurePrecisionReady();

    // 3. Fetch price map from exchange-sync (symbol -> lastPrice)
    const grpcTradeType = this.normalizeTradeTypeForGrpc(body.tradeType);
    const tickerMap = await exchangeSync.getTickerPriceMap(exchangeType, grpcTradeType);

    // 4. Compute orders with precision truncation
    const offset = Math.abs(body.priceOffsetPercent) / 100;
    const isFutures = body.tradeType === 'futures';
    const leverage = 1;
    type AttachedOrder = {
      type: 'take_profit' | 'stop_loss';
      triggerPrice: number;
      orderPrice?: number;
    };
    type StrategyOrderParams = {
      symbol: string;
      tradeType: string;
      side: string;
      positionSide?: string;
      strategyType: string;
      quantity: number;
      triggerPrice: number;
      triggerPriceType: string;
      orderPrice?: number;
      reduceOnly: boolean;
      attachedOrders?: AttachedOrder[];
    };
    const orders: StrategyOrderParams[] = [];

    const tp = (price: number, sym: string) =>
      this.truncateOrderPrice(price, exchangeType, body.tradeType, sym);
    const tq = (qty: number, sym: string) =>
      this.truncateOrderQuantity(qty, exchangeType, body.tradeType, sym);

    for (const symbol of body.symbols) {
      const lastPrice = tickerMap.get(symbol);
      if (!lastPrice) {
        this.logger.warn('[BatchStrategy] No price data for symbol %s, skipping', symbol);
        continue;
      };

      // determine order side and optional position side
      const side = body.side; // 'buy' or 'sell'
      let posSide: string | undefined = undefined;
      if (isFutures) {
        // futures/api may ignore positionSide but we keep for compatibility
        posSide = body.positionSide;
      }

      const entryPriceRaw = lastPrice * (1 + offset);
      const entryPrice = tp(entryPriceRaw, symbol);
      if (entryPrice <= 0) {
        this.logger.warn('[BatchStrategy] Computed entry price %.8f for symbol %s is invalid, skipping', entryPrice, symbol);
        continue;
      }


      const quantityRaw = body.amountUSDT / entryPrice;

      const quantity = tq(quantityRaw, symbol);
      if (quantity <= 0) {
        this.logger.warn('[BatchStrategy] Computed quantity %.8f for symbol %s is too small, skipping', quantity, symbol);
        continue;
      };
      const slPrice = tp(
        side === 'buy'
          ? entryPrice * (1 - Math.abs(body.stopLossPercent) / 100)
          : entryPrice * (1 + Math.abs(body.stopLossPercent) / 100),
        symbol
      );
      const tpPrice = tp(
        side === 'buy'
          ? entryPrice * (1 + Math.abs(body.takeProfitPercent) / 100)
          : entryPrice * (1 - Math.abs(body.takeProfitPercent) / 100),
        symbol
      );
      let strategyType = 'trigger';
      if (exchangeType === 'binance') {
        const resolved = this.resolveBinanceEntryStrategyType(side, entryPrice, lastPrice);
        if (!resolved) {
          this.logger.warn('[BatchStrategy] Entry price %.8f equals/invalid against last price %.8f for %s, skipping', entryPrice, lastPrice, symbol);
          continue;
        }
        strategyType = resolved;
      }

      orders.push({
        symbol,
        tradeType: grpcTradeType,
        side,
        positionSide: posSide,
        strategyType,
        quantity,
        triggerPrice: entryPrice,
        triggerPriceType: 'last',
        orderPrice: entryPrice,
        reduceOnly: false, // opening order by default
        attachedOrders: [
          {
            type: 'take_profit',
            triggerPrice: tpPrice,
            orderPrice: -1,
          },
          {
            type: 'stop_loss',
            triggerPrice: slPrice,
            orderPrice: -1,
          },
        ],
      });
    }

    if (orders.length === 0) {
      throw new httpError.BadRequestError('没有找到所选交易对的价格数据');
    }

    // 5. Place via gRPC
    const orderedSymbols = orders.map((o) => o.symbol);
    const { token, exchangeType: tokenExchangeType } = await this.getTokenForExchange(body.exchangeId);
    const resp = await this.exchangeGrpc.placeStrategyOrders({ token, orders });
    const rawResults: any[] = Array.isArray(resp?.results) ? resp.results : [];
    const results = rawResults.map((r, idx) => ({
      ...r,
      symbol: orderedSymbols[idx] ?? r?.order?.symbol,
    }));
    if (results.length === 0) {
      throw new httpError.BadGatewayError('批量下单返回为空');
    }
    const successCount = resp?.successCount ?? resp?.success_count ?? 0;
    if (successCount <= 0) {
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
          exchangeOrderId: r.order.algoId || r.order.algo_id,
          symbol: r.order.symbol,
          tradeType: body.tradeType,
          side: orders[i].side,
          orderType: body.orderType,
          status: OrderStatus.NEW,
          quantity: String(orders[i].quantity),
          price: String(orders[i].triggerPrice),
          positionSide: orders[i].positionSide ?? null,
          leverage: isFutures ? leverage : null,
          reduceOnly: orders[i].reduceOnly,
        });
      }
      if (orderRecords.length > 0) {
        await this.orderService.createBatch(orderRecords);
        this.orderUpdateService.subscribeForToken(body.exchangeId, tokenExchangeType, token);
      }
    } catch (err) {
      this.logger.error('[BatchStrategy] Failed to persist orders to DB: %s', err);
    }

    return apiOk({ ...resp, results, symbols: orderedSymbols });
  }

  @Post('/batch-strategy/check-duplicates')
  async checkDuplicates(@Body() body: CheckDuplicatesBodyDTO) {
    const { token } = await this.getTokenForExchange(body.exchangeId);
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

    const { token } = await this.getTokenForExchange(order.exchangeId);
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

    const { token } = await this.getTokenForExchange(order.exchangeId);
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
    if (resp.error) {
      if (resp.error.code == 'ORDER_NOT_FOUND' || resp.error.message?.includes('-2011')) {
        await this.orderService.updateByExchangeOrderId(order.exchangeOrderId, order.exchangeId, { status: OrderStatus.CANCELED });
        return apiOk(resp, '取消订单不存在或者已取消');
      }
      this.requireGrpcSuccess(resp, '取消订单失败');
    }
    await this.orderService.updateByExchangeOrderId(order.exchangeOrderId, order.exchangeId, { status: OrderStatus.CANCELED });
    return apiOk(resp);
  }
}
