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


def test_create_brand_over_region_limit_returns_403():
    """RPC raising REGION_LIMIT_REACHED (per-brand region cap) → HTTP 403."""
    _use_profile()
    sb = _mock_sb_with_count(0)
    sb.rpc.return_value.execute.side_effect = Exception(
        "REGION_LIMIT_REACHED: 5 of 2 regions selected"
    )
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post(
            "/api/v1/brands",
            json={"brand_name": "Acme", "target_regions": ["US", "CA", "DE", "FR", "GB"]},
        )
    assert resp.status_code == 403
    assert "region" in resp.json()["detail"].lower()


def test_create_brand_over_platform_limit_returns_403():
    """RPC raising PLATFORM_LIMIT_REACHED (per-brand marketplace cap) → HTTP 403."""
    _use_profile()
    sb = _mock_sb_with_count(0)
    sb.rpc.return_value.execute.side_effect = Exception(
        "PLATFORM_LIMIT_REACHED: 4 of 2 marketplaces selected"
    )
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post(
            "/api/v1/brands",
            json={"brand_name": "Acme", "platforms": ["amazon", "ebay", "etsy", "shopify"]},
        )
    assert resp.status_code == 403
    assert "marketplace" in resp.json()["detail"].lower()


# ── per-brand cap helper (used on EDIT; create is enforced in the RPC) ───────────
def test_enforce_per_brand_caps_blocks_too_many_regions():
    from fastapi import HTTPException

    from tracemark_api.routes.brands import _enforce_per_brand_caps

    limits = {"brands": None, "regions_per_brand": 2, "platforms_per_brand": None}
    with pytest.raises(HTTPException) as exc:
        _enforce_per_brand_caps(limits, platforms=None, target_regions=["US", "CA", "DE"])
    assert exc.value.status_code == 403
    assert "region" in exc.value.detail.lower()


def test_enforce_per_brand_caps_blocks_too_many_platforms():
    from fastapi import HTTPException

    from tracemark_api.routes.brands import _enforce_per_brand_caps

    limits = {"brands": None, "regions_per_brand": None, "platforms_per_brand": 1}
    with pytest.raises(HTTPException) as exc:
        _enforce_per_brand_caps(limits, platforms=["amazon", "ebay"], target_regions=None)
    assert exc.value.status_code == 403
    assert "marketplace" in exc.value.detail.lower()


def test_enforce_per_brand_caps_allows_within_limits_and_unlimited():
    from tracemark_api.routes.brands import _enforce_per_brand_caps

    # Within caps — no raise.
    _enforce_per_brand_caps(
        {"regions_per_brand": 3, "platforms_per_brand": 3},
        platforms=["amazon", "ebay"], target_regions=["US", "CA"],
    )
    # Unlimited (None) — no raise even for large selections.
    _enforce_per_brand_caps(
        {"regions_per_brand": None, "platforms_per_brand": None},
        platforms=["amazon", "ebay", "etsy", "shopify", "alibaba"],
        target_regions=["US", "CA", "DE", "FR", "GB", "JP"],
    )
