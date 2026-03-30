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

  @Rule(Joi.string().trim().valid('spot', 'futures', 'swap').default('spot'))
  tradeType?: string;

  @Rule(Joi.string().trim().valid('limit', 'market', 'algo').default('limit'))
  orderType?: string;

  @Rule(Joi.number().integer().min(1).max(125).optional())
  leverage?: number;

  @Rule(Joi.array().items(Joi.string().trim().min(1)).required())
  symbols!: string[];

  @Rule(Joi.object().unknown(true).allow(null).optional())
  riskConfig?: Record<string, unknown> | null;

  @Rule(Joi.number().min(-50).max(50).allow(null).optional())
  buyPriceOffsetPercent?: number | null;

  @Rule(Joi.number().min(-50).max(50).allow(null).optional())
  sellPriceOffsetPercent?: number | null;

  @Rule(Joi.number().min(0.1).max(100).allow(null).optional())
  stopLossPercent?: number | null;

  @Rule(Joi.number().min(0.1).max(1000).allow(null).optional())
  takeProfitPercent?: number | null;

  // spot 金额
  @Rule(Joi.number().min(0).allow(null).optional())
  amountBuy?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountSell?: number | null;

  // futures 金额
  @Rule(Joi.number().min(0).allow(null).optional())
  amountBuyLong?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountSellLong?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountBuyShort?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountSellShort?: number | null;

  @Rule(Joi.boolean().allow(null).optional())
  live?: boolean | null;
}

export class UpdateStrategyOrderBodyDTO {
  @Rule(Joi.number().integer().positive().allow(null).optional())
  strategyId?: number | null;

  @Rule(Joi.array().items(Joi.string().trim().min(1)).allow(null).optional())
  symbols?: string[] | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  riskConfig?: Record<string, unknown> | null;

  @Rule(Joi.string().trim().valid('limit', 'market', 'algo').allow(null).optional())
  orderType?: string | null;

  @Rule(Joi.number().integer().min(1).max(125).allow(null).optional())
  leverage?: number | null;

  @Rule(Joi.number().min(-50).max(50).allow(null).optional())
  buyPriceOffsetPercent?: number | null;

  @Rule(Joi.number().min(-50).max(50).allow(null).optional())
  sellPriceOffsetPercent?: number | null;

  @Rule(Joi.number().min(0.1).max(100).allow(null).optional())
  stopLossPercent?: number | null;

  @Rule(Joi.number().min(0.1).max(1000).allow(null).optional())
  takeProfitPercent?: number | null;

  // spot 金额
  @Rule(Joi.number().min(0).allow(null).optional())
  amountBuy?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountSell?: number | null;

  // futures 金额
  @Rule(Joi.number().min(0).allow(null).optional())
  amountBuyLong?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountSellLong?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountBuyShort?: number | null;

  @Rule(Joi.number().min(0).allow(null).optional())
  amountSellShort?: number | null;

  @Rule(Joi.boolean().allow(null).optional())
  live?: boolean | null;
}
