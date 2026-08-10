"""
e2e_common.py
=============
Shared fixtures, helpers, and base setup for all individual platform E2E tests.
Mocking is applied ONLY to DB persistence and auth validation; scrapers perform
real HTTP and API calls (e.g. Firecrawl, SerpApi, Meta Ads, Amazon, eBay, etc.).
"""
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from tracemark_api.main import app
from tracemark_api.dependencies import CurrentProfile, require_owner

TEST_BRAND = "Nike"
TEST_USER_ID = "e2e-test-user"
TEST_EMAIL = "e2e@test.com"
TEST_ORG_ID = "e2e-org"

PROFILE = CurrentProfile(
    id=TEST_USER_ID,
    email=TEST_EMAIL,
    organization_id=TEST_ORG_ID,
)


@pytest.fixture(autouse=True)
def _override_auth():
    """Bypass real JWT auth — inject a test profile for every request."""
    app.dependency_overrides[require_owner] = lambda: PROFILE
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Reset SlowAPI rate limiter storage before each test to avoid 429s."""
    from tracemark_api.services.rate_limit import limiter
    try:
        limiter.reset()
    except Exception:
        if hasattr(limiter, "_storage") and hasattr(limiter._storage, "storage"):
            limiter._storage.storage.clear()
        elif hasattr(limiter, "_limiter") and hasattr(limiter._limiter, "_storage"):
            try:
                limiter._limiter._storage.storage.clear()
            except Exception:
                pass
    yield


@pytest.fixture(autouse=True)
def _mock_plan_clamp():
    """Bypass org entitlement clamping so any platform can be scanned."""
    with patch(
        "tracemark_api.routes.monitoring._clamp_scan_to_plan",
        side_effect=lambda _org, platforms, regions: (platforms, regions),
    ):
        yield


@pytest.fixture(autouse=True)
def _mock_db_writes():
    """Prevent any Supabase writes — testing scraper wiring & live responses without DB."""
    with patch("tracemark_api.routes.monitoring.create_case", return_value="mock-case-id"), \
         patch("tracemark_api.routes.monitoring.save_evidence"), \
         patch("tracemark_api.routes.monitoring.save_decision"), \
         patch("tracemark_api.routes.monitoring.persist_all_infringements"), \
         patch("tracemark_api.routes.monitoring.persist_scored_evidence_item"), \
         patch("tracemark_api.routes.monitoring.generate_takedown_reports", return_value=[]), \
         patch("tracemark_api.routes.monitoring.score_evidence", return_value=50), \
         patch("tracemark_api.routes.monitoring.make_decision") as mock_decision, \
         patch("tracemark_api.routes.monitoring.run_tier0_and_filter") as mock_tier0, \
         patch("tracemark_api.routes.monitoring.run_tier1") as mock_tier1, \
         patch("tracemark_api.routes.monitoring.filter_evidence_by_scored") as mock_filter, \
         patch("tracemark_api.routes.monitoring.get_supabase") as mock_sb:
        mock_dec = MagicMock()
        mock_dec.model_dump.return_value = {"action": "investigate", "reasoning": "test"}
        mock_decision.return_value = mock_dec
        mock_tier0.side_effect = lambda ev, _bn: (ev, [])
        mock_tier1.return_value = []
        mock_filter.side_effect = lambda ev, _si: ev
        mock_sb.return_value.table.return_value.select.return_value \
            .eq.return_value.eq.return_value.maybe_single.return_value \
            .execute.return_value = MagicMock(data=None)
        yield


@pytest.fixture(autouse=True)
def _mock_scraper_health_db():
    """Prevent scraper health DB writes while letting the real scraper probe execute."""
    with patch("tracemark_api.services.scraper_health.get_supabase") as mock_sb:
        mock_sb.return_value.table.return_value.insert.return_value.execute.return_value = MagicMock()
        yield


@pytest.fixture(autouse=True)
def _mock_screenshot_db():
    """Prevent screenshot DB lookups/uploads so tests do not require Supabase storage."""
    with patch("tracemark_api.services.marketplace._screenshot_listing", return_value=None), \
         patch("tracemark_api.services.marketplace._cached_screenshot", return_value=None), \
         patch("tracemark_api.services.marketplace._meta_screenshot", return_value=None):
        yield


@pytest.fixture()
def client():
    """FastAPI TestClient instance."""
    return TestClient(app, raise_server_exceptions=False)


def check_brand_payload(platforms: list[str], brand: str = TEST_BRAND) -> dict:
    """Helper to generate request payload for /api/v1/monitoring/check-brand."""
    return {
        "brand_name": brand,
        "platforms": platforms,
        "target_regions": ["US"],
    }
