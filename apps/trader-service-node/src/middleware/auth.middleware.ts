import { Config, Middleware } from '@midwayjs/core';
import type { IMiddleware } from '@midwayjs/core';
import type { Context, NextFunction } from '@midwayjs/koa';
import { getCasdoorServer, type AuthConfig, type CasdoorConfig } from '../common/casdoor.js';
import { apiFail } from '../util/api-response.js';

const isExcludedPath = (path: string): boolean => {
  if (path === '/' || path === '/health') return true;
  if (path === '/api/get_user') return true;
  if (path.startsWith('/api/v1/auth')) return true;
  return false;
};

@Middleware()
export class AuthMiddleware implements IMiddleware<Context, NextFunction> {
  @Config('auth')
  authConfig!: AuthConfig;

  @Config('casdoor')
  casdoorConfig!: CasdoorConfig;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      if (isExcludedPath(ctx.path)) {
        return await next();
      }

      const isEnabled = (this.authConfig?.mode ?? 'mock') === 'casdoor';

      // Mock mode
      if (!isEnabled) {
        const userId = (ctx.get('x-user-id') || 'demo-user').trim() || 'demo-user';
        const username = (ctx.get('x-username') || 'demo').trim() || 'demo';
        (ctx.state as any).user = {
          id: userId,
          name: username,
          isAdmin: true,
          isGlobalAdmin: true,
        };
        return await next();
      }

      // Casdoor mode
      try {
        const authHeader = ctx.get('authorization');
        if (!authHeader) {
          ctx.status = 401;
          ctx.body = apiFail('Missing authorization header');
          return;
        }

        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!token) {
          ctx.status = 401;
          ctx.body = apiFail('Invalid authorization header');
          return;
        }

        const server = getCasdoorServer(this.casdoorConfig);
        const claims = server.parseJwtToken(token);
  
        const isValid = await server.verifyToken(token);
        if (!isValid) {
          ctx.status = 401;
          ctx.body = apiFail('Invalid or expired token');
          return;
        }

        (ctx.state as any).user = {
          id: claims.sub,
          name: claims.name || claims.sub,
          isAdmin: claims.isAdmin || false,
          isGlobalAdmin: claims.isGlobalAdmin || false,
          ...claims,
        };

        await next();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        ctx.status = 401;
        ctx.body = apiFail(message);
      }
    };
  }

  static getName(): string {
    return 'auth';
  }
}
