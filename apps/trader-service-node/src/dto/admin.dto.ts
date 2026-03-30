import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class AdminUserIdParamDTO {
  @Rule(Joi.string().trim().min(1).required())
  id!: string;
}

export class UpdateUserStatusBodyDTO {
  @Rule(Joi.boolean().required().strict())
  isActive!: boolean;
}
