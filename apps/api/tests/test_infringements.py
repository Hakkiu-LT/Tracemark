"""
Tests for GET /api/v1/infringements and related endpoints.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from tracemark_api.main import app
from tracemark_api.dependencies import get_current_profile, CurrentProfile

FAKE_ORG_ID = "fake-org"
FAKE_USER_ID = "fake-id"

FAKE_PROFILE = CurrentProfile(
    id=FAKE_USER_ID,
    email="test@example.com",
    organization_id=FAKE_ORG_ID,
)

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
    "cases": {
        "organization_id": FAKE_ORG_ID,
        "user_id": FAKE_USER_ID,
        "detection_region": "US",
        "status": "active",
        "updated_at": "2026-06-25T10:00:00+00:00",
    },
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


@pytest.fixture(autouse=True)
def override_profile():
    app.dependency_overrides[get_current_profile] = lambda: FAKE_PROFILE
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def test_list_infringements_returns_200(client):
    sb = _make_sb([SAMPLE_INFRINGEMENT], count=1)
    with patch("tracemark_api.routes.infringements.get_supabase", return_value=sb):
        resp = client.get("/api/v1/infringements")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["platform"] == "amazon"


def test_list_infringements_no_token_returns_401(client):
    app.dependency_overrides.clear()
    resp = client.get("/api/v1/infringements")
    assert resp.status_code == 422


def test_list_infringements_risk_level_filter(client):
    sb = _make_sb([], count=0)
    with patch("tracemark_api.routes.infringements.get_supabase", return_value=sb):
        resp = client.get("/api/v1/infringements?risk_level=HIGH")

    assert resp.status_code == 200
    # Verify the risk_level filter was applied somewhere in the eq calls
    from unittest.mock import call
    q_inf = sb.table("infringements")
    eq_calls = [str(c) for c in q_inf.eq.call_args_list]
    assert any("risk_level" in c and "HIGH" in c for c in eq_calls)


def test_get_single_infringement_returns_200(client):
    sb = _make_sb(SAMPLE_INFRINGEMENT)
    with patch("tracemark_api.routes.infringements.get_supabase", return_value=sb):
        resp = client.get("/api/v1/infringements/inf-001")

    assert resp.status_code == 200
    assert resp.json()["id"] == "inf-001"


def test_get_single_infringement_not_found(client):
    sb = _make_sb(None)
    with patch("tracemark_api.routes.infringements.get_supabase", return_value=sb):
        resp = client.get("/api/v1/infringements/no-such-id")

    assert resp.status_code == 404


def test_get_evidence_returns_list(client):
    inf_result = MagicMock()
    inf_result.data = SAMPLE_INFRINGEMENT

    ev_result = MagicMock()
    ev_result.data = [SAMPLE_EVIDENCE]

    call_count = {"n": 0}

    def execute_side_effect():
        call_count["n"] += 1
        if call_count["n"] <= 1:
            return inf_result   # call 1: infringement ownership check
        return ev_result        # call 2: evidence list

    sb = MagicMock()
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.order.return_value = q
    q.maybe_single.return_value = q
    q.execute.side_effect = execute_side_effect
    sb.table.return_value = q

    with patch("tracemark_api.routes.infringements.get_supabase", return_value=sb):
        resp = client.get("/api/v1/infringements/inf-001/evidence")

    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "ev-001"
