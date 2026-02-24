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
var react_exports = {};
__export(react_exports, {
  CasdoorProvider: () => CasdoorProvider,
  useCasdoor: () => useCasdoor,
  useCasdoorCallback: () => useCasdoorCallback,
  useCasdoorClient: () => useCasdoorClient,
  useRequireAuth: () => useRequireAuth
});
module.exports = __toCommonJS(react_exports);
var import_react = require("react");
var import_core = require("./core.js");
const CasdoorContext = (0, import_react.createContext)(null);
function CasdoorProvider({ config, children }) {
  const client = (0, import_react.useMemo)(() => new import_core.CasdoorClient(config), [
    config.endpoint,
    config.clientId,
    config.orgName,
    config.appName,
    config.redirectUri
  ]);
  (0, import_react.useEffect)(() => {
    return () => client.destroy();
  }, [client]);
  return (0, import_react.createElement)(CasdoorContext.Provider, { value: client }, children);
}
function useCasdoorClient() {
  const client = (0, import_react.useContext)(CasdoorContext);
  if (!client) {
    throw new Error("useCasdoorClient must be used within a CasdoorProvider");
  }
  return client;
}
function useCasdoor() {
  const client = useCasdoorClient();
  const [state, setState] = (0, import_react.useState)(client.getState());
  (0, import_react.useEffect)(() => {
    return client.subscribe(setState);
  }, [client]);
  const login = (0, import_react.useCallback)(() => client.login(), [client]);
  const signup = (0, import_react.useCallback)(() => client.signup(), [client]);
  const logout = (0, import_react.useCallback)(() => client.logout(), [client]);
  const getLoginUrl = (0, import_react.useCallback)(() => client.getLoginUrl(), [client]);
  const getSignupUrl = (0, import_react.useCallback)(() => client.getSignupUrl(), [client]);
  const handleCallback = (0, import_react.useCallback)(
    (serverExchangeToken) => client.handleCallback(serverExchangeToken),
    [client]
  );
  const refreshToken = (0, import_react.useCallback)(
    (serverRefreshToken) => client.refreshToken(serverRefreshToken),
    [client]
  );
  return {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    user: state.user,
    accessToken: state.accessToken,
    error: state.error,
    login,
    signup,
    logout,
    getLoginUrl,
    getSignupUrl,
    handleCallback,
    refreshToken
  };
}
function useCasdoorCallback(serverExchangeToken, options) {
  const client = useCasdoorClient();
  const [isLoading, setIsLoading] = (0, import_react.useState)(true);
  const [success, setSuccess] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    let mounted = true;
    const handle = async () => {
      const result = await client.handleCallback(serverExchangeToken);
      if (!mounted) return;
      setIsLoading(false);
      setSuccess(result);
      if (result) {
        options?.onSuccess?.(client.getUser());
      } else {
        const state = client.getState();
        if (state.error) {
          setError(state.error);
          options?.onError?.(state.error);
        }
      }
    };
    handle();
    return () => {
      mounted = false;
    };
  }, [client, serverExchangeToken, options?.onSuccess, options?.onError]);
  return { isLoading, success, error };
}
function useRequireAuth(options) {
  const { isAuthenticated, isLoading, login } = useCasdoor();
  const enabled = options?.enabled ?? true;
  (0, import_react.useEffect)(() => {
    if (enabled && !isLoading && !isAuthenticated) {
      if (options?.redirectTo) {
        window.location.href = options.redirectTo;
      } else {
        login();
      }
    }
  }, [enabled, isLoading, isAuthenticated, login, options?.redirectTo]);
  return { isAuthenticated, isLoading };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CasdoorProvider,
  useCasdoor,
  useCasdoorCallback,
  useCasdoorClient,
  useRequireAuth
});
//# sourceMappingURL=react.cjs.map