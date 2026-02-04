import { Controller, Get, Post, Query } from '@midwayjs/core';
import { apiOk } from '../util/api-response.js';

@Controller('/api/v1/auth')
export class AuthController {
  @Get('/login')
  async login() {
    return apiOk({ auth_mode: process.env.AUTH_MODE ?? 'mock' });
  }

  @Get('/callback')
  async callback(@Query('code') code: string) {
    return apiOk({ code });
  }

  @Post('/logout')
  async logout() {
    return apiOk(null);
  }
}
