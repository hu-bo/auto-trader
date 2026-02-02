import { ref, readonly, onMounted, onUnmounted } from "vue";
import { CasdoorClient } from "./core.js";
let globalClient = null;
function initCasdoor(config) {
  globalClient = new CasdoorClient(config);
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
  const isAuthenticated = ref(false);
  const isLoading = ref(true);
  const user = ref(null);
  const accessToken = ref(null);
  const error = ref(null);
  let unsubscribe = null;
  const updateFromState = (state) => {
    isAuthenticated.value = state.isAuthenticated;
    isLoading.value = state.isLoading;
    user.value = state.user;
    accessToken.value = state.accessToken;
    error.value = state.error;
  };
  onMounted(() => {
    unsubscribe = client.subscribe(updateFromState);
  });
  onUnmounted(() => {
    unsubscribe?.();
  });
  updateFromState(client.getState());
  return {
    isAuthenticated: readonly(isAuthenticated),
    isLoading: readonly(isLoading),
    user: readonly(user),
    accessToken: readonly(accessToken),
    error: readonly(error),
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
  const success = ref(false);
  onMounted(async () => {
    const result = await handleCallback(serverExchangeToken);
    success.value = result;
    if (result) {
      options?.onSuccess?.(getCasdoorClient().getUser());
    } else if (error.value) {
      options?.onError?.(error.value);
    }
  });
  return {
    isLoading: readonly(isLoading),
    success: readonly(success),
    error: readonly(error)
  };
}
export {
  getCasdoorClient,
  initCasdoor,
  useCasdoor,
  useCasdoorCallback
};
//# sourceMappingURL=vue.js.map