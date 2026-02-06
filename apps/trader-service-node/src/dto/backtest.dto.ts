import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class BacktestIdParamDTO {
  @Rule(Joi.number().integer().positive().required())
  id!: number;
}

export class RunBacktestBodyDTO {
  @Rule(Joi.string().trim().min(1).required())
  strategy_id!: string;

  @Rule(Joi.string().trim().min(1).required())
  symbol!: string;

  @Rule(Joi.string().trim().min(1).required())
  start_date!: string;

  @Rule(Joi.string().trim().min(1).required())
  end_date!: string;

  @Rule(Joi.number().required().strict())
  initial_capital!: number;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  parameters?: Record<string, unknown> | null;
}
