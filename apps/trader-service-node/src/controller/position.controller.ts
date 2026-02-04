import { Body, Controller, Get, Inject, Param, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeTokenService } from '../service/exchange-token.service.js';
import { apiOk } from '../util/api-response.js';

type ClosePositionBody = {
  exchange_id: string;
  order_type?: string;
  price?: number | null;
  client_order_id?: string | null;
  token?: string;
};

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
  exchangeToken!: ExchangeTokenService;

  @Get('/')
  async list(
    @Query('exchange_id') exchangeId?: string,
    @Query('symbol') symbol?: string,
    @Query('token') token?: string
  ) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId,
      token,
    });
    const resp = await this.exchangeGrpc.getPositions({ token: grpcToken, symbol });
    return apiOk(resp);
  }

  @Post('/sync')
  async sync(@Query('exchange_id') exchangeId?: string, @Query('token') token?: string) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId,
      token,
    });
    const resp = await this.exchangeGrpc.syncPositions({ token: grpcToken });
    return apiOk(resp);
  }

  @Post('/:positionId/close')
  async close(@Param('positionId') positionId: string, @Body() body: ClosePositionBody) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: body.exchange_id,
      token: body.token,
    });

    const positionsResp = await this.exchangeGrpc.getPositions({ token: grpcToken });
    const positions: any[] = Array.isArray(positionsResp?.positions) ? positionsResp.positions : [];

    const position = positions.find(p => p?.id === positionId);
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
    const orderType = body.order_type ?? 'market';

    const resp = await this.exchangeGrpc.placeOrder({
      token: grpcToken,
      symbol: String(position?.symbol ?? ''),
      tradeType,
      side,
      orderType,
      quantity,
      price: body.price ?? null,
      positionSide: tradeType === 'SPOT' ? null : positionSide,
      clientOrderId: body.client_order_id ?? null,
      reduceOnly: true,
    });
    return apiOk(resp);
  }
}
