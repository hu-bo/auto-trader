import { z } from 'zod';

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(9008),
  HOST: z.string().default('0.0.0.0'),
  GRPC_PORT: z.coerce.number().default(50051),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('trader'),
  DB_USER: z.string().default('trader_user'),
  DB_PASSWORD: z.string().default('123456'),
  DB_POOL_SIZE: z.coerce.number().default(10),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // Exchange
  DEMONET: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  PROXY: z.string().optional(),
  SOCKS_PROXY: z.string().optional(),

  // Risk Control
  RISK_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  RISK_MAX_DAILY_LOSS: z.coerce.number().default(500),
  RISK_MAX_MARGIN_USAGE_PCT: z.coerce.number().default(0.8),
  RISK_DEFAULT_STOP_LOSS_PCT: z.coerce.number().default(0.05),
  RISK_DEFAULT_STOP_PROFIT_PCT: z.coerce.number().default(0.1),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // Token
  TOKEN_SECRET: z.string().default('exchange-service-secret-key'),
  TOKEN_EXPIRE_HOURS: z.coerce.number().default(24),
});

type EnvConfig = z.infer<typeof envSchema>;

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();

export const dbConfig = {
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  poolSize: config.DB_POOL_SIZE,
};

export const redisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  db: config.REDIS_DB,
};

export const exchangeConfig = {
  demonet: config.DEMONET,
  httpsProxy: config.PROXY || undefined,
  socksProxy: config.SOCKS_PROXY || undefined,
};

export const riskConfig = {
  enabled: config.RISK_ENABLED,
  maxDailyLoss: config.RISK_MAX_DAILY_LOSS,
  maxMarginUsagePct: config.RISK_MAX_MARGIN_USAGE_PCT,
  defaultStopLossPct: config.RISK_DEFAULT_STOP_LOSS_PCT,
  defaultStopProfitPct: config.RISK_DEFAULT_STOP_PROFIT_PCT,
};

export const serverConfig = {
  port: config.PORT,
  host: config.HOST,
  grpcPort: config.GRPC_PORT,
};

export const logConfig = {
  level: config.LOG_LEVEL,
  pretty: config.LOG_PRETTY,
};

export const tokenConfig = {
  secret: config.TOKEN_SECRET,
  expireHours: config.TOKEN_EXPIRE_HOURS,
};
