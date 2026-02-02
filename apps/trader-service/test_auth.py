"""测试认证中间件"""
import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings
from app.dependencies import CurrentUser, get_current_user
from app.middleware.auth import create_auth_middleware
from app.schemas import ApiResponse


def test_mock_auth():
    """测试 Mock 认证中间件"""
    app = FastAPI()
    settings = get_settings()

    # 创建 Mock 认证中间件
    exclude_paths = ["/health"]
    auth_middleware = create_auth_middleware(settings, None, exclude_paths)
    app.middleware("http")(auth_middleware)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/protected")
    async def protected(user: CurrentUser = Depends(get_current_user)):
        return {
            "user_id": user.user_id,
            "username": user.username,
            "is_admin": user.is_admin,
        }

    client = TestClient(app)

    # 测试不需要认证的路径
    print("Testing /health (no auth required)...")
    response = client.get("/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200

    # 测试需要认证的路径 - Mock 模式
    print("\nTesting /protected with Mock auth headers...")
    response = client.get(
        "/protected",
        headers={
            "X-User-Id": "test-user-123",
            "X-Username": "tester",
        },
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test-user-123"
    assert data["username"] == "tester"
    assert data["is_admin"] is True

    # 测试没有认证头的情况
    print("\nTesting /protected without auth headers...")
    response = client.get("/protected")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    # Mock 模式会使用默认值，所以应该成功
    assert response.status_code == 200

    print("\n✅ All tests passed!")


if __name__ == "__main__":
    test_mock_auth()
