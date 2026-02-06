import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class AuthCallbackQueryDTO {
  @Rule(Joi.string().trim().min(1).required())
  code!: string;
}
