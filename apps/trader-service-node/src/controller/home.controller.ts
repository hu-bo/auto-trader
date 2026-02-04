import { Controller, Get } from '@midwayjs/core';
import { apiOk } from '../util/api-response.js';

@Controller('/')
export class HomeController {
  @Get('/')
  async home(): Promise<string> {
    return 'Hello Midwayjs!';
  }

  @Get('/health')
  async health() {
    return apiOk({ status: 'ok' });
  }
}
