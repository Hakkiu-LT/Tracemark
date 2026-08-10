"""
test_e2e_tiktok.py
==================
E2E integration test for TikTok Scraper (Firecrawl JS).
Simulates frontend signal -> POST /api/v1/monitoring/check-brand -> TikTokScraper -> Evidence.
"""
import os
import pytest
from tests.e2e_common import check_brand_payload, client, _override_auth, _reset_rate_limiter, _mock_plan_clamp, _mock_db_writes, _mock_scraper_health_db, _mock_screenshot_db


@pytest.mark.integration
class TestTikTokE2ESignal:
    """Real scrape: TikTok search via Firecrawl JS rendering."""

    def test_e2e_tiktok_signal(self, client):
        if not os.environ.get("FIRECRAWL_API_KEY"):
            pytest.skip("FIRECRAWL_API_KEY not set - skipping TikTok integration test")

        resp = client.post(
            "/api/v1/monitoring/check-brand",
            json=check_brand_payload(["tiktok"]),
        )
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code} - {resp.text[:500]}"
        data = resp.json()
        evidence = data["evidence"]
        print(f"[TikTok] Found {len(evidence['social'])} social evidence items")
        assert isinstance(evidence["social"], list)
        if evidence["social"]:
            item = evidence["social"][0]
            assert item["platform"] == "tiktok"
            assert item["handle"]
            print(f"  -> First handle: @{item['handle']} - {item.get('post_url', 'N/A')}")
