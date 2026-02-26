import { Body, Controller, Get, Inject, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from '../service/exchange.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { BalanceQueryDTO, SetLeverageBodyDTO } from '../dto/account.dto.js';

@Controller('/api/v1')
export class AccountController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  exchangeService!: ExchangeService;

  @Inject()
  userService!: UserService;

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

  @Get('/balance')
  async balance(@Query() query: BalanceQueryDTO) {
    const token = await this.getTokenForExchange(query.exchangeId);
    const resp = await this.exchangeGrpc.getBalance({
      token,
      tradeType: query.tradeType,
    });
    return apiOk(resp);
  }

  @Post('/leverage')
  async setLeverage(@Body() body: SetLeverageBodyDTO) {
    const token = await this.getTokenForExchange(body.exchangeId);
    const resp = await this.exchangeGrpc.setLeverage({
      token,
      symbol: body.symbol,
      leverage: body.leverage,
      tradeType: body.tradeType,
      positionSide: body.positionSide ?? null,
    });
    return apiOk(resp);
  }
}
