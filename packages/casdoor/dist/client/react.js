import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  createElement
} from "react";
import { CasdoorClient } from "./core.js";
const CasdoorContext = createContext(null);
function CasdoorProvider({ config, children }) {
  const client = useMemo(() => new CasdoorClient(config), [
    config.endpoint,
    config.clientId,
    config.orgName,
    config.appName,
    config.redirectUri
  ]);
  useEffect(() => {
    return () => client.destroy();
  }, [client]);
  return createElement(CasdoorContext.Provider, { value: client }, children);
}
function useCasdoorClient() {
  const client = useContext(CasdoorContext);
  if (!client) {
    throw new Error("useCasdoorClient must be used within a CasdoorProvider");
  }
  return client;
}
function useCasdoor() {
  const client = useCasdoorClient();
  const [state, setState] = useState(client.getState());
  useEffect(() => {
    return client.subscribe(setState);
  }, [client]);
  const login = useCallback(() => client.login(), [client]);
  const signup = useCallback(() => client.signup(), [client]);
  const logout = useCallback(() => client.logout(), [client]);
  const handleCallback = useCallback(
    (serverExchangeToken) => client.handleCallback(serverExchangeToken),
    [client]
  );
  const refreshToken = useCallback(
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
    handleCallback,
    refreshToken
  };
}
function useCasdoorCallback(serverExchangeToken, options) {
  const client = useCasdoorClient();
  const [isLoading, setIsLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
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
  useEffect(() => {
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
export {
  CasdoorProvider,
  useCasdoor,
  useCasdoorCallback,
  useCasdoorClient,
  useRequireAuth
};
//# sourceMappingURL=react.js.map