import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class PositionIdParamDTO {
  @Rule(Joi.string().trim().min(1).required())
  positionId!: string;
}

export class PositionTokenQueryDTO {
  @Rule(Joi.string().trim().min(1).optional())
  symbol?: string;
}

export class SyncPositionsQueryDTO {
  // No parameters needed
}

export class ClosePositionBodyDTO {
  @Rule(Joi.string().trim().min(1).allow(null).optional())
  orderType?: string | null;

  @Rule(Joi.number().allow(null).optional().strict())
  price?: number | null;

  @Rule(Joi.string().allow('', null).optional())
  clientOrderId?: string | null;
}
