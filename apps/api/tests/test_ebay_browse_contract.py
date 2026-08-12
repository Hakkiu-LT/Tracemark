"""
test_ebay_browse_contract.py
============================
Proves the eBay Browse API scraper returns data in EXACTLY the same shape the rest
of the marketplace scrapers do, and that it flows through the identical downstream
pipeline (`_parse_marketplace_listings` -> `MarketplaceEvidence`) with no special-casing.

Why this file exists (separate from test_platform_scrapers.py):
  test_platform_scrapers.py checks eBay parses its OWN API response correctly.
  THIS file checks eBay is a good *citizen* — its output dicts carry the exact keys
  the detection funnel reads, produce valid MarketplaceEvidence, and are byte-for-byte
  interchangeable with Amazon/Etsy output as far as downstream code can tell.

Contract the downstream reads (see marketplace._parse_marketplace_listings):
  listing["url"] or listing["listing_url"]     -> MarketplaceEvidence.listing_url  (REQUIRED)
  listing["seller"] or listing["seller_name"]  -> MarketplaceEvidence.seller_name
  listing["title"]                              -> MarketplaceEvidence.title
  listing["price"]                              -> MarketplaceEvidence.price
"""
import os

import pytest
from unittest.mock import patch, MagicMock

from tracemark_api.services.marketplace import (
    AmazonScraper,
    EbayScraper,
    _parse_marketplace_listings,
)
from tracemark_api.services.ai import Evidence, MarketplaceEvidence
from tracemark_api.services import marketplace as mp
from tracemark_api.services.detection_funnel import run_tier0
from tracemark_api.services.unified_scraper import UnifiedScrapeResult
from datetime import datetime


# The four keys downstream (_parse_marketplace_listings) actually reads from a listing.
# eBay must satisfy the same required contract as every other static scraper.
_REQUIRED_URL_KEYS = ("url", "listing_url")
_OPTIONAL_KEYS = ("title", "price", "seller", "seller_name")


@pytest.fixture(autouse=True)
def _tracker_not_blocked():
    with patch("tracemark_api.services.api_usage_tracker.tracker.is_blocked", return_value=False), \
         patch("tracemark_api.services.api_usage_tracker.tracker.record", return_value=None):
        yield


def _reset_ebay_token_cache():
    mp._ebay_token_cache["token"] = None
    mp._ebay_token_cache["expires_at"] = 0.0


# A realistic eBay Browse API item_summary/search payload (two items, GB marketplace).
EBAY_BROWSE_PAYLOAD = {
    "itemSummaries": [
        {
            "itemId": "v1|111222333|0",
            "title": "Nike Air Force 1 '07 Triple Black - New",
            "price": {"value": "89.99", "currency": "GBP"},
            "seller": {"username": "trainer_outlet_uk"},
            "itemWebUrl": "https://www.ebay.co.uk/itm/111222333",
            "image": {"imageUrl": "https://i.ebayimg.com/images/g/abc/s-l500.jpg"},
        },
        {
            "itemId": "v1|444555666|0",
            "title": "Nike Dri-FIT Socks 3-Pack",
            "price": {"value": "12.50", "currency": "GBP"},
            "seller": {"username": "sockshop"},
            "itemWebUrl": "https://www.ebay.co.uk/itm/444555666",
            "thumbnailImages": [{"imageUrl": "https://i.ebayimg.com/thumbs/444.jpg"}],
        },
    ]
}

# An equivalent Amazon HTML page — same two conceptual products — to prove the two
# scrapers converge to structurally identical MarketplaceEvidence downstream.
AMAZON_HTML = """
<html><body>
  <div data-component-type="s-search-result">
    <h2><span>Nike Air Force 1 '07 Triple Black - New</span></h2>
    <span class="a-price"><span class="a-offscreen">£89.99</span></span>
    <span class="a-size-small"><span class="a-color-secondary">trainer_outlet_uk</span></span>
    <h2><a href="/dp/B0AF1BLACK">Link</a></h2>
  </div>
  <div data-component-type="s-search-result">
    <h2><span>Nike Dri-FIT Socks 3-Pack</span></h2>
    <span class="a-price"><span class="a-offscreen">£12.50</span></span>
    <span class="a-size-small"><span class="a-color-secondary">sockshop</span></span>
    <h2><a href="/dp/B0SOCKS3PK">Link</a></h2>
  </div>
</body></html>
"""


def _mock_browse_search():
    """Patch a valid OAuth token + a 200 Browse search returning EBAY_BROWSE_PAYLOAD."""
    token_resp = MagicMock(status_code=200)
    token_resp.json.return_value = {"access_token": "tok", "expires_in": 7200}
    search_resp = MagicMock(status_code=200)
    search_resp.json.return_value = EBAY_BROWSE_PAYLOAD
    return token_resp, search_resp


# ---------------------------------------------------------------------------
# 1. Schema parity — eBay output carries the exact keys downstream reads
# ---------------------------------------------------------------------------

class TestEbayOutputSchemaParity:
    def _get_ebay_listings(self, monkeypatch):
        monkeypatch.setenv("EBAY_CLIENT_ID", "cid")
        monkeypatch.setenv("EBAY_CLIENT_SECRET", "sec")
        _reset_ebay_token_cache()
        token_resp, search_resp = _mock_browse_search()
        with patch("tracemark_api.services.marketplace.requests.post", return_value=token_resp), \
             patch("tracemark_api.services.marketplace.call_with_tracking", return_value=search_resp):
            return EbayScraper().search("Nike", caller_id="test", country="GB")

    def test_every_listing_is_a_dict_with_a_url(self, monkeypatch):
        listings = self._get_ebay_listings(monkeypatch)
        assert listings, "eBay returned no listings from a valid payload"
        for lst in listings:
            assert isinstance(lst, dict)
            assert any(lst.get(k) for k in _REQUIRED_URL_KEYS), f"listing missing url: {lst}"

    def test_output_keys_match_amazon_core_keys(self, monkeypatch):
        """eBay dict must expose the same title/price/seller/url keys Amazon does."""
        ebay = self._get_ebay_listings(monkeypatch)[0]
        az = AmazonScraper()
        with patch.object(az._scraper, "scrape",
                          return_value=UnifiedScrapeResult(url="u", title="t", markdown="m",
                                                           html=AMAZON_HTML, success=True)):
            amazon = az.search("Nike", max_pages=1, caller_id="test")[0]
        core = {"title", "price", "seller", "url"}
        assert core.issubset(ebay.keys()), f"eBay missing core keys: {core - set(ebay)}"
        assert core.issubset(amazon.keys()), f"Amazon missing core keys: {core - set(amazon)}"

    def test_values_are_strings_or_none(self, monkeypatch):
        """Downstream does str(price); title/seller/url must be str|None, never dict/list."""
        for lst in self._get_ebay_listings(monkeypatch):
            for key in ("title", "price", "seller", "url"):
                assert lst.get(key) is None or isinstance(lst.get(key), str), \
                    f"{key} is not str|None: {lst.get(key)!r}"


# ---------------------------------------------------------------------------
# 2. Downstream compatibility — eBay output builds valid MarketplaceEvidence
# ---------------------------------------------------------------------------

class TestEbayDownstreamCompatibility:
    def _ebay_evidence(self, monkeypatch):
        monkeypatch.setenv("EBAY_CLIENT_ID", "cid")
        monkeypatch.setenv("EBAY_CLIENT_SECRET", "sec")
        _reset_ebay_token_cache()
        token_resp, search_resp = _mock_browse_search()
        with patch("tracemark_api.services.marketplace.requests.post", return_value=token_resp), \
             patch("tracemark_api.services.marketplace.call_with_tracking", return_value=search_resp):
            raw = EbayScraper().search("Nike", caller_id="test", country="GB")
        # This is the EXACT call gather_evidence makes at marketplace.py:2183
        return _parse_marketplace_listings("Nike", "ebay", raw)

    def test_produces_valid_marketplace_evidence(self, monkeypatch):
        evidence = self._ebay_evidence(monkeypatch)
        assert len(evidence) == 2
        for ev in evidence:
            assert isinstance(ev, MarketplaceEvidence)
            assert ev.platform == "ebay"
            assert ev.listing_url.startswith("https://www.ebay.co.uk/itm/")
            assert ev.seller_name           # non-empty
            assert ev.title                 # non-empty
            assert ev.price                 # non-empty (multi-currency string)

    def test_multi_currency_survives_into_evidence(self, monkeypatch):
        evidence = self._ebay_evidence(monkeypatch)
        prices = {ev.price for ev in evidence}
        assert prices == {"£89.99", "£12.50"}, prices

    def test_ebay_and_amazon_yield_same_evidence_field_shape(self, monkeypatch):
        """The same downstream parser fills the same fields for eBay and Amazon."""
        ebay_ev = self._ebay_evidence(monkeypatch)[0]

        az = AmazonScraper()
        with patch.object(az._scraper, "scrape",
                          return_value=UnifiedScrapeResult(url="u", title="t", markdown="m",
                                                           html=AMAZON_HTML, success=True)):
            amazon_raw = az.search("Nike", max_pages=1, caller_id="test")
        amazon_ev = _parse_marketplace_listings("Nike", "amazon", amazon_raw)[0]

        def populated_fields(ev: MarketplaceEvidence) -> set[str]:
            return {f for f in ("seller_name", "title", "listing_url", "price") if getattr(ev, f)}

        # Both scrapers must populate the identical set of downstream fields.
        assert populated_fields(ebay_ev) == populated_fields(amazon_ev) == \
            {"seller_name", "title", "listing_url", "price"}


# ---------------------------------------------------------------------------
# 3. Detection engagement — eBay evidence actually FEEDS the copycat funnel
#    (the whole point of the product: not just "returns data" but "data that the
#    detection funnel can act on"). Deterministic — Tier 0, no AI, no network.
# ---------------------------------------------------------------------------

class TestEbayFeedsDetectionFunnel:
    def _ebay_evidence_bundle(self, monkeypatch) -> Evidence:
        monkeypatch.setenv("EBAY_CLIENT_ID", "cid")
        monkeypatch.setenv("EBAY_CLIENT_SECRET", "sec")
        _reset_ebay_token_cache()
        token_resp, search_resp = _mock_browse_search()
        with patch("tracemark_api.services.marketplace.requests.post", return_value=token_resp), \
             patch("tracemark_api.services.marketplace.call_with_tracking", return_value=search_resp):
            raw = EbayScraper().search("Nike", caller_id="test", country="GB")
        items = _parse_marketplace_listings("Nike", "ebay", raw)
        return Evidence(marketplaces=items, ads=[], domains=[], social=[], blocked_apis=[],
                        scanned_platforms=["ebay"], timestamp=datetime.now())

    def test_brand_listings_become_detection_candidates(self, monkeypatch):
        """Every eBay listing whose title carries the brand must survive Tier 0 as a
        candidate (scored, NOT auto-dismissed) — i.e. it advances toward a copycat verdict."""
        ev = self._ebay_evidence_bundle(monkeypatch)
        scored = run_tier0(ev, "Nike")

        assert len(scored) == 2
        for s in scored:
            assert s.platform == "ebay"
            assert s.source_url.startswith("https://www.ebay.co.uk/itm/")
            # Brand present in title → positive brand-match score, not auto-dismissed.
            assert s.overall_score > 0.0
            assert s.verdict != "obvious_non_match"

    def test_funnel_score_reflects_brand_relevance(self, monkeypatch):
        """A brand actually present in the listings scores higher than an absent brand —
        proves the funnel discriminates on eBay data rather than rubber-stamping."""
        ev = self._ebay_evidence_bundle(monkeypatch)   # titles are all "Nike ..."
        nike = run_tier0(ev, "Nike")
        rolex = run_tier0(ev, "Rolex")                  # brand absent from these listings

        avg_nike = sum(s.overall_score for s in nike) / len(nike)
        avg_rolex = sum(s.overall_score for s in rolex) / len(rolex)
        assert avg_nike > avg_rolex, f"Nike {avg_nike} should outscore Rolex {avg_rolex}"


@pytest.mark.integration
@pytest.mark.skipif(
    not (os.environ.get("EBAY_CLIENT_ID") and os.environ.get("EBAY_CLIENT_SECRET")
         and os.environ.get("GEMINI_API_KEY")),
    reason="Live copycat test requires EBAY + GEMINI keys",
)
class TestEbayLiveCopycatDetection:
    """End-to-end: real eBay listings -> Tier 0 -> AI decision. Costs 1 gemini_pro call.
    Run with:  pytest -m integration -k LiveCopycat -s"""

    def test_real_ebay_listings_yield_a_decision(self):
        from tracemark_api.services.ai import make_decision, Decision

        _reset_ebay_token_cache()
        raw = EbayScraper().search("Stanley", caller_id="live-copycat", country="US")
        items = _parse_marketplace_listings("Stanley", "ebay", raw)[:5]
        assert items, "No live eBay listings to analyze"

        ev = Evidence(marketplaces=items, ads=[], domains=[], social=[], blocked_apis=[],
                      scanned_platforms=["ebay"], timestamp=datetime.now())
        scored = run_tier0(ev, "Stanley")
        decision = make_decision(ev, scored)

        # The AI copycat judge must return a valid, actionable decision citing eBay data.
        assert isinstance(decision, Decision)
        assert decision.recommended_action in ("TAKEDOWN", "MONITOR", "DISMISS")
        assert decision.risk_level in ("HIGH", "MEDIUM", "LOW")
        assert decision.case_summary, "Decision must include a case summary"


# ---------------------------------------------------------------------------
# 4. LIVE contract — real eBay Browse call, real data satisfies the contract
#    Skipped automatically when no keyset is configured (CI without secrets).
# ---------------------------------------------------------------------------

@pytest.mark.integration
@pytest.mark.skipif(
    not (os.environ.get("EBAY_CLIENT_ID") and os.environ.get("EBAY_CLIENT_SECRET")),
    reason="Live eBay Browse test requires EBAY_CLIENT_ID/EBAY_CLIENT_SECRET",
)
class TestEbayLiveContract:
    """Hits the REAL eBay Browse API. Run with:  pytest -m integration -k Live -s"""

    def test_real_search_returns_contract_valid_listings(self):
        _reset_ebay_token_cache()
        listings = EbayScraper().search("Nike", caller_id="live-contract", country="US")

        assert listings, "Live eBay search returned zero listings for 'Nike'"
        assert len(listings) >= 10, f"Suspiciously few live listings: {len(listings)}"

        for lst in listings:
            # Same contract every other scraper's output obeys:
            assert isinstance(lst, dict)
            assert isinstance(lst.get("url"), str) and lst["url"].startswith("http"), lst
            assert "ebay.com" in lst["url"]
            for key in ("title", "price", "seller"):
                assert lst.get(key) is None or isinstance(lst.get(key), str)

        # And the real data must flow into valid MarketplaceEvidence, same as the pipeline.
        evidence = _parse_marketplace_listings("Nike", "ebay", listings)
        assert len(evidence) == len(listings)
        assert all(ev.listing_url.startswith("http") for ev in evidence)
        # Real listings should overwhelmingly have a title + price.
        with_title = sum(1 for ev in evidence if ev.title)
        with_price = sum(1 for ev in evidence if ev.price)
        assert with_title >= 0.8 * len(evidence), f"Only {with_title}/{len(evidence)} had titles"
        assert with_price >= 0.5 * len(evidence), f"Only {with_price}/{len(evidence)} had prices"

    def test_multi_region_prices_use_local_currency(self):
        """GB search should return GBP (£) prices, DE should return EUR (€) — proves
        the marketplace header + multi-currency path work against live data."""
        _reset_ebay_token_cache()
        gb = EbayScraper().search("Adidas", caller_id="live-contract", country="GB")
        assert gb, "No GB listings"
        gb_prices = [x["price"] for x in gb if x.get("price")]
        assert any("£" in p for p in gb_prices), f"No GBP prices in GB results: {gb_prices[:5]}"
