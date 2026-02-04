import { createHttpRequest } from '@midwayjs/mock';
import { Application } from '@midwayjs/koa';
import assert from 'assert';
import { getApp } from '../setup.js';

describe('test/controller/grpc-validation.test.ts', () => {
  it('should require exchange_id or token for /api/v1/orders', async () => {
    const app: Application = getApp();
    const result = await createHttpRequest(app).get('/api/v1/orders');

    assert(result.status === 400);
    assert(result.body.success === false);
  });

  it('should require exchange_id or token for /api/v1/positions', async () => {
    const app: Application = getApp();
    const result = await createHttpRequest(app).get('/api/v1/positions');

    assert(result.status === 400);
    assert(result.body.success === false);
  });

  it('should require exchange_id or token for /api/v1/balance', async () => {
    const app: Application = getApp();
    const result = await createHttpRequest(app).get('/api/v1/balance').query({ trade_type: 'spot' });

    assert(result.status === 400);
    assert(result.body.success === false);
  });
});

