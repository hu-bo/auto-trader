import { SDK } from 'casdoor-nodejs-sdk';
import { CasdoorConfig, TokenResponse, JwtClaims, AuthResult, CasdoorUser } from '../types.cjs';
export { AuthState, CasdoorPermission, CasdoorRole, ClientConfig, StorageConfig } from '../types.cjs';

/**
 * Casdoor 服务端 SDK
 */
declare class CasdoorServer {
    private sdk;
    private config;
    constructor(config: CasdoorConfig);
    /**
     * 获取登录 URL
     * @param redirectUri 回调地址
     */
    getSigninUrl(redirectUri: string): string;
    /**
     * 获取注册 URL
     * @param redirectUri 回调地址
     * @param enablePassword 是否启用密码注册
     */
    getSignupUrl(redirectUri: string, enablePassword?: boolean): string;
    /**
     * 使用授权码获取 Token
     * @param code 授权码
     */
    getToken(code: string): Promise<TokenResponse>;
    /**
     * 刷新 Token
     * @param refreshToken 刷新令牌
     */
    refreshToken(refreshToken: string): Promise<TokenResponse>;
    /**
     * 解析并验证 JWT Token
     * @param token JWT Token
     */
    parseJwtToken(token: string): JwtClaims;
    /**
     * 验证 Token 并返回用户信息
     * @param token JWT Token
     */
    verifyToken(token: string): Promise<AuthResult>;
    /**
     * 获取用户信息
     * @param name 用户名
     */
    getUser(name: string): Promise<CasdoorUser>;
    /**
     * 获取用户列表
     */
    getUsers(): Promise<CasdoorUser[]>;
    /**
     * 更新用户信息
     * @param user 用户信息
     */
    updateUser(user: Partial<CasdoorUser> & {
        name: string;
    }): Promise<boolean>;
    /**
     * 删除用户
     * @param name 用户名
     */
    deleteUser(name: string): Promise<boolean>;
    /**
     * 获取底层 SDK 实例 (用于高级操作)
     */
    getRawSdk(): SDK;
}
/**
 * Express 中间件 - 验证 Token
 */
declare function createExpressAuthMiddleware(server: CasdoorServer, options?: {
    /** 从请求中获取 Token 的函数，默认从 Authorization header 获取 */
    getToken?: (req: {
        headers: Record<string, string | string[] | undefined>;
    }) => string | null;
    /** 验证失败时的处理函数 */
    onUnauthorized?: (res: {
        status: (code: number) => {
            json: (data: unknown) => void;
        };
    }, error: string) => void;
}): (req: {
    headers: Record<string, string | string[] | undefined>;
    user?: CasdoorUser;
    claims?: JwtClaims;
}, res: {
    status: (code: number) => {
        json: (data: unknown) => void;
    };
}, next: () => void) => Promise<void>;
/**
 * Koa 中间件 - 验证 Token
 */
declare function createKoaAuthMiddleware(server: CasdoorServer, options?: {
    /** 从请求中获取 Token 的函数 */
    getToken?: (ctx: {
        headers: Record<string, string | string[] | undefined>;
    }) => string | null;
    /** 验证失败时的处理函数 */
    onUnauthorized?: (ctx: {
        status: number;
        body: unknown;
    }, error: string) => void;
}): (ctx: {
    headers: Record<string, string | string[] | undefined>;
    status: number;
    body: unknown;
    state: {
        user?: CasdoorUser;
        claims?: JwtClaims;
    };
}, next: () => Promise<void>) => Promise<void>;
/**
 * 创建通用的 Token 验证函数 (用于其他框架)
 */
declare function createTokenVerifier(server: CasdoorServer): (token: string) => Promise<AuthResult>;
/**
 * 创建服务端 SDK 实例
 */
declare function createCasdoorServer(config: CasdoorConfig): CasdoorServer;

export { AuthResult, CasdoorConfig, CasdoorServer, CasdoorUser, JwtClaims, TokenResponse, createCasdoorServer, createExpressAuthMiddleware, createKoaAuthMiddleware, createTokenVerifier, CasdoorServer as default };
