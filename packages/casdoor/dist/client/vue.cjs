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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var vue_exports = {};
__export(vue_exports, {
  getCasdoorClient: () => getCasdoorClient,
  initCasdoor: () => initCasdoor,
  useCasdoor: () => useCasdoor,
  useCasdoorCallback: () => useCasdoorCallback
});
module.exports = __toCommonJS(vue_exports);
var import_vue = require("vue");
var import_core = require("./core.js");
let globalClient = null;
function initCasdoor(config) {
  globalClient = new import_core.CasdoorClient(config);
  return globalClient;
}
function getCasdoorClient() {
  if (!globalClient) {
    throw new Error("Casdoor client not initialized. Call initCasdoor() first.");
  }
  return globalClient;
}
function useCasdoor() {
  const client = getCasdoorClient();
  const isAuthenticated = (0, import_vue.ref)(false);
  const isLoading = (0, import_vue.ref)(true);
  const user = (0, import_vue.ref)(null);
  const accessToken = (0, import_vue.ref)(null);
  const error = (0, import_vue.ref)(null);
  let unsubscribe = null;
  const updateFromState = (state) => {
    isAuthenticated.value = state.isAuthenticated;
    isLoading.value = state.isLoading;
    user.value = state.user;
    accessToken.value = state.accessToken;
    error.value = state.error;
  };
  (0, import_vue.onMounted)(() => {
    unsubscribe = client.subscribe(updateFromState);
  });
  (0, import_vue.onUnmounted)(() => {
    unsubscribe?.();
  });
  updateFromState(client.getState());
  return {
    isAuthenticated: (0, import_vue.readonly)(isAuthenticated),
    isLoading: (0, import_vue.readonly)(isLoading),
    user: (0, import_vue.readonly)(user),
    accessToken: (0, import_vue.readonly)(accessToken),
    error: (0, import_vue.readonly)(error),
    login: () => client.login(),
    signup: () => client.signup(),
    logout: () => client.logout(),
    handleCallback: (serverExchangeToken) => client.handleCallback(serverExchangeToken),
    refreshToken: (serverRefreshToken) => client.refreshToken(serverRefreshToken),
    getClient: () => client
  };
}
function useCasdoorCallback(serverExchangeToken, options) {
  const { isLoading, error, handleCallback } = useCasdoor();
  const success = (0, import_vue.ref)(false);
  (0, import_vue.onMounted)(async () => {
    const result = await handleCallback(serverExchangeToken);
    success.value = result;
    if (result) {
      options?.onSuccess?.(getCasdoorClient().getUser());
    } else if (error.value) {
      options?.onError?.(error.value);
    }
  });
  return {
    isLoading: (0, import_vue.readonly)(isLoading),
    success: (0, import_vue.readonly)(success),
    error: (0, import_vue.readonly)(error)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getCasdoorClient,
  initCasdoor,
  useCasdoor,
  useCasdoorCallback
});
//# sourceMappingURL=vue.cjs.map