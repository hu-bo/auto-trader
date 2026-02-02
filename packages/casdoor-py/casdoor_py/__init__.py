"""Casdoor Python SDK - 服务端认证库"""

from .types import (
    CasdoorConfig,
    CasdoorUser,
    CasdoorRole,
    CasdoorPermission,
    TokenResponse,
    JwtClaims,
    AuthResult,
)

from .server import (
    CasdoorServer,
    create_casdoor_server,
)

from .middleware import (
    create_fastapi_auth_dependency,
    create_fastapi_auth_middleware,
)

__version__ = '0.1.0'

__all__ = [
    # Types
    'CasdoorConfig',
    'CasdoorUser',
    'CasdoorRole',
    'CasdoorPermission',
    'TokenResponse',
    'JwtClaims',
    'AuthResult',
    # Server
    'CasdoorServer',
    'create_casdoor_server',
    # Middleware
    'create_fastapi_auth_dependency',
    'create_fastapi_auth_middleware',
]
