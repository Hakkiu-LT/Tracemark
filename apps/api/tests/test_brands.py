"""Tests for the brands CRUD endpoints and their plan-limit enforcement."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tracemark_api.dependencies import CurrentProfile, get_current_profile
from tracemark_api.main import app
from tracemark_api.services.entitlements import PLAN_ENTITLEMENTS

client = TestClient(app, raise_server_exceptions=False)


def _use_plan(plan: str):
    app.dependency_overrides[get_current_profile] = lambda: CurrentProfile(
        id="user-123",
        email="user@example.com",
        organization_id="org-1",
        plan=plan,
        entitlements=PLAN_ENTITLEMENTS[plan],
    )


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


def _mock_sb_with_count(count: int):
    """get_supabase whose brands count(exact) select returns `count`."""
    sb = MagicMock()
    exec_mock = (
        sb.table.return_value.select.return_value.eq.return_value.in_.return_value.execute
    )
    exec_mock.return_value.count = count
    exec_mock.return_value.data = [{"id": f"b{i}"} for i in range(count)]
    # insert path returns a created row
    sb.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "new-brand", "brand_name": "Acme", "status": "active"}
    ]
    return sb


def test_create_brand_blocked_at_limit():
    _use_plan("starter")  # 1 brand
    sb = _mock_sb_with_count(1)  # already at limit
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post("/api/v1/brands", json={"brand_name": "Acme"})
    assert resp.status_code == 402
    assert "brand" in resp.json()["detail"].lower()


def test_create_brand_allowed_under_limit():
    _use_plan("growth")  # 5 brands
    sb = _mock_sb_with_count(2)  # room to spare
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post("/api/v1/brands", json={"brand_name": "Acme"})
    assert resp.status_code == 200
    assert resp.json()["id"] == "new-brand"


def test_create_brand_with_addon_capacity():
    _use_plan("starter")
    # Simulate starter + 2 extra-brand add-ons → limit 3; currently 2 used.
    profile = CurrentProfile(
        id="user-123",
        email="user@example.com",
        organization_id="org-1",
        plan="starter",
        entitlements=PLAN_ENTITLEMENTS["starter"].__class__(
            **{**PLAN_ENTITLEMENTS["starter"].to_dict(), "brands": 3}
        ),
    )
    app.dependency_overrides[get_current_profile] = lambda: profile
    sb = _mock_sb_with_count(2)
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post("/api/v1/brands", json={"brand_name": "Acme"})
    assert resp.status_code == 200
