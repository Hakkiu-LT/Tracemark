"""
Tests for GET /api/v1/infringements and related endpoints.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tracemark_api.main import app
from tracemark_api.dependencies import AuthUser

FAKE_USER = AuthUser(id="user-1", email="test@example.com")

SAMPLE_INFRINGEMENT = {
    "id": "inf-001",
    "case_id": "case-abc",
    "platform": "amazon",
    "source_url": "https://amazon.com/fake",
    "risk_level": "HIGH",
    "match_score": 0.95,
    "match_type": "keyword",
    "status": "flagged",
    "screenshot_url": None,
    "flagged_at": "2026-06-25T10:00:00+00:00",
    "created_at": "2026-06-25T10:00:00+00:00",
}

SAMPLE_EVIDENCE = {
    "id": "ev-001",
    "infringement_id": "inf-001",
    "screenshot_url": "https://example.com/shot.webp",
    "ai_analysis": None,
    "captured_at": "2026-06-25T10:00:00+00:00",
    "created_at": "2026-06-25T10:00:00+00:00",
}


def _make_sb(data, count=None):
    sb = MagicMock()
    q = MagicMock()
    q.select.return_value = q
    q.order.return_value = q
    q.limit.return_value = q
    q.offset.return_value = q
    q.eq.return_value = q
    q.ilike.return_value = q
    q.maybe_single.return_value = q
    result = MagicMock()
    result.data = data
    result.count = count
    q.execute.return_value = result
    sb.table.return_value = q
    return sb


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def auth_headers():
    return {"Authorization": "Bearer fake-token"}


def test_list_infringements_returns_200(client):
    sb = _make_sb([SAMPLE_INFRINGEMENT], count=1)
    with (
        patch("tracemark_api.routes.infringements.get_supabase", return_value=sb),
        patch("tracemark_api.dependencies.get_supabase") as dep_sb,
    ):
        dep_sb.return_value.auth.get_user.return_value.user = MagicMock(
            id=FAKE_USER.id, email=FAKE_USER.email
        )
        resp = client.get("/api/v1/infringements", headers=auth_headers())

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["platform"] == "amazon"


def test_list_infringements_no_token_returns_401(client):
    resp = client.get("/api/v1/infringements")
    assert resp.status_code == 422  # Header missing → FastAPI 422


def test_list_infringements_risk_level_filter(client):
    sb = _make_sb([], count=0)
    with (
        patch("tracemark_api.routes.infringements.get_supabase", return_value=sb),
        patch("tracemark_api.dependencies.get_supabase") as dep_sb,
    ):
        dep_sb.return_value.auth.get_user.return_value.user = MagicMock(
            id=FAKE_USER.id, email=FAKE_USER.email
        )
        resp = client.get(
            "/api/v1/infringements?risk_level=HIGH", headers=auth_headers()
        )

    assert resp.status_code == 200
    q = sb.table.return_value
    q.eq.assert_called_with("risk_level", "HIGH")


def test_get_single_infringement_returns_200(client):
    sb = _make_sb(SAMPLE_INFRINGEMENT)
    with (
        patch("tracemark_api.routes.infringements.get_supabase", return_value=sb),
        patch("tracemark_api.dependencies.get_supabase") as dep_sb,
    ):
        dep_sb.return_value.auth.get_user.return_value.user = MagicMock(
            id=FAKE_USER.id, email=FAKE_USER.email
        )
        resp = client.get("/api/v1/infringements/inf-001", headers=auth_headers())

    assert resp.status_code == 200
    assert resp.json()["id"] == "inf-001"


def test_get_single_infringement_not_found(client):
    sb = _make_sb(None)
    with (
        patch("tracemark_api.routes.infringements.get_supabase", return_value=sb),
        patch("tracemark_api.dependencies.get_supabase") as dep_sb,
    ):
        dep_sb.return_value.auth.get_user.return_value.user = MagicMock(
            id=FAKE_USER.id, email=FAKE_USER.email
        )
        resp = client.get("/api/v1/infringements/no-such-id", headers=auth_headers())

    assert resp.status_code == 404


def test_get_evidence_returns_list(client):
    sb = _make_sb([SAMPLE_EVIDENCE], count=1)
    with (
        patch("tracemark_api.routes.infringements.get_supabase", return_value=sb),
        patch("tracemark_api.dependencies.get_supabase") as dep_sb,
    ):
        dep_sb.return_value.auth.get_user.return_value.user = MagicMock(
            id=FAKE_USER.id, email=FAKE_USER.email
        )
        resp = client.get(
            "/api/v1/infringements/inf-001/evidence", headers=auth_headers()
        )

    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "ev-001"
