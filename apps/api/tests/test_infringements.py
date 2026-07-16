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
    "case_id": "case-001",
    "infringement_id": "inf-001",
    "source_url": "https://example.com/suspicious",
    "platform": "amazon",
    "screenshot_url": "https://example.com/shot.webp",
    "content_hash": "abc123",
    "tier0_score": 0.85,
    "tier1_score": None,
    "tier2_score": None,
    "overall_score": 0.85,
    "verdict": "obvious_copycat",
    "category": ["marketplace_listing"],
    "criteria": [],
    "confidence": "high",
    "first_seen_at": "2026-06-25T10:00:00+00:00",
    "scraped_at": "2026-06-25T10:00:00+00:00",
    "status": "new",
    "created_at": "2026-06-25T10:00:00+00:00",
}


def _make_sb(data, count=None):
    sb = MagicMock()
    q_infringements = MagicMock()
    q_infringements.select.return_value = q_infringements
    q_infringements.order.return_value = q_infringements
    q_infringements.limit.return_value = q_infringements
    q_infringements.offset.return_value = q_infringements
    q_infringements.eq.return_value = q_infringements
    q_infringements.ilike.return_value = q_infringements
    q_infringements.is_.return_value = q_infringements
    q_infringements.not_ = q_infringements
    q_infringements.maybe_single.return_value = q_infringements
    result_inf = MagicMock()
    result_inf.data = data
    result_inf.count = count
    q_infringements.execute.return_value = result_inf
    
    sb.table.return_value = q_infringements

    def get_query(name):
        if name == "org_settings":
            q_org = MagicMock()
            q_org.select.return_value = q_org
            q_org.eq.return_value = q_org
            q_org.maybe_single.return_value = q_org
            res_org = MagicMock()
            res_org.data = {"persona": "brand_owner"}
            q_org.execute.return_value = res_org
            return q_org
        return q_infringements

    sb.table.side_effect = get_query
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
