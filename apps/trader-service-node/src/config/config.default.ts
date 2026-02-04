import { MidwayConfig } from '@midwayjs/core';
import joi from '@midwayjs/validation-joi';

const parseIntOr = (value: string | undefined, fallback: number): number => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export default {
  // use for cookie sign key, should change to your own and keep security
  keys: '1770045186872_4259',
  koa: {
    port: parseIntOr(process.env.APP_PORT, 9003),
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY ?? '',
  },
  validation: {
    validators: {
      joi,
    },
  },
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: parseIntOr(process.env.DB_PORT, 15000),
        username: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'password',
        database: process.env.DB_NAME ?? 'trader_db',
        synchronize: false,
        logging: false,
        entities: ['**/entity/*.entity{.ts,.js}'],
      },
    },
  },
  exchangeGrpc: {
    url: process.env.EXCHANGE_GRPC_URL ?? 'localhost:50051',
  },
} as MidwayConfig;
