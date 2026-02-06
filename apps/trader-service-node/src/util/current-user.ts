import type { Context } from '@midwayjs/koa';

export type CurrentUser = {
  userId: string;
  username: string;
  isAdmin: boolean;
};

const firstNonEmpty = (...values: Array<string | undefined | null>): string | null => {
  for (const v of values) {
    const s = (v ?? '').trim();
    if (s) return s;
  }
  return null;
};

export function getCurrentUser(ctx: Context): CurrentUser {
  const stateUser = (ctx.state as any)?.user as any;
  if (stateUser && typeof stateUser.id === 'string' && stateUser.id.trim()) {
    const userId = stateUser.id.trim();
    const username = String(stateUser.name ?? stateUser.displayName ?? userId).trim() || userId;
    const isAdmin = Boolean(stateUser.isAdmin || stateUser.isGlobalAdmin);
    return { userId, username, isAdmin };
  }

  const query = (ctx.query ?? {}) as Record<string, string | undefined>;

  const userId =
    firstNonEmpty(ctx.get('x-user-id'), ctx.get('x-userid'), query.user_id, query.userId) ?? 'dev-user';
  const username =
    firstNonEmpty(ctx.get('x-username'), query.username, query.user_name, query.userName) ?? userId;

  return { userId, username, isAdmin: true };
}
