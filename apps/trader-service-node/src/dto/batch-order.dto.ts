import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class PlaceBatchStrategyOrderBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;

  @Rule(Joi.string().trim().valid('futures', 'spot', 'usdm-algo').required())
  tradeType!: string;

  @Rule(Joi.array().items(Joi.string().trim().min(1)).min(1).required())
  symbols!: string[];

  @Rule(Joi.string().trim().valid('buy_long', 'sell_short').required())
  direction!: string;

  @Rule(Joi.number().positive().required())
  amountUSDT!: number;

  @Rule(Joi.number().min(-50).max(50).required())
  priceOffsetPercent!: number;

  @Rule(Joi.number().min(0.1).max(100).required())
  stopLossPercent!: number;

  @Rule(Joi.number().min(0.1).max(1000).required())
  takeProfitPercent!: number;
}

export class CheckDuplicatesBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;

  @Rule(Joi.string().trim().valid('futures', 'spot', 'usdm-algo').required())
  tradeType!: string;
}
