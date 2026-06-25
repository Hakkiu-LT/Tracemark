"""
Tests for auth endpoints and admin access control.

- GET /api/v1/me — JWT validation and profile retrieval
- GET /api/v1/usage-stats — admin email restriction
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from tracemark_api.main import app

client = TestClient(app, raise_server_exceptions=False)

VALID_TOKEN = "valid-supabase-jwt-token"
INVALID_TOKEN = "bad-token"


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _make_supabase_mock(email: str = "gabo.seqq@gmail.com", user_id: str = "user-123"):
    """Return a Supabase client mock that successfully validates a token."""
    mock_user = MagicMock()
    mock_user.id = user_id
    mock_user.email = email

    mock_sb = MagicMock()
    mock_sb.auth.get_user.return_value = MagicMock(user=mock_user)
    mock_sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "full_name": "Gabo Test",
        "avatar_url": "https://example.com/avatar.png",
        "plan": "free",
        "organization_id": None,
    }
    return mock_sb


def _make_supabase_mock_invalid():
    """Return a Supabase client mock that raises on invalid token."""
    mock_sb = MagicMock()
    mock_sb.auth.get_user.side_effect = Exception("Invalid JWT")
    return mock_sb


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/v1/me
# ──────────────────────────────────────────────────────────────────────────────

def test_get_me_returns_profile_with_valid_token():
    with patch("tracemark_api.routes.auth.get_supabase", return_value=_make_supabase_mock()):
        response = client.get(
            "/api/v1/me",
            headers={"Authorization": f"Bearer {VALID_TOKEN}"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "gabo.seqq@gmail.com"
    assert data["id"] == "user-123"
    assert "plan" in data


def test_get_me_returns_401_without_token():
    response = client.get("/api/v1/me")
    assert response.status_code in (401, 422)


def test_get_me_returns_401_with_invalid_token():
    with patch("tracemark_api.routes.auth.get_supabase", return_value=_make_supabase_mock_invalid()):
        response = client.get(
            "/api/v1/me",
            headers={"Authorization": f"Bearer {INVALID_TOKEN}"},
        )
    assert response.status_code == 401


def test_get_me_returns_401_with_empty_bearer():
    with patch("tracemark_api.routes.auth.get_supabase", return_value=_make_supabase_mock_invalid()):
        response = client.get(
            "/api/v1/me",
            headers={"Authorization": "Bearer "},
        )
    assert response.status_code == 401


# ──────────────────────────────────────────────────────────────────────────────
# GET /api/v1/usage-stats — admin restriction
# ──────────────────────────────────────────────────────────────────────────────

def test_usage_stats_allows_admin_email(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "gabo.seqq@gmail.com,marcius.pask@gmail.com")

    with patch("tracemark_api.dependencies.get_supabase", return_value=_make_supabase_mock(email="gabo.seqq@gmail.com")):
        # Reload the module so ADMIN_EMAILS env var is re-read
        import importlib
        import tracemark_api.routes.usage as usage_mod
        importlib.reload(usage_mod)

        response = client.get(
            "/api/v1/usage-stats",
            headers={"Authorization": f"Bearer {VALID_TOKEN}"},
        )
    assert response.status_code == 200


def test_usage_stats_blocks_non_admin_email(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAILS", "gabo.seqq@gmail.com,marcius.pask@gmail.com")

    with patch("tracemark_api.dependencies.get_supabase", return_value=_make_supabase_mock(email="random@example.com")):
        import importlib
        import tracemark_api.routes.usage as usage_mod
        importlib.reload(usage_mod)

        response = client.get(
            "/api/v1/usage-stats",
            headers={"Authorization": f"Bearer {VALID_TOKEN}"},
        )
    assert response.status_code == 403


def test_usage_stats_returns_401_without_token():
    response = client.get("/api/v1/usage-stats")
    assert response.status_code in (401, 422)
