import * as grpc from '@grpc/grpc-js';
import { createChannel, createClient } from 'nice-grpc';
import { Config, Provide, Scope, ScopeEnum, httpError } from '@midwayjs/core';
import type { ExchangeAdapterConfig, GrpcTlsConfig } from '../types/index.js';
import { resolveGrpcChannelSecurity } from './grpc-tls.js';
import {
  ExchangeServiceDefinition,
  type ExchangeServiceClient as GrpcExchangeServiceClient,
  Exchange,
  TradeType,
  OrderSide,
  OrderType,
  PositionSide,
  OrderStatus,
  StrategyOrderType,
  StrategyTriggerPriceType,
  StrategyAttachedOrderType,
} from '@hquant/contracts/exchange';

type StrategyAttachedOrder = {
  type: 'take_profit' | 'stop_loss';
  triggerPrice: number;
  orderPrice?: number | null;
  triggerPriceType?: string | null;
};

function mapTradeTypeValue(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const v = input.trim();
    if (!v) return null;
    const upper = v.toUpperCase();
    if (upper === 'SPOT' || upper === 'TRADE_TYPE_SPOT') return 'spot';
    if (upper === 'FUTURES' || upper === 'TRADE_TYPE_FUTURES' || upper === 'USDM-ALGO' || upper === 'USDM_ALGO') {
      return 'futures';
    }
    if (upper === 'DELIVERY' || upper === 'TRADE_TYPE_DELIVERY') return 'delivery';
    return null;
  }
  if (typeof input === 'number') {
    switch (input) {
      case TradeType.TRADE_TYPE_SPOT:
        return 'spot';
      case TradeType.TRADE_TYPE_FUTURES:
        return 'futures';
      case TradeType.TRADE_TYPE_DELIVERY:
        return 'delivery';
      default:
        return null;
    }
  }
  return null;
}

function normalizePositionTradeType(position: any): any {
  if (!position || typeof position !== 'object') return position;
  const tradeType = mapTradeTypeValue(position.tradeType ?? position.trade_type);
  if (!tradeType) return position;
  const { trade_type: _trade_type, ...rest } = position;
  return { ...rest, tradeType: tradeType };
}

function mapTradeType(input: string): TradeType {
  const v = input.trim().toUpperCase();
  if (v === 'SPOT' || v === 'TRADE_TYPE_SPOT') return TradeType.TRADE_TYPE_SPOT;
  if (v === 'USDM-ALGO' || v === 'USDM_ALGO') return TradeType.TRADE_TYPE_FUTURES;
  if (v === 'FUTURES' || v === 'TRADE_TYPE_FUTURES') return TradeType.TRADE_TYPE_FUTURES;
  if (v === 'DELIVERY' || v === 'TRADE_TYPE_DELIVERY') return TradeType.TRADE_TYPE_DELIVERY;
  throw new httpError.BadRequestError(`Invalid trade_type: ${input}`);
}

function mapExchange(input: string): Exchange {
  const v = input.trim().toUpperCase();
  if (v === 'OKX' || v === 'EXCHANGE_OKX') return Exchange.EXCHANGE_OKX;
  if (v === 'BINANCE' || v === 'EXCHANGE_BINANCE') return Exchange.EXCHANGE_BINANCE;
  throw new httpError.BadRequestError(`Invalid exchange_type: ${input}`);
}

function mapOrderSide(input: string): OrderSide {
  const v = input.trim().toUpperCase();
  if (v === 'BUY' || v === 'ORDER_SIDE_BUY') return OrderSide.ORDER_SIDE_BUY;
  if (v === 'SELL' || v === 'ORDER_SIDE_SELL') return OrderSide.ORDER_SIDE_SELL;
  throw new httpError.BadRequestError(`Invalid side: ${input}`);
}

function mapOrderType(input: string): OrderType {
  const v = input.trim().toUpperCase();
  if (v === 'LIMIT' || v === 'ORDER_TYPE_LIMIT') return OrderType.ORDER_TYPE_LIMIT;
  if (v === 'MARKET' || v === 'ORDER_TYPE_MARKET') return OrderType.ORDER_TYPE_MARKET;
  if (v === 'MAKER_ONLY' || v === 'ORDER_TYPE_MAKER_ONLY') return OrderType.ORDER_TYPE_MAKER_ONLY;
  throw new httpError.BadRequestError(`Invalid order_type: ${input}`);
}

function mapPositionSide(input: string): PositionSide {
  const v = input.trim().toUpperCase();
  if (v === 'LONG' || v === 'POSITION_SIDE_LONG') return PositionSide.POSITION_SIDE_LONG;
  if (v === 'SHORT' || v === 'POSITION_SIDE_SHORT') return PositionSide.POSITION_SIDE_SHORT;
  throw new httpError.BadRequestError(`Invalid position_side: ${input}`);
}

function mapOrderStatus(input: string): OrderStatus {
  const v = input.trim().toUpperCase();
  if (v === 'PENDING' || v === 'ORDER_STATUS_PENDING') return OrderStatus.ORDER_STATUS_PENDING;
  if (v === 'OPEN' || v === 'ORDER_STATUS_OPEN') return OrderStatus.ORDER_STATUS_OPEN;
  if (v === 'PARTIAL' || v === 'ORDER_STATUS_PARTIAL') return OrderStatus.ORDER_STATUS_PARTIAL;
  if (v === 'FILLED' || v === 'ORDER_STATUS_FILLED') return OrderStatus.ORDER_STATUS_FILLED;
  if (v === 'CANCELED' || v === 'ORDER_STATUS_CANCELED') return OrderStatus.ORDER_STATUS_CANCELED;
  if (v === 'REJECTED' || v === 'ORDER_STATUS_REJECTED') return OrderStatus.ORDER_STATUS_REJECTED;
  if (v === 'EXPIRED' || v === 'ORDER_STATUS_EXPIRED') return OrderStatus.ORDER_STATUS_EXPIRED;
  throw new httpError.BadRequestError(`Invalid status: ${input}`);
}

function mapStrategyOrderType(input: string): StrategyOrderType {
  const v = input.trim().toLowerCase();
  if (v === 'stop-loss' || v === 'stop_loss') return StrategyOrderType.STRATEGY_ORDER_TYPE_STOP_LOSS;
  if (v === 'take-profit' || v === 'take_profit') return StrategyOrderType.STRATEGY_ORDER_TYPE_TAKE_PROFIT;
  if (v === 'trigger') return StrategyOrderType.STRATEGY_ORDER_TYPE_TRIGGER;
  if (v === 'trailing-stop' || v === 'trailing_stop') return StrategyOrderType.STRATEGY_ORDER_TYPE_TRAILING_STOP;
  throw new httpError.BadRequestError(`Invalid strategy_type: ${input}`);
}

function mapStrategyTriggerPriceType(input: string): StrategyTriggerPriceType {
  const v = input.trim().toLowerCase();
  if (v === 'last') return StrategyTriggerPriceType.STRATEGY_TRIGGER_PRICE_TYPE_LAST;
  if (v === 'mark') return StrategyTriggerPriceType.STRATEGY_TRIGGER_PRICE_TYPE_MARK;
  if (v === 'index') return StrategyTriggerPriceType.STRATEGY_TRIGGER_PRICE_TYPE_INDEX;
  throw new httpError.BadRequestError(`Invalid trigger_price_type: ${input}`);
}

function mapStrategyAttachedOrderType(input: string): StrategyAttachedOrderType {
  const v = input.trim().toLowerCase();
  if (v === 'take-profit' || v === 'take_profit') return StrategyAttachedOrderType.STRATEGY_ATTACHED_ORDER_TYPE_TAKE_PROFIT;
  if (v === 'stop-loss' || v === 'stop_loss') return StrategyAttachedOrderType.STRATEGY_ATTACHED_ORDER_TYPE_STOP_LOSS;
  throw new httpError.BadRequestError(`Invalid attached_order_type: ${input}`);
}

function deriveAttachedTriggerPrices(params: {
  slTriggerPrice?: number | null;
  tpTriggerPrice?: number | null;
  attachedOrders?: StrategyAttachedOrder[] | null;
}) {
  let sl = params.slTriggerPrice ?? undefined;
  let tp = params.tpTriggerPrice ?? undefined;
  if (params.attachedOrders && params.attachedOrders.length > 0) {
    for (const attached of params.attachedOrders) {
      if (attached.type === 'stop_loss' && sl == null) {
        sl = attached.triggerPrice;
      }
      if (attached.type === 'take_profit' && tp == null) {
        tp = attached.triggerPrice;
      }
    }
  }
  return { slTriggerPrice: sl, tpTriggerPrice: tp };
}

function mapAttachedOrders(attachedOrders?: StrategyAttachedOrder[] | null) {
  if (!attachedOrders || attachedOrders.length === 0) return undefined;
  return attachedOrders.map(ao => {
    const req: any = {
      type: mapStrategyAttachedOrderType(ao.type),
      triggerPrice: ao.triggerPrice,
    };
    if (ao.orderPrice != null) req.orderPrice = ao.orderPrice;
    if (ao.triggerPriceType != null) req.triggerPriceType = mapStrategyTriggerPriceType(ao.triggerPriceType);
    return req;
  });
}

function mapGrpcError(err: unknown): Error {
  const e = err as { code?: number; details?: string; message?: string };
  const message = e.details || e.message || 'gRPC request failed';
  switch (e.code) {
    case grpc.status.INVALID_ARGUMENT:
      return new httpError.BadRequestError(message);
    case grpc.status.UNAUTHENTICATED:
      return new httpError.UnauthorizedError(message);
    case grpc.status.PERMISSION_DENIED:
      return new httpError.ForbiddenError(message);
    case grpc.status.NOT_FOUND:
      return new httpError.NotFoundError(message);
    case grpc.status.UNAVAILABLE:
      return new httpError.BadGatewayError(message);
    default:
      return new httpError.BadGatewayError(message);
  }
}

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class ExchangeGrpcClient {
  @Config('exchangeAdapter')
  exchangeAdapter!: ExchangeAdapterConfig;

  @Config('grpcTls')
  grpcTls!: GrpcTlsConfig;

  private client?: GrpcExchangeServiceClient;

  private getClient(): GrpcExchangeServiceClient {
    if (this.client) return this.client;

    const url = (this.exchangeAdapter?.grpc ?? '').trim();
    if (!url) {
      throw new httpError.ServiceUnavailableError('EXCHANGE_GRPC_URL is required');
    }

    const { credentials, options } = resolveGrpcChannelSecurity(this.grpcTls);
    const channel = createChannel(url, credentials, options);
    this.client = createClient(ExchangeServiceDefinition, channel);
    return this.client;
  }

  /**
   * Get the API key (token) from config
   */
  private getToken(): string {
    const token = (this.exchangeAdapter?.apiKey ?? '').trim();
    if (!token) {
      throw new httpError.ServiceUnavailableError('exchangeAdapter.apiKey is required in config');
    }
    return token;
  }

  private async unary<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw mapGrpcError(err);
    }
  }

  startSubscribeOrders(params: {
    token?: string;
    tradeType: string;
    onUpdate?: (update: any) => void;
  }): { stop: () => void } {
    const client = this.getClient();
    const token = params.token ?? this.getToken();
    const req = {
      token,
      tradeType: mapTradeType(params.tradeType),
    };
    const controller = new AbortController();
    const stream = client.subscribeOrders(req, { signal: controller.signal });

    (async () => {
      try {
        for await (const upd of stream) {
          if (params.onUpdate) params.onUpdate(upd);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        // Best-effort: keep silent to avoid noisy logs on transient stream errors.
      }
    })();

    return { stop: () => controller.abort() };
  }

  async initAccount(params: {
    exchangeType: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string | null;
    demonet?: boolean;
    name?: string | null;
    accountId?: string | null;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      exchange: mapExchange(params.exchangeType),
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      demonet: params.demonet ?? false,
    };
    if (params.passphrase != null) req.passphrase = params.passphrase;
    if (params.name != null) req.name = params.name;
    if (params.accountId != null) req.accountId = params.accountId;
    return await this.unary(() => client.initAccount(req));
  }

  async validateToken(params: { token: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token };
    return await this.unary(() => client.validateToken(req));
  }

  async invalidateToken(params: { token: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token };
    return await this.unary(() => client.invalidateToken(req));
  }

  async getOrders(params: {
    token?: string;
    symbol?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      token: params.token ?? this.getToken(),
    };
    if (params.symbol) req.symbol = params.symbol;
    if (params.status) req.status = mapOrderStatus(params.status);
    if (params.limit !== undefined) req.limit = params.limit;
    if (params.offset !== undefined) req.offset = params.offset;
    return await this.unary(() => client.getOrders(req));
  }

  async getOrder(params: { token?: string; orderId: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token ?? this.getToken(), orderId: params.orderId };
    return await this.unary(() => client.getOrder(req));
  }

  async cancelOrder(params: { token?: string; orderId: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token ?? this.getToken(), orderId: params.orderId };
    return await this.unary(() => client.cancelOrder(req));
  }

  async placeOrder(params: {
    token?: string;
    symbol: string;
    tradeType: string;
    side: string;
    orderType: string;
    quantity: number;
    price?: number | null;
    positionSide?: string | null;
    leverage?: number | null;
    clientOrderId?: string | null;
    reduceOnly?: boolean | null;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      token: params.token ?? this.getToken(),
      symbol: params.symbol,
      tradeType: mapTradeType(params.tradeType),
      side: mapOrderSide(params.side),
      orderType: mapOrderType(params.orderType),
      quantity: params.quantity,
    };
    if (params.price != null) req.price = params.price;
    if (params.positionSide != null) req.positionSide = mapPositionSide(params.positionSide);
    if (params.leverage != null) req.leverage = params.leverage;
    if (params.clientOrderId != null) req.clientOrderId = params.clientOrderId;
    if (params.reduceOnly != null) req.reduceOnly = params.reduceOnly;
    return await this.unary(() => client.placeOrder(req));
  }

  async placeOrders(params: {
    token?: string;
    orders: Array<{
      symbol: string;
      tradeType: string;
      side: string;
      orderType: string;
      quantity: number;
      price?: number | null;
      positionSide?: string | null;
      leverage?: number | null;
      clientOrderId?: string | null;
      reduceOnly?: boolean | null;
    }>;
  }): Promise<any> {
    const client = this.getClient();
    const token = params.token ?? this.getToken();
    const orders = params.orders.map(o => {
      const req: any = {
        symbol: o.symbol,
        tradeType: mapTradeType(o.tradeType),
        side: mapOrderSide(o.side),
        orderType: mapOrderType(o.orderType),
        quantity: o.quantity,
      };
      if (o.price != null) req.price = o.price;
      if (o.positionSide != null) req.positionSide = mapPositionSide(o.positionSide);
      if (o.leverage != null) req.leverage = o.leverage;
      if (o.clientOrderId != null) req.clientOrderId = o.clientOrderId;
      if (o.reduceOnly != null) req.reduceOnly = o.reduceOnly;
      return req;
    });
    return await this.unary(() => client.placeOrders({ token, orders }));
  }

  async getPositions(params: { token?: string; symbol?: string }): Promise<any> {
    const client = this.getClient();
    const req: any = { token: params.token ?? this.getToken() };
    if (params.symbol) req.symbol = params.symbol;
    const resp = await this.unary(() => client.getPositions(req));
    if (!Array.isArray(resp?.positions)) return resp;
    const positions = resp.positions.map(normalizePositionTradeType);
    return { ...resp, positions };
  }

  async syncPositions(params?: { token?: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params?.token ?? this.getToken() };
    const resp = await this.unary(() => client.syncPositions(req));
    if (!Array.isArray(resp?.positions)) return resp;
    const positions = resp.positions.map(normalizePositionTradeType);
    return { ...resp, positions };
  }

  async getBalance(params: { token?: string; tradeType: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token ?? this.getToken(), tradeType: mapTradeType(params.tradeType) };
    return await this.unary(() => client.getBalance(req));
  }

  async setLeverage(params: {
    token?: string;
    symbol: string;
    leverage: number;
    tradeType: string;
    positionSide?: string | null;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      token: params.token ?? this.getToken(),
      symbol: params.symbol,
      leverage: params.leverage,
      tradeType: mapTradeType(params.tradeType),
    };
    if (params.positionSide != null) req.positionSide = mapPositionSide(params.positionSide);
    return await this.unary(() => client.setLeverage(req));
  }

  async placeStrategyOrder(params: {
    token?: string;
    symbol: string;
    tradeType: string;
    side: string;
    strategyType: string;
    quantity: number;
    triggerPrice: number;
    positionSide?: string | null;
    triggerPriceType?: string | null;
    orderPrice?: number | null;
    reduceOnly?: boolean | null;
    clientAlgoId?: string | null;
    callbackRatio?: number | null;
    activationPrice?: number | null;
    slTriggerPrice?: number | null;
    tpTriggerPrice?: number | null;
    attachedOrders?: StrategyAttachedOrder[] | null;
  }): Promise<any> {
    const client = this.getClient();
    const derived = deriveAttachedTriggerPrices(params);
    const req: any = {
      token: params.token ?? this.getToken(),
      symbol: params.symbol,
      tradeType: mapTradeType(params.tradeType),
      side: mapOrderSide(params.side),
      strategyType: mapStrategyOrderType(params.strategyType),
      quantity: params.quantity,
      triggerPrice: params.triggerPrice,
    };
    if (params.positionSide != null) req.positionSide = mapPositionSide(params.positionSide);
    if (params.triggerPriceType != null) req.triggerPriceType = mapStrategyTriggerPriceType(params.triggerPriceType);
    if (params.orderPrice != null) req.orderPrice = params.orderPrice;
    if (params.reduceOnly != null) req.reduceOnly = params.reduceOnly;
    if (params.clientAlgoId != null) req.clientAlgoId = params.clientAlgoId;
    if (params.callbackRatio != null) req.callbackRatio = params.callbackRatio;
    if (params.activationPrice != null) req.activationPrice = params.activationPrice;
    if (derived.slTriggerPrice != null) req.slTriggerPrice = derived.slTriggerPrice;
    if (derived.tpTriggerPrice != null) req.tpTriggerPrice = derived.tpTriggerPrice;
    const attachedOrders = mapAttachedOrders(params.attachedOrders);
    if (attachedOrders != null) req.attachedOrders = attachedOrders;
    return await this.unary(() => client.placeStrategyOrder(req));
  }

  async placeStrategyOrders(params: {
    token?: string;
    orders: Array<{
      symbol: string;
      tradeType: string;
      side: string;
      strategyType: string;
      quantity: number;
      triggerPrice: number;
      positionSide?: string | null;
      triggerPriceType?: string | null;
      orderPrice?: number | null;
      reduceOnly?: boolean | null;
      clientAlgoId?: string | null;
      callbackRatio?: number | null;
      activationPrice?: number | null;
      slTriggerPrice?: number | null;
      tpTriggerPrice?: number | null;
      attachedOrders?: StrategyAttachedOrder[] | null;
    }>;
  }): Promise<any> {
    const client = this.getClient();
    const token = params.token ?? this.getToken();
    const orders = params.orders.map(o => {
      const derived = deriveAttachedTriggerPrices(o);
      const req: any = {
        token,
        symbol: o.symbol,
        tradeType: mapTradeType(o.tradeType),
        side: mapOrderSide(o.side),
        strategyType: mapStrategyOrderType(o.strategyType),
        quantity: o.quantity,
        triggerPrice: o.triggerPrice,
      };
      if (o.positionSide != null) req.positionSide = mapPositionSide(o.positionSide);
      if (o.triggerPriceType != null) req.triggerPriceType = mapStrategyTriggerPriceType(o.triggerPriceType);
      if (o.orderPrice != null) req.orderPrice = o.orderPrice;
      if (o.reduceOnly != null) req.reduceOnly = o.reduceOnly;
      if (o.clientAlgoId != null) req.clientAlgoId = o.clientAlgoId;
      if (o.callbackRatio != null) req.callbackRatio = o.callbackRatio;
      if (o.activationPrice != null) req.activationPrice = o.activationPrice;
      if (derived.slTriggerPrice != null) req.slTriggerPrice = derived.slTriggerPrice;
      if (derived.tpTriggerPrice != null) req.tpTriggerPrice = derived.tpTriggerPrice;
      const attachedOrders = mapAttachedOrders(o.attachedOrders);
      if (attachedOrders != null) req.attachedOrders = attachedOrders;
      return req;
    });
    return await this.unary(() => client.placeStrategyOrders({ token, orders }));
  }

  async cancelStrategyOrder(params: {
    token?: string;
    symbol: string;
    algoId: string;
    tradeType: string;
  }): Promise<any> {
    const client = this.getClient();
    const req = {
      token: params.token ?? this.getToken(),
      symbol: params.symbol,
      algoId: params.algoId,
      tradeType: mapTradeType(params.tradeType),
    };
    return await this.unary(() => client.cancelStrategyOrder(req));
  }

  async getStrategyOrder(params: {
    token?: string;
    algoId: string;
    tradeType: string;
  }): Promise<any> {
    const client = this.getClient();
    const req = {
      token: params.token ?? this.getToken(),
      algoId: params.algoId,
      tradeType: mapTradeType(params.tradeType),
    };
    return await this.unary(() => client.getStrategyOrder(req));
  }

  async getOpenStrategyOrders(params: {
    token?: string;
    symbol?: string;
    tradeType?: string;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = { token: params.token ?? this.getToken() };
    if (params.symbol) req.symbol = params.symbol;
    if (params.tradeType) req.tradeType = mapTradeType(params.tradeType);
    return await this.unary(() => client.getOpenStrategyOrders(req));
  }
}
