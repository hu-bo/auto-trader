import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Config, Provide, httpError } from '@midwayjs/core';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { ExchangeAdapterConfig } from '../types/index.js';

type GrpcTradeType = 'TRADE_TYPE_SPOT' | 'TRADE_TYPE_FUTURES' | 'TRADE_TYPE_DELIVERY';
type GrpcExchange = 'EXCHANGE_OKX' | 'EXCHANGE_BINANCE';
type GrpcOrderSide = 'ORDER_SIDE_BUY' | 'ORDER_SIDE_SELL';
type GrpcOrderType = 'ORDER_TYPE_LIMIT' | 'ORDER_TYPE_MARKET' | 'ORDER_TYPE_MAKER_ONLY';
type GrpcPositionSide = 'POSITION_SIDE_LONG' | 'POSITION_SIDE_SHORT';
type GrpcOrderStatus =
  | 'ORDER_STATUS_PENDING'
  | 'ORDER_STATUS_OPEN'
  | 'ORDER_STATUS_PARTIAL'
  | 'ORDER_STATUS_FILLED'
  | 'ORDER_STATUS_CANCELED'
  | 'ORDER_STATUS_REJECTED'
  | 'ORDER_STATUS_EXPIRED';
type GrpcStrategyOrderType = 'STRATEGY_ORDER_TYPE_STOP_LOSS' | 'STRATEGY_ORDER_TYPE_TAKE_PROFIT' | 'STRATEGY_ORDER_TYPE_TRIGGER' | 'STRATEGY_ORDER_TYPE_TRAILING_STOP';
type GrpcStrategyTriggerPriceType = 'STRATEGY_TRIGGER_PRICE_TYPE_LAST' | 'STRATEGY_TRIGGER_PRICE_TYPE_MARK' | 'STRATEGY_TRIGGER_PRICE_TYPE_INDEX';

function mapTradeType(input: string): GrpcTradeType {
  const v = input.trim().toUpperCase();
  if (v === 'SPOT' || v === 'TRADE_TYPE_SPOT') return 'TRADE_TYPE_SPOT';
  if (v === 'FUTURES' || v === 'TRADE_TYPE_FUTURES') return 'TRADE_TYPE_FUTURES';
  if (v === 'DELIVERY' || v === 'TRADE_TYPE_DELIVERY') return 'TRADE_TYPE_DELIVERY';
  throw new httpError.BadRequestError(`Invalid trade_type: ${input}`);
}

function mapExchange(input: string): GrpcExchange {
  const v = input.trim().toUpperCase();
  if (v === 'OKX' || v === 'EXCHANGE_OKX') return 'EXCHANGE_OKX';
  if (v === 'BINANCE' || v === 'EXCHANGE_BINANCE') return 'EXCHANGE_BINANCE';
  throw new httpError.BadRequestError(`Invalid exchange_type: ${input}`);
}

function mapOrderSide(input: string): GrpcOrderSide {
  const v = input.trim().toUpperCase();
  if (v === 'BUY' || v === 'ORDER_SIDE_BUY') return 'ORDER_SIDE_BUY';
  if (v === 'SELL' || v === 'ORDER_SIDE_SELL') return 'ORDER_SIDE_SELL';
  throw new httpError.BadRequestError(`Invalid side: ${input}`);
}

function mapOrderType(input: string): GrpcOrderType {
  const v = input.trim().toUpperCase();
  if (v === 'LIMIT' || v === 'ORDER_TYPE_LIMIT') return 'ORDER_TYPE_LIMIT';
  if (v === 'MARKET' || v === 'ORDER_TYPE_MARKET') return 'ORDER_TYPE_MARKET';
  if (v === 'MAKER_ONLY' || v === 'ORDER_TYPE_MAKER_ONLY') return 'ORDER_TYPE_MAKER_ONLY';
  throw new httpError.BadRequestError(`Invalid order_type: ${input}`);
}

function mapPositionSide(input: string): GrpcPositionSide {
  const v = input.trim().toUpperCase();
  if (v === 'LONG' || v === 'POSITION_SIDE_LONG') return 'POSITION_SIDE_LONG';
  if (v === 'SHORT' || v === 'POSITION_SIDE_SHORT') return 'POSITION_SIDE_SHORT';
  throw new httpError.BadRequestError(`Invalid position_side: ${input}`);
}

function mapOrderStatus(input: string): GrpcOrderStatus {
  const v = input.trim().toUpperCase();
  if (v === 'PENDING' || v === 'ORDER_STATUS_PENDING') return 'ORDER_STATUS_PENDING';
  if (v === 'OPEN' || v === 'ORDER_STATUS_OPEN') return 'ORDER_STATUS_OPEN';
  if (v === 'PARTIAL' || v === 'ORDER_STATUS_PARTIAL') return 'ORDER_STATUS_PARTIAL';
  if (v === 'FILLED' || v === 'ORDER_STATUS_FILLED') return 'ORDER_STATUS_FILLED';
  if (v === 'CANCELED' || v === 'ORDER_STATUS_CANCELED') return 'ORDER_STATUS_CANCELED';
  if (v === 'REJECTED' || v === 'ORDER_STATUS_REJECTED') return 'ORDER_STATUS_REJECTED';
  if (v === 'EXPIRED' || v === 'ORDER_STATUS_EXPIRED') return 'ORDER_STATUS_EXPIRED';
  throw new httpError.BadRequestError(`Invalid status: ${input}`);
}

function mapStrategyOrderType(input: string): GrpcStrategyOrderType {
  const v = input.trim().toLowerCase();
  if (v === 'stop-loss' || v === 'stop_loss') return 'STRATEGY_ORDER_TYPE_STOP_LOSS';
  if (v === 'take-profit' || v === 'take_profit') return 'STRATEGY_ORDER_TYPE_TAKE_PROFIT';
  if (v === 'trigger') return 'STRATEGY_ORDER_TYPE_TRIGGER';
  if (v === 'trailing-stop' || v === 'trailing_stop') return 'STRATEGY_ORDER_TYPE_TRAILING_STOP';
  throw new httpError.BadRequestError(`Invalid strategy_type: ${input}`);
}

function mapStrategyTriggerPriceType(input: string): GrpcStrategyTriggerPriceType {
  const v = input.trim().toLowerCase();
  if (v === 'last') return 'STRATEGY_TRIGGER_PRICE_TYPE_LAST';
  if (v === 'mark') return 'STRATEGY_TRIGGER_PRICE_TYPE_MARK';
  if (v === 'index') return 'STRATEGY_TRIGGER_PRICE_TYPE_INDEX';
  throw new httpError.BadRequestError(`Invalid trigger_price_type: ${input}`);
}

function mapGrpcError(err: grpc.ServiceError): Error {
  const message = err.details || err.message || 'gRPC request failed';
  switch (err.code) {
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

type ExchangeServiceClient = {
  initAccount: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  validateToken: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  invalidateToken: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  getOrders: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  getOrder: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  cancelOrder: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  placeOrder: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  getPositions: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  syncPositions: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  getBalance: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  setLeverage: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  placeStrategyOrder: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  placeStrategyOrders: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  cancelStrategyOrder: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  getStrategyOrder: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
  getOpenStrategyOrders: (req: any, cb: (err: grpc.ServiceError | null, res: any) => void) => void;
};

@Provide()
export class ExchangeGrpcClient {
  @Config('exchangeAdapter')
  exchangeAdapter!: ExchangeAdapterConfig;

  private client?: ExchangeServiceClient;

  private getClient(): ExchangeServiceClient {
    if (this.client) return this.client;

    const url = (this.exchangeAdapter?.grpc ?? '').trim();
    if (!url) {
      throw new httpError.ServiceUnavailableError('EXCHANGE_GRPC_URL is required');
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const protoPath = join(__dirname, '../../../../packages/contracts/proto/exchange.proto');

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const loaded = grpc.loadPackageDefinition(packageDefinition) as any;
    const ServiceCtor = loaded?.exchange?.ExchangeService;
    if (!ServiceCtor) {
      throw new httpError.ServiceUnavailableError('Failed to load exchange proto');
    }

    this.client = new ServiceCtor(url, grpc.credentials.createInsecure()) as ExchangeServiceClient;
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

  private async unary<T>(fn: (cb: (err: grpc.ServiceError | null, res: T) => void) => void): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      fn((err, res) => {
        if (err) return reject(mapGrpcError(err));
        resolve(res);
      });
    });
  }

  async initAccount(params: {
    exchangeType: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string | null;
    demonet?: boolean;
    name?: string | null;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      exchange: mapExchange(params.exchangeType),
      api_key: params.apiKey,
      api_secret: params.apiSecret,
      demonet: params.demonet ?? false,
    };
    if (params.passphrase != null) req.passphrase = params.passphrase;
    if (params.name != null) req.name = params.name;
    return await this.unary(cb => client.initAccount(req, cb));
  }

  async validateToken(params: { token: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token };
    return await this.unary(cb => client.validateToken(req, cb));
  }

  async invalidateToken(params: { token: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token };
    return await this.unary(cb => client.invalidateToken(req, cb));
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
    return await this.unary(cb => client.getOrders(req, cb));
  }

  async getOrder(params: { token?: string; orderId: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token ?? this.getToken(), order_id: params.orderId };
    return await this.unary(cb => client.getOrder(req, cb));
  }

  async cancelOrder(params: { token?: string; orderId: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token ?? this.getToken(), order_id: params.orderId };
    return await this.unary(cb => client.cancelOrder(req, cb));
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
      trade_type: mapTradeType(params.tradeType),
      side: mapOrderSide(params.side),
      order_type: mapOrderType(params.orderType),
      quantity: params.quantity,
    };
    if (params.price != null) req.price = params.price;
    if (params.positionSide != null) req.position_side = mapPositionSide(params.positionSide);
    if (params.leverage != null) req.leverage = params.leverage;
    if (params.clientOrderId != null) req.client_order_id = params.clientOrderId;
    if (params.reduceOnly != null) req.reduce_only = params.reduceOnly;
    return await this.unary(cb => client.placeOrder(req, cb));
  }

  async getPositions(params: { token?: string; symbol?: string }): Promise<any> {
    const client = this.getClient();
    const req: any = { token: params.token ?? this.getToken() };
    if (params.symbol) req.symbol = params.symbol;
    return await this.unary(cb => client.getPositions(req, cb));
  }

  async syncPositions(params?: { token?: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params?.token ?? this.getToken() };
    return await this.unary(cb => client.syncPositions(req, cb));
  }

  async getBalance(params: { token?: string; tradeType: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: params.token ?? this.getToken(), trade_type: mapTradeType(params.tradeType) };
    return await this.unary(cb => client.getBalance(req, cb));
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
      trade_type: mapTradeType(params.tradeType),
    };
    if (params.positionSide != null) req.position_side = mapPositionSide(params.positionSide);
    return await this.unary(cb => client.setLeverage(req, cb));
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
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      token: params.token ?? this.getToken(),
      symbol: params.symbol,
      trade_type: mapTradeType(params.tradeType),
      side: mapOrderSide(params.side),
      strategy_type: mapStrategyOrderType(params.strategyType),
      quantity: params.quantity,
      trigger_price: params.triggerPrice,
    };
    if (params.positionSide != null) req.position_side = mapPositionSide(params.positionSide);
    if (params.triggerPriceType != null) req.trigger_price_type = mapStrategyTriggerPriceType(params.triggerPriceType);
    if (params.orderPrice != null) req.order_price = params.orderPrice;
    if (params.reduceOnly != null) req.reduce_only = params.reduceOnly;
    if (params.clientAlgoId != null) req.client_algo_id = params.clientAlgoId;
    if (params.callbackRatio != null) req.callback_ratio = params.callbackRatio;
    if (params.activationPrice != null) req.activation_price = params.activationPrice;
    if (params.slTriggerPrice != null) req.sl_trigger_price = params.slTriggerPrice;
    if (params.tpTriggerPrice != null) req.tp_trigger_price = params.tpTriggerPrice;
    return await this.unary(cb => client.placeStrategyOrder(req, cb));
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
      slTriggerPrice?: number | null;
      tpTriggerPrice?: number | null;
    }>;
  }): Promise<any> {
    const client = this.getClient();
    const token = params.token ?? this.getToken();
    const orders = params.orders.map(o => {
      const req: any = {
        token,
        symbol: o.symbol,
        trade_type: mapTradeType(o.tradeType),
        side: mapOrderSide(o.side),
        strategy_type: mapStrategyOrderType(o.strategyType),
        quantity: o.quantity,
        trigger_price: o.triggerPrice,
      };
      if (o.positionSide != null) req.position_side = mapPositionSide(o.positionSide);
      if (o.triggerPriceType != null) req.trigger_price_type = mapStrategyTriggerPriceType(o.triggerPriceType);
      if (o.orderPrice != null) req.order_price = o.orderPrice;
      if (o.reduceOnly != null) req.reduce_only = o.reduceOnly;
      if (o.clientAlgoId != null) req.client_algo_id = o.clientAlgoId;
      if (o.slTriggerPrice != null) req.sl_trigger_price = o.slTriggerPrice;
      if (o.tpTriggerPrice != null) req.tp_trigger_price = o.tpTriggerPrice;
      return req;
    });
    return await this.unary(cb => client.placeStrategyOrders({ token, orders }, cb));
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
      algo_id: params.algoId,
      trade_type: mapTradeType(params.tradeType),
    };
    return await this.unary(cb => client.cancelStrategyOrder(req, cb));
  }

  async getStrategyOrder(params: {
    token?: string;
    algoId: string;
    tradeType: string;
  }): Promise<any> {
    const client = this.getClient();
    const req = {
      token: params.token ?? this.getToken(),
      algo_id: params.algoId,
      trade_type: mapTradeType(params.tradeType),
    };
    return await this.unary(cb => client.getStrategyOrder(req, cb));
  }

  async getOpenStrategyOrders(params: {
    token?: string;
    symbol?: string;
    tradeType?: string;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = { token: params.token ?? this.getToken() };
    if (params.symbol) req.symbol = params.symbol;
    if (params.tradeType) req.trade_type = mapTradeType(params.tradeType);
    return await this.unary(cb => client.getOpenStrategyOrders(req, cb));
  }
}
