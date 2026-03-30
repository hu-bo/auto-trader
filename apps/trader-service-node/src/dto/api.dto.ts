import { Rule } from '@midwayjs/validation';
import * as Joi from 'joi';

export class GetUserQueryDTO {
  @Rule(Joi.number().integer().min(0).optional())
  uid?: number;
}
