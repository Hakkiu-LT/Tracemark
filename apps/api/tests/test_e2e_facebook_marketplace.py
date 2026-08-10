"""
test_e2e_facebook_marketplace.py
================================
E2E integration test for Facebook Marketplace Scraper (Firecrawl JS).
Simulates frontend signal -> POST /api/v1/monitoring/check-brand -> FacebookMarketplaceScraper -> Evidence.
"""
import os
import pytest
from tests.e2e_common import check_brand_payload, client, _override_auth, _reset_rate_limiter, _mock_plan_clamp, _mock_db_writes, _mock_scraper_health_db, _mock_screenshot_db


@pytest.mark.integration
class TestFacebookMarketplaceE2ESignal:
    """Real scrape: Facebook Marketplace via Firecrawl."""

    def test_e2e_facebook_marketplace_signal(self, client):
        if not os.environ.get("FIRECRAWL_API_KEY"):
            pytest.skip("FIRECRAWL_API_KEY not set - skipping Facebook Marketplace integration test")

        resp = client.post(
            "/api/v1/monitoring/check-brand",
            json=check_brand_payload(["facebook_marketplace"]),
        )
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code} - {resp.text[:500]}"
        data = resp.json()
        evidence = data["evidence"]
        print(f"[Facebook Marketplace] Found {len(evidence['marketplaces'])} marketplace listings")
        assert isinstance(evidence["marketplaces"], list)
        if evidence["marketplaces"]:
            listing = evidence["marketplaces"][0]
            assert listing["platform"] == "facebook_marketplace"
            print(f"  -> First listing: {listing.get('seller_name', 'N/A')} - {listing.get('listing_url', 'N/A')}")
        else:
            print("  -> Empty results (Facebook scrapers may be blocked, gracefully handled)")
