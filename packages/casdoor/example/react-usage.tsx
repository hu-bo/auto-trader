/**
 * React 使用示例
 */

import React from 'react';
import {
  CasdoorProvider,
  useCasdoor as useCasdoorReact,
  useCasdoorCallbackReact,
  useRequireAuth,
} from '@hquant/casdoor/client';

// ============ App.tsx - Provider 包裹 ============
export function App() {
  return (
    <CasdoorProvider
      config={{
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
      }}
    >
      <Router />
    </CasdoorProvider>
  );
}

// ============ 登录按钮组件 ============
export function LoginButton() {
  const { isAuthenticated, isLoading, user, login, logout } = useCasdoorReact();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    return (
      <div>
        <span>Welcome, {user?.displayName}</span>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return <button onClick={login}>Login</button>;
}

// ============ 回调页面 ============
// 定义服务端 Token 交换函数
async function serverExchangeToken(code: string) {
  const response = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return response.json();
}

export function CallbackPage() {
  const { isLoading, success, error } = useCasdoorCallbackReact(serverExchangeToken, {
    onSuccess: (user) => {
      console.log('Login successful:', user.name);
      window.location.href = '/dashboard';
    },
    onError: (err) => {
      console.error('Login failed:', err);
      window.location.href = '/login?error=' + err.message;
    },
  });

  if (isLoading) {
    return <div>Processing login...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (success) {
    return <div>Login successful! Redirecting...</div>;
  }

  return null;
}

// ============ 需要认证的页面 ============
export function ProtectedPage() {
  const { isAuthenticated, isLoading } = useRequireAuth();
  const { user } = useCasdoorReact();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Redirecting to login...</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Hello, {user?.displayName}</p>
    </div>
  );
}

// ============ 自定义 Hook - API 请求 ============
export function useAuthFetch() {
  const { accessToken } = useCasdoorReact();

  return async (url: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return fetch(url, { ...options, headers });
  };
}

// ============ 使用示例 ============
export function DataComponent() {
  const authFetch = useAuthFetch();
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    authFetch('/api/data')
      .then((res) => res.json())
      .then(setData);
  }, []);

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

// Placeholder for Router
function Router() {
  return <div>Router placeholder</div>;
}
