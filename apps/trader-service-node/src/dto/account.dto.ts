import { Rule } from '@midwayjs/validation';
import * as Joi from 'joi';

export class BalanceQueryDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;

  @Rule(Joi.string().trim().min(1).required())
  tradeType!: string;
}

export class SetLeverageBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;

  @Rule(Joi.string().trim().min(1).required())
  symbol!: string;

  @Rule(Joi.number().integer().greater(0).required().strict())
  leverage!: number;

  @Rule(Joi.string().trim().min(1).required())
  tradeType!: string;

  @Rule(Joi.string().trim().min(1).allow(null).optional())
  positionSide?: string | null;
}
