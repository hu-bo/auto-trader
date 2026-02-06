import { Body, Controller, Del, Get, Inject, Param, Post, Put } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeService } from '../service/exchange.service.js';
import { StrategyOrderService } from '../service/strategy-order.service.js';
import { StrategyService } from '../service/strategy.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import {
  CreateStrategyOrderBodyDTO,
  StrategyOrderIdParamDTO,
  UpdateStrategyOrderBodyDTO,
} from '../dto/strategy-order.dto.js';

@Controller('/api/v1/strategy-order')
export class StrategyOrderController {
  @Inject()
  ctx!: Context;

  @Inject()
  strategyService!: StrategyService;

  @Inject()
  exchangeService!: ExchangeService;

  @Inject()
  strategyOrderService!: StrategyOrderService;

  @Inject()
  userService!: UserService;

  private async getUserid(): Promise<number> {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx);
    return user.id;
  }

  private toStrategyOrderRead(order: any) {
    return {
      id: order.id,
      user_id: order.userid,
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
    const userid = await this.getUserid();
    const orders = await this.strategyOrderService.listForUser(userid);
    return apiOk(orders.map(o => this.toStrategyOrderRead(o)));
  }

  @Post('/')
  async create(
    @Body() body: CreateStrategyOrderBodyDTO
  ) {
    const userid = await this.getUserid();
    await this.strategyService.get(userid, body.strategy_id);
    await this.exchangeService.get(userid, body.exchange_id);

    const order = await this.strategyOrderService.create({
      userid,
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
  async get(@Param() params: StrategyOrderIdParamDTO) {
    const userid = await this.getUserid();
    const order = await this.strategyOrderService.get(userid, params.id);
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Put('/:id')
  async update(
    @Param() params: StrategyOrderIdParamDTO,
    @Body() body: UpdateStrategyOrderBodyDTO
  ) {
    const userid = await this.getUserid();
    const order = await this.strategyOrderService.update(userid, params.id, {
      symbols: body?.symbols ?? undefined,
      parameters: body?.parameters ?? undefined,
      riskConfig: body?.risk_config ?? undefined,
      live: body?.live ?? undefined,
    });
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Del('/:id')
  async remove(@Param() params: StrategyOrderIdParamDTO) {
    const userid = await this.getUserid();
    await this.strategyOrderService.delete(userid, params.id);
    return apiOk(null);
  }

  @Post('/:id/start')
  async start(@Param() params: StrategyOrderIdParamDTO) {
    const userid = await this.getUserid();
    const order = await this.strategyOrderService.start(userid, params.id);
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Post('/:id/stop')
  async stop(@Param() params: StrategyOrderIdParamDTO) {
    const userid = await this.getUserid();
    const order = await this.strategyOrderService.stop(userid, params.id);
    return apiOk(this.toStrategyOrderRead(order));
  }

  @Get('/:id/stats')
  async stats(@Param() params: StrategyOrderIdParamDTO) {
    return apiOk({ id: params.id, stats: {} });
  }
}
