import { createLogger as createServiceLogger } from '@hquant/logger-js';


const baseLogger = createServiceLogger('exchange-service');

export const logger = baseLogger;

// Backwards-compatible helper: previously `createLogger(scope)`
export function createLogger(scope: string) {
  return baseLogger.child(scope);
}
