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
  exchangeAdapter: {
    grpc: 'localhost:50051',
    apiKey: ''
  },
  strategyEngine: {
    grpc: process.env.STRATEGY_ENGINE_GRPC ?? 'localhost:50052',
    http: process.env.STRATEGY_ENGINE_HTTP ?? 'http://localhost:9002',
  },
  nats: {
    url: process.env.NATS_URL ?? 'nats://152.32.210.32:15001',
    user: process.env.NATS_USER ?? '',
    pass: process.env.NATS_PASS ?? '',
    subjectPrefix: 'exchange',
  },
  signalNats: {
    url: process.env.SIGNAL_NATS_URL ?? 'nats://localhost:16001',
    user: process.env.SIGNAL_NATS_USER ?? 'strategy_engine',
    pass: process.env.SIGNAL_NATS_PASS ?? '123456',
  },
  ai: {
    baseURL: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'gpt-4o',
    maxTokens: 2048,
    temperature: 0.3,
  },
} as MidwayConfig;
