import { Controller, Get, Inject, Post, Query } from '@midwayjs/core';
import { apiFail, apiOk, ApiResponse, ApiSuccess } from '../util/api-response.js';
import { AuthCallbackQueryDTO } from '../dto/auth.dto.js';
import { CasdoorService } from '../service/casdoor.service.js';
import { CasdoorUser, TokenResponse } from '@hquant/casdoor';

@Controller('/api/v1/auth')
export class AuthController {
  @Inject()
  casdoorService!: CasdoorService;

  @Get('/callback')
  async callback(@Query() query: AuthCallbackQueryDTO): Promise<ApiResponse<{ token: TokenResponse; user: CasdoorUser }>> {
    if (!this.casdoorService.isEnabled()) {
      return apiOk({ auth_mode: 'mock', code: query.code });
    }
    const token = await this.casdoorService.verifyCode(query.code);
    console.log(token)
    const { user, valid, error } = await this.casdoorService.verifyTokenGetUser(token.access_token);
    
    if (!valid) {
      return apiFail(`${error}`);
    }

    return apiOk({
      user: user,
      token: token
    });
  }

  @Post('/logout')
  async logout() {
    return apiOk(null);
  }
}
