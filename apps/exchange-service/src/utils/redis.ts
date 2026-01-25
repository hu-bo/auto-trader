import { Redis } from 'ioredis';
import { redisConfig } from '../config/index.js';
import { createLogger } from './logger.js';

const logger = createLogger('redis');

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    const client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      db: redisConfig.db,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    client.on('connect', () => {
      logger.info('Redis connected');
    });

    client.on('error', (err: Error) => {
      logger.error({ err }, 'Redis error');
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisClient = client;
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

// Key prefixes
const KEY_PREFIX = {
  EXCHANGE_CONFIG: 'exchange:config:',
  TOKEN: 'token:',
  ORDER: 'order:',
} as const;

export const redisKeys = {
  exchangeConfig: (token: string) => `${KEY_PREFIX.EXCHANGE_CONFIG}${token}`,
  token: (token: string) => `${KEY_PREFIX.TOKEN}${token}`,
  orderStatus: (orderId: string) => `${KEY_PREFIX.ORDER}${orderId}`,
};
