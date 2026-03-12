import { createLogger } from "@hquant/logger-js";


export const logger: ReturnType<typeof createLogger>  = createLogger('trader-service');
