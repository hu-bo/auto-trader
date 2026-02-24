# 配置文件说明

## Casdoor 配置 (`casdoor.ts`)

统一管理 Casdoor SSO 认证相关的配置和工具函数。

### 导出内容

#### `casdoorConfig`
Casdoor 客户端配置对象，包含：
- `endpoint` - Casdoor 服务端地址
- `clientId` - 客户端 ID
- `orgName` - 组织名称
- `appName` - 应用名称
- `redirectUri` - 登录回调地址
- `logoutRedirectUri` - 登出回调地址
- `storage` - Token 存储配置
- `silentRefresh` - 是否启用静默刷新
- `refreshBeforeExpiry` - Token 过期前多少秒刷新

#### `getCasdoorLoginUrl()`
获取 Casdoor 登录 URL（不跳转）

```ts
const loginUrl = getCasdoorLoginUrl()
console.log(loginUrl) // http://sso.8and1.cn/login/oauth/authorize?...
```

#### `redirectToCasdoorLogin()`
直接跳转到 Casdoor 登录页

```ts
// 在 401 错误处理中使用
if (status === 401) {
  redirectToCasdoorLogin()
}
```

### 使用示例

#### 在 App.tsx 中使用配置
```tsx
import { casdoorConfig } from '@/config/casdoor'

function App() {
  return (
    <CasdoorProvider config={casdoorConfig}>
      {/* ... */}
    </CasdoorProvider>
  )
}
```

#### 在 API 拦截器中使用
```ts
import { redirectToCasdoorLogin } from '@/config/casdoor'

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      redirectToCasdoorLogin()
    }
    return Promise.reject(error)
  }
)
```

### 技术细节

配置文件内部使用了 Casdoor SDK 的 `getLoginUrl()` 方法来构建登录 URL，确保：
- URL 构建逻辑与 SDK 保持一致
- 自动处理 state 参数的生成和存储
- 避免重复代码

临时客户端实例（`_tempClient`）仅用于获取 URL，不会影响全局的认证状态。
