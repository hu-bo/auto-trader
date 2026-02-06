import { Config, Inject, Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Context } from '@midwayjs/koa';
import type { Repository } from 'typeorm';
import { UserExchange } from '../entity/user-exchange.entity.js';
import { AesGcmEncryptor } from '../util/encryption.js';
import { UserService } from './user.service.js';
import type { EncryptionConfig } from '../types/index.js';

@Provide()
export class ExchangeTokenService {
  @InjectEntityModel(UserExchange)
  exchangeRepo?: Repository<UserExchange>;

  @Config('encryption')
  encryptionConfig!: EncryptionConfig;

  @Inject()
  userService!: UserService;

  async resolveToken(params: {
    ctx: Context;
    exchangeId?: number;
    token?: string;
  }): Promise<string> {
    const headerToken =
      (params.ctx.get('x-exchange-token') || params.ctx.get('x-grpc-token') || '').trim();
    if (headerToken) return headerToken;

    const directToken = (params.token ?? '').trim();
    if (directToken) return directToken;

    const exchangeId = params.exchangeId ?? 0;
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

    const userid = await this.userService.getCurrentUserid(params.ctx);
    if (exchange.userid !== userid) {
      throw new httpError.NotFoundError('Exchange not found');
    }
    if (!exchange.grpcTokenEncrypted) {
      throw new httpError.BadRequestError('Exchange token not initialized');
    }

    const key = (this.encryptionConfig?.key ?? '').trim();
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
