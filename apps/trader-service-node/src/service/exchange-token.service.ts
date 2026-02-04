import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Context } from '@midwayjs/koa';
import type { Repository } from 'typeorm';
import { UserExchange } from '../entity/user-exchange.entity.js';
import { Config } from '@midwayjs/core';
import { AesGcmEncryptor } from '../util/encryption.js';

@Provide()
export class ExchangeTokenService {
  @InjectEntityModel(UserExchange)
  exchangeRepo?: Repository<UserExchange>;

  @Config('encryption.key')
  encryptionKey?: string;

  async resolveToken(params: {
    ctx: Context;
    exchangeId?: string;
    token?: string;
  }): Promise<string> {
    const headerToken =
      (params.ctx.get('x-exchange-token') || params.ctx.get('x-grpc-token') || '').trim();
    if (headerToken) return headerToken;

    const directToken = (params.token ?? '').trim();
    if (directToken) return directToken;

    const exchangeId = (params.exchangeId ?? '').trim();
    if (!exchangeId) {
      throw new httpError.BadRequestError('exchange_id or token is required');
    }

    if (!this.exchangeRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }

    const exchange = await this.exchangeRepo.findOne({ where: { id: exchangeId } });
    if (!exchange) {
      throw new httpError.NotFoundError('Exchange not found');
    }
    if (!exchange.grpcTokenEncrypted) {
      throw new httpError.BadRequestError('Exchange token not initialized');
    }

    const key = (this.encryptionKey ?? '').trim();
    if (!key) return exchange.grpcTokenEncrypted;

    try {
      return AesGcmEncryptor.fromKey(key).decrypt(exchange.grpcTokenEncrypted);
    } catch (err) {
      void err;
      // Backward-compatible: allow plaintext storage if decrypt fails.
      return exchange.grpcTokenEncrypted;
    }
  }
}
