import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../.env.local') });

import { initDatabase, closeDatabase } from './database/index.js';
import { getRedis, closeRedis } from './utils/redis.js';
import { getExchangeManager } from './services/ExchangeManager.js';
import { startGrpcServer, stopGrpcServer } from './grpc/server.js';
import { serverConfig } from './config/index.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('main');

async function bootstrap() {
  logger.info('Starting Exchange Service...');

  try {
    // Initialize database
    logger.info('Initializing database...');
    await initDatabase();

    // Initialize Redis
    logger.info('Initializing Redis...');
    getRedis();

    // Initialize Exchange Manager (restore instances from Redis)
    logger.info('Initializing Exchange Manager...');
    const exchangeManager = getExchangeManager();
    await exchangeManager.initialize();

    // Start gRPC server
    logger.info('Starting gRPC server...');
    await startGrpcServer();

    logger.info(
      {
        grpcPort: serverConfig.grpcPort,
        host: serverConfig.host,
      },
      'Exchange Service started successfully'
    );

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down...');

      try {
        // Stop gRPC server
        await stopGrpcServer();

        // Shutdown exchange manager
        await exchangeManager.shutdown();

        // Close Redis
        await closeRedis();

        // Close database
        await closeDatabase();

        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.fatal({ reason }, 'Unhandled rejection');
      shutdown('unhandledRejection');
    });
  } catch (error) {
    logger.fatal({ error }, 'Failed to start service');
    process.exit(1);
  }
}

bootstrap();
