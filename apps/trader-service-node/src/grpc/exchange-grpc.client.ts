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
    symbol?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      token: this.getToken(),
    };
    if (params.symbol) req.symbol = params.symbol;
    if (params.status) req.status = mapOrderStatus(params.status);
    if (params.limit !== undefined) req.limit = params.limit;
    if (params.offset !== undefined) req.offset = params.offset;
    return await this.unary(cb => client.getOrders(req, cb));
  }

  async getOrder(params: { orderId: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: this.getToken(), order_id: params.orderId };
    return await this.unary(cb => client.getOrder(req, cb));
  }

  async cancelOrder(params: { orderId: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: this.getToken(), order_id: params.orderId };
    return await this.unary(cb => client.cancelOrder(req, cb));
  }

  async placeOrder(params: {
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
      token: this.getToken(),
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

  async getPositions(params: { symbol?: string }): Promise<any> {
    const client = this.getClient();
    const req: any = { token: this.getToken() };
    if (params.symbol) req.symbol = params.symbol;
    return await this.unary(cb => client.getPositions(req, cb));
  }

  async syncPositions(): Promise<any> {
    const client = this.getClient();
    const req = { token: this.getToken() };
    return await this.unary(cb => client.syncPositions(req, cb));
  }

  async getBalance(params: { tradeType: string }): Promise<any> {
    const client = this.getClient();
    const req = { token: this.getToken(), trade_type: mapTradeType(params.tradeType) };
    return await this.unary(cb => client.getBalance(req, cb));
  }

  async setLeverage(params: {
    symbol: string;
    leverage: number;
    tradeType: string;
    positionSide?: string | null;
  }): Promise<any> {
    const client = this.getClient();
    const req: any = {
      token: this.getToken(),
      symbol: params.symbol,
      leverage: params.leverage,
      trade_type: mapTradeType(params.tradeType),
    };
    if (params.positionSide != null) req.position_side = mapPositionSide(params.positionSide);
    return await this.unary(cb => client.setLeverage(req, cb));
  }
}
