import { Body, Controller, Get, Inject, Param, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from '../service/exchange.service.js';
import { OrderService } from '../service/order.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { CancelOrderBodyDTO, ListOrdersQueryDTO, OrderIdParamDTO, OrderTokenQueryDTO, PlaceOrderBodyDTO } from '../dto/order.dto.js';

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
