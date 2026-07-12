"""
Tests for Stripe billing.

- billing_config: plan/add-on price mapping and reverse lookups
- webhook: signature verification and misconfiguration handling
- endpoint validation: create-subscription rejects unknown plans/intervals
- get-subscription: returns the free plan when nothing is stored
"""
import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tracemark_api.dependencies import (
    AuthUser,
    CurrentProfile,
    get_current_profile,
    get_current_user,
)
from tracemark_api.main import app
from tracemark_api.services.entitlements import PLAN_ENTITLEMENTS

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _override_auth():
    """Bypass Supabase JWT validation for authenticated billing routes."""
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        id="user-123", email="user@example.com"
    )
    yield
    app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# billing_config
# ──────────────────────────────────────────────────────────────────────────────

def test_get_plan_price_id_reads_env():
    with patch.dict(os.environ, {"STRIPE_PRICE_GROWTH_MONTH": "price_growth_m"}):
        from tracemark_api.services import billing_config

        assert billing_config.get_plan_price_id("growth", "month") == "price_growth_m"


def test_get_plan_price_id_unknown_combo_raises():
    from tracemark_api.services import billing_config

    with pytest.raises(ValueError):
        billing_config.get_plan_price_id("nonexistent", "month")


def test_get_plan_price_id_missing_env_raises():
    from tracemark_api.services import billing_config

    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("STRIPE_PRICE_PRO_YEAR", None)
        with pytest.raises(ValueError):
            billing_config.get_plan_price_id("pro", "year")


def test_normalize_addon_quantity_flat_addon_pinned_to_one():
    from tracemark_api.services import billing_config

    assert billing_config.normalize_addon_quantity("addon_reports", 5) == 1
    assert billing_config.normalize_addon_quantity("addon_region", 5) == 5
    assert billing_config.normalize_addon_quantity("addon_region", 0) == 1


def test_price_id_reverse_lookup():
    from tracemark_api.services import billing_config

    with patch.dict(
        os.environ,
        {
            "STRIPE_PRICE_AGENCY_YEAR": "price_agency_y",
            "STRIPE_PRICE_ADDON_DOMAINS": "price_dom",
        },
    ):
        assert billing_config.price_id_to_plan("price_agency_y") == ("agency", "year")
        assert billing_config.price_id_to_addon("price_dom") == "addon_domains"
        assert billing_config.price_id_to_plan("price_unknown") is None


# ──────────────────────────────────────────────────────────────────────────────
# Webhook
# ──────────────────────────────────────────────────────────────────────────────

def test_webhook_missing_secret_returns_503():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("STRIPE_WEBHOOK_SECRET", None)
        resp = client.post(
            "/api/v1/billing/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=abc"},
        )
    assert resp.status_code == 503


def test_webhook_invalid_signature_returns_400():
    with patch.dict(os.environ, {"STRIPE_WEBHOOK_SECRET": "whsec_test"}):
        resp = client.post(
            "/api/v1/billing/webhook",
            content=b'{"type":"invoice.paid"}',
            headers={"stripe-signature": "t=1,v1=deadbeef"},
        )
    assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# create-subscription validation
# ──────────────────────────────────────────────────────────────────────────────

def test_create_subscription_rejects_non_self_serve_plan():
    resp = client.post(
        "/api/v1/billing/create-subscription",
        json={"plan": "enterprise", "interval": "month"},
    )
    assert resp.status_code == 400


def test_create_subscription_rejects_bad_interval():
    resp = client.post(
        "/api/v1/billing/create-subscription",
        json={"plan": "growth", "interval": "weekly"},
    )
    assert resp.status_code == 400


# ──────────────────────────────────────────────────────────────────────────────
# get-subscription
# ──────────────────────────────────────────────────────────────────────────────

def test_get_subscription_returns_free_when_empty():
    mock_sb = MagicMock()
    # profile lookup for org id
    mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "organization_id": None
    }
    # subscriptions query (via _current_subscription_row) returns no rows
    mock_sb.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = []

    with patch("tracemark_api.routes.billing.get_supabase", return_value=mock_sb):
        resp = client.get("/api/v1/billing/subscription")

    assert resp.status_code == 200
    body = resp.json()
    assert body["plan"] == "free"
    assert body["status"] == "none"


# ──────────────────────────────────────────────────────────────────────────────
# Phase F: managed takedown one-off charge
# ──────────────────────────────────────────────────────────────────────────────

def _override_profile(plan: str):
    """Force a specific plan's entitlements for the duration of a test."""
    app.dependency_overrides[get_current_profile] = lambda: CurrentProfile(
        id="user-123",
        email="user@example.com",
        organization_id="org-1",
        plan=plan,
        entitlements=PLAN_ENTITLEMENTS[plan],
    )


def test_charge_managed_takedown_requires_customer():
    # Pro is entitled to managed takedown, so we reach the customer check.
    _override_profile("pro")
    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "organization_id": "org-1",
        "stripe_customer_id": None,
    }
    with patch("tracemark_api.routes.billing.get_supabase", return_value=mock_sb):
        resp = client.post("/api/v1/billing/charge-managed-takedown", json={})
    assert resp.status_code == 404


def test_charge_managed_takedown_blocked_for_lower_plan():
    # Starter is NOT entitled — must be refused before any Stripe/customer work.
    _override_profile("starter")
    resp = client.post("/api/v1/billing/charge-managed-takedown", json={})
    assert resp.status_code == 403
