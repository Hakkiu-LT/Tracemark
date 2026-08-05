"""Tests for the brands CRUD endpoints.

Brand creation goes through the create_brand_checked RPC (atomic, limit-enforced in the DB).
Here we mock the RPC: a normal call returns the created row; a call that raises
BRAND_LIMIT_REACHED must surface as HTTP 403."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tracemark_api.dependencies import CurrentProfile, get_current_profile
from tracemark_api.main import app

client = TestClient(app, raise_server_exceptions=False)


def _use_profile():
    app.dependency_overrides[get_current_profile] = lambda: CurrentProfile(
        id="user-123",
        email="user@example.com",
        organization_id="org-1",
    )


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()


def _mock_sb_with_count(count: int):
    """get_supabase whose brands count(exact) select returns `count`, and whose
    create_brand_checked RPC returns a created row."""
    sb = MagicMock()
    exec_mock = sb.table.return_value.select.return_value.eq.return_value.execute
    exec_mock.return_value.count = count
    exec_mock.return_value.data = [{"id": f"b{i}"} for i in range(count)]
    # RPC path returns the created row (create_brand_checked RETURNS public.brands)
    sb.rpc.return_value.execute.return_value.data = {
        "id": "new-brand", "brand_name": "Acme", "status": "active",
    }
    return sb


def test_create_brand_allowed_with_existing_brands():
    _use_profile()
    sb = _mock_sb_with_count(20)  # plenty of existing brands — no limit applies
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post("/api/v1/brands", json={"brand_name": "Acme"})
    assert resp.status_code == 200
    assert resp.json()["id"] == "new-brand"


def test_create_first_brand():
    _use_profile()
    sb = _mock_sb_with_count(0)  # first brand for this org
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post("/api/v1/brands", json={"brand_name": "Acme"})
    assert resp.status_code == 200
    assert resp.json()["id"] == "new-brand"


def test_create_brand_over_limit_returns_403():
    """When the RPC raises BRAND_LIMIT_REACHED, the endpoint must return HTTP 403."""
    _use_profile()
    sb = _mock_sb_with_count(5)
    sb.rpc.return_value.execute.side_effect = Exception(
        "BRAND_LIMIT_REACHED: 5 of 5 brands used"
    )
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post("/api/v1/brands", json={"brand_name": "Acme"})
    assert resp.status_code == 403
    assert "limit" in resp.json()["detail"].lower()
