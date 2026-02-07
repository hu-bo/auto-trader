import { Body, Controller, Get, Inject, Param, Put, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { CasdoorService } from '../service/casdoor.service.js';
import { apiOk } from '../util/api-response.js';
import { UserService } from '../service/user.service.js';


@Controller('/api/v1/admin')
export class AdminController {
  @Inject()
  ctx!: Context;

  @Inject()
  casdoor!: CasdoorService;

  @Inject()
  userService!: UserService;

  @Get('/users')
  async listUsers() {
    const users = await this.userService.getUsers();
    return apiOk(users);
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
