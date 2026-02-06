import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class StrategyIdParamDTO {
  @Rule(Joi.number().integer().positive().required())
  id!: number;
}

export class CreateStrategyBodyDTO {
  @Rule(Joi.string().trim().min(1).required())
  name!: string;

  @Rule(Joi.string().allow('', null).optional())
  description?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  tag?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  code?: string | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  params?: Record<string, unknown> | null;

  @Rule(Joi.string().allow('', null).optional())
  version?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  status?: string | null;

  @Rule(Joi.boolean().allow(null).optional())
  isPublic?: boolean | null;
}

export class UpdateStrategyBodyDTO {
  @Rule(Joi.string().allow('', null).optional())
  name?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  description?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  tag?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  code?: string | null;

  @Rule(Joi.object().unknown(true).allow(null).optional())
  params?: Record<string, unknown> | null;

  @Rule(Joi.string().allow('', null).optional())
  version?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  status?: string | null;

  @Rule(Joi.boolean().allow(null).optional())
  isPublic?: boolean | null;
}
