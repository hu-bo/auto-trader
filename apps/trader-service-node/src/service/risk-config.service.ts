import { Provide, httpError } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { IsNull, type Repository } from 'typeorm';
import { RiskConfig } from '../entity/risk-config.entity.js';

type RiskConfigPatch = {
  name?: string | null;
  riskConfig?: Record<string, unknown> | null;
};

@Provide()
export class RiskConfigService {
  @InjectEntityModel(RiskConfig)
  riskConfigRepo?: Repository<RiskConfig>;

  private requireRepo(): Repository<RiskConfig> {
    if (!this.riskConfigRepo) {
      throw new httpError.ServiceUnavailableError('Database not configured');
    }
    return this.riskConfigRepo;
  }

  private toRiskConfigFields(data: Record<string, unknown>): Partial<RiskConfig> {
    const { maxPositionSize, maxDailyLoss, maxDrawdown, stopLossPercent, takeProfitPercent, maxLeverage, ...rest } = data;
    return {
      maxPositionSize: maxPositionSize != null ? String(maxPositionSize) : null,
      maxDailyLoss: maxDailyLoss != null ? String(maxDailyLoss) : null,
      maxDrawdown: maxDrawdown != null ? String(maxDrawdown) : null,
      stopLossPercent: stopLossPercent != null ? String(stopLossPercent) : null,
      takeProfitPercent: takeProfitPercent != null ? String(takeProfitPercent) : null,
      maxLeverage: maxLeverage != null ? Number(maxLeverage) : null,
      extra: Object.keys(rest).length > 0 ? rest : {},
    };
  }

  riskConfigToDict(rc: RiskConfig | null | undefined): Record<string, unknown> {
    if (!rc) return {};
    const result: Record<string, unknown> = {};
    if (rc.maxPositionSize != null) result.maxPositionSize = Number(rc.maxPositionSize);
    if (rc.maxDailyLoss != null) result.maxDailyLoss = Number(rc.maxDailyLoss);
    if (rc.maxDrawdown != null) result.maxDrawdown = Number(rc.maxDrawdown);
    if (rc.stopLossPercent != null) result.stopLossPercent = Number(rc.stopLossPercent);
    if (rc.takeProfitPercent != null) result.takeProfitPercent = Number(rc.takeProfitPercent);
    if (rc.maxLeverage != null) result.maxLeverage = rc.maxLeverage;
    if (rc.extra && Object.keys(rc.extra).length > 0) Object.assign(result, rc.extra);
    return result;
  }

  async listPresets(userid: number): Promise<RiskConfig[]> {
    const repo = this.requireRepo();
    return await repo.find({
      where: { userid, strategyOrderId: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async getPreset(userid: number, id: number): Promise<RiskConfig> {
    const repo = this.requireRepo();
    const item = await repo.findOne({ where: { id, userid, strategyOrderId: IsNull() } });
    if (!item) throw new httpError.NotFoundError('Risk config not found');
    return item;
  }

  async createPreset(userid: number, name: string, riskConfig: Record<string, unknown>): Promise<RiskConfig> {
    const repo = this.requireRepo();
    const entity = repo.create({
      userid,
      name,
      strategyOrderId: null,
      ...this.toRiskConfigFields(riskConfig),
    });
    return await repo.save(entity);
  }

  async updatePreset(userid: number, id: number, patch: RiskConfigPatch): Promise<RiskConfig> {
    const repo = this.requireRepo();
    const entity = await this.getPreset(userid, id);

    if (patch.name !== undefined && patch.name !== null) {
      entity.name = patch.name;
    }

    if (patch.riskConfig !== undefined && patch.riskConfig !== null) {
      Object.assign(entity, this.toRiskConfigFields(patch.riskConfig));
    }

    return await repo.save(entity);
  }

  async deletePreset(userid: number, id: number): Promise<void> {
    const repo = this.requireRepo();
    const entity = await this.getPreset(userid, id);
    await repo.remove(entity);
  }
}
