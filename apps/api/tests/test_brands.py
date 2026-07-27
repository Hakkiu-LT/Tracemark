"""Tests for the brands CRUD endpoints. Any logged-in user has full, unlimited
access — there are no plan limits, so creating a brand always succeeds."""
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
    """get_supabase whose brands count(exact) select returns `count`."""
    sb = MagicMock()
    exec_mock = sb.table.return_value.select.return_value.eq.return_value.execute
    exec_mock.return_value.count = count
    exec_mock.return_value.data = [{"id": f"b{i}"} for i in range(count)]
    # insert path returns a created row
    sb.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "new-brand", "brand_name": "Acme", "status": "active"}
    ]
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
