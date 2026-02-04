import { Controller, Get } from '@midwayjs/core';
import { apiOk } from '../util/api-response.js';

@Controller('/api/v1/signals')
export class SignalController {
  @Get('/')
  async listSignals() {
    return apiOk([]);
  }
}

