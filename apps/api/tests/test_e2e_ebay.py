"""
test_e2e_ebay.py
================
E2E integration test for eBay Scraper.
Simulates frontend signal -> POST /api/v1/monitoring/check-brand -> EbayScraper -> Evidence.
"""
import pytest
from tests.e2e_common import check_brand_payload, client, _override_auth, _reset_rate_limiter, _mock_plan_clamp, _mock_db_writes, _mock_scraper_health_db, _mock_screenshot_db


@pytest.mark.integration
class TestEbayE2ESignal:
    """Real scrape: eBay search results for brand-name products."""

    def test_e2e_ebay_signal(self, client):
        resp = client.post(
            "/api/v1/monitoring/check-brand",
            json=check_brand_payload(["ebay"]),
        )
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code} - {resp.text[:500]}"
        data = resp.json()
        evidence = data["evidence"]
        print(f"[eBay] Found {len(evidence['marketplaces'])} marketplace listings")
        assert isinstance(evidence["marketplaces"], list)
        if evidence["marketplaces"]:
            listing = evidence["marketplaces"][0]
            assert listing["platform"] == "ebay"
            assert listing["listing_url"]
            print(f"  -> First listing: {listing.get('seller_name', 'N/A')} - {listing['listing_url']}")
