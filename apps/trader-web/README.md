# Trader Web (用户交易 + 后台管理前端)

> 基于 React + Semi Design + Vite 的量化交易前端应用

## 概述

trader-web 是量化交易系统的前端应用，提供：
- 用户登录与认证（Casdoor 集成）
- 交易所账户管理
- 策略配置与监控
- 实时行情与K线图表
- 订单管理与仓位查看
- 收益统计与报表
- 后台管理功能

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
| Casdoor React SDK | latest | 统一认证 |
| KLineCharts Pro | custom | K线图表 |

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
│   │   ├── auth/                     # 认证相关
│   │   │   ├── Login.tsx
│   │   │   └── Callback.tsx
│   │   ├── dashboard/                # 仪表盘
│   │   │   └── Dashboard.tsx
│   │   ├── trading/                  # 交易相关
│   │   │   ├── TradingView.tsx       # 交易主页
│   │   │   ├── OrderBook.tsx         # 订单簿
│   │   │   └── TradeHistory.tsx      # 交易历史
│   │   ├── strategy/                 # 策略管理
│   │   │   ├── StrategyList.tsx      # 策略列表
│   │   │   ├── StrategyConfig.tsx    # 策略配置
│   │   │   └── StrategyStats.tsx     # 策略统计
│   │   ├── position/                 # 仓位管理
│   │   │   └── Positions.tsx
│   │   ├── order/                    # 订单管理
│   │   │   └── Orders.tsx
│   │   ├── exchange/                 # 交易所配置
│   │   │   └── ExchangeConfig.tsx
│   │   ├── stats/                    # 统计报表
│   │   │   ├── Overview.tsx
│   │   │   └── PnLReport.tsx
│   │   ├── settings/                 # 设置
│   │   │   └── Settings.tsx
│   │   └── admin/                    # 后台管理
│   │       ├── UserManage.tsx
│   │       ├── StrategyManage.tsx
│   │       └── SystemStats.tsx
│   ├── components/                   # 公共组件
│   │   ├── layout/                   # 布局组件
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── charts/                   # 图表组件
│   │   │   ├── KLineChart.tsx        # K线图表
│   │   │   ├── PnLChart.tsx          # 收益曲线
│   │   │   └── PieChart.tsx          # 饼图
│   │   ├── trading/                  # 交易组件
│   │   │   ├── OrderForm.tsx         # 下单表单
│   │   │   ├── PositionCard.tsx      # 仓位卡片
│   │   │   └── OrderTable.tsx        # 订单表格
│   │   └── common/                   # 通用组件
│   │       ├── Loading.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── ConfirmModal.tsx
│   ├── hooks/                        # 自定义 Hooks
│   │   ├── useAuth.ts                # 认证相关
│   │   ├── useWebSocket.ts           # WebSocket
│   │   ├── useMarketData.ts          # 行情数据
│   │   └── useNotification.ts        # 通知
│   ├── stores/                       # 状态管理
│   │   ├── authStore.ts              # 认证状态
│   │   ├── marketStore.ts            # 行情状态
│   │   └── notificationStore.ts      # 通知状态
│   ├── services/                     # API 服务
│   │   ├── api.ts                    # Axios 实例
│   │   ├── auth.service.ts           # 认证服务
│   │   ├── strategy.service.ts       # 策略服务
│   │   ├── order.service.ts          # 订单服务
│   │   ├── position.service.ts       # 仓位服务
│   │   └── stats.service.ts          # 统计服务
│   ├── utils/                        # 工具函数
│   │   ├── format.ts                 # 格式化
│   │   ├── storage.ts                # 本地存储
│   │   └── websocket.ts              # WebSocket 工具
│   ├── types/                        # 类型定义
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── order.ts
│   │   └── strategy.ts
│   └── styles/                       # 样式
│       ├── global.scss
│       └── variables.scss
├── public/                           # 静态资源
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .drone.yml
```

## 核心实现

### 1. Casdoor 认证集成

```typescript
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { CasdoorProvider } from 'casdoor-react-sdk';
import App from './App';

const casdoorConfig = {
  serverUrl: import.meta.env.VITE_CASDOOR_ENDPOINT,
  clientId: import.meta.env.VITE_CASDOOR_CLIENT_ID,
  appName: import.meta.env.VITE_CASDOOR_APP_NAME,
  organizationName: import.meta.env.VITE_CASDOOR_ORG_NAME,
  redirectPath: '/callback',
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CasdoorProvider config={casdoorConfig}>
      <App />
    </CasdoorProvider>
  </React.StrictMode>
);
```

### 2. 认证 Hook

```typescript
// src/hooks/useAuth.ts
import { useCallback } from 'react';
import { useCasdoor } from 'casdoor-react-sdk';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/auth.service';

export function useAuth() {
  const { signin, signout, getAccessToken } = useCasdoor();
  const { user, setUser, clearUser, isAuthenticated } = useAuthStore();

  const login = useCallback(() => {
    signin();
  }, [signin]);

  const logout = useCallback(async () => {
    await authService.logout();
    clearUser();
    signout();
  }, [signout, clearUser]);

  const handleCallback = useCallback(async (code: string, state: string) => {
    try {
      const { user, token } = await authService.callback(code, state);
      setUser(user);
      localStorage.setItem('token', token.accessToken);
      localStorage.setItem('refreshToken', token.refreshToken);
      return true;
    } catch (error) {
      console.error('Auth callback failed:', error);
      return false;
    }
  }, [setUser]);

  const refreshToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const newToken = await authService.refreshToken(refreshToken);
      localStorage.setItem('token', newToken.accessToken);
      return true;
    } catch (error) {
      clearUser();
      return false;
    }
  }, [clearUser]);

  return {
    user,
    isAuthenticated,
    login,
    logout,
    handleCallback,
    refreshToken,
  };
}
```

### 3. 认证状态管理

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### 4. API 服务配置

```typescript
// src/services/api.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '../stores/authStore';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token 过期，尝试刷新
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('token', data.accessToken);
          // 重试原请求
          return api.request(error.config!);
        } catch {
          // 刷新失败，清除认证状态
          useAuthStore.getState().clearUser();
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### 5. 策略服务

```typescript
// src/services/strategy.service.ts
import api from './api';
import { Strategy, StrategyBinding, BindStrategyDto } from '../types/strategy';

export const strategyService = {
  // 获取可用策略列表
  async getAvailableStrategies(): Promise<Strategy[]> {
    return api.get('/strategies/available');
  },

  // 获取用户绑定的策略
  async getUserBindings(): Promise<StrategyBinding[]> {
    return api.get('/strategies/bindings');
  },

  // 绑定策略
  async bindStrategy(dto: BindStrategyDto): Promise<StrategyBinding> {
    return api.post('/strategies/bind', dto);
  },

  // 更新策略配置
  async updateBinding(id: string, dto: Partial<BindStrategyDto>): Promise<StrategyBinding> {
    return api.put(`/strategies/bindings/${id}`, dto);
  },

  // 启动策略
  async startStrategy(id: string): Promise<void> {
    return api.post(`/strategies/bindings/${id}/start`);
  },

  // 停止策略
  async stopStrategy(id: string): Promise<void> {
    return api.post(`/strategies/bindings/${id}/stop`);
  },

  // 获取策略统计
  async getStrategyStats(id: string, period: string): Promise<any> {
    return api.get(`/strategies/bindings/${id}/stats`, { params: { period } });
  },
};
```

### 6. WebSocket Hook

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(
  onMessage: (msg: WebSocketMessage) => void,
  topics: string[] = []
) {
  const wsRef = useRef<WebSocket | null>(null);
  const { isAuthenticated } = useAuthStore();

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = `${import.meta.env.VITE_WS_URL}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // 订阅主题
      topics.forEach(topic => {
        ws.send(JSON.stringify({ action: 'subscribe', topic }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      // 自动重连
      setTimeout(connect, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [topics, onMessage]);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isAuthenticated, connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
```

### 7. K线图表组件

```typescript
// src/components/charts/KLineChart.tsx
import React, { useEffect, useRef } from 'react';
import { init, dispose, Chart } from '@anthropic/klinecharts-pro';
import { useMarketData } from '../../hooks/useMarketData';

interface KLineChartProps {
  symbol: string;
  interval: string;
  height?: number;
}

export const KLineChart: React.FC<KLineChartProps> = ({
  symbol,
  interval,
  height = 500,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { klineData, subscribe, unsubscribe } = useMarketData();

  useEffect(() => {
    if (!containerRef.current) return;

    // 初始化图表
    chartRef.current = init(containerRef.current, {
      locale: 'zh-CN',
      styles: {
        candle: {
          priceMark: {
            last: {
              show: true,
              text: {
                show: true,
              },
            },
          },
        },
      },
    });

    // 添加技术指标
    chartRef.current.createIndicator('MA', false, { id: 'candle_pane' });
    chartRef.current.createIndicator('VOL');
    chartRef.current.createIndicator('MACD');

    return () => {
      if (chartRef.current) {
        dispose(containerRef.current!);
      }
    };
  }, []);

  useEffect(() => {
    // 订阅行情
    subscribe(symbol, interval);

    return () => {
      unsubscribe(symbol, interval);
    };
  }, [symbol, interval, subscribe, unsubscribe]);

  useEffect(() => {
    if (chartRef.current && klineData.length > 0) {
      chartRef.current.applyNewData(klineData);
    }
  }, [klineData]);

  // 实时更新
  useEffect(() => {
    const updateHandler = (data: any) => {
      if (chartRef.current && data.symbol === symbol) {
        chartRef.current.updateData(data);
      }
    };

    // 监听实时数据
    window.addEventListener('kline_update', updateHandler as any);

    return () => {
      window.removeEventListener('kline_update', updateHandler as any);
    };
  }, [symbol]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height }}
    />
  );
};
```

### 8. 交易主页

```typescript
// src/pages/trading/TradingView.tsx
import React, { useState } from 'react';
import { Layout, Select, Card, Row, Col } from '@douyinfe/semi-ui';
import { KLineChart } from '../../components/charts/KLineChart';
import { OrderForm } from '../../components/trading/OrderForm';
import { OrderTable } from '../../components/trading/OrderTable';
import { PositionCard } from '../../components/trading/PositionCard';
import { useWebSocket } from '../../hooks/useWebSocket';

const { Content } = Layout;

const SYMBOLS = [
  { value: 'BTC/USDT', label: 'BTC/USDT' },
  { value: 'ETH/USDT', label: 'ETH/USDT' },
  { value: 'BNB/USDT', label: 'BNB/USDT' },
];

const INTERVALS = [
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
];

export const TradingView: React.FC = () => {
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [interval, setInterval] = useState('15m');

  // WebSocket 实时数据
  useWebSocket(
    (msg) => {
      if (msg.type === 'ticker') {
        // 更新行情
      } else if (msg.type === 'order_update') {
        // 更新订单
      }
    },
    ['ticker', 'orders', 'positions']
  );

  return (
    <Content style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        {/* 图表区域 */}
        <Col span={18}>
          <Card
            title={
              <div style={{ display: 'flex', gap: 16 }}>
                <Select
                  value={symbol}
                  onChange={setSymbol}
                  optionList={SYMBOLS}
                  style={{ width: 150 }}
                />
                <Select
                  value={interval}
                  onChange={setInterval}
                  optionList={INTERVALS}
                  style={{ width: 100 }}
                />
              </div>
            }
          >
            <KLineChart symbol={symbol} interval={interval} height={500} />
          </Card>
        </Col>

        {/* 下单区域 */}
        <Col span={6}>
          <Card title="下单">
            <OrderForm symbol={symbol} />
          </Card>

          <Card title="当前持仓" style={{ marginTop: 16 }}>
            <PositionCard symbol={symbol} />
          </Card>
        </Col>

        {/* 订单列表 */}
        <Col span={24}>
          <Card title="委托订单">
            <OrderTable />
          </Card>
        </Col>
      </Row>
    </Content>
  );
};
```

### 9. 策略配置页面

```typescript
// src/pages/strategy/StrategyConfig.tsx
import React, { useState } from 'react';
import {
  Form,
  Card,
  Button,
  Select,
  InputNumber,
  Switch,
  Toast,
  Spin,
} from '@douyinfe/semi-ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { strategyService } from '../../services/strategy.service';
import { exchangeService } from '../../services/exchange.service';

export const StrategyConfig: React.FC = () => {
  const queryClient = useQueryClient();
  const [formApi, setFormApi] = useState<any>();

  // 获取可用策略
  const { data: strategies, isLoading: loadingStrategies } = useQuery({
    queryKey: ['available-strategies'],
    queryFn: strategyService.getAvailableStrategies,
  });

  // 获取交易所配置
  const { data: exchanges, isLoading: loadingExchanges } = useQuery({
    queryKey: ['exchanges'],
    queryFn: exchangeService.getExchanges,
  });

  // 绑定策略
  const bindMutation = useMutation({
    mutationFn: strategyService.bindStrategy,
    onSuccess: () => {
      Toast.success('策略绑定成功');
      queryClient.invalidateQueries({ queryKey: ['user-bindings'] });
      formApi?.reset();
    },
    onError: (error: any) => {
      Toast.error(error.message || '绑定失败');
    },
  });

  const handleSubmit = (values: any) => {
    bindMutation.mutate(values);
  };

  if (loadingStrategies || loadingExchanges) {
    return <Spin size="large" />;
  }

  return (
    <Card title="绑定新策略">
      <Form
        getFormApi={setFormApi}
        onSubmit={handleSubmit}
        labelPosition="left"
        labelWidth={120}
      >
        <Form.Select
          field="strategyId"
          label="选择策略"
          rules={[{ required: true, message: '请选择策略' }]}
          optionList={strategies?.map(s => ({
            value: s.id,
            label: s.name,
          }))}
          style={{ width: '100%' }}
        />

        <Form.Select
          field="exchangeId"
          label="交易所"
          rules={[{ required: true, message: '请选择交易所' }]}
          optionList={exchanges?.map(e => ({
            value: e.id,
            label: `${e.name} (${e.exchangeType})`,
          }))}
          style={{ width: '100%' }}
        />

        <Form.Select
          field="symbols"
          label="交易对"
          multiple
          rules={[{ required: true, message: '请选择交易对' }]}
          optionList={[
            { value: 'BTC/USDT', label: 'BTC/USDT' },
            { value: 'ETH/USDT', label: 'ETH/USDT' },
            { value: 'BNB/USDT', label: 'BNB/USDT' },
          ]}
          style={{ width: '100%' }}
        />

        <Form.InputNumber
          field="allocation"
          label="资金分配(%)"
          rules={[
            { required: true, message: '请输入资金分配比例' },
            { type: 'number', min: 1, max: 100, message: '范围 1-100' },
          ]}
          suffix="%"
          style={{ width: '100%' }}
        />

        <Card title="风控配置" style={{ marginBottom: 16 }}>
          <Form.InputNumber
            field="riskConfig.maxPositionSize"
            label="最大持仓"
            initValue={10000}
            suffix="USDT"
          />
          <Form.InputNumber
            field="riskConfig.maxDailyLoss"
            label="日最大亏损"
            initValue={500}
            suffix="USDT"
          />
          <Form.InputNumber
            field="riskConfig.maxDrawdown"
            label="最大回撤(%)"
            initValue={10}
            suffix="%"
          />
          <Form.InputNumber
            field="riskConfig.stopLossPercent"
            label="止损(%)"
            initValue={2}
            suffix="%"
          />
          <Form.InputNumber
            field="riskConfig.takeProfitPercent"
            label="止盈(%)"
            initValue={5}
            suffix="%"
          />
        </Card>

        <Button
          type="primary"
          htmlType="submit"
          loading={bindMutation.isPending}
          block
        >
          绑定策略
        </Button>
      </Form>
    </Card>
  );
};
```

### 10. 收益统计页面

```typescript
// src/pages/stats/Overview.tsx
import React from 'react';
import { Card, Row, Col, Descriptions, Spin } from '@douyinfe/semi-ui';
import { useQuery } from '@tanstack/react-query';
import { statsService } from '../../services/stats.service';
import { PnLChart } from '../../components/charts/PnLChart';
import { formatCurrency, formatPercent } from '../../utils/format';

export const Overview: React.FC = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['user-stats'],
    queryFn: statsService.getOverview,
    refetchInterval: 60000, // 每分钟刷新
  });

  if (isLoading) {
    return <Spin size="large" />;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Descriptions row>
              <Descriptions.Item itemKey="总收益">
                <span style={{ color: stats?.totalPnl >= 0 ? '#00b578' : '#ff4d4f', fontSize: 24 }}>
                  {formatCurrency(stats?.totalPnl)}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Descriptions row>
              <Descriptions.Item itemKey="今日收益">
                <span style={{ color: stats?.todayPnl >= 0 ? '#00b578' : '#ff4d4f', fontSize: 24 }}>
                  {formatCurrency(stats?.todayPnl)}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Descriptions row>
              <Descriptions.Item itemKey="运行策略">
                <span style={{ fontSize: 24 }}>{stats?.activeStrategies}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Descriptions row>
              <Descriptions.Item itemKey="总交易次数">
                <span style={{ fontSize: 24 }}>{stats?.totalTrades}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* 收益曲线 */}
      <Card title="收益曲线" style={{ marginTop: 16 }}>
        <PnLChart />
      </Card>

      {/* 详细统计 */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="本周统计">
            <Descriptions>
              <Descriptions.Item itemKey="收益">{formatCurrency(stats?.weekPnl)}</Descriptions.Item>
              <Descriptions.Item itemKey="胜率">{formatPercent(stats?.weekWinRate)}</Descriptions.Item>
              <Descriptions.Item itemKey="交易次数">{stats?.weekTrades}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="本月统计">
            <Descriptions>
              <Descriptions.Item itemKey="收益">{formatCurrency(stats?.monthPnl)}</Descriptions.Item>
              <Descriptions.Item itemKey="胜率">{formatPercent(stats?.monthWinRate)}</Descriptions.Item>
              <Descriptions.Item itemKey="交易次数">{stats?.monthTrades}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
```

### 11. 后台管理 - 用户管理

```typescript
// src/pages/admin/UserManage.tsx
import React, { useState } from 'react';
import { Table, Card, Button, Tag, Modal, Toast } from '@douyinfe/semi-ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/admin.service';

export const UserManage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => adminService.getUsers({ page, pageSize: 20 }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminService.updateUserStatus(userId, isActive),
    onSuccess: () => {
      Toast.success('状态更新成功');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const columns = [
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>{role}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'grey'}>{isActive ? '活跃' : '禁用'}</Tag>
      ),
    },
    {
      title: '策略数',
      dataIndex: 'strategyCount',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Button
          type="tertiary"
          onClick={() => {
            Modal.confirm({
              title: '确认操作',
              content: `确定要${record.isActive ? '禁用' : '启用'}该用户吗？`,
              onOk: () => toggleStatusMutation.mutate({
                userId: record.id,
                isActive: !record.isActive,
              }),
            });
          }}
        >
          {record.isActive ? '禁用' : '启用'}
        </Button>
      ),
    },
  ];

  return (
    <Card title="用户管理">
      <Table
        columns={columns}
        dataSource={data?.users}
        loading={isLoading}
        pagination={{
          currentPage: page,
          total: data?.total,
          pageSize: 20,
          onPageChange: setPage,
        }}
        rowKey="id"
      />
    </Card>
  );
};
```

## 路由配置

```typescript
// src/routes/index.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { AuthGuard, AdminGuard } from './guards';

// 页面组件
import { Login } from '../pages/auth/Login';
import { Callback } from '../pages/auth/Callback';
import { Dashboard } from '../pages/dashboard/Dashboard';
import { TradingView } from '../pages/trading/TradingView';
import { StrategyList } from '../pages/strategy/StrategyList';
import { StrategyConfig } from '../pages/strategy/StrategyConfig';
import { Positions } from '../pages/position/Positions';
import { Orders } from '../pages/order/Orders';
import { Overview } from '../pages/stats/Overview';
import { Settings } from '../pages/settings/Settings';
import { UserManage } from '../pages/admin/UserManage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/callback',
    element: <Callback />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
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

## 配置文件

### Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:9103',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9103',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
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

### TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## Nginx 配置

```nginx
# /etc/nginx/conf.d/trader-web.conf
server {
    listen 80;
    server_name trader.example.com;

    root /data/app/trader-web/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 代理
    location /api {
        proxy_pass http://127.0.0.1:9103;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://127.0.0.1:9103;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 开发与构建

### 安装依赖

```bash
# 项目根目录
pnpm install

# 或指定应用
pnpm -w install --filter "trader-web..."
```

### 开发模式

```bash
cd apps/trader-web
pnpm run dev
```

### 生产构建

```bash
cd apps/trader-web
pnpm run build
```

### 类型检查

```bash
pnpm run type-check
```

### 代码检查

```bash
pnpm run lint
```

## 参考文档

- [React 文档](https://react.dev/)
- [Semi Design](https://semi.design/)
- [Vite 文档](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Casdoor React SDK](https://github.com/casdoor/casdoor-react-sdk)
- [KLineCharts](https://klinecharts.com/)

---

**版本**: 1.0.0
**端口**: 80 (Nginx)
**最后更新**: 2026-01-23
