import { createHttpRequest } from '@midwayjs/mock';
import { Application } from '@midwayjs/koa';
import assert from 'assert';
import { getApp } from '../setup.js';

describe('test/controller/not-implemented.test.ts', () => {
  it('should expose auth endpoints (not 501)', async () => {
    const app: Application = getApp();

    const login = await createHttpRequest(app).get('/api/v1/auth/login');
    assert(login.status === 200);
    assert(login.body.success === true);
    assert(typeof login.body.data?.auth_mode === 'string');

    const cb = await createHttpRequest(app).get('/api/v1/auth/callback?code=test-code');
    assert(cb.status === 200);
    assert(cb.body.success === true);
    assert(cb.body.data?.code === 'test-code');
  });
});
