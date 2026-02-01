"""FastAPI 应用示例"""
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from pydantic import BaseModel
from casdoor_py import (
    create_casdoor_server,
    CasdoorConfig,
    CasdoorUser,
    create_fastapi_auth_dependency,
)

# 初始化配置
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

# 创建 Casdoor 实例
casdoor = create_casdoor_server(config)

# 创建认证依赖
require_auth = create_fastapi_auth_dependency(casdoor)

# 创建 FastAPI 应用
app = FastAPI(title="Casdoor FastAPI Example")


# Pydantic 模型
class TokenRequest(BaseModel):
    code: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    phone: Optional[str] = None


class UserResponse(BaseModel):
    name: str
    email: str
    display_name: str
    avatar: str
    is_admin: bool


@app.get('/api/auth/signin-url')
async def get_signin_url(redirect_uri: str = Query('http://localhost:3000/callback')):
    """获取登录 URL"""
    url = casdoor.get_signin_url(redirect_uri)
    return {'url': url}


@app.post('/api/auth/token')
async def exchange_token(request: TokenRequest):
    """Token 交换"""
    try:
        # 使用授权码获取 Token
        token = await casdoor.get_token(request.code)

        # 解析 JWT
        claims = casdoor.parse_jwt_token(token.access_token)

        # 获取用户信息
        user = await casdoor.get_user(claims.name)

        return {
            'access_token': token.access_token,
            'refresh_token': token.refresh_token,
            'expires_in': token.expires_in,
            'user': {
                'name': user.name,
                'email': user.email,
                'display_name': user.display_name,
                'avatar': user.avatar,
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@app.post('/api/auth/refresh')
async def refresh_token(request: RefreshTokenRequest):
    """刷新 Token"""
    try:
        token = await casdoor.refresh_token(request.refresh_token)
        return {
            'access_token': token.access_token,
            'refresh_token': token.refresh_token,
            'expires_in': token.expires_in,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@app.get('/api/user/me', response_model=UserResponse)
async def get_current_user(user: CasdoorUser = Depends(require_auth)):
    """获取当前用户信息 (需要认证)"""
    return UserResponse(
        name=user.name,
        email=user.email,
        display_name=user.display_name,
        avatar=user.avatar,
        is_admin=user.is_admin,
    )


@app.post('/api/user/update')
async def update_user(
    update_data: UserUpdateRequest,
    user: CasdoorUser = Depends(require_auth),
):
    """更新用户信息 (需要认证)"""
    try:
        # 只允许更新某些字段
        user_update = {
            'name': user.name,
            'owner': user.owner,
        }

        if update_data.display_name is not None:
            user_update['displayName'] = update_data.display_name
        if update_data.avatar is not None:
            user_update['avatar'] = update_data.avatar
        if update_data.phone is not None:
            user_update['phone'] = update_data.phone

        success = await casdoor.update_user(user_update)
        if success:
            return {'message': 'User updated successfully'}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Failed to update user',
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@app.get('/api/users')
async def get_users(current_user: CasdoorUser = Depends(require_auth)):
    """获取用户列表 (需要认证且需要管理员权限)"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Admin permission required',
        )

    try:
        users = await casdoor.get_users()
        return {
            'users': [
                {
                    'name': user.name,
                    'email': user.email,
                    'display_name': user.display_name,
                    'avatar': user.avatar,
                    'is_admin': user.is_admin,
                }
                for user in users
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@app.get('/api/public')
async def public_endpoint():
    """公开端点 (不需要认证)"""
    return {'message': 'This is a public endpoint'}


@app.get('/health')
async def health():
    """健康检查"""
    return {'status': 'ok'}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
