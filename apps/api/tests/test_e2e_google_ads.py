"""
test_e2e_google_ads.py
======================
E2E integration test for Google Ads / SERP Scraper (SerpApi).
Simulates frontend signal -> POST /api/v1/monitoring/check-brand -> GoogleSERPAPI -> Evidence.
"""
import os
import pytest
from tests.e2e_common import check_brand_payload, client, _override_auth, _reset_rate_limiter, _mock_plan_clamp, _mock_db_writes, _mock_scraper_health_db, _mock_screenshot_db


@pytest.mark.integration
class TestGoogleAdsE2ESignal:
    """Real API call: SerpApi google_ads engine for ad hijacking detection."""

    def test_e2e_google_ads_signal(self, client):
        if not os.environ.get("GOOGLE_SERP_API"):
            pytest.skip("GOOGLE_SERP_API not set - skipping Google Ads integration test")

        resp = client.post(
            "/api/v1/monitoring/check-brand",
            json=check_brand_payload(["google_ads"]),
        )
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code} - {resp.text[:500]}"
        data = resp.json()
        evidence = data["evidence"]
        print(f"[Google Ads] Found {len(evidence['ads'])} ad evidence items")
        assert isinstance(evidence["ads"], list)
        if evidence["ads"]:
            ad = evidence["ads"][0]
            assert ad["destination_url"]
            assert ad["platform"]
            print(f"  -> First ad: {ad['platform']} - {ad['destination_url']}")
