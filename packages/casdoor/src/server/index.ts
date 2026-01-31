import { SDK as CasdoorSDK } from 'casdoor-nodejs-sdk';
import type {
  CasdoorConfig,
  CasdoorUser,
  AuthResult,
  JwtClaims,
  TokenResponse,
} from '../types.js';

export * from '../types.js';

/**
 * Casdoor 服务端 SDK
 */
export class CasdoorServer {
  private sdk: CasdoorSDK;
  private config: CasdoorConfig;

  constructor(config: CasdoorConfig) {
    if (!config.clientSecret) {
      throw new Error('clientSecret is required for server-side SDK');
    }
    if (!config.certificate) {
      throw new Error('certificate is required for server-side SDK');
    }

    this.config = config;
    this.sdk = new CasdoorSDK({
      endpoint: config.endpoint,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      certificate: config.certificate,
      orgName: config.orgName,
      appName: config.appName,
    });
  }

  /**
   * 获取登录 URL
   * @param redirectUri 回调地址
   * @param state 状态参数
   */
  getSigninUrl(redirectUri: string, state?: string): string {
    return this.sdk.getSigninUrl(redirectUri, state ?? '');
  }

  /**
   * 获取注册 URL
   * @param redirectUri 回调地址
   * @param state 状态参数
   */
  getSignupUrl(redirectUri: string, state?: string): string {
    return this.sdk.getSignupUrl(redirectUri, state ?? '');
  }

  /**
   * 使用授权码获取 Token
   * @param code 授权码
   */
  async getToken(code: string): Promise<TokenResponse> {
    const token = await this.sdk.getOAuthToken(code);
    return token as TokenResponse;
  }

  /**
   * 刷新 Token
   * @param refreshToken 刷新令牌
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const token = await this.sdk.refreshOAuthToken(refreshToken);
    return token as TokenResponse;
  }

  /**
   * 解析并验证 JWT Token
   * @param token JWT Token
   */
  parseJwtToken(token: string): JwtClaims {
    return this.sdk.parseJwtToken(token) as JwtClaims;
  }

  /**
   * 验证 Token 并返回用户信息
   * @param token JWT Token
   */
  async verifyToken(token: string): Promise<AuthResult> {
    try {
      const claims = this.parseJwtToken(token);

      // 检查过期时间
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp && claims.exp < now) {
        return {
          valid: false,
          error: 'Token has expired',
        };
      }

      // 获取用户信息
      const user = await this.getUser(claims.name || claims.sub);

      return {
        valid: true,
        user,
        claims,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  /**
   * 获取用户信息
   * @param name 用户名
   */
  async getUser(name: string): Promise<CasdoorUser> {
    const user = await this.sdk.getUser(name);
    return user as CasdoorUser;
  }

  /**
   * 获取用户列表
   */
  async getUsers(): Promise<CasdoorUser[]> {
    const users = await this.sdk.getUsers();
    return users as CasdoorUser[];
  }

  /**
   * 更新用户信息
   * @param user 用户信息
   */
  async updateUser(user: Partial<CasdoorUser> & { name: string }): Promise<boolean> {
    const result = await this.sdk.modifyUser('update-user', user);
    return result.status === 'ok';
  }

  /**
   * 删除用户
   * @param name 用户名
   */
  async deleteUser(name: string): Promise<boolean> {
    const result = await this.sdk.modifyUser('delete-user', { name, owner: this.config.orgName });
    return result.status === 'ok';
  }

  /**
   * 获取底层 SDK 实例 (用于高级操作)
   */
  getRawSdk(): CasdoorSDK {
    return this.sdk;
  }
}

/**
 * Express 中间件 - 验证 Token
 */
export function createExpressAuthMiddleware(
  server: CasdoorServer,
  options?: {
    /** 从请求中获取 Token 的函数，默认从 Authorization header 获取 */
    getToken?: (req: { headers: Record<string, string | string[] | undefined> }) => string | null;
    /** 验证失败时的处理函数 */
    onUnauthorized?: (res: { status: (code: number) => { json: (data: unknown) => void } }, error: string) => void;
  }
) {
  const getToken = options?.getToken ?? ((req) => {
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  });

  const onUnauthorized = options?.onUnauthorized ?? ((res, error) => {
    res.status(401).json({ error: 'Unauthorized', message: error });
  });

  return async (
    req: { headers: Record<string, string | string[] | undefined>; user?: CasdoorUser; claims?: JwtClaims },
    res: { status: (code: number) => { json: (data: unknown) => void } },
    next: () => void
  ) => {
    const token = getToken(req);
    if (!token) {
      onUnauthorized(res, 'No token provided');
      return;
    }

    const result = await server.verifyToken(token);
    if (!result.valid) {
      onUnauthorized(res, result.error ?? 'Invalid token');
      return;
    }

    req.user = result.user;
    req.claims = result.claims;
    next();
  };
}

/**
 * Koa 中间件 - 验证 Token
 */
export function createKoaAuthMiddleware(
  server: CasdoorServer,
  options?: {
    /** 从请求中获取 Token 的函数 */
    getToken?: (ctx: { headers: Record<string, string | string[] | undefined> }) => string | null;
    /** 验证失败时的处理函数 */
    onUnauthorized?: (ctx: { status: number; body: unknown }, error: string) => void;
  }
) {
  const getToken = options?.getToken ?? ((ctx) => {
    const auth = ctx.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  });

  const onUnauthorized = options?.onUnauthorized ?? ((ctx, error) => {
    ctx.status = 401;
    ctx.body = { error: 'Unauthorized', message: error };
  });

  return async (
    ctx: {
      headers: Record<string, string | string[] | undefined>;
      status: number;
      body: unknown;
      state: { user?: CasdoorUser; claims?: JwtClaims };
    },
    next: () => Promise<void>
  ) => {
    const token = getToken(ctx);
    if (!token) {
      onUnauthorized(ctx, 'No token provided');
      return;
    }

    const result = await server.verifyToken(token);
    if (!result.valid) {
      onUnauthorized(ctx, result.error ?? 'Invalid token');
      return;
    }

    ctx.state.user = result.user;
    ctx.state.claims = result.claims;
    await next();
  };
}

/**
 * 创建通用的 Token 验证函数 (用于其他框架)
 */
export function createTokenVerifier(server: CasdoorServer) {
  return async (token: string): Promise<AuthResult> => {
    return server.verifyToken(token);
  };
}

/**
 * 创建服务端 SDK 实例
 */
export function createCasdoorServer(config: CasdoorConfig): CasdoorServer {
  return new CasdoorServer(config);
}

export default CasdoorServer;
