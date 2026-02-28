import { Body, Controller, Del, Get, Inject, Param, Post, Put, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from '../service/exchange.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { CreateExchangeBodyDTO, ExchangeIdParamDTO, UpdateExchangeBodyDTO } from '../dto/exchange.dto.js';

@Controller('/api/v1/exchanges')
export class ExchangeController {
  @Inject()
  ctx!: Context;

  @Inject()
  exchangeService!: ExchangeService;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  @Inject()
  userService!: UserService;

  private async getUserid(): Promise<number> {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    return user.id;
  }

  private toExchangeRead(
    exchange: any,
    creds?: { apiKey: string; apiSecret: string; passphrase: string | null }
  ) {
    return {
      id: exchange.id,
      userId: exchange.userid,
      apiKey: creds?.apiKey ?? undefined,
      apiSecret: creds?.apiSecret ?? undefined,
      passphrase: creds?.passphrase ?? undefined,
      exchangeType: exchange.exchangeType,
      name: exchange.name,
      isTestnet: exchange.isTestnet,
      isActive: exchange.isActive,
      createdAt: exchange.createdAt,
      updatedAt: exchange.updatedAt,
    };
  }

  @Get('/')
  async list() {
    const userid = await this.getUserid();
    const exchanges = await this.exchangeService.listForUser(userid);
    const results = await Promise.all(
      exchanges.map(async (x) => {
        const creds = await this.exchangeService.getApiCredentials(userid, x.id);
        return this.toExchangeRead(x, creds);
      })
    );
    return apiOk(results);
  }

  @Post('/')
  async create(
    @Body() body: CreateExchangeBodyDTO
  ) {
    const userid = await this.getUserid();
    const exchange = await this.exchangeService.create({
      userid,
      exchangeType: body.exchangeType,
      name: body.name,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      passphrase: body.passphrase ?? null,
      isTestnet: body.isTestnet ?? false,
      isActive: body.isActive ?? true,
    });

    // Token 由上游服务生成和管理，不再在此处初始化
    const creds = await this.exchangeService.getApiCredentials(userid, exchange.id);
    return apiOk(this.toExchangeRead(exchange, creds));
  }

  @Put('/:id')
  async update(
    @Param() params: ExchangeIdParamDTO,
    @Body() body: UpdateExchangeBodyDTO
  ) {
    const userid = await this.getUserid();
    const exchange = await this.exchangeService.update(userid, params.id, {
      name: body?.name ?? undefined,
      apiKey: body?.apiKey ?? undefined,
      apiSecret: body?.apiSecret ?? undefined,
      passphrase: body?.passphrase ?? undefined,
      isTestnet: body?.isTestnet ?? undefined,
      isActive: body?.isActive ?? undefined,
    });
    const creds = await this.exchangeService.getApiCredentials(userid, exchange.id);
    return apiOk(this.toExchangeRead(exchange, creds));
  }

  @Del('/:id')
  async remove(@Param() params: ExchangeIdParamDTO) {
    const userid = await this.getUserid();
    await this.exchangeService.delete(userid, params.id);
    return apiOk(null);
  }

  @Post('/:id/test')
  async test(@Param() params: ExchangeIdParamDTO) {
    const userid = await this.getUserid();
    const exchange = await this.exchangeService.get(userid, params.id);
    const creds = await this.exchangeService.getApiCredentials(userid, params.id);

    // 使用 API 凭证初始化账户，token 由上游服务生成
    const initResp = await this.exchangeGrpc.initAccount({
      exchangeType: exchange.exchangeType,
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
      passphrase: creds.passphrase,
      demonet: exchange.isTestnet,
      name: exchange.name,
    });

    if (!initResp?.success || !initResp?.token) {
      const msg = initResp?.error || 'InitAccount failed';
      throw new httpError.BadGatewayError(msg);
    }

    // 验证 token（同时验证 API Key 是否可用）
    const validateResp = await this.exchangeGrpc.validateToken({ token: initResp.token });
    return apiOk({
      valid: validateResp.valid,
      exchange: validateResp.exchange,
      token: initResp.token,
      initialized: true,
      error: validateResp.error || undefined,
    });
  }
}
