import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class ExchangeIdParamDTO {
  @Rule(Joi.number().integer().positive().required())
  id!: number;
}

export class CreateExchangeBodyDTO {
  @Rule(Joi.string().trim().min(1).required())
  exchangeType!: string;

  @Rule(Joi.string().trim().min(1).required())
  name!: string;

  @Rule(Joi.string().trim().min(1).required())
  apiKey!: string;

  @Rule(Joi.string().trim().min(1).required())
  apiSecret!: string;

  @Rule(Joi.string().allow('', null).optional())
  passphrase?: string | null;

  @Rule(Joi.boolean().allow(null).optional())
  isTestnet?: boolean | null;

  @Rule(Joi.boolean().allow(null).optional())
  isActive?: boolean | null;
}

export class UpdateExchangeBodyDTO {
  @Rule(Joi.string().allow('', null).optional())
  name?: string | null;

  @Rule(Joi.string().trim().min(1).required())
  exchangeType!: string;
  
  @Rule(Joi.string().allow('', null).optional())
  apiKey?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  apiSecret?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  passphrase?: string | null;

  @Rule(Joi.boolean().allow(null).optional())
  isTestnet?: boolean | null;

  @Rule(Joi.boolean().allow(null).optional())
  isActive?: boolean | null;
}
