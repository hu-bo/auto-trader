import { Body, Controller, Del, Get, Inject, Param, Post, Put } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { StrategyService } from '../service/strategy.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { CreateStrategyBodyDTO, StrategyIdParamDTO, UpdateStrategyBodyDTO } from '../dto/strategy.dto.js';

@Controller('/api/v1/strategies')
export class StrategyController {
  @Inject()
  ctx!: Context;

  @Inject()
  strategyService!: StrategyService;

  @Inject()
  userService!: UserService;

  private async getUserid(): Promise<number> {
    const user = await this.userService.getOrCreateCurrentUser(this.ctx);
    return user.id;
  }

  private toStrategyRead(strategy: any) {
    return {
      id: strategy.id,
      userId: strategy.userid,
      name: strategy.name,
      description: strategy.description,
      tag: strategy.tag,
      code: strategy.code,
      params: strategy.params ?? {},
      version: strategy.version,
      status: strategy.status,
      isPublic: strategy.isPublic,
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt,
    };
  }

  @Get('/')
  async list() {
    const userid = await this.getUserid();
    const strategies = await this.strategyService.listForUser(userid);
    return apiOk(strategies.map(s => this.toStrategyRead(s)));
  }

  @Get('/available')
  async available() {
    const userid = await this.getUserid();
    const strategies = await this.strategyService.listAvailable(userid);
    return apiOk(strategies.map(s => this.toStrategyRead(s)));
  }

  @Post('/')
  async create(
    @Body() body: CreateStrategyBodyDTO
  ) {
    const userid = await this.getUserid();
    const strategy = await this.strategyService.create({
      userid,
      name: body.name,
      description: body.description ?? '',
      tag: body.tag ?? 'neutral',
      code: body.code ?? '',
      params: body.params ?? {},
      version: body.version ?? 'v1',
      status: body.status ?? 'inactive',
      isPublic: body.isPublic ?? true,
    });
    return apiOk(this.toStrategyRead(strategy));
  }

  @Get('/:id')
  async get(@Param() params: StrategyIdParamDTO) {
    const userid = await this.getUserid();
    const strategy = await this.strategyService.get(userid, params.id);
    return apiOk(this.toStrategyRead(strategy));
  }

  @Put('/:id')
  async update(
    @Param() params: StrategyIdParamDTO,
    @Body() body: UpdateStrategyBodyDTO
  ) {
    const userid = await this.getUserid();
    const strategy = await this.strategyService.update(userid, params.id, {
      name: body?.name ?? undefined,
      description: body?.description ?? undefined,
      tag: body?.tag ?? undefined,
      code: body?.code ?? undefined,
      params: body?.params ?? undefined,
      version: body?.version ?? undefined,
      status: body?.status ?? undefined,
      isPublic: body?.isPublic ?? undefined,
    });
    return apiOk(this.toStrategyRead(strategy));
  }

  @Del('/:id')
  async remove(@Param() params: StrategyIdParamDTO) {
    const userid = await this.getUserid();
    await this.strategyService.delete(userid, params.id);
    return apiOk(null);
  }
}
