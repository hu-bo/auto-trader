# Trader Web 技术文档

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Semi Design | 2.x | UI 组件库 |
| React Router | 6.x | 路由管理 |
| Zustand | 4.x | 状态管理 |
| TanStack Query | 5.x | 数据请求 |
| Casdoor React SDK | latest | 统一认证 packages/casdoor |
| KLineCharts Pro | custom | K线图表 packages/klinecharts-pro |

## 目录结构

```
trader-web/
├── src/
│   ├── main.tsx                      # 应用入口
│   ├── App.tsx                       # 根组件
│   ├── routes/                       # 路由配置
│   │   ├── index.tsx                 # 路由定义
│   │   └── guards.tsx                # 路由守卫
│   ├── pages/                        # 页面组件
│   │   ├── auth/                     # 认证 (Login, Callback)
│   │   ├── dashboard/                # 仪表盘
│   │   ├── trading/                  # 交易 (TradingView, OrderBook, TradeHistory)
│   │   ├── strategy/                 # 策略 (StrategyList, StrategyConfig, StrategyStats)
│   │   ├── position/                 # 仓位
│   │   ├── order/                    # 订单
│   │   ├── exchange/                 # 交易所配置
│   │   ├── settings/                 # 设置
│   │   └── admin/                    # 后台 (UserManage, StrategyManage, SystemStats)
│   ├── components/                   # 公共组件
│   │   ├── layout/                   # 布局 (MainLayout, Sidebar, Header)
│   │   ├── charts/                   # 图表 (KLineChart, PnLChart, PieChart)
│   │   ├── trading/                  # 交易 (OrderForm, StrategyOrderForm, PositionCard, OrderTable)
│   │   └── common/                   # 通用 (Loading, ErrorBoundary, ConfirmModal)
│   ├── hooks/                        # 自定义 Hooks (useAuth, useWebSocket)
│   ├── stores/                       # Zustand 状态管理 (authStore)
│   ├── api/                          # API 服务 (api, auth, strategy, order, position, exchange)
│   ├── utils/                        # 工具函数 (format, storage, ws)
│   ├── types/                        # 类型定义 (auth, order, exchange, strategy)
│   └── styles/                       # 样式 (global.scss, variables.scss)
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 核心实现

### 1. Casdoor 认证集成

入口通过 `CasdoorProvider` 包裹整个应用：

```typescript
// src/main.tsx
import { CasdoorProvider } from '@hquant/casdoor/client';

const casdoorConfig = {
  endpoint: 'https://auth.example.com',
  clientId: 'your-client-id',
  orgName: 'your-org',
  appName: 'your-app',
  redirectUri: 'http://localhost:3000/callback',
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <CasdoorProvider config={casdoorConfig}>
    <App />
  </CasdoorProvider>
);
```

页面中通过 `useCasdoorReact` Hook 获取认证状态：

```typescript
import { useCasdoorReact } from '@hquant/casdoor/client';

const { isAuthenticated, user, login, logout } = useCasdoorReact();
```

### 2. API 服务

Axios 实例统一配置拦截器：

```typescript
// src/services/api.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器 - 自动附加 Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截器 - 401 时跳转 Casdoor 重新登录
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      const casdoorClient = createCasdoorClient();
      window.location.href = casdoorClient.buildAuthUrl("signin");
    }
    return Promise.reject(error);
  }
);
```

### 3. WebSocket

基于 socket.io，通过 `useWebSocket` Hook 订阅频道：

```typescript
useWebSocket(
  (msg) => {
    if (msg.type === 'ticker') { /* 更新行情 */ }
    else if (msg.type === 'order_update') { /* 更新订单 */ }
  },
  ['ticker', 'orders', 'positions']
);
```

### 4. K线图表

使用 `packages/klinecharts-pro` 自定义组件：

```typescript
<KLineChart symbol={symbol} interval={interval} height={500} />
```

### 5. 交易主页

布局：左侧 K 线图表 + 右侧下单/持仓，底部订单列表。

```typescript
// src/pages/trading/TradingView.tsx
<Row gutter={[16, 16]}>
  <Col span={18}>
    <Card title={<SymbolSelector />}>
      <KLineChart symbol={symbol} interval={interval} height={500} />
    </Card>
  </Col>
  <Col span={6}>
    <Card title="下单"><OrderForm symbol={symbol} /></Card>
    <Card title="当前持仓"><PositionCard symbol={symbol} /></Card>
  </Col>
  <Col span={24}>
    <Card title="委托订单"><OrderTable /></Card>
  </Col>
</Row>
```

### 6. 策略配置

TanStack Query 管理数据获取与变更，Semi Form 驱动表单：

```typescript
// src/pages/strategy/StrategyConfig.tsx
const { data: strategies } = useQuery({
  queryKey: ['available-strategies'],
  queryFn: strategyService.getAvailableStrategies,
});

const bindMutation = useMutation({
  mutationFn: strategyService.bindStrategy,
  onSuccess: () => {
    Toast.success('策略绑定成功');
    queryClient.invalidateQueries({ queryKey: ['user-bindings'] });
  },
});
```

表单字段：策略选择、交易所、交易对（多选）、资金分配比例、风控配置（最大持仓 / 日最大亏损 / 最大回撤 / 止损 / 止盈）。

### 7. 收益统计

顶部统计卡片（总收益、今日收益、运行策略数、总交易次数）+ 收益曲线 + 周/月统计明细：

```typescript
// src/pages/stats/Overview.tsx
const { data: stats } = useQuery({
  queryKey: ['user-stats'],
  queryFn: statsService.getOverview,
  refetchInterval: 60000, // 每分钟刷新
});
```

### 8. 后台管理 - 用户管理

Semi Table + 分页 + 状态切换：

```typescript
// src/pages/admin/UserManage.tsx
const { data } = useQuery({
  queryKey: ['admin-users', page],
  queryFn: () => adminService.getUsers({ page, pageSize: 20 }),
});

const toggleStatusMutation = useMutation({
  mutationFn: ({ userId, isActive }) =>
    adminService.updateUserStatus(userId, isActive),
});

// 表格列：用户名、邮箱、角色(Tag)、状态(Tag)、策略数、注册时间、操作(启用/禁用)
```

## 路由配置

```typescript
// src/routes/index.tsx
export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/callback', element: <Callback /> },
  {
    path: '/',
    element: <AuthGuard><MainLayout /></AuthGuard>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'trading', element: <TradingView /> },
      { path: 'strategies', element: <StrategyList /> },
      { path: 'strategies/new', element: <StrategyConfig /> },
      { path: 'positions', element: <Positions /> },
      { path: 'orders', element: <Orders /> },
      { path: 'stats', element: <Overview /> },
      { path: 'settings', element: <Settings /> },
      {
        path: 'admin',
        element: <AdminGuard />,
        children: [
          { path: 'users', element: <UserManage /> },
        ],
      },
    ],
  },
]);
```

| 路径 | 页面 | 权限 |
|------|------|------|
| `/login` | 登录 | 公开 |
| `/callback` | Casdoor 回调 | 公开 |
| `/dashboard` | 仪表盘 | 登录 |
| `/trading` | 交易主页 | 登录 |
| `/strategies` | 策略列表 | 登录 |
| `/strategies/new` | 策略配置 | 登录 |
| `/positions` | 仓位管理 | 登录 |
| `/orders` | 订单管理 | 登录 |
| `/stats` | 收益统计 | 登录 |
| `/settings` | 设置 | 登录 |
| `/admin/users` | 用户管理 | 管理员 |

## 配置

### 环境变量

```bash
# .env.example
VITE_API_BASE_URL=/api
VITE_WS_URL=ws://localhost:9103/ws

# Casdoor
VITE_CASDOOR_ENDPOINT=https://auth.example.com
VITE_CASDOOR_CLIENT_ID=your-client-id
VITE_CASDOOR_APP_NAME=trader
VITE_CASDOOR_ORG_NAME=built-in
```

### Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:9103', changeOrigin: true },
      '/ws': { target: 'ws://localhost:9103', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          semi: ['@douyinfe/semi-ui'],
          charts: ['@anthropic/klinecharts-pro'],
        },
      },
    },
  },
});
```

### TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

## 参考

- [React](https://react.dev/)
- [Semi Design](https://semi.design/)
- [Vite](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query)
- [Zustand](https://zustand-demo.pmnd.rs/)
- Casdoor SDK: `packages/casdoor`
- KLineCharts: `packages/klinecharts-pro`
- 后端 API: `apps/trader-service/app/api`
