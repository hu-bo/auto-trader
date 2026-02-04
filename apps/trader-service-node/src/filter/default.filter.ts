import { Catch, MidwayHttpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { apiFail } from '../util/api-response.js';

@Catch()
export class DefaultErrorFilter {
  async catch(err: unknown, ctx: Context) {
    const status = err instanceof MidwayHttpError ? err.status : 500;
    const message =
      err instanceof Error ? err.message : status === 500 ? 'Internal Server Error' : String(err);

    ctx.status = status;
    ctx.logger.error(err);
    return apiFail(message);
  }
}
