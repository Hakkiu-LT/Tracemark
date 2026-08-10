"""
test_e2e_meta_ads.py
====================
E2E integration test for Meta Ads Scraper (Meta Graph API ads_archive).
Simulates frontend signal -> POST /api/v1/monitoring/check-brand -> MetaAdsAPI -> Evidence.
"""
import os
import pytest
from tests.e2e_common import check_brand_payload, client, _override_auth, _reset_rate_limiter, _mock_plan_clamp, _mock_db_writes, _mock_scraper_health_db, _mock_screenshot_db


@pytest.mark.integration
class TestMetaAdsE2ESignal:
    """Real API call: Meta Ad Library API for Facebook/Instagram ad monitoring."""

    def test_e2e_meta_ads_signal(self, client):
        if not os.environ.get("META_ADS_ACCESS_TOKEN"):
            pytest.skip("META_ADS_ACCESS_TOKEN not set - skipping Meta Ads integration test")

        resp = client.post(
            "/api/v1/monitoring/check-brand",
            json=check_brand_payload(["meta_ads"]),
        )
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code} - {resp.text[:500]}"
        data = resp.json()
        evidence = data["evidence"]
        print(f"[Meta Ads] Found {len(evidence['ads'])} ad evidence items")
        assert isinstance(evidence["ads"], list)
        if evidence["ads"]:
            ad = evidence["ads"][0]
            assert ad["destination_url"]
            assert ad["platform"]
            print(f"  -> First ad: {ad['platform']} - {ad['destination_url']}")
