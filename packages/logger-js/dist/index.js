"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createLogger: () => createLogger
});
module.exports = __toCommonJS(index_exports);
var import_pino = __toESM(require("pino"));
var import_path = __toESM(require("path"));
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
      dir: import_path.default.resolve(LOG_DIR),
      // pino-transport-rotating-file treats `filename` as a base name,
      // then appends timestamp during rotation.
      filename: "app",
      interval: "1d",
      maxFiles: 30,
      mkdir: true,
      timestampFormat: "iso"
    }
  };
}
function createLogger(service) {
  if (!service) {
    throw new Error("service name is required for logger initialization");
  }
  const baseLogger = (0, import_pino.default)(
    {
      level: LOG_LEVEL,
      base: {
        pid: process.pid,
        service,
        env: NODE_ENV
      },
      timestamp: () => `,"time":"${(/* @__PURE__ */ new Date()).toISOString()}"`
    },
    import_pino.default.transport(createTransport())
  );
  function createLogger2(scope) {
    return baseLogger.child({ scope });
  }
  return {
    ...baseLogger,
    child: createLogger2
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createLogger
});
