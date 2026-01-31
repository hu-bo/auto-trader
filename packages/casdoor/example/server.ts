/**
 * 服务端使用示例 - Express
 */

import { createCasdoorServer, createExpressAuthMiddleware } from '@hquant/casdoor/server';

// 1. 初始化服务端 SDK
const casdoor = createCasdoorServer({
  endpoint: 'https://auth.example.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  orgName: 'your-org',
  appName: 'your-app',
  certificate: `-----BEGIN CERTIFICATE-----
YOUR CERTIFICATE HERE
-----END CERTIFICATE-----`,
});

// 2. 创建 Express 中间件
const authMiddleware = createExpressAuthMiddleware(casdoor);

// 3. 使用中间件保护路由
// app.use('/api', authMiddleware);

// 4. Token 交换接口 (供前端调用)
async function exchangeToken(code: string) {
  const token = await casdoor.getToken(code);
  const claims = casdoor.parseJwtToken(token.access_token);
  const user = await casdoor.getUser(claims.name || claims.sub);
  return { token, user };
}

// 5. 刷新 Token 接口
async function refreshUserToken(refreshToken: string) {
  return await casdoor.refreshToken(refreshToken);
}

// 6. 直接验证 Token
async function verifyUserToken(token: string) {
  const result = await casdoor.verifyToken(token);
  if (result.valid) {
    console.log('User:', result.user?.name);
    console.log('Claims:', result.claims);
  } else {
    console.error('Invalid token:', result.error);
  }
  return result;
}

export { casdoor, exchangeToken, refreshUserToken, verifyUserToken };
