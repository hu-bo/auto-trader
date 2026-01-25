import { z } from 'zod';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const nodeConfig = require('config');

const emptyToUndefined = (v: unknown) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  return v;
};

const coerceBoolean = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  }
  return v;
}, z.boolean());

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const configSchema = z.object({
  server: z.object({
    port: z.coerce.number().default(9008),
    host: z.string().default('0.0.0.0'),
    grpcPort: z.coerce.number().default(50051),
  }),
  database: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    name: z.string().default('trader'),
    user: z.string().default('trader_user'),
    password: z.string().default('123456'),
    poolSize: z.coerce.number().default(10),
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: optionalString,
    db: z.coerce.number().default(0),
  }),
  exchange: z.object({
    demonet: coerceBoolean.default(true),
    proxy: optionalString,
    socksProxy: optionalString,
  }),
  risk: z.object({
    enabled: coerceBoolean.default(true),
    maxDailyLoss: z.coerce.number().default(500),
    maxMarginUsagePct: z.coerce.number().default(0.8),
    defaultStopLossPct: z.coerce.number().default(0.05),
    defaultStopProfitPct: z.coerce.number().default(0.1),
  }),
  log: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    pretty: coerceBoolean.default(true),
    dir: z.string().default('logs'),
  }),
  token: z.object({
    secret: z.string().default('exchange-service-secret-key'),
    expireHours: z.coerce.number().default(24),
  }),
});

type ServiceConfig = z.infer<typeof configSchema>;

function loadConfig(): ServiceConfig {
  // node-config object -> plain JS object
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const raw = nodeConfig.util.toObject(nodeConfig) as unknown;

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();

export const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  username: config.database.user,
  password: config.database.password,
  poolSize: config.database.poolSize,
};

export const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
};

export const exchangeConfig = {
  demonet: config.exchange.demonet,
  httpsProxy: config.exchange.proxy || undefined,
  socksProxy: config.exchange.socksProxy || undefined,
};

export const riskConfig = {
  enabled: config.risk.enabled,
  maxDailyLoss: config.risk.maxDailyLoss,
  maxMarginUsagePct: config.risk.maxMarginUsagePct,
  defaultStopLossPct: config.risk.defaultStopLossPct,
  defaultStopProfitPct: config.risk.defaultStopProfitPct,
};

export const serverConfig = {
  port: config.server.port,
  host: config.server.host,
  grpcPort: config.server.grpcPort,
};

export const logConfig = {
  level: config.log.level,
  pretty: config.log.pretty,
  dir: config.log.dir,
};

export const tokenConfig = {
  secret: config.token.secret,
  expireHours: config.token.expireHours,
};

