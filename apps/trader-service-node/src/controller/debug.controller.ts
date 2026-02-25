import { Controller, Post, Body, Config } from '@midwayjs/core';
import axios from 'axios';
import { apiOk, apiFail } from '../util/api-response.js';
import { StrategyEngineConfig } from '../types/config.js';

@Controller('/api/v1/strategy-engine')
export class DebugController {
  @Config('strategyEngine')
  strategyEngine!: StrategyEngineConfig;

  /**
   * Proxy debug/evaluate requests to strategy-engine REST API
   */
  @Post('/debug/evaluate')
  async debugEvaluate(@Body() body: any) {
    try {
      const resp = await axios.post(
        `${this.strategyEngine.http}/api/v1/debug/evaluate`,
        body,
        { timeout: 30000 }
      );
      return apiOk(resp.data);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          return apiFail('无法连接到 strategy-engine 服务');
        }
        if (error.response?.data?.detail) {
          return apiFail(error.response.data.detail);
        }
      }
      return apiFail(error.message || 'DSL 调试执行失败');
    }
  }
}
