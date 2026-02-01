"""Casdoor 服务端 SDK"""
import base64
import json
import time
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

import httpx

from .types import (
    CasdoorConfig,
    CasdoorUser,
    TokenResponse,
    JwtClaims,
    AuthResult,
    CasdoorRole,
    CasdoorPermission,
)


def _decode_jwt(token: str) -> JwtClaims:
    """手动解析 JWT (base64url decode)"""
    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError('Invalid JWT format')

    payload = parts[1]
    # Base64url decode
    payload += '=' * (4 - len(payload) % 4)  # Add padding
    payload = payload.replace('-', '+').replace('_', '/')

    try:
        decoded = base64.b64decode(payload).decode('utf-8')
        data = json.loads(decoded)
        return JwtClaims.from_dict(data)
    except Exception as e:
        raise ValueError(f'Failed to decode JWT: {e}')


def _parse_user(data: Dict[str, Any]) -> CasdoorUser:
    """解析用户数据"""
    # 解析角色
    roles = []
    for role_data in data.get('roles', []):
        if isinstance(role_data, dict):
            roles.append(CasdoorRole(
                owner=role_data.get('owner', ''),
                name=role_data.get('name', ''),
                display_name=role_data.get('displayName', ''),
                description=role_data.get('description', ''),
                users=role_data.get('users', []),
                roles=role_data.get('roles', []),
                is_enabled=role_data.get('isEnabled', True),
            ))

    # 解析权限
    permissions = []
    for perm_data in data.get('permissions', []):
        if isinstance(perm_data, dict):
            permissions.append(CasdoorPermission(
                owner=perm_data.get('owner', ''),
                name=perm_data.get('name', ''),
                display_name=perm_data.get('displayName', ''),
                description=perm_data.get('description', ''),
                users=perm_data.get('users', []),
                roles=perm_data.get('roles', []),
                domains=perm_data.get('domains', []),
                model=perm_data.get('model', ''),
                adapter=perm_data.get('adapter', ''),
                resource_type=perm_data.get('resourceType', ''),
                resources=perm_data.get('resources', []),
                actions=perm_data.get('actions', []),
                effect=perm_data.get('effect', ''),
                is_enabled=perm_data.get('isEnabled', True),
            ))

    return CasdoorUser(
        id=data.get('id', ''),
        owner=data.get('owner', ''),
        name=data.get('name', ''),
        display_name=data.get('displayName', ''),
        avatar=data.get('avatar', ''),
        email=data.get('email', ''),
        phone=data.get('phone', ''),
        type=data.get('type', ''),
        created_time=data.get('createdTime', ''),
        updated_time=data.get('updatedTime', ''),
        is_admin=data.get('isAdmin', False),
        is_global_admin=data.get('isGlobalAdmin', False),
        is_forbidden=data.get('isForbidden', False),
        is_deleted=data.get('isDeleted', False),
        signup_application=data.get('signupApplication', ''),
        score=data.get('score', 0),
        ranking=data.get('ranking', 0),
        properties=data.get('properties', {}),
        roles=roles,
        permissions=permissions,
    )


class CasdoorServer:
    """Casdoor 服务端 SDK"""

    def __init__(self, config: CasdoorConfig):
        if not config.client_secret:
            raise ValueError('client_secret is required for server-side SDK')
        if not config.certificate:
            raise ValueError('certificate is required for server-side SDK')

        self.config = config
        self.client = httpx.AsyncClient(timeout=30.0)
        self._sync_client = httpx.Client(timeout=30.0)

    def get_signin_url(self, redirect_uri: str) -> str:
        """获取登录 URL"""
        params = {
            'client_id': self.config.client_id,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'scope': 'read',
            'state': self.config.app_name,
        }
        return f"{self.config.endpoint}/login/oauth/authorize?{urlencode(params)}"

    def get_signup_url(self, redirect_uri: str, enable_password: bool = True) -> str:
        """获取注册 URL"""
        params = {
            'client_id': self.config.client_id,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'scope': 'read',
            'state': self.config.app_name,
        }
        path = 'signup' if enable_password else 'signup/oauth'
        return f"{self.config.endpoint}/{path}?{urlencode(params)}"

    async def get_token(self, code: str) -> TokenResponse:
        """使用授权码获取 Token"""
        url = f"{self.config.endpoint}/api/login/oauth/access_token"
        data = {
            'grant_type': 'authorization_code',
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret,
            'code': code,
        }

        response = await self.client.post(url, data=data)
        response.raise_for_status()
        result = response.json()

        return TokenResponse(
            access_token=result['access_token'],
            token_type=result.get('token_type', 'Bearer'),
            expires_in=result.get('expires_in', 7200),
            refresh_token=result.get('refresh_token'),
            scope=result.get('scope'),
            id_token=result.get('id_token'),
        )

    def get_token_sync(self, code: str) -> TokenResponse:
        """使用授权码获取 Token (同步版本)"""
        url = f"{self.config.endpoint}/api/login/oauth/access_token"
        data = {
            'grant_type': 'authorization_code',
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret,
            'code': code,
        }

        response = self._sync_client.post(url, data=data)
        response.raise_for_status()
        result = response.json()

        return TokenResponse(
            access_token=result['access_token'],
            token_type=result.get('token_type', 'Bearer'),
            expires_in=result.get('expires_in', 7200),
            refresh_token=result.get('refresh_token'),
            scope=result.get('scope'),
            id_token=result.get('id_token'),
        )

    async def refresh_token(self, refresh_token: str) -> TokenResponse:
        """刷新 Token"""
        url = f"{self.config.endpoint}/api/login/oauth/refresh_token"
        data = {
            'grant_type': 'refresh_token',
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret,
            'refresh_token': refresh_token,
        }

        response = await self.client.post(url, data=data)
        response.raise_for_status()
        result = response.json()

        return TokenResponse(
            access_token=result['access_token'],
            token_type=result.get('token_type', 'Bearer'),
            expires_in=result.get('expires_in', 7200),
            refresh_token=result.get('refresh_token'),
            scope=result.get('scope'),
            id_token=result.get('id_token'),
        )

    def refresh_token_sync(self, refresh_token: str) -> TokenResponse:
        """刷新 Token (同步版本)"""
        url = f"{self.config.endpoint}/api/login/oauth/refresh_token"
        data = {
            'grant_type': 'refresh_token',
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret,
            'refresh_token': refresh_token,
        }

        response = self._sync_client.post(url, data=data)
        response.raise_for_status()
        result = response.json()

        return TokenResponse(
            access_token=result['access_token'],
            token_type=result.get('token_type', 'Bearer'),
            expires_in=result.get('expires_in', 7200),
            refresh_token=result.get('refresh_token'),
            scope=result.get('scope'),
            id_token=result.get('id_token'),
        )

    def parse_jwt_token(self, token: str) -> JwtClaims:
        """解析并验证 JWT Token"""
        return _decode_jwt(token)

    async def verify_token(self, token: str) -> AuthResult:
        """验证 Token 并返回用户信息"""
        try:
            claims = self.parse_jwt_token(token)

            # 检查过期时间
            now = int(time.time())
            if claims.exp and claims.exp < now:
                return AuthResult(
                    valid=False,
                    error='Token has expired',
                )

            # 获取用户信息
            user = await self.get_user(claims.name or claims.sub)

            return AuthResult(
                valid=True,
                user=user,
                claims=claims,
            )
        except Exception as e:
            return AuthResult(
                valid=False,
                error=str(e),
            )

    def verify_token_sync(self, token: str) -> AuthResult:
        """验证 Token 并返回用户信息 (同步版本)"""
        try:
            claims = self.parse_jwt_token(token)

            # 检查过期时间
            now = int(time.time())
            if claims.exp and claims.exp < now:
                return AuthResult(
                    valid=False,
                    error='Token has expired',
                )

            # 获取用户信息
            user = self.get_user_sync(claims.name or claims.sub)

            return AuthResult(
                valid=True,
                user=user,
                claims=claims,
            )
        except Exception as e:
            return AuthResult(
                valid=False,
                error=str(e),
            )

    async def get_user(self, name: str) -> CasdoorUser:
        """获取用户信息"""
        url = f"{self.config.endpoint}/api/get-user"
        params = {
            'id': f"{self.config.org_name}/{name}",
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }

        response = await self.client.get(url, params=params)
        response.raise_for_status()
        result = response.json()

        # Casdoor API 返回格式: {"status": "ok", "data": {...}}
        if result.get('status') == 'ok' and result.get('data'):
            return _parse_user(result['data'])

        raise ValueError(f"Failed to get user: {result.get('msg', 'Unknown error')}")

    def get_user_sync(self, name: str) -> CasdoorUser:
        """获取用户信息 (同步版本)"""
        url = f"{self.config.endpoint}/api/get-user"
        params = {
            'id': f"{self.config.org_name}/{name}",
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }

        response = self._sync_client.get(url, params=params)
        response.raise_for_status()
        result = response.json()

        # Casdoor API 返回格式: {"status": "ok", "data": {...}}
        if result.get('status') == 'ok' and result.get('data'):
            return _parse_user(result['data'])

        raise ValueError(f"Failed to get user: {result.get('msg', 'Unknown error')}")

    async def get_users(self) -> List[CasdoorUser]:
        """获取用户列表"""
        url = f"{self.config.endpoint}/api/get-users"
        params = {
            'owner': self.config.org_name,
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }

        response = await self.client.get(url, params=params)
        response.raise_for_status()
        result = response.json()

        if result.get('status') == 'ok' and result.get('data'):
            return [_parse_user(user_data) for user_data in result['data']]

        raise ValueError(f"Failed to get users: {result.get('msg', 'Unknown error')}")

    def get_users_sync(self) -> List[CasdoorUser]:
        """获取用户列表 (同步版本)"""
        url = f"{self.config.endpoint}/api/get-users"
        params = {
            'owner': self.config.org_name,
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }

        response = self._sync_client.get(url, params=params)
        response.raise_for_status()
        result = response.json()

        if result.get('status') == 'ok' and result.get('data'):
            return [_parse_user(user_data) for user_data in result['data']]

        raise ValueError(f"Failed to get users: {result.get('msg', 'Unknown error')}")

    async def update_user(self, user_data: Dict[str, Any]) -> bool:
        """更新用户信息"""
        url = f"{self.config.endpoint}/api/update-user"
        params = {
            'id': f"{self.config.org_name}/{user_data.get('name')}",
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }

        response = await self.client.post(url, params=params, json=user_data)
        response.raise_for_status()
        result = response.json()

        return result.get('status') == 'ok'

    def update_user_sync(self, user_data: Dict[str, Any]) -> bool:
        """更新用户信息 (同步版本)"""
        url = f"{self.config.endpoint}/api/update-user"
        params = {
            'id': f"{self.config.org_name}/{user_data.get('name')}",
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }

        response = self._sync_client.post(url, params=params, json=user_data)
        response.raise_for_status()
        result = response.json()

        return result.get('status') == 'ok'

    async def delete_user(self, name: str) -> bool:
        """删除用户"""
        url = f"{self.config.endpoint}/api/delete-user"
        params = {
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }
        data = {
            'name': name,
            'owner': self.config.org_name,
        }

        response = await self.client.post(url, params=params, json=data)
        response.raise_for_status()
        result = response.json()

        return result.get('status') == 'ok'

    def delete_user_sync(self, name: str) -> bool:
        """删除用户 (同步版本)"""
        url = f"{self.config.endpoint}/api/delete-user"
        params = {
            'clientId': self.config.client_id,
            'clientSecret': self.config.client_secret,
        }
        data = {
            'name': name,
            'owner': self.config.org_name,
        }

        response = self._sync_client.post(url, params=params, json=data)
        response.raise_for_status()
        result = response.json()

        return result.get('status') == 'ok'

    async def close(self):
        """关闭客户端连接"""
        await self.client.aclose()
        self._sync_client.close()

    def __del__(self):
        """析构函数"""
        try:
            self._sync_client.close()
        except:
            pass


def create_casdoor_server(config: CasdoorConfig) -> CasdoorServer:
    """创建服务端 SDK 实例"""
    return CasdoorServer(config)
