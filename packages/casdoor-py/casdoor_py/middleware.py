"""Casdoor 认证中间件"""
from typing import Optional, Callable, Awaitable, Any
from functools import wraps

from .server import CasdoorServer
from .types import CasdoorUser, JwtClaims


# Flask 中间件
def create_flask_auth_middleware(
    server: CasdoorServer,
    get_token: Optional[Callable] = None,
    on_unauthorized: Optional[Callable] = None,
):
    """
    创建 Flask 认证中间件

    Args:
        server: CasdoorServer 实例
        get_token: 从请求中获取 Token 的函数，默认从 Authorization header 获取
        on_unauthorized: 验证失败时的处理函数

    Usage:
        from flask import Flask, request, g
        from casdoor_py import create_casdoor_server, create_flask_auth_middleware

        app = Flask(__name__)
        casdoor = create_casdoor_server(config)
        auth_middleware = create_flask_auth_middleware(casdoor)

        @app.before_request
        def before_request():
            auth_middleware()

        @app.route('/api/protected')
        def protected():
            return {'user': g.user.name}
    """
    from flask import request, g, jsonify

    def _get_token(req):
        auth = req.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return auth[7:]
        return None

    def _on_unauthorized(error: str):
        return jsonify({'error': 'Unauthorized', 'message': error}), 401

    get_token_func = get_token or _get_token
    on_unauthorized_func = on_unauthorized or _on_unauthorized

    def middleware():
        token = get_token_func(request)
        if not token:
            return on_unauthorized_func('No token provided')

        result = server.verify_token_sync(token)
        if not result.valid:
            return on_unauthorized_func(result.error or 'Invalid token')

        g.user = result.user
        g.claims = result.claims

    return middleware


def flask_require_auth(
    server: CasdoorServer,
    get_token: Optional[Callable] = None,
    on_unauthorized: Optional[Callable] = None,
):
    """
    Flask 路由装饰器，要求认证

    Usage:
        @app.route('/api/protected')
        @flask_require_auth(casdoor)
        def protected():
            from flask import g
            return {'user': g.user.name}
    """
    from flask import request, g, jsonify

    def _get_token(req):
        auth = req.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return auth[7:]
        return None

    def _on_unauthorized(error: str):
        return jsonify({'error': 'Unauthorized', 'message': error}), 401

    get_token_func = get_token or _get_token
    on_unauthorized_func = on_unauthorized or _on_unauthorized

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            token = get_token_func(request)
            if not token:
                return on_unauthorized_func('No token provided')

            result = server.verify_token_sync(token)
            if not result.valid:
                return on_unauthorized_func(result.error or 'Invalid token')

            g.user = result.user
            g.claims = result.claims
            return f(*args, **kwargs)

        return decorated_function

    return decorator


# FastAPI 中间件和依赖
def create_fastapi_auth_dependency(
    server: CasdoorServer,
    get_token: Optional[Callable] = None,
):
    """
    创建 FastAPI 认证依赖

    Usage:
        from fastapi import FastAPI, Depends
        from casdoor_py import create_casdoor_server, create_fastapi_auth_dependency

        app = FastAPI()
        casdoor = create_casdoor_server(config)
        require_auth = create_fastapi_auth_dependency(casdoor)

        @app.get('/api/protected')
        async def protected(user: CasdoorUser = Depends(require_auth)):
            return {'user': user.name}
    """
    from fastapi import Request, HTTPException, status

    async def _get_token(request: Request) -> Optional[str]:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return auth[7:]
        return None

    get_token_func = get_token or _get_token

    async def auth_dependency(request: Request) -> CasdoorUser:
        token = await get_token_func(request)
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='No token provided',
                headers={'WWW-Authenticate': 'Bearer'},
            )

        result = await server.verify_token(token)
        if not result.valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=result.error or 'Invalid token',
                headers={'WWW-Authenticate': 'Bearer'},
            )

        return result.user

    return auth_dependency


def create_fastapi_auth_middleware(
    server: CasdoorServer,
    get_token: Optional[Callable] = None,
    exclude_paths: Optional[list] = None,
):
    """
    创建 FastAPI 认证中间件

    Usage:
        from fastapi import FastAPI
        from fastapi.middleware.trustedhost import TrustedHostMiddleware
        from casdoor_py import create_casdoor_server, create_fastapi_auth_middleware

        app = FastAPI()
        casdoor = create_casdoor_server(config)

        app.middleware('http')(create_fastapi_auth_middleware(
            casdoor,
            exclude_paths=['/api/public', '/docs', '/openapi.json']
        ))

        @app.get('/api/protected')
        async def protected(request: Request):
            user = request.state.user
            return {'user': user.name}
    """
    from fastapi import Request, HTTPException, status
    from fastapi.responses import JSONResponse

    exclude_paths = exclude_paths or []

    async def _get_token(request: Request) -> Optional[str]:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return auth[7:]
        return None

    get_token_func = get_token or _get_token

    async def middleware(request: Request, call_next):
        # 检查是否排除路径
        if request.url.path in exclude_paths:
            return await call_next(request)

        # 获取 Token
        token = await get_token_func(request)
        if not token:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={'error': 'Unauthorized', 'message': 'No token provided'},
                headers={'WWW-Authenticate': 'Bearer'},
            )

        # 验证 Token
        result = await server.verify_token(token)
        if not result.valid:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={'error': 'Unauthorized', 'message': result.error or 'Invalid token'},
                headers={'WWW-Authenticate': 'Bearer'},
            )

        # 将用户信息存储到 request.state
        request.state.user = result.user
        request.state.claims = result.claims

        response = await call_next(request)
        return response

    return middleware


# Django 中间件
class DjangoAuthMiddleware:
    """
    Django 认证中间件

    Usage:
        # settings.py
        MIDDLEWARE = [
            ...
            'casdoor_py.middleware.DjangoAuthMiddleware',
        ]

        # 在项目初始化时设置 casdoor server
        from casdoor_py import create_casdoor_server
        from casdoor_py.middleware import DjangoAuthMiddleware

        casdoor = create_casdoor_server(config)
        DjangoAuthMiddleware.set_server(casdoor)

        # 在视图中使用
        def protected_view(request):
            user = request.casdoor_user
            return JsonResponse({'user': user.name})
    """

    _server: Optional[CasdoorServer] = None

    @classmethod
    def set_server(cls, server: CasdoorServer):
        """设置 CasdoorServer 实例"""
        cls._server = server

    def __init__(self, get_response):
        if self._server is None:
            raise ValueError(
                'CasdoorServer not set. Call DjangoAuthMiddleware.set_server(server) first.'
            )
        self.get_response = get_response

    def __call__(self, request):
        # 获取 Token
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        token = None
        if auth.startswith('Bearer '):
            token = auth[7:]

        if token:
            # 验证 Token
            result = self._server.verify_token_sync(token)
            if result.valid:
                request.casdoor_user = result.user
                request.casdoor_claims = result.claims
            else:
                request.casdoor_user = None
                request.casdoor_claims = None
        else:
            request.casdoor_user = None
            request.casdoor_claims = None

        response = self.get_response(request)
        return response


def django_require_auth(view_func):
    """
    Django 视图装饰器，要求认证

    Usage:
        from django.http import JsonResponse
        from casdoor_py.middleware import django_require_auth

        @django_require_auth
        def protected_view(request):
            return JsonResponse({'user': request.casdoor_user.name})
    """
    from django.http import JsonResponse

    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not hasattr(request, 'casdoor_user') or request.casdoor_user is None:
            return JsonResponse(
                {'error': 'Unauthorized', 'message': 'Authentication required'},
                status=401,
            )
        return view_func(request, *args, **kwargs)

    return _wrapped_view
