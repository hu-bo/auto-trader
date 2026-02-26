import { Body, Controller, Get, Inject, Param, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeService } from '../service/exchange.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import {
  ClosePositionBodyDTO,
  PositionIdParamDTO,
  PositionTokenQueryDTO,
  SyncPositionsBodyDTO,
} from '../dto/position.dto.js';

const normalizeGrpcEnumName = (value: unknown, prefix: string): string | null => {
  if (typeof value !== 'string') return null;
  const s = value.trim().toUpperCase();
  if (!s) return null;
  return s.startsWith(prefix) ? s.slice(prefix.length) : s;
};

@Controller('/api/v1/positions')
export class PositionController {
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

  @Get('/')
  async list(@Query() query: PositionTokenQueryDTO) {
    const token = await this.getTokenForExchange(query.exchangeId);
    const resp = await this.exchangeGrpc.getPositions({
      token,
      symbol: query.symbol,
    });
    return apiOk(resp);
  }

  @Post('/sync')
  async sync(@Body() body: SyncPositionsBodyDTO) {
    const token = await this.getTokenForExchange(body.exchangeId);
    const resp = await this.exchangeGrpc.syncPositions({ token });
    return apiOk(resp);
  }

  @Post('/:positionId/close')
  async close(@Param() params: PositionIdParamDTO, @Body() body: ClosePositionBodyDTO) {
    const token = await this.getTokenForExchange(body.exchangeId);
    const positionsResp = await this.exchangeGrpc.getPositions({ token });
    const positions: any[] = Array.isArray(positionsResp?.positions) ? positionsResp.positions : [];

    const position = positions.find(p => p?.id === params.positionId);
    if (!position) {
      throw new httpError.NotFoundError('Position not found');
    }

    const tradeType = normalizeGrpcEnumName(position?.trade_type, 'TRADE_TYPE_');
    const positionSide = normalizeGrpcEnumName(position?.position_side, 'POSITION_SIDE_');
    if (!tradeType) {
      throw new httpError.BadRequestError('Position trade_type missing');
    }

    const quantity = Math.abs(Number.parseFloat(position?.position_amt ?? '0'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new httpError.BadRequestError('Position quantity is 0');
    }

    const side = positionSide === 'LONG' ? 'SELL' : 'BUY';
    const orderType = body.orderType ?? 'market';

    const resp = await this.exchangeGrpc.placeOrder({
      token,
      symbol: String(position?.symbol ?? ''),
      tradeType,
      side,
      orderType,
      quantity,
      price: body.price ?? null,
      positionSide: tradeType === 'SPOT' ? null : positionSide,
      clientOrderId: body.clientOrderId ?? null,
      reduceOnly: true,
    });
    return apiOk(resp);
  }
}
