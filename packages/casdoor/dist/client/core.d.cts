import { e as ClientConfig, a as AuthState, T as TokenResponse, d as CasdoorUser } from '../types-dmynJi7Z.cjs';

type AuthStateListener = (state: AuthState) => void;
/**
 * Casdoor 客户端 SDK
 */
declare class CasdoorClient {
    private config;
    private storage;
    private listeners;
    private refreshTimer;
    private state;
    constructor(config: ClientConfig);
    /**
     * 初始化状态
     */
    private initializeState;
    /**
     * 更新状态并通知监听器
     */
    private updateState;
    /**
     * 订阅状态变化
     */
    subscribe(listener: AuthStateListener): () => void;
    /**
     * 获取当前状态
     */
    getState(): AuthState;
    /**
     * 构建登录 URL
     */
    private buildAuthUrl;
    /**
     * 生成随机 state
     */
    private generateState;
    /**
     * 跳转到登录页
     */
    login(): void;
    /**
     * 跳转到注册页
     */
    signup(): void;
    /**
     * 登出
     */
    logout(): void;
    /**
     * 处理回调
     * @param serverExchangeToken 服务端 Token 交换函数
     */
    handleCallback(serverExchangeToken: (code: string) => Promise<{
        token: TokenResponse;
        user: CasdoorUser;
    }>): Promise<boolean>;
    /**
     * 刷新 Token
     * @param serverRefreshToken 服务端刷新 Token 函数
     */
    refreshToken(serverRefreshToken: (refreshToken: string) => Promise<TokenResponse>): Promise<boolean>;
    /**
     * 设置自动刷新定时器
     */
    private setupRefreshTimer;
    /**
     * 清除刷新定时器
     */
    private clearRefreshTimer;
    /**
     * 获取 Access Token
     */
    getAccessToken(): string | null;
    /**
     * 获取用户信息
     */
    getUser(): CasdoorUser | null;
    /**
     * 检查是否已认证
     */
    isAuthenticated(): boolean;
    /**
     * 销毁客户端
     */
    destroy(): void;
}
/**
 * 创建客户端 SDK 实例
 */
declare function createCasdoorClient(config: ClientConfig): CasdoorClient;

export { type AuthStateListener, CasdoorClient, createCasdoorClient };
