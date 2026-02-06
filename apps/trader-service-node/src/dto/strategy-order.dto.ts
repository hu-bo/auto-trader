import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class StrategyOrderIdParamDTO {
  @Rule(Joi.number().integer().positive().required())
  id!: number;
}

export class CreateStrategyOrderBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  strategy_id!: number;

  @Rule(Joi.number().integer().positive().required())
  exchange_id!: number;

  @Rule(Joi.array().items(Joi.string().trim().min(1)).required())
  symbols!: string[];

  @Rule(Joi.object().unknown(true).allow(null).optional())
  parameters?: Record<string, unknown> | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  risk_config?: Record<string, unknown> | null;

  @Rule(Joi.boolean().allow(null).optional())
  live?: boolean | null;
}

export class UpdateStrategyOrderBodyDTO {
  @Rule(Joi.array().items(Joi.string().trim().min(1)).allow(null).optional())
  symbols?: string[] | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  parameters?: Record<string, unknown> | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  risk_config?: Record<string, unknown> | null;

  @Rule(Joi.boolean().allow(null).optional())
  live?: boolean | null;
}
