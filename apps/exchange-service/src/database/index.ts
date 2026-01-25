import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dbConfig } from '../config/index.js';
import { Account } from '../entities/Account.js';
import { Order } from '../entities/Order.js';
import { Position } from '../entities/Position.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('database');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  username: dbConfig.username,
  password: dbConfig.password,
  synchronize: true, // Set to false in production
  logging: false,
  entities: [Account, Order, Position],
  poolSize: dbConfig.poolSize,
  extra: {
    max: dbConfig.poolSize,
    idleTimeoutMillis: 30000,
  },
});

export async function initDatabase(): Promise<DataSource> {
  try {
    await AppDataSource.initialize();
    logger.info('Database connection established');
    return AppDataSource;
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info('Database connection closed');
  }
}
