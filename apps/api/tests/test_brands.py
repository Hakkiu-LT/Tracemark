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


def test_create_brand_disallowed_region_returns_403():
    """RPC raising REGION_NOT_ALLOWED (region not in the plan whitelist) → HTTP 403."""
    _use_profile()
    sb = _mock_sb_with_count(0)
    sb.rpc.return_value.execute.side_effect = Exception(
        "REGION_NOT_ALLOWED: selection includes a region not in the plan"
    )
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post(
            "/api/v1/brands",
            json={"brand_name": "Acme", "target_regions": ["DE"]},
        )
    assert resp.status_code == 403
    assert "region" in resp.json()["detail"].lower()


def test_create_brand_disallowed_platform_returns_403():
    """RPC raising PLATFORM_NOT_ALLOWED (marketplace not in the plan whitelist) → HTTP 403."""
    _use_profile()
    sb = _mock_sb_with_count(0)
    sb.rpc.return_value.execute.side_effect = Exception(
        "PLATFORM_NOT_ALLOWED: selection includes a marketplace not in the plan"
    )
    with patch("tracemark_api.routes.brands.get_supabase", return_value=sb):
        resp = client.post(
            "/api/v1/brands",
            json={"brand_name": "Acme", "platforms": ["ebay"]},
        )
    assert resp.status_code == 403
    assert "marketplace" in resp.json()["detail"].lower()


# ── whitelist helper (used on EDIT; create is enforced in the RPC) ───────────────
def test_enforce_allowed_lists_blocks_disallowed_region():
    from fastapi import HTTPException

    from tracemark_api.routes.brands import _enforce_allowed_lists

    # Plan allows only USA. Selecting DE must be blocked.
    limits = {"allowed_platforms": None, "allowed_regions": ["US"]}
    with pytest.raises(HTTPException) as exc:
        _enforce_allowed_lists(limits, platforms=None, target_regions=["US", "DE"])
    assert exc.value.status_code == 403
    assert "region" in exc.value.detail.lower()
    assert "DE" in exc.value.detail


def test_enforce_allowed_lists_blocks_disallowed_platform():
    from fastapi import HTTPException

    from tracemark_api.routes.brands import _enforce_allowed_lists

    # Plan allows only Amazon. Selecting eBay must be blocked.
    limits = {"allowed_platforms": ["amazon"], "allowed_regions": None}
    with pytest.raises(HTTPException) as exc:
        _enforce_allowed_lists(limits, platforms=["amazon", "ebay"], target_regions=None)
    assert exc.value.status_code == 403
    assert "marketplace" in exc.value.detail.lower()
    assert "ebay" in exc.value.detail


def test_enforce_allowed_lists_allows_subset_and_unrestricted():
    from tracemark_api.routes.brands import _enforce_allowed_lists

    # Selection is a subset of the whitelist — no raise.
    _enforce_allowed_lists(
        {"allowed_platforms": ["amazon", "ebay"], "allowed_regions": ["US", "CA"]},
        platforms=["amazon"], target_regions=["US"],
    )
    # Unrestricted (None whitelists) — no raise even for a large selection.
    _enforce_allowed_lists(
        {"allowed_platforms": None, "allowed_regions": None},
        platforms=["amazon", "ebay", "etsy", "shopify", "alibaba"],
        target_regions=["US", "CA", "DE", "FR", "GB", "JP"],
    )
