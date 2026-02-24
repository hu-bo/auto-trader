import { Body, Controller, Get, Inject, Post, Query } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { apiOk } from '../util/api-response.js';
import { BalanceQueryDTO, SetLeverageBodyDTO } from '../dto/account.dto.js';

@Controller('/api/v1')
export class AccountController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Get('/balance')
  async balance(@Query() query: BalanceQueryDTO) {
    const resp = await this.exchangeGrpc.getBalance({ 
      tradeType: query.tradeType 
    });
    return apiOk(resp);
  }

  @Post('/leverage')
  async setLeverage(@Body() body: SetLeverageBodyDTO) {
    const resp = await this.exchangeGrpc.setLeverage({
      symbol: body.symbol,
      leverage: body.leverage,
      tradeType: body.tradeType,
      positionSide: body.positionSide ?? null,
    });
    return apiOk(resp);
  }
}
