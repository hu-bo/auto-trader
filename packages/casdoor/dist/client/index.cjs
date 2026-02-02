"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var client_exports = {};
__export(client_exports, {
  CasdoorClient: () => import_core.CasdoorClient,
  CasdoorProvider: () => import_react.CasdoorProvider,
  TokenStorage: () => import_storage.TokenStorage,
  createCasdoorClient: () => import_core.createCasdoorClient,
  getCasdoorClient: () => import_vue.getCasdoorClient,
  initCasdoor: () => import_vue.initCasdoor,
  useCasdoor: () => import_vue.useCasdoor,
  useCasdoorCallback: () => import_vue.useCasdoorCallback,
  useCasdoorCallbackReact: () => import_react.useCasdoorCallback,
  useCasdoorClient: () => import_react.useCasdoorClient,
  useCasdoorReact: () => import_react.useCasdoor,
  useRequireAuth: () => import_react.useRequireAuth
});
module.exports = __toCommonJS(client_exports);
var import_core = require("./core.js");
var import_storage = require("./storage.js");
var import_vue = require("./vue.js");
var import_react = require("./react.js");
__reExport(client_exports, require("../types.js"), module.exports);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CasdoorClient,
  CasdoorProvider,
  TokenStorage,
  createCasdoorClient,
  getCasdoorClient,
  initCasdoor,
  useCasdoor,
  useCasdoorCallback,
  useCasdoorCallbackReact,
  useCasdoorClient,
  useCasdoorReact,
  useRequireAuth,
  ...require("../types.js")
});
//# sourceMappingURL=index.cjs.map