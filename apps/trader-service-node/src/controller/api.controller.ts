import { Inject, Controller, Get, Query } from '@midwayjs/core';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { GetUserQueryDTO } from '../dto/api.dto.js';

@Controller('/api')
export class APIController {
  @Inject()
  userService!: UserService;

  @Get('/get_user')
  async getUser(@Query() query: GetUserQueryDTO) {
    const parsedUid = Number(query.uid);
    const user = await this.userService.getUser({
      uid: Number.isFinite(parsedUid) ? parsedUid : 0,
    });
    return apiOk(user);
  }
}
