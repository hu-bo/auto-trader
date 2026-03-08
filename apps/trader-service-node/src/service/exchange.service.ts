import { Config, Provide, Scope, ScopeEnum, httpError } from '@midwayjs/core';
import { isNil } from 'lodash-es';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { UserExchange } from '../entity/user-exchange.entity.js';
import { AesGcmEncryptor } from '../util/encryption.js';
import type { EncryptionConfig } from '../types/index.js';

type ExchangeCreateParams = {
  userid: number;
  exchangeType: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isTestnet?: boolean;
  isActive?: boolean;
};

type ExchangeUpdateParams = {
  exchangeType?: string;
  name?: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  isTestnet?: boolean;
  isActive?: boolean;
};

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class ExchangeService {
  @InjectEntityModel(UserExchange)
  exchangeRepo?: Repository<UserExchange>;

  @Config('encryption')
  encryptionConfig!: EncryptionConfig;

  private requireRepo(): Repository<UserExchange> {
    if (!this.exchangeRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.exchangeRepo;
  }

  private requireEncryptor(): AesGcmEncryptor {
    const key = (this.encryptionConfig?.key ?? '').trim();
    if (!key) {
      throw new httpError.InternalServerErrorError('ENCRYPTION_KEY is required for this operation');
    }
    try {
      return AesGcmEncryptor.fromKey(key);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid ENCRYPTION_KEY';
      throw new httpError.InternalServerErrorError(message);
    }
  }

  async listForUser(userid: number): Promise<UserExchange[]> {
    const repo = this.requireRepo();
    return repo.find({ where: { userid }, order: { createdAt: 'DESC' } });
  }

  async get(userid: number, exchangeId: number): Promise<UserExchange> {
    const repo = this.requireRepo();
    const exchange = await repo.findOne({ where: { id: exchangeId } });
    if (!exchange || exchange.userid !== userid) {
      throw new httpError.NotFoundError('Exchange not found');
    }
    return exchange;
  }

  async create(params: ExchangeCreateParams): Promise<UserExchange> {
    const repo = this.requireRepo();
    const encryptor = this.requireEncryptor();

    const exchange = repo.create({
      userid: params.userid,
      exchangeType: params.exchangeType,
      name: params.name,
      apiKeyEncrypted: encryptor.encrypt(params.apiKey),
      apiSecretEncrypted: encryptor.encrypt(params.apiSecret),
      passphraseEncrypted: params.passphrase ? encryptor.encrypt(params.passphrase) : null,
      isTestnet: params.isTestnet ?? false,
      isActive: params.isActive ?? true,
    });
    return await repo.save(exchange);
  }

  async update(userid: number, exchangeId: number, patch: ExchangeUpdateParams): Promise<UserExchange> {
    const repo = this.requireRepo();
    const encryptor = this.requireEncryptor();
    const exchange = await this.get(userid, exchangeId);

    if (!isNil(patch.name)) exchange.name = patch.name;
    if (!isNil(patch.apiKey)) {
      exchange.apiKeyEncrypted = encryptor.encrypt(patch.apiKey);
    }
    if (!isNil(patch.apiSecret)) {
      exchange.apiSecretEncrypted = encryptor.encrypt(patch.apiSecret);
    }
    if (!isNil(patch.exchangeType)) {
      exchange.exchangeType = patch.exchangeType;
    }
    if (patch.passphrase !== undefined) {
      exchange.passphraseEncrypted =
        patch.passphrase && patch.passphrase.trim() ? encryptor.encrypt(patch.passphrase) : null;
    }
    if (!isNil(patch.isTestnet)) exchange.isTestnet = patch.isTestnet;
    if (!isNil(patch.isActive)) exchange.isActive = patch.isActive;

    return await repo.save(exchange);
  }

  async delete(userid: number, exchangeId: number): Promise<void> {
    const repo = this.requireRepo();
    const exchange = await this.get(userid, exchangeId);
    await repo.remove(exchange);
  }

  async getApiCredentials(userid: number, exchangeId: number): Promise<{
    apiKey: string;
    apiSecret: string;
    passphrase: string | null;
  }> {
    const exchange = await this.get(userid, exchangeId);
    const encryptor = this.requireEncryptor();
    return {
      apiKey: encryptor.decrypt(exchange.apiKeyEncrypted),
      apiSecret: encryptor.decrypt(exchange.apiSecretEncrypted),
      passphrase: exchange.passphraseEncrypted ? encryptor.decrypt(exchange.passphraseEncrypted) : null,
    };
  }
}
