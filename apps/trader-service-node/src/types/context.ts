import type { CasdoorUser } from '@hquant/casdoor/server';

/**
 * 扩展 Koa Context 的 state.user 类型
 */
export type StateUser = CasdoorUser;

declare module '@midwayjs/koa' {
  interface State {
    user: StateUser;
  }
}
