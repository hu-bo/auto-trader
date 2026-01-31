import type {
  ClientConfig,
  CasdoorUser,
  AuthState,
  TokenResponse,
} from '../types.js';
import { TokenStorage } from './storage.js';

export type AuthStateListener = (state: AuthState) => void;

/**
 * Casdoor 客户端 SDK
 */
export class CasdoorClient {
  private config: ClientConfig;
  private storage: TokenStorage;
  private listeners: Set<AuthStateListener> = new Set();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private state: AuthState = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    accessToken: null,
    error: null,
  };

  constructor(config: ClientConfig) {
    this.config = config;
    this.storage = new TokenStorage(config.storage);
    this.initializeState();
  }

  /**
   * 初始化状态
   */
  private initializeState(): void {
    const token = this.storage.getAccessToken();
    const user = this.storage.getUser();

    if (token && !this.storage.isTokenExpired()) {
      this.updateState({
        isAuthenticated: true,
        isLoading: false,
        user,
        accessToken: token,
        error: null,
      });

      // 设置自动刷新
      if (this.config.silentRefresh) {
        this.setupRefreshTimer();
      }
    } else {
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        error: null,
      });
    }
  }

  /**
   * 更新状态并通知监听器
   */
  private updateState(newState: Partial<AuthState>): void {
    this.state = { ...this.state, ...newState };
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    // 立即通知当前状态
    listener(this.state);
    // 返回取消订阅函数
    return () => this.listeners.delete(listener);
  }

  /**
   * 获取当前状态
   */
  getState(): AuthState {
    return this.state;
  }

  /**
   * 构建登录 URL
   */
  private buildAuthUrl(type: 'signin' | 'signup'): string {
    const { endpoint, clientId, appName, orgName, redirectUri } = this.config;
    const state = this.generateState();

    // 保存 state 用于验证
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('casdoor_oauth_state', state);
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state,
    });

    const path = type === 'signin' ? 'login/oauth/authorize' : 'signup/oauth/authorize';
    return `${endpoint}/${path}?${params.toString()}&application=${appName}&organization=${orgName}`;
  }

  /**
   * 生成随机 state
   */
  private generateState(): string {
    const array = new Uint8Array(16);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < 16; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 跳转到登录页
   */
  login(): void {
    const url = this.buildAuthUrl('signin');
    window.location.href = url;
  }

  /**
   * 跳转到注册页
   */
  signup(): void {
    const url = this.buildAuthUrl('signup');
    window.location.href = url;
  }

  /**
   * 登出
   */
  logout(): void {
    this.storage.clear();
    this.clearRefreshTimer();
    this.updateState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      accessToken: null,
      error: null,
    });

    const logoutUri = this.config.logoutRedirectUri;
    if (logoutUri) {
      const params = new URLSearchParams({
        id_token_hint: '',
        post_logout_redirect_uri: logoutUri,
      });
      window.location.href = `${this.config.endpoint}/api/logout?${params.toString()}`;
    }
  }

  /**
   * 处理回调
   * @param serverExchangeToken 服务端 Token 交换函数
   */
  async handleCallback(
    serverExchangeToken: (code: string) => Promise<{ token: TokenResponse; user: CasdoorUser }>
  ): Promise<boolean> {
    this.updateState({ isLoading: true });

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        throw new Error(urlParams.get('error_description') || error);
      }

      if (!code) {
        throw new Error('No authorization code found');
      }

      // 验证 state
      if (typeof sessionStorage !== 'undefined') {
        const savedState = sessionStorage.getItem('casdoor_oauth_state');
        if (savedState && savedState !== state) {
          throw new Error('Invalid state parameter');
        }
        sessionStorage.removeItem('casdoor_oauth_state');
      }

      // 调用服务端交换 Token
      const { token, user } = await serverExchangeToken(code);

      this.storage.saveToken(token);
      this.storage.saveUser(user);

      this.updateState({
        isAuthenticated: true,
        isLoading: false,
        user,
        accessToken: token.access_token,
        error: null,
      });

      // 设置自动刷新
      if (this.config.silentRefresh) {
        this.setupRefreshTimer();
      }

      // 清理 URL
      window.history.replaceState({}, document.title, window.location.pathname);

      return true;
    } catch (error) {
      this.updateState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        accessToken: null,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
      return false;
    }
  }

  /**
   * 刷新 Token
   * @param serverRefreshToken 服务端刷新 Token 函数
   */
  async refreshToken(
    serverRefreshToken: (refreshToken: string) => Promise<TokenResponse>
  ): Promise<boolean> {
    const refreshToken = this.storage.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const token = await serverRefreshToken(refreshToken);
      this.storage.saveToken(token);
      this.updateState({
        accessToken: token.access_token,
      });
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  /**
   * 设置自动刷新定时器
   */
  private setupRefreshTimer(): void {
    this.clearRefreshTimer();

    const expiresAt = this.storage.getExpiresAt();
    if (!expiresAt) return;

    const refreshBeforeExpiry = (this.config.refreshBeforeExpiry ?? 60) * 1000;
    const timeout = expiresAt - Date.now() - refreshBeforeExpiry;

    if (timeout > 0) {
      this.refreshTimer = setTimeout(() => {
        // 触发刷新事件，由应用层处理
        this.listeners.forEach((listener) => {
          listener({ ...this.state, isLoading: true });
        });
      }, timeout);
    }
  }

  /**
   * 清除刷新定时器
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 获取 Access Token
   */
  getAccessToken(): string | null {
    return this.storage.getAccessToken();
  }

  /**
   * 获取用户信息
   */
  getUser(): CasdoorUser | null {
    return this.storage.getUser();
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  /**
   * 销毁客户端
   */
  destroy(): void {
    this.clearRefreshTimer();
    this.listeners.clear();
  }
}

/**
 * 创建客户端 SDK 实例
 */
export function createCasdoorClient(config: ClientConfig): CasdoorClient {
  return new CasdoorClient(config);
}
