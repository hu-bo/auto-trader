import { Body, Controller, Get, Inject, Param, Post, Query, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeGrpcClient } from '../grpc/exchange-grpc.client.js';
import { ExchangeTokenService } from '../service/exchange-token.service.js';
import { apiOk } from '../util/api-response.js';
import {
  ClosePositionBodyDTO,
  PositionIdParamDTO,
  PositionTokenQueryDTO,
  SyncPositionsQueryDTO,
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
  exchangeToken!: ExchangeTokenService;

  @Get('/')
  async list(@Query() query: PositionTokenQueryDTO) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: query.exchangeId,
      token: query.token,
    });
    const resp = await this.exchangeGrpc.getPositions({ token: grpcToken, symbol: query.symbol });
    return apiOk(resp);
  }

  @Post('/sync')
  async sync(@Query() query: SyncPositionsQueryDTO) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: query.exchangeId,
      token: query.token,
    });
    const resp = await this.exchangeGrpc.syncPositions({ token: grpcToken });
    return apiOk(resp);
  }

  @Post('/:positionId/close')
  async close(@Param() params: PositionIdParamDTO, @Body() body: ClosePositionBodyDTO) {
    const grpcToken = await this.exchangeToken.resolveToken({
      ctx: this.ctx,
      exchangeId: body.exchangeId,
      token: body.token,
    });

    const positionsResp = await this.exchangeGrpc.getPositions({ token: grpcToken });
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
      token: grpcToken,
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
