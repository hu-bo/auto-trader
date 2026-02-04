import type { Context } from '@midwayjs/koa';

export type CurrentUser = {
  userId: string;
  username: string;
};

const firstNonEmpty = (...values: Array<string | undefined | null>): string | null => {
  for (const v of values) {
    const s = (v ?? '').trim();
    if (s) return s;
  }
  return null;
};

export function getCurrentUser(ctx: Context): CurrentUser {
  const query = (ctx.query ?? {}) as Record<string, string | undefined>;

  const userId =
    firstNonEmpty(ctx.get('x-user-id'), ctx.get('x-userid'), query.user_id, query.userId) ?? 'dev-user';
  const username =
    firstNonEmpty(ctx.get('x-username'), query.username, query.user_name, query.userName) ?? userId;

  return { userId, username };
}

