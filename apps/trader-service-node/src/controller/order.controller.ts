import { Body, Controller, Get, Inject, Param, Post, Query } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeTokenService } from '../service/exchange-token.service.js';
import { apiOk } from '../util/api-response.js';
import { ListOrdersQueryDTO, OrderIdParamDTO, OrderTokenQueryDTO, PlaceOrderBodyDTO } from '../dto/order.dto.js';

@Controller('/api/v1/orders')
export class OrderController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  exchangeToken!: ExchangeTokenService;

  @Get('/')
  async list(@Query() query: ListOrdersQueryDTO) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: query.exchangeId,
      token: query.token,
    });

    const resp = await this.exchangeGrpc.getOrders({
      token: grpcToken,
      symbol: query.symbol,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    return apiOk(resp);
  }

  @Post('/')
  async create(@Body() body: PlaceOrderBodyDTO) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: body.exchangeId,
      token: body.token,
    });

    const resp = await this.exchangeGrpc.placeOrder({
      token: grpcToken,
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

  @Get('/:orderId')
  async get(
    @Param() params: OrderIdParamDTO,
    @Query() query: OrderTokenQueryDTO
  ) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: query.exchangeId,
      token: query.token,
    });
    const resp = await this.exchangeGrpc.getOrder({ token: grpcToken, orderId: params.orderId });
    return apiOk(resp);
  }

  @Post('/:orderId/cancel')
  async cancel(
    @Param() params: OrderIdParamDTO,
    @Query() query: OrderTokenQueryDTO
  ) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: query.exchangeId,
      token: query.token,
    });
    const resp = await this.exchangeGrpc.cancelOrder({ token: grpcToken, orderId: params.orderId });
    return apiOk(resp);
  }
}
