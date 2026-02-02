# 认证系统重构说明（中间件方式）

## 概述

重构了 trader-service 的认证系统，使用**中间件方式**统一管理认证，基于 `casdoor-py` 包，支持 Mock 和 Casdoor 两种认证模式。

## 中间件架构优势

相比依赖注入方式，中间件方式具有以下优势：

1. **全局自动应用** - 无需在每个路由手动添加 `Depends`
2. **统一拦截** - 在请求进入路由前完成认证，性能更好
3. **灵活配置** - 通过 `exclude_paths` 配置白名单
4. **request.state** - 用户信息自动存储，便于访问
5. **统一错误格式** - 认证失败返回 `ApiResponse.error` 格式

## 使用方式

### API 路由中获取用户

```python
from fastapi import APIRouter, Depends
from app.dependencies import CurrentUser, get_current_user

@router.get("/profile")
async def get_profile(user: CurrentUser = Depends(get_current_user)):
    return {"user_id": user.user_id, "username": user.username}
```

### 配置不需要认证的路径

在 `main.py` 中：

```python
exclude_paths = [
    "/health",
    "/docs", 
    "/api/v1/auth/callback",
]
```

## 配置

### Mock 模式
```bash
AUTH_MODE=mock
```

请求 Header：
```
X-User-Id: demo-user
X-Username: demo
```

### Casdoor 模式
```bash
AUTH_MODE=casdoor
CASDOOR_ENDPOINT=http://sso.8and1.cn
CASDOOR_CLIENT_ID=xxx
CASDOOR_CLIENT_SECRET=xxx
CASDOOR_ORG_NAME=8PLUS1
CASDOOR_APP_NAME=trader
CASDOOR_CERTIFICATE_PATH=/path/to/cert.pem
```

请求 Header：
```
Authorization: Bearer <access_token>
```

## 文件结构

- `app/middleware/auth.py` - 认证中间件
- `app/dependencies.py` - 获取用户依赖
- `app/main.py` - 注册中间件

