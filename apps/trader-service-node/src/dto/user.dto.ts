import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class UpdateMeBodyDTO {
  @Rule(Joi.string().allow('', null).optional())
  displayName?: string | null;

  @Rule(Joi.string().allow('', null).optional())
  username?: string | null;
}
