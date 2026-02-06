import { Config, Controller, Get, Post, Query } from '@midwayjs/core';
import { exchangeToken, getSigninUrl, type AuthConfig, type CasdoorConfig } from '../common/casdoor.js';
import { apiOk } from '../util/api-response.js';
import { AuthCallbackQueryDTO } from '../dto/auth.dto.js';

@Controller('/api/v1/auth')
export class AuthController {
  @Config('auth')
  authConfig!: AuthConfig;

  @Config('casdoor')
  casdoorConfig!: CasdoorConfig;

  @Get('/login')
  async login() {
    const isEnabled = (this.authConfig?.mode ?? 'mock') === 'casdoor';
    if (!isEnabled) {
      return apiOk({ auth_mode: 'mock', url: null });
    }
    const url = getSigninUrl(this.casdoorConfig);
    return apiOk({ auth_mode: 'casdoor', url });
  }

  @Get('/callback')
  async callback(@Query() query: AuthCallbackQueryDTO) {
    const isEnabled = (this.authConfig?.mode ?? 'mock') === 'casdoor';
    if (!isEnabled) {
      return apiOk({ auth_mode: 'mock', code: query.code });
    }

    const resp = await exchangeToken(this.casdoorConfig, query.code);
    return apiOk(resp);
  }

  @Post('/logout')
  async logout() {
    return apiOk(null);
  }
}
