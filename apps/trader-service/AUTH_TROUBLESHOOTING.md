# 认证系统故障排查指南

## 常见错误及解决方案

### 1. AttributeError: 'NoneType' object has no attribute 'user_id'

**症状**：
```python
File "app/api/v1/exchanges.py", line 43, in list_exchanges
    session, user_id=current_user.user_id, username=current_user.username
                     ^^^^^^^^^^^^^^^^^^^^
AttributeError: 'NoneType' object has no attribute 'user_id'
```

**可能原因**：
- 认证中间件没有正确设置 `request.state.user`
- 路径不在 `exclude_paths` 中，但认证失败后继续执行

**解决方案**：

1. **检查依赖是否已安装**：
   ```bash
   cd apps/trader-service
   poetry install
   ```

2. **检查日志**：
   查看日志中的认证信息：
   ```bash
   # 启动服务时查看日志
   poetry run uvicorn app.main:app --reload

   # 应该看到类似输出：
   # [Auth] Using Mock authentication middleware
   # Auth middleware registered with mode: mock
   ```

3. **验证中间件是否注册**：
   检查 `app/main.py` 确保中间件已注册：
   ```python
   auth_middleware = create_auth_middleware(settings, casdoor_server, exclude_paths)
   app.middleware("http")(auth_middleware)
   ```

4. **测试认证**：

   **Mock 模式**：
   ```bash
   # 测试需要认证的接口
   curl -H "X-User-Id: test-user" \
        -H "X-Username: tester" \
        http://localhost:9003/api/v1/exchanges

   # 或者不带 header（会使用默认值）
   curl http://localhost:9003/api/v1/exchanges
   ```

   **Casdoor 模式**：
   ```bash
   curl -H "Authorization: Bearer <your_token>" \
        http://localhost:9003/api/v1/exchanges
   ```

### 2. 路径不需要认证但被拦截

**症状**：
`/health` 或 `/api/v1/auth/callback` 返回 401

**解决方案**：
检查 `app/main.py` 中的 `exclude_paths` 配置：
```python
exclude_paths = [
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/api/v1/auth/callback",
]
```

### 3. Casdoor 认证失败

**症状**：
返回 401 Unauthorized

**排查步骤**：

1. **检查配置**：
   ```bash
   # 查看 .env 文件
   cat .env

   # 必须包含：
   AUTH_MODE=casdoor
   CASDOOR_ENDPOINT=http://sso.8and1.cn
   CASDOOR_CLIENT_ID=xxx
   CASDOOR_CLIENT_SECRET=xxx
   CASDOOR_ORG_NAME=8PLUS1
   CASDOOR_APP_NAME=trader
   CASDOOR_CERTIFICATE_PATH=/path/to/cert.pem
   ```

2. **检查证书文件**：
   ```bash
   # 确保证书文件存在且可读
   ls -la /path/to/cert.pem
   cat /path/to/cert.pem | head -1
   # 应该看到：-----BEGIN CERTIFICATE-----
   ```

3. **测试 Token**：
   ```bash
   # 使用有效的 access_token
   curl -H "Authorization: Bearer <access_token>" \
        http://localhost:9003/api/v1/exchanges
   ```

### 4. 中间件执行顺序问题

**症状**：
其他中间件干扰认证

**解决方案**：
确保认证中间件在错误处理之后注册：
```python
# 正确的顺序
register_exception_handlers(app)  # 先注册异常处理
app.middleware("http")(auth_middleware)  # 再注册认证
```

## 调试工具

### 1. 运行测试脚本

```bash
cd apps/trader-service
python test_auth.py
```

### 2. 启用详细日志

在 `.env` 中添加：
```bash
LOG_LEVEL=DEBUG
```

### 3. 检查 request.state

在任何路由中添加调试代码：
```python
@router.get("/debug")
async def debug(request: Request):
    return {
        "has_user": hasattr(request.state, "user"),
        "user_type": type(request.state.user).__name__ if hasattr(request.state, "user") else None,
        "user": str(request.state.user) if hasattr(request.state, "user") else None,
    }
```

## 快速检查清单

- [ ] 依赖已安装（`poetry install`）
- [ ] `.env` 文件配置正确
- [ ] 证书文件存在（Casdoor 模式）
- [ ] 中间件已在 `main.py` 中注册
- [ ] `exclude_paths` 配置正确
- [ ] 日志显示中间件已初始化
- [ ] 测试脚本通过（`python test_auth.py`）

## 获取帮助

如果问题仍然存在，请提供以下信息：

1. 完整的错误堆栈
2. 日志输出（启动时和请求时）
3. 配置信息（隐藏敏感信息）
4. 请求示例（curl 命令）
