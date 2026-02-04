import { Body, Controller, Get, Inject, Put, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { getCurrentUser } from '../util/current-user.js';

@Controller('/api/v1/user')
export class UserController {
  @Inject()
  ctx!: Context;

  @Inject()
  userService!: UserService;

  private toUserRead(user: any) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: user.isActive,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  @Get('/me')
  async me() {
    const currentUser = getCurrentUser(this.ctx);
    const user = await this.userService.getOrCreate({ userId: currentUser.userId, username: currentUser.username });
    return apiOk(this.toUserRead(user));
  }

  @Put('/me')
  async updateMe(@Body() body: { username?: string | null }) {
    const currentUser = getCurrentUser(this.ctx);
    if (body?.username === undefined) {
      throw new httpError.BadRequestError('username is required');
    }

    const user = await this.userService.updateUser(currentUser.userId, { username: body.username });
    return apiOk(this.toUserRead(user));
  }
}
