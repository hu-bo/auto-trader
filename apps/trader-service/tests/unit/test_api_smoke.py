import os
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{Path(tempfile.gettempdir()) / 'trader_service_test.db'}",
)
os.environ.setdefault("AUTH_MODE", "mock")
os.environ.setdefault("ENCRYPTION_KEY", "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")

from app.main import create_app  # noqa: E402


def test_health() -> None:
    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


def test_me_and_create_resources() -> None:
    app = create_app()
    with TestClient(app) as client:
        me = client.get("/api/v1/user/me", headers={"X-User-Id": "u1", "X-Username": "alice"})
        assert me.status_code == 200
        assert me.json()["id"] == "u1"

        strategy = client.post(
            "/api/v1/strategies",
            headers={"X-User-Id": "u1", "X-Username": "alice"},
            json={"name": "s1", "description": "demo"},
        )
        assert strategy.status_code == 200
        strategy_id = strategy.json()["id"]

        exchange = client.post(
            "/api/v1/exchanges",
            headers={"X-User-Id": "u1", "X-Username": "alice"},
            json={
                "exchange_type": "BINANCE",
                "name": "binance-main",
                "api_key": "k",
                "api_secret": "s",
                "is_testnet": True,
            },
        )
        assert exchange.status_code == 200
        exchange_id = exchange.json()["id"]

        order = client.post(
            "/api/v1/strategy-order",
            headers={"X-User-Id": "u1", "X-Username": "alice"},
            json={
                "strategy_id": strategy_id,
                "exchange_id": exchange_id,
                "symbols": ["BTC-USDT"],
                "live": False,
            },
        )
        assert order.status_code == 200
        assert order.json()["strategy_id"] == strategy_id

