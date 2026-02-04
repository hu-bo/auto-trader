import { Body, Controller, Get, Inject, Param, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeTokenService } from '../service/exchange-token.service.js';
import { apiOk } from '../util/api-response.js';

type PlaceOrderBody = {
  exchange_id: string;
  symbol: string;
  trade_type: string;
  side: string;
  order_type: string;
  quantity: number;
  price?: number | null;
  position_side?: string | null;
  leverage?: number | null;
  client_order_id?: string | null;
  reduce_only?: boolean | null;
  token?: string;
};

const parseOptionalInt = (value?: string): number | undefined => {
  if (value == null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
};

@Controller('/api/v1/orders')
export class OrderController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  exchangeToken!: ExchangeTokenService;

  @Get('/')
  async list(
    @Query('exchange_id') exchangeId?: string,
    @Query('symbol') symbol?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('token') token?: string
  ) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId,
      token,
    });

    const resp = await this.exchangeGrpc.getOrders({
      token: grpcToken,
      symbol,
      status,
      limit: parseOptionalInt(limit),
      offset: parseOptionalInt(offset),
    });
    return apiOk(resp);
  }

  @Post('/')
  async create(@Body() body: PlaceOrderBody) {
    if (!body?.symbol) throw new httpError.BadRequestError('symbol is required');
    if (!body?.trade_type) throw new httpError.BadRequestError('trade_type is required');
    if (!body?.side) throw new httpError.BadRequestError('side is required');
    if (!body?.order_type) throw new httpError.BadRequestError('order_type is required');
    if (typeof body?.quantity !== 'number') throw new httpError.BadRequestError('quantity is required');

    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: body.exchange_id,
      token: body.token,
    });

    const resp = await this.exchangeGrpc.placeOrder({
      token: grpcToken,
      symbol: body.symbol,
      tradeType: body.trade_type,
      side: body.side,
      orderType: body.order_type,
      quantity: body.quantity,
      price: body.price,
      positionSide: body.position_side,
      leverage: body.leverage,
      clientOrderId: body.client_order_id,
      reduceOnly: body.reduce_only,
    });
    return apiOk(resp);
  }

  @Get('/:orderId')
  async get(
    @Param('orderId') orderId: string,
    @Query('exchange_id') exchangeId?: string,
    @Query('token') token?: string
  ) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId,
      token,
    });
    const resp = await this.exchangeGrpc.getOrder({ token: grpcToken, orderId });
    return apiOk(resp);
  }

  @Post('/:orderId/cancel')
  async cancel(
    @Param('orderId') orderId: string,
    @Query('exchange_id') exchangeId?: string,
    @Query('token') token?: string
  ) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId,
      token,
    });
    const resp = await this.exchangeGrpc.cancelOrder({ token: grpcToken, orderId });
    return apiOk(resp);
  }
}
