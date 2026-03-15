// src/index.ts
import pino from "pino";
import path from "path";
var NODE_ENV = process.env.NODE_ENV || "development";
var IS_DEV = NODE_ENV !== "production";
var LOG_LEVEL = process.env.LOG_LEVEL || "info";
var LOG_DIR = process.env.LOG_DIR || "logs";
function createTransport() {
  if (IS_DEV) {
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname"
      }
    };
  }
  return {
    target: "pino-transport-rotating-file",
    options: {
      dir: path.resolve(LOG_DIR),
      // pino-transport-rotating-file treats `filename` as a base name,
      // then appends timestamp during rotation.
      filename: "app",
      interval: "1d",
      immutable: true,
      retentionDays: 30,
      mkdir: true,
      timestampFormat: "iso"
    }
  };
}
function createLogger(service) {
  if (!service) {
    throw new Error("service name is required for logger initialization");
  }
  const baseLogger = pino(
    {
      level: LOG_LEVEL,
      base: {
        pid: process.pid,
        service,
        env: NODE_ENV
      },
      timestamp: () => `,"time":"${(/* @__PURE__ */ new Date()).toISOString()}"`
    },
    pino.transport(createTransport())
  );
  function createLogger2(scope) {
    return baseLogger.child({ scope });
  }
  return {
    ...baseLogger,
    child: createLogger2
  };
}
export {
  createLogger
};
