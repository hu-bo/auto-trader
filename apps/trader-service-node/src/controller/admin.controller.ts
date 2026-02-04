import { Body, Controller, Get, Inject, Param, Put, httpError } from '@midwayjs/core';
import { User } from '../entity/user.entity.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';

type UserStatusUpdateBody = {
  is_active: boolean;
};

function toUserRead(user: User) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    is_active: user.isActive,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

@Controller('/api/v1/admin')
export class AdminController {
  @Inject()
  userService!: UserService;

  @Get('/users')
  async listUsers() {
    const users = await this.userService.listUsers();
    return apiOk(users.map(toUserRead));
  }

  @Put('/users/:id/status')
  async updateUserStatus(@Param('id') id: string, @Body() body: UserStatusUpdateBody) {
    if (typeof body?.is_active !== 'boolean') {
      throw new httpError.BadRequestError('is_active is required');
    }

    const user = await this.userService.setActive(id, body.is_active);
    return apiOk(toUserRead(user));
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
