import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class StrategyOrderIdParamDTO {
  @Rule(Joi.number().integer().positive().required())
  id!: number;
}

export class ListStrategyOrderQueryDTO {
  @Rule(Joi.number().integer().min(1).default(1))
  page?: number;

  @Rule(Joi.number().integer().min(1).max(100).default(20))
  pageSize?: number;
}

export class CreateStrategyOrderBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  strategyId!: number;

  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;

  @Rule(Joi.array().items(Joi.string().trim().min(1)).required())
  symbols!: string[];

  @Rule(Joi.object().unknown(true).allow(null).optional())
  parameters?: Record<string, unknown> | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  riskConfig?: Record<string, unknown> | null;

  @Rule(Joi.boolean().allow(null).optional())
  live?: boolean | null;
}

export class UpdateStrategyOrderBodyDTO {
  @Rule(Joi.array().items(Joi.string().trim().min(1)).allow(null).optional())
  symbols?: string[] | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  parameters?: Record<string, unknown> | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  riskConfig?: Record<string, unknown> | null;

  @Rule(Joi.boolean().allow(null).optional())
  live?: boolean | null;
}
