/**
 * Vue 使用示例
 */

// ============ main.ts ============
import { initCasdoor } from '@hquant/casdoor/client/vue';

// 应用入口初始化
initCasdoor({
  endpoint: 'https://auth.example.com',
  clientId: 'your-client-id',
  orgName: 'your-org',
  appName: 'your-app',
  redirectUri: 'http://localhost:3000/callback',
  logoutRedirectUri: 'http://localhost:3000',
  storage: {
    type: 'localStorage',
    prefix: 'myapp_',
  },
  silentRefresh: true,
  refreshBeforeExpiry: 60,
});

// ============ 登录按钮组件 ============
// LoginButton.vue
/*
<script setup lang="ts">
import { useCasdoor } from '@hquant/casdoor/client';

const { isAuthenticated, isLoading, user, login, logout } = useCasdoor();
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isAuthenticated">
    <span>Welcome, {{ user?.displayName }}</span>
    <button @click="logout">Logout</button>
  </div>
  <button v-else @click="login">Login</button>
</template>
*/

// ============ 回调页面 ============
// Callback.vue
/*
<script setup lang="ts">
import { useCasdoorCallback } from '@hquant/casdoor/client';
import { useRouter } from 'vue-router';

const router = useRouter();

// 定义服务端 Token 交换函数
async function serverExchangeToken(code: string) {
  const response = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return response.json();
}

const { isLoading, success, error } = useCasdoorCallback(serverExchangeToken, {
  onSuccess: (user) => {
    console.log('Login successful:', user.name);
    router.push('/dashboard');
  },
  onError: (err) => {
    console.error('Login failed:', err);
    router.push('/login?error=' + err.message);
  },
});
</script>

<template>
  <div v-if="isLoading">Processing login...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else-if="success">Login successful! Redirecting...</div>
</template>
*/

// ============ 路由守卫 ============
// router/index.ts
/*
import { getCasdoorClient } from '@hquant/casdoor/client';

router.beforeEach((to, from, next) => {
  const client = getCasdoorClient();

  if (to.meta.requiresAuth && !client.isAuthenticated()) {
    client.login();
    return;
  }

  next();
});
*/

// ============ API 请求拦截器 ============
// api/index.ts
/*
import { getCasdoorClient } from '@hquant/casdoor/client';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const client = getCasdoorClient();
  const token = client.getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
*/

export {};
