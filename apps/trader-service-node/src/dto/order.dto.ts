import { Rule } from '@midwayjs/validation';
import Joi from 'joi';
import { OrderStatus } from '../entity/order.entity.js';

export class OrderIdParamDTO {
  @Rule(Joi.string().trim().min(1).required())
  orderId!: string;
}

export class OrderTokenQueryDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;
}

export class ListOrdersQueryDTO extends OrderTokenQueryDTO {
  @Rule(Joi.string().trim().min(1).optional())
  symbol?: string;

  @Rule(Joi.string().trim().min(1).optional())
  status?: OrderStatus;

  @Rule(Joi.number().integer().min(0).optional())
  limit?: number;

  @Rule(Joi.number().integer().min(0).optional())
  offset?: number;
}

export class CancelOrderBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;
}

export class PlaceOrderBodyDTO {
  @Rule(Joi.number().integer().positive().required())
  exchangeId!: number;

  @Rule(Joi.string().trim().min(1).required())
  symbol!: string;

  @Rule(Joi.string().trim().min(1).required())
  tradeType!: string;

  @Rule(Joi.string().trim().min(1).required())
  side!: string;

  @Rule(Joi.string().trim().min(1).required())
  orderType!: string;

  @Rule(Joi.number().greater(0).required().strict())
  quantity!: number;

  @Rule(Joi.number().allow(null).optional().strict())
  price?: number | null;

  @Rule(Joi.string().trim().min(1).allow(null).optional())
  positionSide?: string | null;

  @Rule(Joi.number().integer().greater(0).allow(null).optional().strict())
  leverage?: number | null;

  @Rule(Joi.string().allow('', null).optional())
  clientOrderId?: string | null;

  @Rule(Joi.boolean().allow(null).optional().strict())
  reduceOnly?: boolean | null;
}
