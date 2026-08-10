"""
test_audit_fixes.py
===================
Tests verifying the fixes for the scraper & detection audit findings:
1. Listing title inclusion in MarketplaceEvidence and detection funnel scoring
2. SSRF validation in Firecrawl scrape & screenshot functions
3. 6-hour scan scheduler brand selection & scan triggering
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta, timezone

from tracemark_api.services.ai import MarketplaceEvidence
from tracemark_api.services.detection_funnel import _score_marketplace
from tracemark_api.services.firecrawl_client import scrape_page, screenshot_page
from tracemark_api.services.scan_scheduler import run_due_brand_scans, SCAN_INTERVAL_HOURS


# ---------------------------------------------------------------------------
# 1. Marketplace Title Scoring Tests
# ---------------------------------------------------------------------------

class TestMarketplaceTitleScoring:
    def test_marketplace_matches_on_listing_title(self):
        """Verify that a listing with brand in the title is detected even if seller name differs."""
        item = MarketplaceEvidence(
            platform="Amazon",
            seller_name="random_unrelated_shop_88",
            title="Official Nike Air Max 90 Running Shoes",
            listing_url="https://amazon.com/dp/B08XYZ123",
            price="$129.99",
        )
        scored = _score_marketplace(item, "Nike")
        assert scored.tier0.brand_name_match_score > 0.8
        assert scored.verdict != "obvious_non_match"
        assert "Nike" in scored.criteria[0].evidence

    def test_marketplace_matches_on_seller_when_no_title(self):
        """Verify fallback to seller_name when title is None."""
        item = MarketplaceEvidence(
            platform="Amazon",
            seller_name="NikeOfficialStore",
            title=None,
            listing_url="https://amazon.com/dp/B08XYZ123",
            price="$129.99",
        )
        scored = _score_marketplace(item, "Nike")
        assert scored.tier0.brand_name_match_score > 0.8


# ---------------------------------------------------------------------------
# 2. Firecrawl SSRF Validation Tests
# ---------------------------------------------------------------------------

class TestFirecrawlSSRF:
    def test_scrape_page_blocks_private_ip(self):
        res = scrape_page("http://127.0.0.1:8000/internal")
        assert res.success is False
        assert "SSRF blocked" in (res.error_message or "")

    def test_scrape_page_blocks_metadata_ip(self):
        res = scrape_page("http://169.254.169.254/latest/meta-data/")
        assert res.success is False
        assert "SSRF blocked" in (res.error_message or "")

    def test_screenshot_page_blocks_private_ip(self):
        res = screenshot_page("http://192.168.1.1/admin")
        assert res is None


# ---------------------------------------------------------------------------
# 3. Scan Scheduler Tests
# ---------------------------------------------------------------------------

class TestScanScheduler:
    def test_scheduler_triggers_scan_for_due_brands(self):
        """Brands never scanned (last_scan_at=None) or scanned > 6h ago should trigger."""
        import asyncio
        old_time = (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()
        recent_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

        mock_brands = [
            {"id": "b1", "brand_name": "DueBrand1", "status": "active", "last_scan_at": None, "organization_id": "org1"},
            {"id": "b2", "brand_name": "DueBrand2", "status": "active", "last_scan_at": old_time, "organization_id": "org1"},
            {"id": "b3", "brand_name": "RecentBrand", "status": "active", "last_scan_at": recent_time, "organization_id": "org1"},
            {"id": "b4", "brand_name": "OnHoldBrand", "status": "on_hold", "last_scan_at": None, "organization_id": "org1"},
        ]

        mock_sb = MagicMock()
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.neq.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[b for b in mock_brands if b["status"] != "on_hold"])

        with patch("tracemark_api.services.scan_scheduler.get_supabase", return_value=mock_sb), \
             patch("tracemark_api.services.scan_scheduler.scan_single_brand") as mock_scan:
            asyncio.run(run_due_brand_scans())
            assert mock_scan.call_count == 2
            scanned_names = [call.args[0]["brand_name"] for call in mock_scan.call_args_list]
            assert "DueBrand1" in scanned_names
            assert "DueBrand2" in scanned_names
            assert "RecentBrand" not in scanned_names
            assert "OnHoldBrand" not in scanned_names
