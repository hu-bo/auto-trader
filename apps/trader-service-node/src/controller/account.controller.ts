import { Body, Controller, Get, Inject, Post, Query } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeTokenService } from '../service/exchange-token.service.js';
import { apiOk } from '../util/api-response.js';
import { BalanceQueryDTO, SetLeverageBodyDTO } from '../dto/account.dto.js';

@Controller('/api/v1')
export class AccountController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  exchangeToken!: ExchangeTokenService;

  @Get('/balance')
  async balance(@Query() query: BalanceQueryDTO) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: query.exchangeId,
      token: query.token,
    });
    const resp = await this.exchangeGrpc.getBalance({ token: grpcToken, tradeType: query.tradeType });
    return apiOk(resp);
  }

  @Post('/leverage')
  async setLeverage(@Body() body: SetLeverageBodyDTO) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: body.exchangeId,
      token: body.token,
    });
    const resp = await this.exchangeGrpc.setLeverage({
      token: grpcToken,
      symbol: body.symbol,
      leverage: body.leverage,
      tradeType: body.tradeType,
      positionSide: body.positionSide ?? null,
    });
    return apiOk(resp);
  }
}
