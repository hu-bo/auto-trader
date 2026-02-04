import { Body, Controller, Del, Get, Inject, Param, Post, Put, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeService } from '../service/exchange.service.js';
import { StrategyOrderService } from '../service/strategy-order.service.js';
import { StrategyService } from '../service/strategy.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { getCurrentUser } from '../util/current-user.js';

@Controller('/api/v1/strategy-order')
export class StrategyOrderController {
  @Inject()
  ctx!: Context;

  @Inject()
  userService!: UserService;

  @Inject()
  strategyService!: StrategyService;

  @Inject()
  exchangeService!: ExchangeService;

  @Inject()
  strategyOrderService!: StrategyOrderService;

  private async ensureUser() {
    const currentUser = getCurrentUser(this.ctx);
    await this.userService.getOrCreate({ userId: currentUser.userId, username: currentUser.username });
    return currentUser;
  }

  private toStrategyOrderRead(order: any) {
    return {
      id: order.id,
      user_id: order.userId,
      strategy_id: order.strategyId,
      exchange_id: order.exchangeId,
      symbols: order.symbols ?? [],
      parameters: order.parameters ?? {},
      risk_config: order.riskConfig ?? {},
      live: order.live,
      is_running: order.isRunning,
      started_at: order.startedAt,
      stopped_at: order.stoppedAt,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    };
  }

  @Get('/')
  async list() {
    const currentUser = await this.ensureUser();
    const orders = await this.strategyOrderService.listForUser(currentUser.userId);
    return apiOk(orders.map(o => this.toStrategyOrderRead(o)));
  }

  @Post('/')
  async create(
    @Body()
    body: {
      strategy_id: string;
      exchange_id: string;
      symbols: string[];
      parameters?: Record<string, unknown>;
      risk_config?: Record<string, unknown>;
      live?: boolean;
    }
  ) {
    if (!body?.strategy_id) throw new httpError.BadRequestError('strategy_id is required');
    if (!body?.exchange_id) throw new httpError.BadRequestError('exchange_id is required');
    if (!Array.isArray(body?.symbols)) throw new httpError.BadRequestError('symbols is required');

    const currentUser = await this.ensureUser();
    await this.strategyService.get(currentUser.userId, body.strategy_id);
    await this.exchangeService.get(currentUser.userId, body.exchange_id);

    const order = await this.strategyOrderService.create({
      userId: currentUser.userId,
      strategyId: body.strategy_id,
      exchangeId: body.exchange_id,
      symbols: body.symbols,
      parameters: body.parameters ?? {},
      riskConfig: body.risk_config ?? {},
      live: body.live ?? false,
    });
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Get('/:id')
  async get(@Param('id') id: string) {
    const currentUser = await this.ensureUser();
    const order = await this.strategyOrderService.get(currentUser.userId, id);
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Put('/:id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      symbols?: string[] | null;
      parameters?: Record<string, unknown> | null;
      risk_config?: Record<string, unknown> | null;
      live?: boolean | null;
    }
  ) {
    const currentUser = await this.ensureUser();
    const order = await this.strategyOrderService.update(currentUser.userId, id, {
      symbols: body?.symbols ?? undefined,
      parameters: body?.parameters ?? undefined,
      riskConfig: body?.risk_config ?? undefined,
      live: body?.live ?? undefined,
    });
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Del('/:id')
  async remove(@Param('id') id: string) {
    const currentUser = await this.ensureUser();
    await this.strategyOrderService.delete(currentUser.userId, id);
    return apiOk(null);
  }

  @Post('/:id/start')
  async start(@Param('id') id: string) {
    const currentUser = await this.ensureUser();
    const order = await this.strategyOrderService.start(currentUser.userId, id);
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Post('/:id/stop')
  async stop(@Param('id') id: string) {
    const currentUser = await this.ensureUser();
    const order = await this.strategyOrderService.stop(currentUser.userId, id);
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Get('/:id/stats')
  async stats(@Param('id') id: string) {
    return apiOk({ id, stats: {} });
  }
}
