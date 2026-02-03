import { MidwayConfig } from '@midwayjs/core';
import joi from '@midwayjs/validation-joi';

export default {
  // use for cookie sign key, should change to your own and keep security
  keys: '1770045186872_4259',
  koa: {
    port: 7001,
  },
  validation: {
    validators: {
      joi,
    },
  },
} as MidwayConfig;
