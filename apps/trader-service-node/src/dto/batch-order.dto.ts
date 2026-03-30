import { Rule } from '@midwayjs/validation';
import * as Joi from 'joi';

export class PlaceBatchStrategyOrderBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;

  @Rule(Joi.string().trim().valid('futures', 'spot', 'usdm-algo').required())
  tradeType!: string;

  @Rule(Joi.string().trim().valid('limit', 'market', 'algo').required())
  orderType!: string;
  
  @Rule(Joi.array().items(Joi.string().trim().min(1)).min(1).required())
  symbols!: string[];

  // leveraged only applies to futures; spot orders may omit
  @Rule(Joi.number().integer().positive().optional())
  leverage?: number;
  
  @Rule(Joi.string().trim().valid('buy', 'sell').required())
  side!: string;

  // optional for futures (usdm-algo) when specifying long vs short position
  @Rule(Joi.string().trim().valid('long', 'short').optional())
  positionSide?: string;

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
