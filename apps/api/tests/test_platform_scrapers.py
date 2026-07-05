"""
test_platform_scrapers.py
=========================
Unit tests for platform-specific scrapers using mocked HTTP responses.

Tests verify:
  - HTML parsing selectors for static scrapers (eBay, Etsy, Google Shopping)
  - Shopify /products.json parsing
  - JS-heavy scrapers delegate to UnifiedScraper correctly
  - MarketplaceScraper.scrape_all_sources() routes all platforms
"""
import json
import pytest
from unittest.mock import patch, MagicMock

from tracemark_api.services.marketplace import (
    AmazonScraper,
    EbayScraper,
    EtsyScraper,
    AlibabaScraper,
    AliExpressScraper,
    ShopifyScraper,
    FacebookMarketplaceScraper,
    TikTokScraper,
    InstagramScraper,
    GoogleShoppingScraper,
    GoogleSERPAPI,
    GoogleAdsAPI,
    MetaAdsAPI,
    MarketplaceScraper,
)
from tracemark_api.services.unified_scraper import UnifiedScrapeResult



@pytest.fixture(autouse=True)
def mock_tracker_not_blocked():
    with patch("tracemark_api.services.api_usage_tracker.tracker.is_blocked", return_value=False), \
         patch("tracemark_api.services.api_usage_tracker.tracker.record", return_value=None):
        yield


# ---------------------------------------------------------------------------
# Fixtures: mock HTML content for static scrapers
# ---------------------------------------------------------------------------

EBAY_HTML = """
<html>
<body>
<ul>
  <li class="s-item">
    <div class="s-item__title"><span>Shop on eBay</span></div>
    <a class="s-item__link" href="https://ebay.com/itm/111"></a>
  </li>
  <li class="s-item">
    <div class="s-item__title"><span>Genuine Brand Widget - New Sealed</span></div>
    <span class="s-item__price">$24.99</span>
    <a class="s-item__link" href="https://ebay.com/itm/222?tracking=abc"></a>
    <img class="s-item__image-img" src="https://img.ebay.com/222.jpg" />
    <span class="s-item__seller-info-text">seller123 (99.8%)</span>
    <span class="s-item__subtitle">Brand New</span>
  </li>
  <li class="s-item">
    <div class="s-item__title"><span>Another Brand Item</span></div>
    <span class="s-item__price">$12.50</span>
    <a class="s-item__link" href="https://ebay.com/itm/333"></a>
  </li>
</ul>
</body>
</html>
"""

ETSY_HTML = """
<html>
<body>
<div class="wt-grid">
  <div class="v2-listing-card" data-listing-id="1001">
    <a class="listing-link" href="https://www.etsy.com/listing/1001/handmade-brand-pillow">
      <img src="https://img.etsystatic.com/1001.jpg" />
    </a>
    <div class="v2-listing-card__info">
      <h3>Handmade Brand Pillow</h3>
    </div>
    <span class="currency-value">29.99</span>
    <div class="v2-listing-card__shop">CraftyShop</div>
  </div>
  <div class="v2-listing-card" data-listing-id="1002">
    <a class="listing-link" href="https://www.etsy.com/listing/1002/custom-logo-mug">
      <img src="https://img.etsystatic.com/1002.jpg" />
    </a>
    <div class="v2-listing-card__info">
      <h3>Custom Logo Mug</h3>
    </div>
    <span class="currency-value">14.50</span>
    <div class="v2-listing-card__shop">MugWorld</div>
  </div>
</div>
</body>
</html>
"""

GOOGLE_SHOPPING_HTML = """
<html>
<body>
<div class="sh-dgr__gr-auto">
  <h3 class="tAxDx">Brand Widget Premium</h3>
  <span class="a8Pemb">$39.99</span>
  <span class="aULzUe">WidgetStore</span>
  <a href="/shopping/product/12345">Link</a>
</div>
<div class="sh-dgr__gr-auto">
  <h3 class="tAxDx">Cheap Brand Clone</h3>
  <span class="a8Pemb">$9.99</span>
  <span class="aULzUe">CheapGoods</span>
  <a href="/shopping/product/67890">Link</a>
</div>
</body>
</html>
"""

SHOPIFY_PRODUCTS_JSON = {
    "products": [
        {
            "title": "Brand Widget Knockoff",
            "handle": "brand-widget-knockoff",
            "vendor": "FakeVendor",
            "variants": [{"price": "19.99"}],
            "images": [{"src": "https://cdn.shopify.com/img1.jpg"}],
        },
        {
            "title": "Official Brand Case",
            "handle": "official-brand-case",
            "vendor": "CaseStore",
            "variants": [{"price": "29.99"}],
            "images": [],
        },
    ]
}

AMAZON_HTML = """
<html>
<body>
  <div data-component-type="s-search-result">
    <h2><span>Official Brand Watch</span></h2>
    <span class="a-price"><span class="a-offscreen">$199.99</span></span>
    <span class="a-size-small"><span class="a-color-secondary">WatchMaker Store</span></span>
    <h2><a href="/dp/B08XWW9XYZ">Link</a></h2>
    <span class="a-icon-alt">4.5 out of 5 stars</span>
    <span class="a-size-small"><a class="a-link-normal" href="#">1,234</a></span>
  </div>
  <div data-component-type="s-search-result">
    <h2><span>Counterfeit Brand Watch</span></h2>
    <span class="a-price"><span class="a-offscreen">$29.99</span></span>
    <h2><a href="/dp/B08XWW9ABC">Link</a></h2>
  </div>
</body>
</html>
"""

ALIBABA_HTML = """
<html>
<body>
  <div class="organic-list-offer-outter">
    <div class="elements-title-normal__content">Super Brand Widget</div>
    <div class="elements-offer-price-normal__price">$0.50 - $1.00</div>
    <a href="//www.alibaba.com/product-detail/123.html">Link</a>
  </div>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Helper: create a mocked UnifiedScrapeResult
# ---------------------------------------------------------------------------

def _mock_scrape_result(html: str = "", markdown: str = "", success: bool = True) -> UnifiedScrapeResult:
    return UnifiedScrapeResult(
        url="https://test.example.com",
        title="Test",
        markdown=markdown or "test markdown content",
        html=html or None,
        success=success,
    )


# ---------------------------------------------------------------------------
# eBay Scraper Tests
# ---------------------------------------------------------------------------

class TestEbayScraper:
    def test_parses_ebay_listings(self):
        scraper = EbayScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(html=EBAY_HTML)
            results = scraper.search("TestBrand", max_pages=1, caller_id="test")

        # "Shop on eBay" card should be filtered out
        assert len(results) == 2
        assert results[0]["title"] == "Genuine Brand Widget - New Sealed"
        assert results[0]["price"] == "$24.99"
        assert results[0]["seller"] == "seller123 (99.8%)"
        # Tracking params should be stripped
        assert results[0]["url"] == "https://ebay.com/itm/222"
        assert results[0]["image"] == "https://img.ebay.com/222.jpg"

    def test_returns_empty_on_failure(self):
        scraper = EbayScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(success=False)
            results = scraper.search("TestBrand", max_pages=1)
        assert results == []

    @patch("tracemark_api.services.marketplace.call_with_tracking")
    def test_ebay_search_via_api(self, mock_call):
        scraper = EbayScraper()
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "findItemsByKeywordsResponse": [{
                "ack": ["Success"],
                "searchResult": [{
                    "item": [{
                        "title": ["API Brand Item"],
                        "viewItemURL": ["https://ebay.com/itm/999"],
                        "sellingStatus": [{"currentPrice": [{"__value__": "29.99"}]}],
                        "galleryURL": ["https://img.ebay.com/999.jpg"],
                        "sellerInfo": [{"sellerUserName": ["api_seller"]}]
                    }]
                }]
            }]
        }
        mock_call.return_value = mock_resp

        with patch.dict("os.environ", {"EBAY_APP_ID": "mock_app_id"}):
            results = scraper.search("TestBrand", max_pages=1, caller_id="test")

        assert len(results) == 1
        assert results[0]["title"] == "API Brand Item"
        assert results[0]["price"] == "$29.99"
        assert results[0]["seller"] == "api_seller"
        assert results[0]["url"] == "https://ebay.com/itm/999"
        assert results[0]["image"] == "https://img.ebay.com/999.jpg"


# ---------------------------------------------------------------------------
# Etsy Scraper Tests
# ---------------------------------------------------------------------------

class TestEtsyScraper:
    def test_parses_etsy_listings(self):
        scraper = EtsyScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(html=ETSY_HTML)
            results = scraper.search("TestBrand", max_pages=1, caller_id="test")

        assert len(results) == 2
        assert results[0]["title"] == "Handmade Brand Pillow"
        assert results[0]["price"] == "29.99"
        assert results[0]["seller"] == "CraftyShop"
        assert "listing/1001" in results[0]["url"]


# ---------------------------------------------------------------------------
# Google Shopping Scraper Tests
# ---------------------------------------------------------------------------

class TestGoogleShoppingScraper:
    def test_parses_shopping_cards(self):
        scraper = GoogleShoppingScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(html=GOOGLE_SHOPPING_HTML)
            results = scraper.search("TestBrand", caller_id="test")

        assert len(results) == 2
        assert results[0]["title"] == "Brand Widget Premium"
        assert results[0]["price"] == "$39.99"
        assert results[0]["seller"] == "WidgetStore"
        assert "/shopping/product/12345" in results[0]["url"]


# ---------------------------------------------------------------------------
# Shopify Scraper Tests
# ---------------------------------------------------------------------------

class TestShopifyScraper:
    def test_parses_products_json(self):
        """Test that Shopify scraper correctly parses /products.json responses."""
        scraper = ShopifyScraper()

        # Mock SERP response that includes a myshopify.com link
        serp_html = """
        <html><body>
        <a href="/url?q=https://fake-store.myshopify.com/products/test">
          <h3>Fake Store</h3>
        </a>
        </body></html>
        """
        mock_serp_result = _mock_scrape_result(html=serp_html)

        # Mock the products.json HTTP response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = SHOPIFY_PRODUCTS_JSON

        with patch.object(scraper._scraper, "scrape", return_value=mock_serp_result):
            with patch("tracemark_api.services.marketplace.call_with_tracking", return_value=mock_response):
                results = scraper.search("TestBrand", caller_id="test")

        assert len(results) == 2
        assert results[0]["title"] == "Brand Widget Knockoff"
        assert results[0]["price"] == "$19.99"
        assert results[0]["seller"] == "FakeVendor"


# ---------------------------------------------------------------------------
# JS-heavy Scraper Tests (AliExpress, TikTok, Instagram, Facebook Marketplace)
# ---------------------------------------------------------------------------

class TestJsHeavyScrapers:
    def test_aliexpress_returns_markdown(self):
        scraper = AliExpressScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(markdown="AliExpress product listings...")
            result = scraper.search("TestBrand", caller_id="test")
        assert isinstance(result, str)
        assert "AliExpress" in result

    @patch("tracemark_api.services.marketplace.call_with_tracking")
    def test_aliexpress_search_via_api(self, mock_call):
        scraper = AliExpressScraper()
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "aliexpress_affiliate_product_query_response": {
                "resp_result": {
                    "result": {
                        "products": {
                            "product": [{
                                "product_title": "API AliExpress Item",
                                "product_detail_url": "https://aliexpress.com/item/111.html",
                                "target_original_price": "15.99",
                                "shop_info": {"shop_name": "API Shop"}
                            }]
                        }
                    }
                }
            }
        }
        mock_call.return_value = mock_resp

        with patch.dict("os.environ", {"ALIEXPRESS_APP_KEY": "key", "ALIEXPRESS_APP_SECRET": "secret"}):
            result = scraper.search("TestBrand", caller_id="test")

        assert isinstance(result, str)
        parsed = json.loads(result)
        assert len(parsed) == 1
        assert parsed[0]["title"] == "API AliExpress Item"
        assert parsed[0]["price"] == "15.99"
        assert parsed[0]["seller"] == "API Shop"
        assert parsed[0]["url"] == "https://aliexpress.com/item/111.html"

    def test_tiktok_returns_markdown(self):
        scraper = TikTokScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(markdown="TikTok videos about brand...")
            result = scraper.search("TestBrand", caller_id="test")
        assert isinstance(result, str)
        assert "TikTok" in result

    def test_instagram_returns_markdown(self):
        scraper = InstagramScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(markdown="Instagram posts tagged #testbrand...")
            result = scraper.search("TestBrand", caller_id="test")
        assert isinstance(result, str)

    def test_facebook_marketplace_returns_empty_when_blocked(self):
        scraper = FacebookMarketplaceScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            # Simulate Facebook blocking (short content)
            mock_scrape.return_value = _mock_scrape_result(markdown="Login required")
            result = scraper.search("TestBrand", caller_id="test")
        assert result == ""

    def test_facebook_marketplace_returns_content_when_successful(self):
        scraper = FacebookMarketplaceScraper()
        content = "A" * 200  # > 100 chars = considered successful
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(markdown=content)
            result = scraper.search("TestBrand", caller_id="test")
        assert len(result) > 100


# ---------------------------------------------------------------------------
# MarketplaceScraper Integration Tests
# ---------------------------------------------------------------------------

class TestMarketplaceScraperIntegration:
    @patch.dict("os.environ", {}, clear=True)
    def test_scrape_all_sources_routes_all_platforms(self):
        """Verify all platforms route correctly and don't raise."""
        all_platforms = [
            "amazon", "ebay", "alibaba", "etsy", "google_shopping",
            "aliexpress", "shopify", "facebook_marketplace",
            "tiktok", "instagram",
            "google_ads", "meta_ads", "domains",
        ]
        scraper = MarketplaceScraper()

        # Mock all internal scrapers to return empty
        for attr in [
            "amazon", "ebay", "alibaba", "etsy", "google_shopping",
            "aliexpress", "shopify", "facebook_marketplace",
            "tiktok", "instagram", "google_ads", "meta_ads", "serp",
        ]:
            mock = MagicMock()
            mock.search.return_value = [] if attr not in ("aliexpress", "facebook_marketplace", "tiktok", "instagram") else ""
            setattr(scraper, attr, mock)

        # Also mock serp's check_serp_domains
        scraper.serp.check_serp_domains = MagicMock(return_value=[])

        results, blocked = scraper.scrape_all_sources("TestBrand", all_platforms)

        assert isinstance(results, dict)
        assert "marketplaces" in results
        assert "ads" in results
        assert "social" in results
        assert "domains" in results
        assert isinstance(blocked, list)


# ---------------------------------------------------------------------------
# Amazon Scraper Tests
# ---------------------------------------------------------------------------

class TestAmazonScraper:
    def test_parses_amazon_listings(self):
        scraper = AmazonScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(html=AMAZON_HTML)
            results = scraper.search("TestBrand", max_pages=1, caller_id="test")

        assert len(results) == 2
        assert results[0]["title"] == "Official Brand Watch"
        assert results[0]["price"] == "$199.99"
        assert results[0]["seller"] == "WatchMaker Store"
        assert results[0]["url"] == "https://amazon.com/dp/B08XWW9XYZ"
        assert results[0]["rating"] == "4.5"
        assert results[0]["reviews"] == "1,234"

        assert results[1]["title"] == "Counterfeit Brand Watch"
        assert results[1]["price"] == "$29.99"
        assert results[1]["seller"] is None
        assert results[1]["url"] == "https://amazon.com/dp/B08XWW9ABC"

    def test_returns_empty_on_failure(self):
        scraper = AmazonScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(success=False)
            results = scraper.search("TestBrand", max_pages=1)
        assert results == []


# ---------------------------------------------------------------------------
# Alibaba Scraper Tests
# ---------------------------------------------------------------------------

class TestAlibabaScraper:
    def test_parses_alibaba_listings(self):
        scraper = AlibabaScraper()
        with patch.object(scraper._scraper, "scrape") as mock_scrape:
            mock_scrape.return_value = _mock_scrape_result(html=ALIBABA_HTML)
            results = scraper.search("TestBrand", max_pages=1, caller_id="test")

        assert len(results) == 1
        assert results[0]["title"] == "Super Brand Widget"
        assert results[0]["price"] == "$0.50 - $1.00"
        assert results[0]["url"] == "https://www.alibaba.com/product-detail/123.html"

    @patch("tracemark_api.services.marketplace.call_with_tracking")
    def test_alibaba_search_via_api(self, mock_call):
        scraper = AlibabaScraper()
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "alibaba_icbu_product_search_response": {
                "products": {
                    "product": [{
                        "subject": "API Wholesale Widget",
                        "product_id": "456",
                        "price": "US $1.50"
                    }]
                }
            }
        }
        mock_call.return_value = mock_resp

        with patch.dict("os.environ", {"ALIBABA_APP_KEY": "key", "ALIBABA_APP_SECRET": "secret"}):
            results = scraper.search("TestBrand", max_pages=1, caller_id="test")

        assert len(results) == 1
        assert results[0]["title"] == "API Wholesale Widget"
        assert results[0]["price"] == "US $1.50"
        assert results[0]["url"] == "https://www.alibaba.com/product-detail/456.html"


# ---------------------------------------------------------------------------
# Google SERP API Tests
# ---------------------------------------------------------------------------

class TestGoogleSERPAPI:
    @patch("tracemark_api.services.marketplace.requests.get")
    @patch("whois.whois")
    def test_check_serp_domains(self, mock_whois, mock_get):
        serp = GoogleSERPAPI()
        
        # Mock Google search HTTP response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = """
        <html><body>
          <a href="/url?q=https://testbrand-infringing-store-xyz.com/product-page"><h3>Fake Store Link</h3></a>
          <a href="https://legitimate-store.com"><h3>Another Link</h3></a>
        </body></html>
        """
        mock_get.return_value = mock_resp

        # Mock WHOIS response
        mock_w = MagicMock()
        mock_w.registrar = "GoDaddy.com, LLC"
        mock_w.creation_date = "2025-01-01"
        mock_w.expiration_date = "2027-01-01"
        mock_w.name_servers = ["ns1.godaddy.com", "ns2.godaddy.com"]
        mock_w.get.side_effect = lambda key, default=None: {
            "org": "Fake Corp LLC",
            "country": "CN",
            "emails": "abuse@godaddy.com",
        }.get(key, default)
        mock_whois.return_value = mock_w

        # Mock domain whitelist behavior to not filter testbrand-infringing-store-xyz.com
        with patch("tracemark_api.services.marketplace.whitelist_service.is_whitelisted", return_value=False):
            with patch.dict("os.environ", {}, clear=True):
                results = serp.check_serp_domains("TestBrand", caller_id="test")

        assert len(results) >= 1
        assert any(r["domain"] == "testbrand-infringing-store-xyz.com" for r in results)
        target = next(r for r in results if r["domain"] == "testbrand-infringing-store-xyz.com")
        assert target["registrant"] == "GoDaddy.com, LLC"
        assert target["name_servers"] == ["ns1.godaddy.com", "ns2.godaddy.com"]
        assert target["registrant_organization"] == "Fake Corp LLC"
        assert target["registrant_country"] == "CN"
        assert target["registrant_email"] == "abuse@godaddy.com"

    @patch("tracemark_api.services.marketplace.requests.post")
    @patch("tracemark_api.services.marketplace.requests.get")
    def test_search_falls_back_to_searchcans_when_google_serp_blocked(self, mock_get, mock_post):
        serp = GoogleSERPAPI()
        
        # SearchCans response mock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": {
                "organic": [
                    {"title": "Fake Watch", "link": "https://testbrand-suspicious-watch-shop.com/item1"},
                    {"title": "Legit Site", "link": "https://testbrand-legit-site.com/home"}
                ]
            }
        }
        mock_post.return_value = mock_resp
        
        env_vars = {
            "GOOGLE_SERP_API": "serp_key",
            "SEARCHCANS_API": "searchcans_key"
        }
        
        from tracemark_api.services.api_usage_tracker import tracker
        def side_effect_is_blocked(api_key):
            if api_key == "google_serp":
                return True
            return False
            
        with patch.object(tracker, "is_blocked", side_effect=side_effect_is_blocked):
            with patch.dict("os.environ", env_vars, clear=True):
                with patch("tracemark_api.services.marketplace.whitelist_service.is_whitelisted", return_value=False):
                    results = serp.search("TestBrand", max_pages=1, caller_id="test")
        
        mock_post.assert_called_once()
        mock_get.assert_not_called()
        assert "testbrand-suspicious-watch-shop.com" in results
        assert "testbrand-legit-site.com" in results

    @patch("tracemark_api.services.marketplace.requests.post")
    def test_searchcans_yield_measurement(self, mock_post):
        serp = GoogleSERPAPI()
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": {
                "organic": [
                    {"title": "Watch Shop 1", "link": "https://testbrand-shop1.com/item1"},
                    {"title": "Watch Shop 2", "link": "https://testbrand-shop2.com/item2"},
                    {"title": "Duplicate Shop 1", "link": "https://testbrand-shop1.com/item3"},
                    {"title": "Official Shop", "link": "https://testbrand.com/home"},
                    {"title": "Whitelisted Shop", "link": "https://google.com/search"}
                ]
            }
        }
        mock_post.return_value = mock_resp
        
        env_vars = {
            "SEARCHCANS_API": "searchcans_key"
        }
        
        with patch.dict("os.environ", env_vars, clear=True):
            with patch("tracemark_api.services.marketplace.whitelist_service.is_whitelisted") as mock_whitelist:
                mock_whitelist.side_effect = lambda d: d == "google.com"
                results = serp.search("TestBrand", max_pages=1, caller_id="test")
                
        assert len(results) == 2
        assert "testbrand-shop1.com" in results
        assert "testbrand-shop2.com" in results
        
        credits_used = 1
        yield_per_credit = len(results) / credits_used
        print(f"\n[Yield Monitor] SearchCans achieved {yield_per_credit} unique domain detections per credit used.")
        assert yield_per_credit == 2.0


# ---------------------------------------------------------------------------
# Google Ads API Tests
# ---------------------------------------------------------------------------

class TestGoogleAdsAPI:
    @patch("tracemark_api.services.marketplace.requests.get")
    def test_search_json_success(self, mock_get):
        ads_api = GoogleAdsAPI()
        
        # Setup mock response for public ads JSON API
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "ads": [
                {
                    "advertiser_name": "BadGuyStore",
                    "ad_text": "Cheap TestBrand items 50% off",
                    "destination_url": "https://fake-testbrand.com",
                    "impressions_range": "10k-50k",
                    "first_shown_date": "2026-06-20"
                }
            ]
        }
        mock_get.return_value = mock_resp

        results = ads_api.search("TestBrand", caller_id="test")
        assert len(results) == 1
        assert results[0]["advertiser"] == "BadGuyStore"
        assert "50% off" in results[0]["ad_text"]
        assert results[0]["destination_url"] == "https://fake-testbrand.com"

    @patch("tracemark_api.services.marketplace.requests.get")
    def test_search_json_fails_falls_back_to_html(self, mock_get):
        ads_api = GoogleAdsAPI()
        
        # JSON returns 500, but fallback HTML scrape succeeds
        mock_json_resp = MagicMock()
        mock_json_resp.status_code = 500
        
        mock_html_resp = MagicMock()
        mock_html_resp.status_code = 200
        mock_html_resp.text = """
        <html><body>
          <div data-advertiser-name="ImposterShop">
            <span class="headline">Impersonating TestBrand widget</span>
            <a href="https://bad-shop.net">Link</a>
          </div>
        </body></html>
        """
        mock_get.side_effect = [mock_json_resp, mock_html_resp]

        results = ads_api.search("TestBrand", caller_id="test")
        assert len(results) == 1
        assert results[0]["advertiser"] == "ImposterShop"
        assert "Impersonating" in results[0]["ad_text"]
        assert results[0]["destination_url"] == "https://bad-shop.net"


# ---------------------------------------------------------------------------
# Meta Ads API Tests
# ---------------------------------------------------------------------------

class TestMetaAdsAPI:
    @patch("tracemark_api.services.marketplace.requests.get")
    @patch("tracemark_api.services.marketplace._meta_screenshot", return_value="https://supabase.co/shot.png")
    def test_search_meta_success(self, mock_screenshot, mock_get):
        ads_api = MetaAdsAPI()
        
        # Setup mock response for Meta Ads Graph API
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": [
                {
                    "id": "11223344",
                    "page_name": "MetaImposter",
                    "ad_creative_bodies": ["Authentic TestBrand on sale now"],
                    "ad_snapshot_url": "https://facebook.com/ads/snapshot/1",
                    "impressions": {"lower_bound": 5000}
                }
            ]
        }
        mock_get.return_value = mock_resp

        with patch.dict("os.environ", {"META_ADS_ACCESS_TOKEN": "valid_token"}):
            results = ads_api.search("TestBrand", caller_id="test")

        assert len(results) == 1
        assert results[0]["advertiser"] == "MetaImposter"
        assert "Authentic" in results[0]["ad_text"]
        assert results[0]["destination_url"] == "https://www.facebook.com/ads/library/?id=11223344"
        assert results[0]["screenshot_url"] == "https://supabase.co/shot.png"

    def test_search_skips_when_no_token(self):
        ads_api = MetaAdsAPI()
        with patch.dict("os.environ", {}, clear=True):
            results = ads_api.search("TestBrand", caller_id="test")
        assert results == []


# ---------------------------------------------------------------------------
# Playwright Client Tests
# ---------------------------------------------------------------------------

class TestPlaywrightClient:
    def test_local_screenshot_takes_bytes(self):
        from tracemark_api.services.playwright_client import take_local_screenshot
        with patch("playwright.sync_api.sync_playwright") as mock_sync:
            mock_browser = MagicMock()
            mock_page = MagicMock()
            mock_page.screenshot.return_value = b"fake_png_data"
            mock_browser.new_page.return_value = mock_page
            mock_sync.return_value.__enter__.return_value.chromium.launch.return_value = mock_browser

            result = take_local_screenshot("https://example.com")
            assert result == b"fake_png_data"


class TestCachedScreenshotRouting:
    @patch("tracemark_api.services.marketplace._screenshot_cache", {})
    @patch("tracemark_api.services.playwright_client.take_local_screenshot")
    @patch("tracemark_api.services.firecrawl_client.screenshot_page")
    @patch("tracemark_api.services.storage.upload_screenshot_bytes")
    @patch("tracemark_api.services.storage.upload_screenshot")
    def test_routes_static_domain_to_playwright(self, mock_upload_fc, mock_upload_pw, mock_fc_screenshot, mock_pw_screenshot):
        from tracemark_api.services.marketplace import _cached_screenshot
        mock_pw_screenshot.return_value = b"png_data"
        mock_upload_pw.return_value = "https://supabase.co/pw_shot.png"
        
        # Disable database call inside _cached_screenshot
        with patch("tracemark_api.services.database.get_supabase") as mock_db:
            mock_db.side_effect = Exception("No DB in test")
            url = "https://ebay.com/itm/12345"
            res = _cached_screenshot(url, prefix="test")
            
            assert res == "https://supabase.co/pw_shot.png"
            mock_pw_screenshot.assert_called_once_with(url)
            mock_fc_screenshot.assert_not_called()

    @patch("tracemark_api.services.marketplace._screenshot_cache", {})
    @patch("tracemark_api.services.playwright_client.take_local_screenshot")
    @patch("tracemark_api.services.firecrawl_client.screenshot_page")
    @patch("tracemark_api.services.storage.upload_screenshot_bytes")
    @patch("tracemark_api.services.storage.upload_screenshot")
    def test_routes_js_domain_to_firecrawl(self, mock_upload_fc, mock_upload_pw, mock_fc_screenshot, mock_pw_screenshot):
        from tracemark_api.services.marketplace import _cached_screenshot
        mock_fc_screenshot.return_value = "https://firecrawl.dev/temp.png"
        mock_upload_fc.return_value = "https://supabase.co/fc_shot.png"
        
        with patch("tracemark_api.services.database.get_supabase") as mock_db:
            mock_db.side_effect = Exception("No DB in test")
            url = "https://tiktok.com/@infringer/video/1"
            res = _cached_screenshot(url, prefix="test")
            
            assert res == "https://supabase.co/fc_shot.png"
            mock_fc_screenshot.assert_called_once_with(url)
            mock_pw_screenshot.assert_not_called()


class TestAIDomainEvaluation:
    @patch("tracemark_api.services.marketplace.ChatGoogleGenerativeAI")
    def test_extract_domain_evaluations_with_ai(self, mock_llm_class):
        from tracemark_api.services.marketplace import extract_domain_evaluations_with_ai, DomainEvaluation, DomainEvaluationList
        
        mock_llm = MagicMock()
        mock_llm_class.return_value = mock_llm
        
        mock_structured = MagicMock()
        mock_llm.with_structured_output.return_value = mock_structured
        
        mock_structured.invoke.return_value = DomainEvaluationList(
            items=[
                DomainEvaluation(
                    domain_name="njctl.org",
                    is_clone=False,
                    similarity_score=15,
                    reasoning="Unrelated generic teaching organization."
                ),
                DomainEvaluation(
                    domain_name="buyderila.com",
                    is_clone=True,
                    similarity_score=92,
                    reasoning="Impersonating store using brand name."
                )
            ]
        )
        
        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake_key"}):
            results = extract_domain_evaluations_with_ai(
                brand_name="derila",
                domains_data=[{"domain": "njctl.org"}, {"domain": "buyderila.com"}],
                caller_id="test"
            )
            
        assert len(results) == 2
        assert results[0].domain_name == "njctl.org"
        assert results[0].is_clone is False
        assert results[0].similarity_score == 15
        assert results[1].domain_name == "buyderila.com"
        assert results[1].is_clone is True
        assert results[1].similarity_score == 92
