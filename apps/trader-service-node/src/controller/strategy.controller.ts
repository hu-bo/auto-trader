import { Body, Controller, Del, Get, Inject, Param, Post, Put, httpError } from '@midwayjs/core';
import type { Context } from '@midwayjs/koa';
import { StrategyService } from '../service/strategy.service.js';
import { UserService } from '../service/user.service.js';
import { apiOk } from '../util/api-response.js';
import { getCurrentUser } from '../util/current-user.js';

@Controller('/api/v1/strategies')
export class StrategyController {
  @Inject()
  ctx!: Context;

  @Inject()
  userService!: UserService;

  @Inject()
  strategyService!: StrategyService;

  private async ensureUser() {
    const currentUser = getCurrentUser(this.ctx);
    await this.userService.getOrCreate({ userId: currentUser.userId, username: currentUser.username });
    return currentUser;
  }

  private toStrategyRead(strategy: any) {
    return {
      id: strategy.id,
      user_id: strategy.userId,
      name: strategy.name,
      description: strategy.description,
      tag: strategy.tag,
      code: strategy.code,
      params: strategy.params ?? {},
      version: strategy.version,
      status: strategy.status,
      is_public: strategy.isPublic,
      created_at: strategy.createdAt,
      updated_at: strategy.updatedAt,
    };
  }

  @Get('/')
  async list() {
    const currentUser = await this.ensureUser();
    const strategies = await this.strategyService.listForUser(currentUser.userId);
    return apiOk(strategies.map(s => this.toStrategyRead(s)));
  }

  @Get('/available')
  async available() {
    const currentUser = await this.ensureUser();
    const strategies = await this.strategyService.listAvailable(currentUser.userId);
    return apiOk(strategies.map(s => this.toStrategyRead(s)));
  }

  @Post('/')
  async create(
    @Body()
    body: {
      name: string;
      description?: string;
      tag?: string;
      code?: string;
      params?: Record<string, unknown>;
      version?: string;
      status?: string;
    }
  ) {
    if (!body?.name) throw new httpError.BadRequestError('name is required');

    const currentUser = await this.ensureUser();
    const strategy = await this.strategyService.create({
      userId: currentUser.userId,
      name: body.name,
      description: body.description ?? '',
      tag: body.tag ?? 'neutral',
      code: body.code ?? '',
      params: body.params ?? {},
      version: body.version ?? 'v1',
      status: body.status ?? 'inactive',
      isPublic: true,
    });
    return apiOk(this.toStrategyRead(strategy));
  }

  @Get('/:id')
  async get(@Param('id') id: string) {
    const currentUser = await this.ensureUser();
    const strategy = await this.strategyService.get(currentUser.userId, id);
    return apiOk(this.toStrategyRead(strategy));
  }

  @Put('/:id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string | null;
      description?: string | null;
      tag?: string | null;
      code?: string | null;
      params?: Record<string, unknown> | null;
      version?: string | null;
      status?: string | null;
      is_public?: boolean | null;
    }
  ) {
    const currentUser = await this.ensureUser();
    const strategy = await this.strategyService.update(currentUser.userId, id, {
      name: body?.name ?? undefined,
      description: body?.description ?? undefined,
      tag: body?.tag ?? undefined,
      code: body?.code ?? undefined,
      params: body?.params ?? undefined,
      version: body?.version ?? undefined,
      status: body?.status ?? undefined,
      isPublic: body?.is_public ?? undefined,
    });
    return apiOk(this.toStrategyRead(strategy));
  }

  @Del('/:id')
  async remove(@Param('id') id: string) {
    const currentUser = await this.ensureUser();
    await this.strategyService.delete(currentUser.userId, id);
    return apiOk(null);
  }
}
