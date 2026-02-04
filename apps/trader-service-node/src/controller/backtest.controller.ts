import { Body, Controller, Get, Inject, Param, Post, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { BacktestService } from '../service/backtest.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { getCurrentUser } from '../util/current-user.js';
import { newId } from '../util/id.js';

@Controller('/api/v1')
export class BacktestController {
  @Inject()
  ctx!: Context;

  @Inject()
  userService!: UserService;

  @Inject()
  backtestService!: BacktestService;

  private async ensureUser() {
    const currentUser = getCurrentUser(this.ctx);
    try {
      await this.userService.getOrCreate({ userId: currentUser.userId, username: currentUser.username });
    } catch (err) {
      if (!(err instanceof httpError.ServiceUnavailableError)) throw err;
    }
    return currentUser;
  }

  @Post('/backtests')
  async runBacktest(
    @Body()
    body: {
      strategy_id: string;
      symbol: string;
      start_date: string;
      end_date: string;
      initial_capital: number;
      parameters?: Record<string, unknown> | null;
    }
  ) {
    if (!body?.strategy_id) throw new httpError.BadRequestError('strategy_id is required');
    if (!body?.symbol) throw new httpError.BadRequestError('symbol is required');
    if (!body?.start_date) throw new httpError.BadRequestError('start_date is required');
    if (!body?.end_date) throw new httpError.BadRequestError('end_date is required');
    if (typeof body?.initial_capital !== 'number') {
      throw new httpError.BadRequestError('initial_capital is required');
    }

    const currentUser = await this.ensureUser();

    try {
      const backtest = await this.backtestService.create({
        userId: currentUser.userId,
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
          user_id: currentUser.userId,
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
    const currentUser = await this.ensureUser();
    try {
      const backtests = await this.backtestService.listForUser(currentUser.userId);
      return apiOk(backtests);
    } catch (err) {
      if (err instanceof httpError.ServiceUnavailableError) {
        return apiOk([]);
      }
      throw err;
    }
  }

  @Get('/backtests/:id')
  async getBacktest(@Param('id') id: string) {
    const currentUser = await this.ensureUser();
    const backtest = await this.backtestService.get(currentUser.userId, id);
    return apiOk(backtest);
  }

  @Get('/backtests/:id/progress')
  async backtestProgress(@Param('id') id: string) {
    return apiOk({ id, progress: 0 });
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
