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
  auth: {
    mode: process.env.AUTH_MODE ?? 'mock',
  },
  casdoor: {
    endpoint: 'http://sso.8and1.cn',
    clientId: '7b474919541526399765' ,
    clientSecret: process.env.CASDOOR_CLIENT_SECRET ?? '',
    orgName: '8PLUS1',
    appName: 'trader',
    certificatePath: process.env.CASDOOR_CERTIFICATE_PATH ?? '',
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
        host: 'localhost',
        port: 15000,
        username: 'trader_user',
        password: '123456',
        database: 'trader',
        synchronize: true,
        logging: false,
        entities: ['**/entity/*.entity{.ts,.js}'],
      },
    },
  },
  exchangeGrpc: {
    url: process.env.EXCHANGE_GRPC_URL ?? 'localhost:50051',
  },
} as MidwayConfig;
