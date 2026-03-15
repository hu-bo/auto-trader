import { Catch, httpError, MidwayHttpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { createScopedLogger } from '../common/logger.js';
import { apiFail } from '../util/api-response.js';

const logger = createScopedLogger('NotFoundFilter');

@Catch(httpError.NotFoundError)
export class NotFoundFilter {
  async catch(err: MidwayHttpError, ctx: Context) {
    ctx.status = 404;
    logger.warn(err);
    return apiFail('Not Found');
  }
}
