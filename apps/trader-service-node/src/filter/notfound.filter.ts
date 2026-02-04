import { Catch, httpError, MidwayHttpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { apiFail } from '../util/api-response.js';

@Catch(httpError.NotFoundError)
export class NotFoundFilter {
  async catch(err: MidwayHttpError, ctx: Context) {
    ctx.status = 404;
    ctx.logger.warn(err);
    return apiFail('Not Found');
  }
}
