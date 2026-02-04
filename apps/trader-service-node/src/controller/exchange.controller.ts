import { Body, Controller, Del, Get, Inject, Param, Post, Put, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from '../service/exchange.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { getCurrentUser } from '../util/current-user.js';

@Controller('/api/v1/exchanges')
export class ExchangeController {
  @Inject()
  ctx!: Context;

  @Inject()
  userService!: UserService;

  @Inject()
  exchangeService!: ExchangeService;

  @Inject()
  exchangeGrpc!: ExchangeGrpcClient;

  private async ensureUser() {
    const currentUser = getCurrentUser(this.ctx);
    await this.userService.getOrCreate({ userId: currentUser.userId, username: currentUser.username });
    return currentUser;
  }

  private toExchangeRead(exchange: any) {
    return {
      id: exchange.id,
      user_id: exchange.userId,
      exchange_type: exchange.exchangeType,
      name: exchange.name,
      has_grpc_token: Boolean(exchange.grpcTokenEncrypted),
      is_testnet: exchange.isTestnet,
      is_active: exchange.isActive,
      created_at: exchange.createdAt,
      updated_at: exchange.updatedAt,
    };
  }

  @Get('/')
  async list() {
    const currentUser = await this.ensureUser();
    const exchanges = await this.exchangeService.listForUser(currentUser.userId);
    return apiOk(exchanges.map(x => this.toExchangeRead(x)));
  }

  @Post('/')
  async create(
    @Body()
    body: {
      exchange_type: string;
      name: string;
      api_key: string;
      api_secret: string;
      passphrase?: string | null;
      is_testnet?: boolean;
      is_active?: boolean;
    }
  ) {
    if (!body?.exchange_type) throw new httpError.BadRequestError('exchange_type is required');
    if (!body?.name) throw new httpError.BadRequestError('name is required');
    if (!body?.api_key) throw new httpError.BadRequestError('api_key is required');
    if (!body?.api_secret) throw new httpError.BadRequestError('api_secret is required');

    const currentUser = await this.ensureUser();
    let exchange = await this.exchangeService.create({
      userId: currentUser.userId,
      exchangeType: body.exchange_type,
      name: body.name,
      apiKey: body.api_key,
      apiSecret: body.api_secret,
      passphrase: body.passphrase ?? null,
      isTestnet: body.is_testnet ?? false,
      isActive: body.is_active ?? true,
    });

    try {
      const initResp = await this.exchangeGrpc.initAccount({
        exchangeType: exchange.exchangeType,
        apiKey: body.api_key,
        apiSecret: body.api_secret,
        passphrase: body.passphrase ?? null,
        demonet: exchange.isTestnet,
        name: exchange.name,
      });
      if (initResp?.success && typeof initResp?.token === 'string' && initResp.token) {
        exchange = await this.exchangeService.setGrpcToken(currentUser.userId, exchange.id, initResp.token);
      }
    } catch (err) {
      void err;
    }

    return apiOk(this.toExchangeRead(exchange));
  }

  @Put('/:id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string | null;
      api_key?: string | null;
      api_secret?: string | null;
      passphrase?: string | null;
      is_testnet?: boolean | null;
      is_active?: boolean | null;
    }
  ) {
    const currentUser = await this.ensureUser();
    const exchange = await this.exchangeService.update(currentUser.userId, id, {
      name: body?.name ?? undefined,
      apiKey: body?.api_key ?? undefined,
      apiSecret: body?.api_secret ?? undefined,
      passphrase: body?.passphrase ?? undefined,
      isTestnet: body?.is_testnet ?? undefined,
      isActive: body?.is_active ?? undefined,
    });
    return apiOk(this.toExchangeRead(exchange));
  }

  @Del('/:id')
  async remove(@Param('id') id: string) {
    const currentUser = await this.ensureUser();

    try {
      const token = await this.exchangeService.getGrpcToken(currentUser.userId, id);
      await this.exchangeGrpc.invalidateToken({ token });
    } catch (err) {
      void err;
    }

    await this.exchangeService.delete(currentUser.userId, id);
    return apiOk(null);
  }

  @Post('/:id/test')
  async test(@Param('id') id: string) {
    const currentUser = await this.ensureUser();

    const exchange = await this.exchangeService.get(currentUser.userId, id);
    let token: string | null = null;

    try {
      token = await this.exchangeService.getGrpcToken(currentUser.userId, id);
      const validateResp = await this.exchangeGrpc.validateToken({ token });
      if (validateResp?.valid) {
        return apiOk({ ...validateResp, initialized: false });
      }
    } catch (err) {
      void err;
      token = null;
    }

    const creds = await this.exchangeService.getApiCredentials(currentUser.userId, id);
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

    await this.exchangeService.setGrpcToken(currentUser.userId, id, initResp.token);
    const validateResp = await this.exchangeGrpc.validateToken({ token: initResp.token });
    return apiOk({ ...validateResp, initialized: true });
  }
}
