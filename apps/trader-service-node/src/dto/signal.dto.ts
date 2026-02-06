import { Rule } from '@midwayjs/validation';
import Joi from 'joi';

export class SubscribeSignalDTO {
  @Rule(Joi.string().required())
  exchange!: string;

  @Rule(Joi.string().required())
  tradeType!: string;

  @Rule(Joi.string().required())
  symbol!: string;
}

export class SignalQueryDTO {
  @Rule(Joi.number().integer().min(1).default(1))
  page?: number;

  @Rule(Joi.number().integer().min(1).max(100).default(50))
  limit?: number;
}

export class SignalResponseDTO {
  signalId!: string;
  strategyId!: string;
  strategyName!: string;
  exchange!: string;
  tradeType!: string;
  symbol!: string;
  period!: string;
  action!: string;
  price!: string;
  confidence!: string;
  timestamp!: Date;
  createdAt!: Date;
}
