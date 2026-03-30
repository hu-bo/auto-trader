import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

const riskConfigFieldSchema = Joi.object({
  maxPositionSize: Joi.number().positive().allow(null).optional(),
  maxDailyLoss: Joi.number().positive().allow(null).optional(),
  maxDrawdown: Joi.number().min(0).allow(null).optional(),
  stopLossPercent: Joi.number().min(0).allow(null).optional(),
  takeProfitPercent: Joi.number().min(0).allow(null).optional(),
  maxLeverage: Joi.number().integer().min(1).allow(null).optional(),
}).unknown(false);

export class RiskConfigIdParamDTO {
  @Rule(Joi.number().integer().positive().required())
  id!: number;
}

export class CreateRiskConfigBodyDTO {
  @Rule(Joi.string().trim().min(1).max(128).required())
  name!: string;

  @Rule(riskConfigFieldSchema.required())
  riskConfig!: Record<string, unknown>;
}

export class UpdateRiskConfigBodyDTO {
  @Rule(Joi.string().trim().min(1).max(128).allow(null).optional())
  name?: string | null;

  @Rule(riskConfigFieldSchema.allow(null).optional())
  riskConfig?: Record<string, unknown> | null;
}
