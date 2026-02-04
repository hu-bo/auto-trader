import { createHttpRequest } from '@midwayjs/mock';
import { Application } from '@midwayjs/koa';
import assert from 'assert';
import { getApp } from '../setup.js';

describe('test/controller/stats.test.ts', () => {
  it('should GET /api/v1/stats', async () => {
    const app: Application = getApp();
    const result = await createHttpRequest(app).get('/api/v1/stats');

    assert(result.status === 200);
    assert(result.body.success === true);
    assert(result.body.message === 'OK');
    assert.deepStrictEqual(result.body.data, {});
  });
});

