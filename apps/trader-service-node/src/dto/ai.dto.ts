import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class AIGenerateBodyDTO {
  @Rule(Joi.string().trim().min(1).max(2000).required())
  message!: string;

  @Rule(Joi.string().allow('', null).max(10000).optional())
  codeContext?: string | null;

  @Rule(Joi.string().allow('', null).max(5000).optional())
  systemPrompt?: string | null;
}
