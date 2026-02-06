import { StorageConfig, TokenResponse, CasdoorUser } from '../types.cjs';

/**
 * Token 存储管理器
 */
declare class TokenStorage {
    private storage;
    private prefix;
    private accessTokenKey;
    private refreshTokenKey;
    private userKey;
    private expiresAtKey;
    constructor(config?: StorageConfig);
    private getKey;
    /**
     * 保存 Token
     */
    saveToken(token: TokenResponse): void;
    /**
     * 获取 Access Token
     */
    getAccessToken(): string | null;
    /**
     * 获取 Refresh Token
     */
    getRefreshToken(): string | null;
    /**
     * 获取 Token 过期时间
     */
    getExpiresAt(): number | null;
    /**
     * 检查 Token 是否过期
     */
    isTokenExpired(): boolean;
    /**
     * 检查 Token 是否即将过期
     * @param thresholdSeconds 过期阈值 (秒)
     */
    isTokenExpiringSoon(thresholdSeconds?: number): boolean;
    /**
     * 保存用户信息
     */
    saveUser(user: CasdoorUser): void;
    /**
     * 获取用户信息
     */
    getUser(): CasdoorUser | null;
    /**
     * 清除所有存储
     */
    clear(): void;
    /**
     * 检查是否有有效 Token
     */
    hasValidToken(): boolean;
}

export { TokenStorage };
