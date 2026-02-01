"""Casdoor SDK 类型定义"""
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any


@dataclass
class CasdoorConfig:
    """Casdoor SDK 配置"""
    endpoint: str  # Casdoor 服务端地址，如 https://auth.example.com
    client_id: str  # 客户端 ID
    org_name: str  # 组织名称
    app_name: str  # 应用名称
    client_secret: Optional[str] = None  # 客户端密钥 (服务端使用)
    certificate: Optional[str] = None  # 用于验证 JWT 的证书 (服务端使用)


@dataclass
class CasdoorRole:
    """Casdoor 角色"""
    owner: str
    name: str
    display_name: str
    description: str
    users: List[str]
    roles: List[str]
    is_enabled: bool


@dataclass
class CasdoorPermission:
    """Casdoor 权限"""
    owner: str
    name: str
    display_name: str
    description: str
    users: List[str]
    roles: List[str]
    domains: List[str]
    model: str
    adapter: str
    resource_type: str
    resources: List[str]
    actions: List[str]
    effect: str
    is_enabled: bool


@dataclass
class CasdoorUser:
    """Casdoor 用户信息"""
    id: str
    owner: str
    name: str
    display_name: str
    avatar: str
    email: str
    phone: str
    type: str
    created_time: str
    updated_time: str
    is_admin: bool
    is_global_admin: bool
    is_forbidden: bool
    is_deleted: bool
    signup_application: str
    score: int
    ranking: int
    properties: Dict[str, str] = field(default_factory=dict)
    roles: List[CasdoorRole] = field(default_factory=list)
    permissions: List[CasdoorPermission] = field(default_factory=list)


@dataclass
class TokenResponse:
    """Token 响应"""
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    id_token: Optional[str] = None


@dataclass
class JwtClaims:
    """JWT Claims"""
    sub: str
    iss: str
    aud: str
    exp: int
    iat: int
    nbf: Optional[int] = None
    name: Optional[str] = None
    owner: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'JwtClaims':
        """从字典创建 JwtClaims"""
        known_fields = {
            'sub', 'iss', 'aud', 'exp', 'iat', 'nbf', 'name', 'owner'
        }
        known = {k: v for k, v in data.items() if k in known_fields}
        extra = {k: v for k, v in data.items() if k not in known_fields}
        return cls(**known, extra=extra)


@dataclass
class AuthResult:
    """服务端鉴权结果"""
    valid: bool
    user: Optional[CasdoorUser] = None
    claims: Optional[JwtClaims] = None
    error: Optional[str] = None
