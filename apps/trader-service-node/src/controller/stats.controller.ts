import { Controller, Get } from '@midwayjs/core';
import { apiOk } from '../util/api-response.js';

@Controller('/api/v1/stats')
export class StatsController {
  @Get('/')
  async stats() {
    return apiOk({});
  }
}

