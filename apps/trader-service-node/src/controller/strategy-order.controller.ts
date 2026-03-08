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

  @Get('/')
  async list(@Query() query: ListStrategyOrderQueryDTO) {
    const userid = await this.getUserid();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { data, total } = await this.strategyOrderService.listForUser(userid, page, pageSize);
    return apiOk({
      data: data.map(o => this.strategyOrderService.toJson(o)),
      total,
      page,
      pageSize,
    });
  }

  @Post('/')
  async create(@Body() body: CreateStrategyOrderBodyDTO) {
    const userid = await this.getUserid();
    await this.strategyService.get(userid, body.strategyId);
    await this.exchangeService.get(userid, body.exchangeId);

    const order = await this.strategyOrderService.create({
      userid,
      strategyId: body.strategyId,
      exchangeId: body.exchangeId,
      tradeType: body.tradeType,
      orderType: body.orderType,
      leverage: body.leverage ?? undefined,
      symbols: body.symbols,
      riskConfig: body.riskConfig ?? {},
      buyPriceOffsetPercent: body.buyPriceOffsetPercent ?? undefined,
      sellPriceOffsetPercent: body.sellPriceOffsetPercent ?? undefined,
      stopLossPercent: body.stopLossPercent ?? undefined,
      takeProfitPercent: body.takeProfitPercent ?? undefined,
      amountBuy: body.amountBuy ?? 0,
      amountSell: body.amountSell ?? 0,
      amountBuyLong: body.amountBuyLong ?? 0,
      amountSellLong: body.amountSellLong ?? 0,
      amountBuyShort: body.amountBuyShort ?? 0,
      amountSellShort: body.amountSellShort ?? 0,
      live: body.live ?? false,
    });
    return apiOk(this.strategyOrderService.toJson(order));
  }

  @Get('/:id')
  async get(@Param() params: StrategyOrderIdParamDTO) {
    const userid = await this.getUserid();
    const order = await this.strategyOrderService.get(userid, params.id);
    return apiOk(this.strategyOrderService.toJson(order));
  }

  @Put('/:id')
  async update(@Param() params: StrategyOrderIdParamDTO, @Body() body: UpdateStrategyOrderBodyDTO) {
    const userid = await this.getUserid();
    const order = await this.strategyOrderService.update(userid, params.id, {
      strategyId: body?.strategyId ?? undefined,
      symbols: body?.symbols ?? undefined,
      riskConfig: body?.riskConfig ?? undefined,
      orderType: body?.orderType ?? undefined,
      leverage: body?.leverage ?? undefined,
      buyPriceOffsetPercent: body?.buyPriceOffsetPercent ?? undefined,
      sellPriceOffsetPercent: body?.sellPriceOffsetPercent ?? undefined,
      stopLossPercent: body?.stopLossPercent ?? undefined,
      takeProfitPercent: body?.takeProfitPercent ?? undefined,
      amountBuy: body?.amountBuy ?? undefined,
      amountSell: body?.amountSell ?? undefined,
      amountBuyLong: body?.amountBuyLong ?? undefined,
      amountSellLong: body?.amountSellLong ?? undefined,
      amountBuyShort: body?.amountBuyShort ?? undefined,
      amountSellShort: body?.amountSellShort ?? undefined,
      live: body?.live ?? undefined,
    });
    return apiOk(this.strategyOrderService.toJson(order));
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
    return apiOk(this.strategyOrderService.toJson(order));
  }

  @Post('/:id/stop')
  async stop(@Param() params: StrategyOrderIdParamDTO) {
    const userid = await this.getUserid();
    const order = await this.strategyOrderService.stop(userid, params.id);
    return apiOk(this.strategyOrderService.toJson(order));
  }

  @Get('/:id/stats')
  async stats(@Param() params: StrategyOrderIdParamDTO) {
    return apiOk({ id: params.id, stats: {} });
  }
}
