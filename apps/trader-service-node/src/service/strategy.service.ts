import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { Strategy } from '../entity/strategy.entity.js';

type StrategyCreateParams = {
  userId: string;
  name: string;
  description?: string;
  tag?: string;
  code?: string;
  params?: Record<string, unknown>;
  version?: string;
  status?: string;
  isPublic: boolean;
};

type StrategyUpdateParams = {
  name?: string | null;
  description?: string | null;
  tag?: string | null;
  code?: string | null;
  params?: Record<string, unknown> | null;
  version?: string | null;
  status?: string | null;
  isPublic?: boolean | null;
};

@Provide()
export class StrategyService {
  @InjectEntityModel(Strategy)
  strategyRepo?: Repository<Strategy>;

  private requireRepo(): Repository<Strategy> {
    if (!this.strategyRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.strategyRepo;
  }

  async listForUser(userId: string): Promise<Strategy[]> {
    const repo = this.requireRepo();
    return repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async listAvailable(userId: string): Promise<Strategy[]> {
    const repo = this.requireRepo();
    return repo
      .createQueryBuilder('strategy')
      .where('strategy.isPublic = :isPublic', { isPublic: true })
      .orWhere('strategy.userId = :userId', { userId })
      .orderBy('strategy.createdAt', 'DESC')
      .getMany();
  }

  async create(params: StrategyCreateParams): Promise<Strategy> {
    const repo = this.requireRepo();
    const strategy = repo.create({
      userId: params.userId,
      name: params.name,
      description: params.description ?? '',
      tag: params.tag ?? 'neutral',
      code: params.code ?? '',
      params: params.params ?? {},
      version: params.version ?? 'v1',
      status: params.status ?? 'inactive',
      isPublic: params.isPublic,
    });
    return await repo.save(strategy);
  }

  async get(userId: string, strategyId: string): Promise<Strategy> {
    const repo = this.requireRepo();
    const strategy = await repo.findOne({ where: { id: strategyId } });
    if (!strategy) {
      throw new httpError.NotFoundError('Strategy not found');
    }
    if (strategy.userId !== userId && !strategy.isPublic) {
      throw new httpError.NotFoundError('Strategy not found');
    }
    return strategy;
  }

  async update(userId: string, strategyId: string, patch: StrategyUpdateParams): Promise<Strategy> {
    const repo = this.requireRepo();
    const strategy = await repo.findOne({ where: { id: strategyId } });
    if (!strategy || strategy.userId !== userId) {
      throw new httpError.NotFoundError('Strategy not found');
    }

    if (patch.name !== undefined && patch.name !== null) strategy.name = patch.name;
    if (patch.description !== undefined && patch.description !== null) strategy.description = patch.description;
    if (patch.tag !== undefined && patch.tag !== null) strategy.tag = patch.tag;
    if (patch.code !== undefined && patch.code !== null) strategy.code = patch.code;
    if (patch.params !== undefined && patch.params !== null) strategy.params = patch.params;
    if (patch.version !== undefined && patch.version !== null) strategy.version = patch.version;
    if (patch.status !== undefined && patch.status !== null) strategy.status = patch.status;
    if (patch.isPublic !== undefined && patch.isPublic !== null) strategy.isPublic = patch.isPublic;

    return await repo.save(strategy);
  }

  async delete(userId: string, strategyId: string): Promise<void> {
    const repo = this.requireRepo();
    const strategy = await repo.findOne({ where: { id: strategyId } });
    if (!strategy || strategy.userId !== userId) {
      throw new httpError.NotFoundError('Strategy not found');
    }
    await repo.remove(strategy);
  }
}

