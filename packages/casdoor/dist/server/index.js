import { SDK as CasdoorSDK } from "casdoor-nodejs-sdk";
export * from "../types.js";
function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = parts[1];
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const decoded = Buffer.from(padded, "base64").toString("utf-8");
  return JSON.parse(decoded);
}
class CasdoorServer {
  sdk;
  config;
  constructor(config) {
    if (!config.clientSecret) {
      throw new Error("clientSecret is required for server-side SDK");
    }
    if (!config.certificate) {
      throw new Error("certificate is required for server-side SDK");
    }
    this.config = config;
    this.sdk = new CasdoorSDK({
      endpoint: config.endpoint,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      certificate: config.certificate,
      orgName: config.orgName,
      appName: config.appName
    });
  }
  /**
   * 获取登录 URL
   * @param redirectUri 回调地址
   */
  getSigninUrl(redirectUri) {
    return this.sdk.getSignInUrl(redirectUri);
  }
  /**
   * 获取注册 URL
   * @param redirectUri 回调地址
   * @param enablePassword 是否启用密码注册
   */
  getSignupUrl(redirectUri, enablePassword = true) {
    return this.sdk.getSignUpUrl(enablePassword, redirectUri);
  }
  /**
   * 使用授权码获取 Token
   * @param code 授权码
   */
  async getToken(code) {
    const token = await this.sdk.getAuthToken(code);
    return token;
  }
  /**
   * 刷新 Token
   * @param refreshToken 刷新令牌
   */
  async refreshToken(refreshToken) {
    const token = await this.sdk.refreshToken(refreshToken);
    return token;
  }
  /**
   * 解析并验证 JWT Token
   * @param token JWT Token
   */
  parseJwtToken(token) {
    return decodeJwt(token);
  }
  /**
   * 验证 Token 并返回用户信息
   * @param token JWT Token
   */
  async verifyToken(token) {
    try {
      const claims = this.parseJwtToken(token);
      const now = Math.floor(Date.now() / 1e3);
      if (claims.exp && claims.exp < now) {
        return {
          valid: false,
          error: "Token has expired"
        };
      }
      const user = await this.getUser(claims.name || claims.sub);
      return {
        valid: true,
        user,
        claims
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Token verification failed"
      };
    }
  }
  /**
   * 获取用户信息
   * @param name 用户名
   */
  async getUser(name) {
    const response = await this.sdk.getUser(name);
    const user = response.data?.data ?? response.data;
    return user;
  }
  /**
   * 获取用户列表
   */
  async getUsers() {
    const response = await this.sdk.getUsers();
    const users = response.data ?? response;
    return users;
  }
  /**
   * 更新用户信息
   * @param user 用户信息
   */
  async updateUser(user) {
    const result = await this.sdk.updateUser(user);
    const data = result.data ?? result;
    return data.status === "ok";
  }
  /**
   * 删除用户
   * @param name 用户名
   */
  async deleteUser(name) {
    const result = await this.sdk.deleteUser({ name, owner: this.config.orgName });
    const data = result.data ?? result;
    return data.status === "ok";
  }
  /**
   * 获取底层 SDK 实例 (用于高级操作)
   */
  getRawSdk() {
    return this.sdk;
  }
}
function createExpressAuthMiddleware(server, options) {
  const getToken = options?.getToken ?? ((req) => {
    const auth = req.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      return auth.slice(7);
    }
    return null;
  });
  const onUnauthorized = options?.onUnauthorized ?? ((res, error) => {
    res.status(401).json({ error: "Unauthorized", message: error });
  });
  return async (req, res, next) => {
    const token = getToken(req);
    if (!token) {
      onUnauthorized(res, "No token provided");
      return;
    }
    const result = await server.verifyToken(token);
    if (!result.valid) {
      onUnauthorized(res, result.error ?? "Invalid token");
      return;
    }
    req.user = result.user;
    req.claims = result.claims;
    next();
  };
}
function createKoaAuthMiddleware(server, options) {
  const getToken = options?.getToken ?? ((ctx) => {
    const auth = ctx.headers.authorization;
    if (typeof auth === "string" && auth.startsWith("Bearer ")) {
      return auth.slice(7);
    }
    return null;
  });
  const onUnauthorized = options?.onUnauthorized ?? ((ctx, error) => {
    ctx.status = 401;
    ctx.body = { error: "Unauthorized", message: error };
  });
  return async (ctx, next) => {
    const token = getToken(ctx);
    if (!token) {
      onUnauthorized(ctx, "No token provided");
      return;
    }
    const result = await server.verifyToken(token);
    if (!result.valid) {
      onUnauthorized(ctx, result.error ?? "Invalid token");
      return;
    }
    ctx.state.user = result.user;
    ctx.state.claims = result.claims;
    await next();
  };
}
function createTokenVerifier(server) {
  return async (token) => {
    return server.verifyToken(token);
  };
}
function createCasdoorServer(config) {
  return new CasdoorServer(config);
}
var server_default = CasdoorServer;
export {
  CasdoorServer,
  createCasdoorServer,
  createExpressAuthMiddleware,
  createKoaAuthMiddleware,
  createTokenVerifier,
  server_default as default
};
//# sourceMappingURL=index.js.map