"""Casdoor FastAPI 认证中间件"""
from typing import Optional, Callable

from .server import CasdoorServer
from .types import CasdoorUser


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
    from fastapi import Request, status
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
