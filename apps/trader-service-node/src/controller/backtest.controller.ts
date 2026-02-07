import { Body, Controller, Get, Inject, Param, Post, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { BacktestService } from '../service/backtest.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { newId } from '../util/id.js';
import { BacktestIdParamDTO, RunBacktestBodyDTO } from '../dto/backtest.dto.js';

@Controller('/api/v1')
export class BacktestController {
  @Inject()
  ctx!: Context;

  @Inject()
  backtestService!: BacktestService;

  @Inject()
  userService!: UserService;

  private async getUserid(): Promise<number> {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    return user.id;
  }

  @Post('/backtests')
  async runBacktest(@Body() body: RunBacktestBodyDTO) {
    const userid = await this.getUserid();

    try {
      const backtest = await this.backtestService.create({
        userid,
        strategyId: body.strategy_id,
        symbol: body.symbol,
        startDate: new Date(body.start_date),
        endDate: new Date(body.end_date),
        initialCapital: String(body.initial_capital),
        parameters: body.parameters ?? null,
      });
      return apiOk(backtest);
    } catch (err) {
      if (err instanceof httpError.ServiceUnavailableError) {
        return apiOk({
          id: newId(),
          userid,
          strategy_id: body.strategy_id,
          symbol: body.symbol,
          status: 'pending',
        });
      }
      throw err;
    }
  }

  @Get('/backtests')
  async listBacktests() {
    const userid = await this.getUserid();
    try {
      const backtests = await this.backtestService.listForUser(userid);
      return apiOk(backtests);
    } catch (err) {
      if (err instanceof httpError.ServiceUnavailableError) {
        return apiOk([]);
      }
      throw err;
    }
  }

  @Get('/backtests/:id')
  async getBacktest(@Param() params: BacktestIdParamDTO) {
    const userid = await this.getUserid();
    const backtest = await this.backtestService.get(userid, params.id);
    return apiOk(backtest);
  }

  @Get('/backtests/:id/progress')
  async backtestProgress(@Param() params: BacktestIdParamDTO) {
    return apiOk({ id: params.id, progress: 0 });
  }

  @Post('/ml/train')
  async trainModel() {
    return apiOk({ queued: true });
  }

  @Get('/ml/models')
  async listModels() {
    return apiOk([]);
  }
}
