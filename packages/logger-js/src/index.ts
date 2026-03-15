import pino from 'pino';
import path from 'path';
import os from 'os';

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DEV = NODE_ENV !== 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_DIR = process.env.LOG_DIR || 'logs';

/**
 * 创建 transport，根据环境切换
 */
function createTransport(): pino.TransportSingleOptions {
  if (IS_DEV) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
    };
  }

  return {
    target: 'pino-transport-rotating-file',
    options: {
      dir: path.resolve(LOG_DIR),
      // pino-transport-rotating-file treats `filename` as a base name,
      // then appends timestamp during rotation.
      filename: 'app',
      interval: '1d',
      maxFiles: 30,
      mkdir: true,
      timestampFormat: 'iso',
    },
  };
}

/**
 * 初始化服务级 logger
 * @param service 服务名，必须传
 */
export function createLogger(service: string) {
  if (!service) {
    throw new Error('service name is required for logger initialization');
  }

  const baseLogger = pino(
    {
      level: LOG_LEVEL,
      base: {
        pid: process.pid,
        service,
        env: NODE_ENV,
      },
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    },
    pino.transport(createTransport())
  );

  /**
   * 创建模块/子系统级别 logger
   * @param scope 模块名
   */
  function createLogger(scope: string) {
    return baseLogger.child({ scope });
  }

  return {
    ...baseLogger,
    child: createLogger,
  };
}
