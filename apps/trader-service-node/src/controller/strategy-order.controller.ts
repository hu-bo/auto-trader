import { Body, Controller, Del, Get, Inject, Param, Post, Put, Query } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { ExchangeService } from '../service/exchange.service.js';
import { StrategyOrderService } from '../service/strategy-order.service.js';
import { StrategyService } from '../service/strategy.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import {
  CreateStrategyOrderBodyDTO,
  ListStrategyOrderQueryDTO,
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
    const user = await this.userService.getOrCreateCurrentUser(this.ctx.state.user);
    return user.id;
  }

  private toStrategyOrderRead(order: any) {
    return {
      id: order.id,
      user_id: order.userid,
      strategy_id: order.strategyId,
      strategy_name: order.strategy?.name || '',
      strategy_params: order.strategy?.params ?? {},
      exchange_id: order.exchangeId,
      exchange_name: order.exchange?.name || '',
      exchange_type: order.exchange?.exchangeType || '',
      trade_type: order.tradeType,
      symbols: order.symbols ?? [],
      risk_config: this.strategyOrderService.riskConfigToDict(order.riskConfig),
      live: order.live,
      is_running: order.isRunning,
      started_at: order.startedAt,
      stopped_at: order.stoppedAt,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    };
  }

  @Get('/')
  async list(@Query() query: ListStrategyOrderQueryDTO) {
    const userid = await this.getUserid();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { data, total } = await this.strategyOrderService.listForUser(userid, page, pageSize);
    return apiOk({
      data: data.map(o => this.toStrategyOrderRead(o)),
      total,
      page,
      pageSize,
    });
  }

  @Post('/')
  async create(
    @Body() body: CreateStrategyOrderBodyDTO
  ) {
    const userid = await this.getUserid();
    await this.strategyService.get(userid, body.strategyId);
    await this.exchangeService.get(userid, body.exchangeId);

    const order = await this.strategyOrderService.create({
      userid,
      strategyId: body.strategyId,
      exchangeId: body.exchangeId,
      tradeType: body.tradeType,
      symbols: body.symbols,
      riskConfig: body.riskConfig ?? {},
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
      strategyId: body?.strategyId ?? undefined,
      symbols: body?.symbols ?? undefined,
      riskConfig: body?.riskConfig ?? undefined,
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
