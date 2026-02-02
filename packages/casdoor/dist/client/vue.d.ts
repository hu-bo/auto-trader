import { DeepReadonly, Ref } from 'vue';
import { d as CasdoorUser, T as TokenResponse, e as ClientConfig } from '../types-dmynJi7Z.js';
import { CasdoorClient } from './core.js';

/**
 * 初始化 Casdoor 客户端 (应在应用入口调用一次)
 */
declare function initCasdoor(config: ClientConfig): CasdoorClient;
/**
 * 获取全局客户端实例
 */
declare function getCasdoorClient(): CasdoorClient;
interface UseCasdoorReturn {
    /** 是否已认证 */
    isAuthenticated: DeepReadonly<Ref<boolean>>;
    /** 是否正在加载 */
    isLoading: DeepReadonly<Ref<boolean>>;
    /** 当前用户 */
    user: DeepReadonly<Ref<CasdoorUser | null>>;
    /** Access Token */
    accessToken: DeepReadonly<Ref<string | null>>;
    /** 错误信息 */
    error: DeepReadonly<Ref<Error | null>>;
    /** 跳转到登录页 */
    login: () => void;
    /** 跳转到注册页 */
    signup: () => void;
    /** 登出 */
    logout: () => void;
    /** 处理 OAuth 回调 */
    handleCallback: (serverExchangeToken: (code: string) => Promise<{
        token: TokenResponse;
        user: CasdoorUser;
    }>) => Promise<boolean>;
    /** 刷新 Token */
    refreshToken: (serverRefreshToken: (refreshToken: string) => Promise<TokenResponse>) => Promise<boolean>;
    /** 获取客户端实例 */
    getClient: () => CasdoorClient;
}
/**
 * Vue Composable - Casdoor 认证
 */
declare function useCasdoor(): UseCasdoorReturn;
/**
 * Vue Composable - 仅用于回调页面
 */
declare function useCasdoorCallback(serverExchangeToken: (code: string) => Promise<{
    token: TokenResponse;
    user: CasdoorUser;
}>, options?: {
    onSuccess?: (user: CasdoorUser) => void;
    onError?: (error: Error) => void;
}): {
    isLoading: Readonly<Ref<boolean, boolean>>;
    success: Readonly<Ref<boolean, boolean>>;
    error: Readonly<Ref<Error | null, Error | null>>;
};

export { type UseCasdoorReturn, getCasdoorClient, initCasdoor, useCasdoor, useCasdoorCallback };
