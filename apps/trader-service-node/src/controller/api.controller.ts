import { Inject, Controller, Get, Query } from '@midwayjs/core';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';

@Controller('/api')
export class APIController {
  @Inject()
  userService!: UserService;

  @Get('/get_user')
  async getUser(@Query('uid') uid: string) {
    const parsedUid = Number(uid);
    const user = await this.userService.getUser({
      uid: Number.isFinite(parsedUid) ? parsedUid : 0,
    });
    return apiOk(user);
  }
}
