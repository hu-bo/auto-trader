# casdoor-py

Casdoor Python SDK - 服务端认证库，支持 Flask、FastAPI、Django 等主流 Python Web 框架。

## 特性

- ✅ 完整的服务端认证功能
- ✅ 支持 Flask、FastAPI
- ✅ 同步和异步 API
- ✅ JWT Token 解析和验证
- ✅ 用户管理 (获取、更新、删除)
- ✅ OAuth 2.0 授权码流程
- ✅ Token 刷新
- ✅ 类型提示完整

## 安装

```bash
# 基础安装
pip install casdoor-py

# 安装 Flask 支持
pip install casdoor-py[flask]

# 安装 FastAPI 支持
pip install casdoor-py[fastapi]

# 安装 Django 支持
pip install casdoor-py[django]

# 安装所有框架支持
pip install casdoor-py[all]
```

## 快速开始

### 配置

```python
from casdoor_py import CasdoorConfig, create_casdoor_server

config = CasdoorConfig(
    endpoint='https://auth.example.com',
    client_id='your-client-id',
    client_secret='your-client-secret',
    org_name='your-org',
    app_name='your-app',
    certificate='''-----BEGIN CERTIFICATE-----
YOUR CERTIFICATE HERE
-----END CERTIFICATE-----''',
)

casdoor = create_casdoor_server(config)
```

### Flask 使用

#### 方式 1: 使用装饰器

```python
from flask import Flask, g, jsonify
from casdoor_py import create_casdoor_server, flask_require_auth

app = Flask(__name__)
casdoor = create_casdoor_server(config)

@app.route('/api/protected')
@flask_require_auth(casdoor)
def protected():
    # g.user 包含用户信息
    # g.claims 包含 JWT claims
    return jsonify({'user': g.user.name, 'email': g.user.email})

@app.route('/api/public')
def public():
    return jsonify({'message': 'This is public'})
```

#### 方式 2: 使用全局中间件

```python
from flask import Flask, request, g, jsonify
from casdoor_py import create_casdoor_server, create_flask_auth_middleware

app = Flask(__name__)
casdoor = create_casdoor_server(config)
auth_middleware = create_flask_auth_middleware(casdoor)

@app.before_request
def before_request():
    # 只对 /api 路径进行认证
    if request.path.startswith('/api'):
        return auth_middleware()

@app.route('/api/user')
def get_user():
    return jsonify({'user': g.user.name})
```

#### Token 交换

```python
@app.route('/api/auth/token', methods=['POST'])
def exchange_token():
    code = request.json.get('code')

    # 使用授权码获取 Token
    token = casdoor.get_token_sync(code)

    # 解析 JWT
    claims = casdoor.parse_jwt_token(token.access_token)

    # 获取用户信息
    user = casdoor.get_user_sync(claims.name)

    return jsonify({
        'access_token': token.access_token,
        'refresh_token': token.refresh_token,
        'user': {
            'name': user.name,
            'email': user.email,
            'display_name': user.display_name,
        }
    })
```

### FastAPI 使用

#### 方式 1: 使用依赖注入

```python
from fastapi import FastAPI, Depends
from casdoor_py import create_casdoor_server, create_fastapi_auth_dependency, CasdoorUser

app = FastAPI()
casdoor = create_casdoor_server(config)
require_auth = create_fastapi_auth_dependency(casdoor)

@app.get('/api/protected')
async def protected(user: CasdoorUser = Depends(require_auth)):
    return {'user': user.name, 'email': user.email}

@app.get('/api/public')
async def public():
    return {'message': 'This is public'}
```

#### 方式 2: 使用全局中间件

```python
from fastapi import FastAPI, Request
from casdoor_py import create_casdoor_server, create_fastapi_auth_middleware

app = FastAPI()
casdoor = create_casdoor_server(config)

# 添加认证中间件，排除公开路径
app.middleware('http')(create_fastapi_auth_middleware(
    casdoor,
    exclude_paths=['/api/public', '/docs', '/openapi.json', '/redoc']
))

@app.get('/api/protected')
async def protected(request: Request):
    # request.state.user 包含用户信息
    # request.state.claims 包含 JWT claims
    user = request.state.user
    return {'user': user.name, 'email': user.email}

@app.get('/api/public')
async def public():
    return {'message': 'This is public'}
```

#### Token 交换

```python
from pydantic import BaseModel

class TokenRequest(BaseModel):
    code: str

@app.post('/api/auth/token')
async def exchange_token(request: TokenRequest):
    # 使用授权码获取 Token
    token = await casdoor.get_token(request.code)

    # 解析 JWT
    claims = casdoor.parse_jwt_token(token.access_token)

    # 获取用户信息
    user = await casdoor.get_user(claims.name)

    return {
        'access_token': token.access_token,
        'refresh_token': token.refresh_token,
        'user': {
            'name': user.name,
            'email': user.email,
            'display_name': user.display_name,
        }
    }
```

#### 在视图中使用

```python
from django.http import JsonResponse
from casdoor_py.middleware import django_require_auth

# 使用装饰器保护视图
@django_require_auth
def protected_view(request):
    # request.casdoor_user 包含用户信息
    # request.casdoor_claims 包含 JWT claims
    user = request.casdoor_user
    return JsonResponse({
        'user': user.name,
        'email': user.email,
    })

# 手动检查认证
def optional_auth_view(request):
    if hasattr(request, 'casdoor_user') and request.casdoor_user:
        return JsonResponse({'user': request.casdoor_user.name})
    else:
        return JsonResponse({'message': 'Not authenticated'})
```

## API 文档

### CasdoorServer

#### 初始化

```python
from casdoor_py import create_casdoor_server, CasdoorConfig

config = CasdoorConfig(
    endpoint='https://auth.example.com',
    client_id='your-client-id',
    client_secret='your-client-secret',
    org_name='your-org',
    app_name='your-app',
    certificate='...',
)

server = create_casdoor_server(config)
```

#### 方法

| 方法 | 描述 | 同步版本 | 异步版本 |
|------|------|---------|---------|
| `get_signin_url(redirect_uri)` | 获取登录 URL | ✅ | - |
| `get_signup_url(redirect_uri, enable_password)` | 获取注册 URL | ✅ | - |
| `get_token(code)` | 使用授权码获取 Token | `get_token_sync` | `get_token` |
| `refresh_token(refresh_token)` | 刷新 Token | `refresh_token_sync` | `refresh_token` |
| `parse_jwt_token(token)` | 解析 JWT Token | ✅ | - |
| `verify_token(token)` | 验证 Token 并返回用户信息 | `verify_token_sync` | `verify_token` |
| `get_user(name)` | 获取用户信息 | `get_user_sync` | `get_user` |
| `get_users()` | 获取用户列表 | `get_users_sync` | `get_users` |
| `update_user(user_data)` | 更新用户信息 | `update_user_sync` | `update_user` |
| `delete_user(name)` | 删除用户 | `delete_user_sync` | `delete_user` |

### 中间件

#### Flask

```python
# 全局中间件
create_flask_auth_middleware(server, get_token=None, on_unauthorized=None)

# 装饰器
flask_require_auth(server, get_token=None, on_unauthorized=None)
```

#### FastAPI

```python
# 依赖注入
create_fastapi_auth_dependency(server, get_token=None)

# 全局中间件
create_fastapi_auth_middleware(server, get_token=None, exclude_paths=None)
```

## 示例项目

查看 `examples` 目录获取完整示例：

- `examples/flask_app.py` - Flask 应用示例
- `examples/fastapi_app.py` - FastAPI 应用示例

## 同步 vs 异步

本库同时提供同步和异步 API：

- **同步方法** (带 `_sync` 后缀): 适用于 Flask、Django 等同步框架
- **异步方法** (无后缀): 适用于 FastAPI、异步 Django 等异步框架

```python
# 同步
token = casdoor.get_token_sync(code)
user = casdoor.get_user_sync(username)

# 异步
token = await casdoor.get_token(code)
user = await casdoor.get_user(username)
```

## 开发

```bash
# 克隆仓库
git clone https://github.com/hquant/casdoor-py.git
cd casdoor-py

# 安装开发依赖
pip install -e ".[dev,all]"

# 运行测试
pytest

# 代码格式化
black casdoor_py

# 类型检查
mypy casdoor_py
```

## 许可证

MIT License

## 相关链接

- [Casdoor 官方文档](https://casdoor.org/docs/overview)
- [Casdoor API 文档](https://casdoor.org/docs/basic/server-installation)
- [TypeScript 版本](../casdoor)

## 贡献

欢迎提交 Issue 和 Pull Request!
