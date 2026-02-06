import { Controller, Get, Query } from '@midwayjs/core';
import { apiOk } from '../util/api-response.js';

@Controller('/api/v1/stats')
export class StatsController {
  @Get('/')
  async stats() {
    return apiOk({});
  }

  @Get('/pnl')
  async pnl(@Query('days') days?: number) {
    return apiOk([{
      days: days || 30,
      total_pnl: 0,
      daily_pnl: [],
    }]);
  }
}

