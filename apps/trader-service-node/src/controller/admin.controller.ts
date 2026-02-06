import { Body, Controller, Get, Inject, Param, Put, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { CasdoorService } from '../service/casdoor.service.js';
import { apiOk } from '../util/api-response.js';
import { getCurrentUser } from '../util/current-user.js';
import { AdminUserIdParamDTO, UpdateUserStatusBodyDTO } from '../dto/admin.dto.js';

function toUserRead(user: any) {
  return {
    id: user?.id ?? null,
    username: user?.name ?? null,
    role: user?.isAdmin || user?.isGlobalAdmin ? 'admin' : 'user',
    isActive: !user?.isForbidden,
    createdAt: user?.createdTime ?? null,
    updatedAt: user?.updatedTime ?? null,
  };
}

@Controller('/api/v1/admin')
export class AdminController {
  @Inject()
  ctx!: Context;

  @Inject()
  casdoor!: CasdoorService;

  @Get('/users')
  async listUsers() {
    const currentUser = getCurrentUser(this.ctx);
    if (!currentUser.isAdmin) {
      throw new httpError.ForbiddenError('Admin only');
    }

    if (!this.casdoor.isEnabled()) {
      return apiOk([toUserRead({ id: currentUser.userId, name: currentUser.username, isAdmin: true })]);
    }

    const users = await this.casdoor.getUsers();
    return apiOk(users.map(toUserRead));
  }

  @Put('/users/:id/status')
  async updateUserStatus(@Param() params: AdminUserIdParamDTO, @Body() body: UpdateUserStatusBodyDTO) {
    const id = params.id;

    const currentUser = getCurrentUser(this.ctx);
    if (!currentUser.isAdmin) {
      throw new httpError.ForbiddenError('Admin only');
    }

    if (!this.casdoor.isEnabled()) {
      return apiOk(toUserRead({ id, name: id, isForbidden: !body.isActive, isAdmin: false }));
    }

    const users = await this.casdoor.getUsers();
    const target = users.find(u => u?.id === id || u?.name === id);
    if (!target) throw new httpError.NotFoundError('User not found');

    const ok = await this.casdoor.updateUser({
      name: target.name,
      owner: target.owner,
      isForbidden: !body.isActive,
    } as any);
    if (!ok) throw new httpError.BadGatewayError('Failed to update Casdoor user');

    return apiOk(toUserRead({ ...target, isForbidden: !body.isActive }));
  }

  @Get('/strategies')
  async adminStrategies() {
    return apiOk([]);
  }

  @Get('/orders')
  async adminOrders() {
    return apiOk([]);
  }
}
