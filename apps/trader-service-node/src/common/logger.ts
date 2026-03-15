import { createLogger } from '@hquant/logger-js';

export type AppLogger = ReturnType<typeof createLogger>;

export interface ServiceLogger {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
  child: (scope: string) => ServiceLogger;
}

export const logger: AppLogger = createLogger('trader-service');

export const createScopedLogger = (scope: string): ServiceLogger =>
  logger.child(scope) as unknown as ServiceLogger;
