import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import type { Repository } from 'typeorm';
import { Backtest } from '../entity/backtest.entity.js';

type BacktestCreateParams = {
  userid: number;
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: string;
  parameters?: Record<string, unknown> | null;
};

@Provide()
export class BacktestService {
  @InjectEntityModel(Backtest)
  backtestRepo?: Repository<Backtest>;

  private requireRepo(): Repository<Backtest> {
    if (!this.backtestRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.backtestRepo;
  }

  async create(params: BacktestCreateParams): Promise<Backtest> {
    const repo = this.requireRepo();
    const backtest = repo.create({
      userid: params.userid,
      strategyId: params.strategyId,
      symbol: params.symbol,
      startDate: params.startDate,
      endDate: params.endDate,
      initialCapital: params.initialCapital,
      parameters: params.parameters ?? null,
      status: 'pending',
      result: null,
      progress: '0',
      error: null,
    });
    return await repo.save(backtest);
  }

  async listForUser(userid: number): Promise<Backtest[]> {
    const repo = this.requireRepo();
    return repo.find({ where: { userid }, order: { createdAt: 'DESC' } });
  }

  async get(userid: number, backtestId: number): Promise<Backtest> {
    const repo = this.requireRepo();
    const backtest = await repo.findOne({ where: { id: backtestId } });
    if (!backtest || backtest.userid !== userid) {
      throw new httpError.NotFoundError('Backtest not found');
    }
    return backtest;
  }
}
