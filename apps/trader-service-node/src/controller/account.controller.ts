import { Body, Controller, Get, Inject, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeTokenService } from '../service/exchange-token.service.js';
import { apiOk } from '../util/api-response.js';

type SetLeverageBody = {
  exchange_id: string;
  symbol: string;
  leverage: number;
  trade_type: string;
  position_side?: string | null;
  token?: string;
};

@Controller('/api/v1')
export class AccountController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  exchangeToken!: ExchangeTokenService;

  @Get('/balance')
  async balance(
    @Query('exchange_id') exchangeId: string | undefined,
    @Query('trade_type') tradeType: string,
    @Query('token') token?: string
  ) {
    if (!tradeType) throw new httpError.BadRequestError('trade_type is required');
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId,
      token,
    });
    const resp = await this.exchangeGrpc.getBalance({ token: grpcToken, tradeType });
    return apiOk(resp);
  }

  @Post('/leverage')
  async setLeverage(@Body() body: SetLeverageBody) {
    if (!body?.symbol) throw new httpError.BadRequestError('symbol is required');
    if (typeof body?.leverage !== 'number') throw new httpError.BadRequestError('leverage is required');
    if (!body?.trade_type) throw new httpError.BadRequestError('trade_type is required');

    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: body.exchange_id,
      token: body.token,
    });
    const resp = await this.exchangeGrpc.setLeverage({
      token: grpcToken,
      symbol: body.symbol,
      leverage: body.leverage,
      tradeType: body.trade_type,
      positionSide: body.position_side ?? null,
    });
    return apiOk(resp);
  }
}
