import { Rule } from '@midwayjs/validation';
import * as Joi from 'joi';

export class UpdateMeBodyDTO {
  @Rule(Joi.string().allow('', null).optional())
  displayName?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  username?: string | null;
}
