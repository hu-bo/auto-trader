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
    # Flask
    create_flask_auth_middleware,
    flask_require_auth,
    # FastAPI
    create_fastapi_auth_dependency,
    create_fastapi_auth_middleware,
    # Django
    DjangoAuthMiddleware,
    django_require_auth,
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
    'create_flask_auth_middleware',
    'flask_require_auth',
    'create_fastapi_auth_dependency',
    'create_fastapi_auth_middleware',
    'DjangoAuthMiddleware',
    'django_require_auth',
]
