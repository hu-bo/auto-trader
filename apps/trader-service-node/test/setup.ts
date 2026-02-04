import { createApp, close } from '@midwayjs/mock';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Application } from '@midwayjs/koa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let app: Application;
export async function mochaGlobalSetup() {
  // create app
  app = (await createApp({
    appDir: join(__dirname, '../'),
  })) as unknown as Application;
}

export async function mochaGlobalTeardown() {
  await close(app);
};

export function getApp(): Application {
  return app;
}
