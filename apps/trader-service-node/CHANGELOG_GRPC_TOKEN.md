# 移除 grpcTokenEncrypted 字段

## 变更说明

Token 现在由上游服务（exchange-adapter-service）生成和管理，不再存储在数据库中。

## 修改的文件

### 1. `src/entity/user-exchange.entity.ts`
- ✅ 已移除 `grpcTokenEncrypted` 字段（之前已完成）

### 2. `src/service/exchange-token.service.ts`
**变更前：**
- 从数据库读取加密的 token
- 解密后返回

**变更后：**
- 仅从请求头（`x-exchange-token` 或 `x-grpc-token`）或参数中获取 token
- Token 必须由调用方提供
- 如果未提供 token，抛出错误

### 3. `src/service/exchange.service.ts`
**移除的方法：**
- `setGrpcToken()` - 设置 token
- `getGrpcToken()` - 获取 token
- `clearGrpcToken()` - 清除 token

**修改的方法：**
- `create()` - 移除了 `grpcTokenEncrypted: null` 的初始化

### 4. `src/controller/exchange.controller.ts`
**变更：**

#### `toExchangeRead()`
- 移除了 `hasGrpcToken` 字段

#### `create()`
- 移除了创建后自动初始化 token 的逻辑
- Token 由上游服务生成，不在此处处理

#### `remove()`
- 移除了删除前使 token 失效的逻辑
- 简化为直接删除记录

#### `test()`
- 移除了从数据库读取和验证已存储 token 的逻辑
- 每次测试都重新初始化账户
- 返回新生成的 token 供前端使用

## 使用方式

### 前端调用示例

```typescript
// 测试交易所配置
const response = await api.post(`/api/v1/exchanges/${exchangeId}/test`)
const { token, valid, initialized } = response.data

// 后续请求需要在请求头中携带 token
const accountInfo = await api.get('/api/v1/accounts', {
  headers: {
    'x-exchange-token': token
  }
})
```

### 后端服务调用示例

```typescript
// 在需要调用 exchange-adapter-service 的地方
const token = await exchangeTokenService.resolveToken({
  ctx,
  token: requestToken, // 可选：从请求参数传入
})

// 使用 token 调用 gRPC 服务
const result = await exchangeGrpc.someMethod({ token })
```

## 迁移指南

### 对于现有数据
- 数据库中已存储的 `grpc_token_encrypted` 字段将被忽略
- 不需要数据迁移
- 用户需要重新测试交易所配置以获取新的 token

### 对于前端应用
1. 调用 `/api/v1/exchanges/:id/test` 获取 token
2. 将 token 存储在内存或状态管理中
3. 后续请求在请求头中携带 token：`x-exchange-token: <token>`

### 对于其他后端服务
- 确保在调用需要 exchange token 的接口时，在请求头中传递 token
- 或者在请求参数中传递 token

## 优势

1. **安全性提升** - Token 不再持久化存储，减少泄露风险
2. **架构简化** - Token 生命周期由上游服务统一管理
3. **灵活性增强** - Token 可以有过期时间，支持动态刷新
4. **职责清晰** - trader-service 只负责用户和配置管理，不管理 token

## 注意事项

1. Token 是临时的，前端需要妥善管理（如存储在内存中）
2. Token 过期后需要重新调用 `/test` 接口获取新 token
3. 确保所有调用 exchange-adapter-service 的地方都正确传递 token
