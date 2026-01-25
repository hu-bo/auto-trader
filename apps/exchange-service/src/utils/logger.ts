import pino from 'pino';
import { logConfig } from '../config/index.js';

const transport = logConfig.pretty
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : undefined;

export const logger = pino(
  {
    level: logConfig.level,
  },
  transport
);

export function createLogger(module: string) {
  return logger.child({ module });
}
