"""
test_e2e_instagram.py
=====================
E2E integration test for Instagram Scraper (Firecrawl JS).
Simulates frontend signal -> POST /api/v1/monitoring/check-brand -> InstagramScraper -> Evidence.
"""
import os
import pytest
from tests.e2e_common import check_brand_payload, client, _override_auth, _reset_rate_limiter, _mock_plan_clamp, _mock_db_writes, _mock_scraper_health_db, _mock_screenshot_db


@pytest.mark.integration
class TestInstagramE2ESignal:
    """Real scrape: Instagram hashtag explore page via Firecrawl."""

    def test_e2e_instagram_signal(self, client):
        if not os.environ.get("FIRECRAWL_API_KEY"):
            pytest.skip("FIRECRAWL_API_KEY not set - skipping Instagram integration test")

        resp = client.post(
            "/api/v1/monitoring/check-brand",
            json=check_brand_payload(["instagram"]),
        )
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code} - {resp.text[:500]}"
        data = resp.json()
        evidence = data["evidence"]
        print(f"[Instagram] Found {len(evidence['social'])} social evidence items")
        assert isinstance(evidence["social"], list)
        if evidence["social"]:
            item = evidence["social"][0]
            assert item["platform"] == "instagram"
            print(f"  -> First handle: @{item.get('handle', 'N/A')} - {item.get('post_url', 'N/A')}")
