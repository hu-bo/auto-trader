/**
 * Casdoor SDK 配置
 */
export interface CasdoorConfig {
  /** Casdoor 服务端地址，如 https://auth.example.com */
  endpoint: string;
  /** 客户端 ID */
  clientId: string;
  /** 客户端密钥 (服务端使用) */
  clientSecret?: string;
  /** 组织名称 */
  orgName: string;
  /** 应用名称 */
  appName: string;
  /** 用于验证 JWT 的证书 (服务端使用) */
  certificate?: string;
}

/**
 * Casdoor 用户信息
 */
export interface CasdoorUser {
  id: string;
  owner: string;
  name: string;
  displayName: string;
  avatar: string;
  email: string;
  phone: string;
  type: string;
  createdTime: string;
  updatedTime: string;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  isForbidden: boolean;
  isDeleted: boolean;
  signupApplication: string;
  score: number;
  ranking: number;
  properties: Record<string, string>;
  roles: CasdoorRole[];
  permissions: CasdoorPermission[];
}

/**
 * Casdoor 角色
 */
export interface CasdoorRole {
  owner: string;
  name: string;
  displayName: string;
  description: string;
  users: string[];
  roles: string[];
  isEnabled: boolean;
}

/**
 * Casdoor 权限
 */
export interface CasdoorPermission {
  owner: string;
  name: string;
  displayName: string;
  description: string;
  users: string[];
  roles: string[];
  domains: string[];
  model: string;
  adapter: string;
  resourceType: string;
  resources: string[];
  actions: string[];
  effect: string;
  isEnabled: boolean;
}

/**
 * Token 响应
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * JWT Claims
 */
export interface JwtClaims {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  nbf?: number;
  name?: string;
  owner?: string;
  [key: string]: unknown;
}

/**
 * 客户端存储配置
 */
export interface StorageConfig {
  /** 存储类型 */
  type: 'localStorage' | 'sessionStorage' | 'memory';
  /** 存储键名前缀 */
  prefix?: string;
  /** Access Token 键名 */
  accessTokenKey?: string;
  /** Refresh Token 键名 */
  refreshTokenKey?: string;
  /** 用户信息键名 */
  userKey?: string;
}

/**
 * 客户端 SDK 配置
 */
export interface ClientConfig extends CasdoorConfig {
  /** 登录后回调地址 */
  redirectUri: string;
  /** 登出后回调地址 */
  logoutRedirectUri?: string;
  /** 存储配置 */
  storage?: StorageConfig;
  /** 静默刷新 Token */
  silentRefresh?: boolean;
  /** Token 过期前多少秒刷新 (默认 60) */
  refreshBeforeExpiry?: number;
}

/**
 * 认证状态
 */
export interface AuthState {
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 当前用户 */
  user: CasdoorUser | null;
  /** Access Token */
  accessToken: string | null;
  /** 错误信息 */
  error: Error | null;
}

/**
 * 服务端鉴权结果
 */
export interface AuthResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 用户信息 */
  user?: CasdoorUser;
  /** JWT Claims */
  claims?: JwtClaims;
  /** 错误信息 */
  error?: string;
}
