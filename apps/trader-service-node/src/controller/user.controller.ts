import { Body, Config, Controller, Get, Inject } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { type AuthConfig, type CasdoorConfig } from '../common/casdoor.js';
import { apiOk } from '../util/api-response.js';
import { getCurrentUser } from '../util/current-user.js';
import { UserService } from '../service/user.service.js';

@Controller('/api/v1/user')
export class UserController {
  @Inject()
  ctx!: Context;

  @Config('auth')
  authConfig!: AuthConfig;

  @Config('casdoor')
  casdoorConfig!: CasdoorConfig;

  @Inject()
  userService!: UserService;
  private toUserReadFromState(user: any) {
    return {
      id: user?.id ?? null,
      username: user?.name ?? null,
      role: user?.isAdmin || user?.isGlobalAdmin ? 'admin' : 'user',
      isActive: !user?.isForbidden,
      createdAt: user?.createdTime ?? null,
      updatedAt: user?.updatedTime ?? null,
    };
  }

  @Get('/me')
  async me() {
    const user = (this.ctx.state as any)?.user;
    if (user) return apiOk(this.toUserReadFromState(user));

    const currentUser = getCurrentUser(this.ctx);
    return apiOk({
      id: currentUser.userId,
      username: currentUser.username,
      role: currentUser.isAdmin ? 'admin' : 'user',
      isActive: true,
      createdAt: null,
      updatedAt: null,
    });
  }

  @Get('/current')
  async current() {
    const user = await this.userService.syncCurrentUser(this.ctx);
    return apiOk({
      id: user.id,
      casdoorid: user.casdoorid,
      username: user.username,
      displayname: user.displayname,
      role: user.role,
      isadmin: user.isadmin,
      isactive: user.isactive,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  }
}
