import { Config, Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { UserExchange } from '../entity/user-exchange.entity.js';
import { AesGcmEncryptor } from '../util/encryption.js';

type ExchangeCreateParams = {
  userId: string;
  exchangeType: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string | null;
  isTestnet?: boolean;
  isActive?: boolean;
};

type ExchangeUpdateParams = {
  name?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  passphrase?: string | null;
  isTestnet?: boolean | null;
  isActive?: boolean | null;
};

@Provide()
export class ExchangeService {
  @InjectEntityModel(UserExchange)
  exchangeRepo?: Repository<UserExchange>;

  @Config('encryption.key')
  encryptionKey?: string;

  private requireRepo(): Repository<UserExchange> {
    if (!this.exchangeRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.exchangeRepo;
  }

  private requireEncryptor(): AesGcmEncryptor {
    const key = (this.encryptionKey ?? '').trim();
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

  async listForUser(userId: string): Promise<UserExchange[]> {
    const repo = this.requireRepo();
    return repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async get(userId: string, exchangeId: string): Promise<UserExchange> {
    const repo = this.requireRepo();
    const exchange = await repo.findOne({ where: { id: exchangeId } });
    if (!exchange || exchange.userId !== userId) {
      throw new httpError.NotFoundError('Exchange not found');
    }
    return exchange;
  }

  async create(params: ExchangeCreateParams): Promise<UserExchange> {
    const repo = this.requireRepo();
    const encryptor = this.requireEncryptor();

    const exchange = repo.create({
      userId: params.userId,
      exchangeType: params.exchangeType,
      name: params.name,
      apiKeyEncrypted: encryptor.encrypt(params.apiKey),
      apiSecretEncrypted: encryptor.encrypt(params.apiSecret),
      passphraseEncrypted: params.passphrase ? encryptor.encrypt(params.passphrase) : null,
      grpcTokenEncrypted: null,
      isTestnet: params.isTestnet ?? false,
      isActive: params.isActive ?? true,
    });
    return await repo.save(exchange);
  }

  async update(userId: string, exchangeId: string, patch: ExchangeUpdateParams): Promise<UserExchange> {
    const repo = this.requireRepo();
    const encryptor = this.requireEncryptor();
    const exchange = await this.get(userId, exchangeId);

    if (patch.name !== undefined && patch.name !== null) exchange.name = patch.name;
    if (patch.apiKey !== undefined && patch.apiKey !== null) {
      exchange.apiKeyEncrypted = encryptor.encrypt(patch.apiKey);
    }
    if (patch.apiSecret !== undefined && patch.apiSecret !== null) {
      exchange.apiSecretEncrypted = encryptor.encrypt(patch.apiSecret);
    }
    if (patch.passphrase !== undefined) {
      exchange.passphraseEncrypted =
        patch.passphrase && patch.passphrase.trim() ? encryptor.encrypt(patch.passphrase) : null;
    }
    if (patch.isTestnet !== undefined && patch.isTestnet !== null) exchange.isTestnet = patch.isTestnet;
    if (patch.isActive !== undefined && patch.isActive !== null) exchange.isActive = patch.isActive;

    return await repo.save(exchange);
  }

  async delete(userId: string, exchangeId: string): Promise<void> {
    const repo = this.requireRepo();
    const exchange = await this.get(userId, exchangeId);
    await repo.remove(exchange);
  }

  async setGrpcToken(userId: string, exchangeId: string, token: string): Promise<UserExchange> {
    const repo = this.requireRepo();
    const encryptor = this.requireEncryptor();
    const exchange = await this.get(userId, exchangeId);
    exchange.grpcTokenEncrypted = encryptor.encrypt(token);
    return await repo.save(exchange);
  }

  async clearGrpcToken(userId: string, exchangeId: string): Promise<UserExchange> {
    const repo = this.requireRepo();
    const exchange = await this.get(userId, exchangeId);
    exchange.grpcTokenEncrypted = null;
    return await repo.save(exchange);
  }

  async getGrpcToken(userId: string, exchangeId: string): Promise<string> {
    const exchange = await this.get(userId, exchangeId);
    if (!exchange.grpcTokenEncrypted) {
      throw new httpError.BadRequestError('Exchange is not initialized (missing grpc token)');
    }
    const encryptor = this.requireEncryptor();
    return encryptor.decrypt(exchange.grpcTokenEncrypted);
  }

  async getApiCredentials(userId: string, exchangeId: string): Promise<{
    apiKey: string;
    apiSecret: string;
    passphrase: string | null;
  }> {
    const exchange = await this.get(userId, exchangeId);
    const encryptor = this.requireEncryptor();
    return {
      apiKey: encryptor.decrypt(exchange.apiKeyEncrypted),
      apiSecret: encryptor.decrypt(exchange.apiSecretEncrypted),
      passphrase: exchange.passphraseEncrypted ? encryptor.decrypt(exchange.passphraseEncrypted) : null,
    };
  }
}
