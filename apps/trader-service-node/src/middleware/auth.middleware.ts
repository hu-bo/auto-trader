import { Inject, Middleware } from '@midwayjs/core';
import type { IMiddleware } from '@midwayjs/core';
import type { Context, NextFunction } from '@midwayjs/koa';
import { CasdoorService } from '../service/casdoor.service.js';
import { apiFail } from '../util/api-response.js';

const isExcludedPath = (path: string): boolean => {
  if (path === '/' || path === '/health') return true;
  if (path === '/api/get_user') return true;
  if (path.startsWith('/api/v1/auth')) return true;
  return false;
};

@Middleware()
export class AuthMiddleware implements IMiddleware<Context, NextFunction> {
  @Inject()
  casdoorService!: CasdoorService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
  
      if (isExcludedPath(ctx.path)) {
        return await next();
      }

      // Mock mode
      if (!this.casdoorService.isEnabled()) {
        const userId = (ctx.get('x-user-id') || 'demo-user').trim() || 'demo-user';
        const username = (ctx.get('x-username') || 'demo').trim() || 'demo';
        ctx.state.user = {
          id: userId,
          owner: 'built-in',
          name: username,
          displayName: username,
          avatar: '',
          email: `${username}@localhost`,
          phone: '',
          type: 'normal-user',
          createdTime: new Date().toISOString(),
          updatedTime: new Date().toISOString(),
          isAdmin: true,
          isGlobalAdmin: true,
          isForbidden: false,
          isDeleted: false,
          signupApplication: 'app-built-in',
          score: 0,
          ranking: 0,
          properties: {},
          roles: [],
          permissions: [],
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

        const { valid, user } = await this.casdoorService.verifyTokenGetUser(token);
        if (!valid || !user) {
          ctx.status = 401;
          ctx.body = apiFail('Invalid or expired token');
          return;
        }
        ctx.state.user = user;
        await next();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        ctx.body = apiFail(message);
      }
    };
  }

  static getName(): string {
    return 'auth';
  }
}
