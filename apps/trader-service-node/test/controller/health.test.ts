import { createHttpRequest } from '@midwayjs/mock';
import { Application } from '@midwayjs/koa';
import assert from 'assert';
import { getApp } from '../setup.js';

describe('test/controller/health.test.ts', () => {
  it('should GET /health', async () => {
    const app: Application = getApp();
    const result = await createHttpRequest(app).get('/health');

    assert(result.status === 200);
    assert(result.body.success === true);
    assert(result.body.message === 'OK');
    assert(result.body.data?.status === 'ok');
  });
});

