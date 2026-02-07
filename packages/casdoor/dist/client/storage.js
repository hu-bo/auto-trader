const DEFAULT_PREFIX = "casdoor_";
const DEFAULT_ACCESS_TOKEN_KEY = "access_token";
const DEFAULT_REFRESH_TOKEN_KEY = "refresh_token";
const DEFAULT_USER_KEY = "user";
const DEFAULT_EXPIRES_AT_KEY = "expires_at";
class MemoryStorage {
  store = /* @__PURE__ */ new Map();
  getItem(key) {
    return this.store.get(key) ?? null;
  }
  setItem(key, value) {
    this.store.set(key, value);
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
class TokenStorage {
  storage;
  prefix;
  accessTokenKey;
  refreshTokenKey;
  userKey;
  expiresAtKey;
  constructor(config) {
    this.prefix = config?.prefix ?? DEFAULT_PREFIX;
    this.accessTokenKey = config?.accessTokenKey ?? DEFAULT_ACCESS_TOKEN_KEY;
    this.refreshTokenKey = config?.refreshTokenKey ?? DEFAULT_REFRESH_TOKEN_KEY;
    this.userKey = config?.userKey ?? DEFAULT_USER_KEY;
    this.expiresAtKey = DEFAULT_EXPIRES_AT_KEY;
    const storageType = config?.type ?? "localStorage";
    if (typeof window === "undefined") {
      this.storage = new MemoryStorage();
    } else if (storageType === "localStorage") {
      this.storage = window.localStorage;
    } else if (storageType === "sessionStorage") {
      this.storage = window.sessionStorage;
    } else {
      this.storage = new MemoryStorage();
    }
  }
  getKey(key) {
    return `${this.prefix}${key}`;
  }
  /**
   * 保存 Token
   * 兼容 SDK 返回的 { access_token, refresh_token } 和完整的 TokenResponse
   */
  saveToken(token) {
    this.storage.setItem(this.getKey(this.accessTokenKey), token.access_token);
    if (token.refresh_token) {
      this.storage.setItem(this.getKey(this.refreshTokenKey), token.refresh_token);
    }
    if (token.expires_in) {
      const expiresAt = Date.now() + token.expires_in * 1e3;
      this.storage.setItem(this.getKey(this.expiresAtKey), expiresAt.toString());
    }
  }
  /**
   * 获取 Access Token
   */
  getAccessToken() {
    return this.storage.getItem(this.getKey(this.accessTokenKey));
  }
  /**
   * 获取 Refresh Token
   */
  getRefreshToken() {
    return this.storage.getItem(this.getKey(this.refreshTokenKey));
  }
  /**
   * 获取 Token 过期时间
   */
  getExpiresAt() {
    const expiresAt = this.storage.getItem(this.getKey(this.expiresAtKey));
    return expiresAt ? parseInt(expiresAt, 10) : null;
  }
  /**
   * 检查 Token 是否过期
   * 如果没有存储过期时间（SDK 未返回 expires_in），视为未过期
   */
  isTokenExpired() {
    const expiresAt = this.getExpiresAt();
    if (!expiresAt) return false;
    return Date.now() >= expiresAt;
  }
  /**
   * 检查 Token 是否即将过期
   * @param thresholdSeconds 过期阈值 (秒)
   */
  isTokenExpiringSoon(thresholdSeconds = 60) {
    const expiresAt = this.getExpiresAt();
    if (!expiresAt) return false;
    return Date.now() >= expiresAt - thresholdSeconds * 1e3;
  }
  /**
   * 保存用户信息
   */
  saveUser(user) {
    this.storage.setItem(this.getKey(this.userKey), JSON.stringify(user));
  }
  /**
   * 获取用户信息
   */
  getUser() {
    const userStr = this.storage.getItem(this.getKey(this.userKey));
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  /**
   * 清除所有存储
   */
  clear() {
    this.storage.removeItem(this.getKey(this.accessTokenKey));
    this.storage.removeItem(this.getKey(this.refreshTokenKey));
    this.storage.removeItem(this.getKey(this.userKey));
    this.storage.removeItem(this.getKey(this.expiresAtKey));
  }
  /**
   * 检查是否有有效 Token
   */
  hasValidToken() {
    return !!this.getAccessToken() && !this.isTokenExpired();
  }
}
export {
  TokenStorage
};
//# sourceMappingURL=storage.js.map