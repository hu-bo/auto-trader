# @hquant/casdoor

Casdoor SDK 封装，支持服务端鉴权和前端 Token 管理。

## 安装

```bash
pnpm add @hquant/casdoor
```

## 服务端使用

```typescript
import { createCasdoorServer, createExpressAuthMiddleware } from '@hquant/casdoor/server';

// 初始化
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

// Express 中间件
const authMiddleware = createExpressAuthMiddleware(casdoor);
app.use('/api', authMiddleware);

// Token 交换 (供前端回调使用)
app.post('/api/auth/token', async (req, res) => {
  const { code } = req.body;
  const token = await casdoor.getToken(code);
  const claims = casdoor.parseJwtToken(token.access_token);
  const user = await casdoor.getUser(claims.name);
  res.json({ token, user });
});
```

## Vue 前端使用

```typescript
// main.ts - 初始化
import { initCasdoor } from '@hquant/casdoor/client';

initCasdoor({
  endpoint: 'https://auth.example.com',
  clientId: 'your-client-id',
  orgName: 'your-org',
  appName: 'your-app',
  redirectUri: 'http://localhost:3000/callback',
});
```

```vue
<!-- LoginButton.vue -->
<script setup lang="ts">
import { useCasdoor } from '@hquant/casdoor/client';

const { isAuthenticated, user, login, logout } = useCasdoor();
</script>

<template>
  <div v-if="isAuthenticated">
    <span>{{ user?.displayName }}</span>
    <button @click="logout">Logout</button>
  </div>
  <button v-else @click="login">Login</button>
</template>
```

## React 前端使用

```tsx
// App.tsx
import { CasdoorProvider } from '@hquant/casdoor/client';

function App() {
  return (
    <CasdoorProvider
      config={{
        endpoint: 'https://auth.example.com',
        clientId: 'your-client-id',
        orgName: 'your-org',
        appName: 'your-app',
        redirectUri: 'http://localhost:3000/callback',
      }}
    >
      <YourApp />
    </CasdoorProvider>
  );
}
```

```tsx
// LoginButton.tsx
import { useCasdoorReact } from '@hquant/casdoor/client';

function LoginButton() {
  const { isAuthenticated, user, login, logout } = useCasdoorReact();

  if (isAuthenticated) {
    return (
      <>
        <span>{user?.displayName}</span>
        <button onClick={logout}>Logout</button>
      </>
    );
  }

  return <button onClick={login}>Login</button>;
}
```

## API

### 服务端

| 方法 | 描述 |
|------|------|
| `createCasdoorServer(config)` | 创建服务端实例 |
| `server.getToken(code)` | 使用授权码获取 Token |
| `server.refreshToken(refreshToken)` | 刷新 Token |
| `server.verifyToken(token)` | 验证 Token |
| `server.getUser(name)` | 获取用户信息 |
| `server.parseJwtToken(token)` | 解析 JWT |
| `createExpressAuthMiddleware(server)` | Express 中间件 |
| `createKoaAuthMiddleware(server)` | Koa 中间件 |

### 客户端

| 方法/Hook | 描述 |
|-----------|------|
| `initCasdoor(config)` | Vue: 初始化客户端 |
| `useCasdoor()` | Vue: 认证 composable |
| `useCasdoorCallback()` | Vue: 回调处理 composable |
| `CasdoorProvider` | React: Provider 组件 |
| `useCasdoorReact()` | React: 认证 hook |
| `useCasdoorCallbackReact()` | React: 回调处理 hook |
| `useRequireAuth()` | React: 路由保护 hook |

## 配置项

```typescript
interface ClientConfig {
  endpoint: string;        // Casdoor 服务地址
  clientId: string;        // 客户端 ID
  orgName: string;         // 组织名称
  appName: string;         // 应用名称
  redirectUri: string;     // 登录回调地址
  logoutRedirectUri?: string;  // 登出回调地址
  storage?: {
    type: 'localStorage' | 'sessionStorage' | 'memory';
    prefix?: string;
  };
  silentRefresh?: boolean; // 自动刷新 Token
  refreshBeforeExpiry?: number; // 过期前刷新时间(秒)
}
```
