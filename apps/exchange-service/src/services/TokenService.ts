import { createHmac, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { AppDataSource } from '../database/index.js';
import { Account, type ExchangeType } from '../entities/Account.js';
import { tokenConfig, exchangeConfig } from '../config/index.js';
import { getRedis, redisKeys } from '../utils/redis.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TokenService');

// Validation schemas
export const InitAccountSchema = z.object({
  exchange: z.enum(['okx', 'binance']),
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
  passphrase: z.string().optional(),
  demonet: z.boolean().optional(),
  name: z.string().optional(),
  riskConfig: z.record(z.unknown()).optional(),
});

export type InitAccountInput = z.infer<typeof InitAccountSchema>;

export interface AccountConfig {
  id: string;
  token: string;
  exchange: ExchangeType;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  demonet: boolean;
  riskConfig?: Record<string, unknown>;
}

export class TokenService {
  private accountRepo: Repository<Account>;

  constructor() {
    this.accountRepo = AppDataSource.getRepository(Account);
  }

  /**
   * Generate a unique token for an account
   */
  private generateToken(exchange: ExchangeType, apiKey: string): string {
    const timestamp = Date.now().toString();
    const random = randomBytes(16).toString('hex');
    const data = `${exchange}:${apiKey}:${timestamp}:${random}`;
    const hmac = createHmac('sha256', tokenConfig.secret);
    hmac.update(data);
    return hmac.digest('hex').substring(0, 32);
  }

  /**
   * Initialize an exchange account and return a token
   */
  async initAccount(input: InitAccountInput): Promise<string> {
    const validated = InitAccountSchema.parse(input);

    // Check if account already exists
    const existing = await this.accountRepo.findOne({
      where: {
        exchange: validated.exchange,
        apiKey: validated.apiKey,
      },
    });

    if (existing) {
      // Update existing account and return its token
      existing.apiSecret = validated.apiSecret;
      existing.passphrase = validated.passphrase;
      existing.demonet = validated.demonet ?? exchangeConfig.demonet;
      existing.name = validated.name;
      existing.riskConfig = validated.riskConfig;
      existing.status = 'active';
      existing.lastActiveAt = new Date();
      await this.accountRepo.save(existing);

      // Cache config to Redis
      await this.cacheAccountConfig(existing);

      logger.info({ exchange: validated.exchange, token: existing.token }, 'Account updated');
      return existing.token;
    }

    // Create new account
    const token = this.generateToken(validated.exchange, validated.apiKey);
    const account = this.accountRepo.create({
      token,
      exchange: validated.exchange,
      apiKey: validated.apiKey,
      apiSecret: validated.apiSecret,
      passphrase: validated.passphrase,
      demonet: validated.demonet ?? exchangeConfig.demonet,
      name: validated.name,
      riskConfig: validated.riskConfig,
      status: 'active',
      lastActiveAt: new Date(),
    });

    await this.accountRepo.save(account);

    // Cache config to Redis
    await this.cacheAccountConfig(account);

    logger.info({ exchange: validated.exchange, token }, 'Account created');
    return token;
  }

  /**
   * Get account config by token
   */
  async getAccountConfig(token: string): Promise<AccountConfig | null> {
    const redis = getRedis();
    const cacheKey = redisKeys.exchangeConfig(token);

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as AccountConfig;
    }

    // Load from database
    const account = await this.accountRepo.findOne({
      where: { token, status: 'active' },
    });

    if (!account) {
      return null;
    }

    const config: AccountConfig = {
      id: account.id,
      token: account.token,
      exchange: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      passphrase: account.passphrase,
      demonet: account.demonet,
      riskConfig: account.riskConfig,
    };

    // Cache for future use
    await redis.setex(cacheKey, 3600, JSON.stringify(config));

    return config;
  }

  /**
   * Validate a token
   */
  async validateToken(token: string): Promise<boolean> {
    const config = await this.getAccountConfig(token);
    return config !== null;
  }

  /**
   * Invalidate a token
   */
  async invalidateToken(token: string): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { token },
    });

    if (account) {
      account.status = 'inactive';
      await this.accountRepo.save(account);
    }

    // Remove from cache
    const redis = getRedis();
    await redis.del(redisKeys.exchangeConfig(token));

    logger.info({ token }, 'Token invalidated');
  }

  /**
   * Get all active accounts
   */
  async getAllActiveAccounts(): Promise<AccountConfig[]> {
    const accounts = await this.accountRepo.find({
      where: { status: 'active' },
    });

    return accounts.map((account) => ({
      id: account.id,
      token: account.token,
      exchange: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      passphrase: account.passphrase,
      demonet: account.demonet,
      riskConfig: account.riskConfig,
    }));
  }

  /**
   * Update last active time
   */
  async updateLastActive(token: string): Promise<void> {
    await this.accountRepo.update({ token }, { lastActiveAt: new Date() });
  }

  /**
   * Cache account config to Redis
   */
  private async cacheAccountConfig(account: Account): Promise<void> {
    const redis = getRedis();
    const config: AccountConfig = {
      id: account.id,
      token: account.token,
      exchange: account.exchange,
      apiKey: account.apiKey,
      apiSecret: account.apiSecret,
      passphrase: account.passphrase,
      demonet: account.demonet,
      riskConfig: account.riskConfig,
    };
    await redis.setex(
      redisKeys.exchangeConfig(account.token),
      tokenConfig.expireHours * 3600,
      JSON.stringify(config)
    );
  }
}

// Singleton instance
let tokenService: TokenService | null = null;

export function getTokenService(): TokenService {
  if (!tokenService) {
    tokenService = new TokenService();
  }
  return tokenService;
}
