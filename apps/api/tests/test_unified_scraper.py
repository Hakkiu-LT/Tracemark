"""
Tests for the UnifiedScraper and its supporting components.

These tests use unittest.mock to avoid real HTTP calls during CI.
"""
import pytest
from unittest.mock import MagicMock, patch

from tracemark_api.services.unified_scraper import (
    DomainRegistry,
    detect_requires_javascript,
    UnifiedScraper,
    SCRAPE_STATIC,
    SCRAPE_JS,
    UnifiedScrapeResult,
)


# ---------------------------------------------------------------------------
# DomainRegistry tests
# ---------------------------------------------------------------------------

class TestDomainRegistry:
    def test_known_static_domains(self):
        assert DomainRegistry.classify("https://www.amazon.com/s?k=nike") == SCRAPE_STATIC
        assert DomainRegistry.classify("https://www.ebay.com/sch/i.html?_nkw=nike") == SCRAPE_STATIC
        assert DomainRegistry.classify("https://www.alibaba.com/trade/search?SearchText=nike") == SCRAPE_STATIC
        assert DomainRegistry.classify("https://www.walmart.com/search?q=nike") == SCRAPE_STATIC
        assert DomainRegistry.classify("https://www.etsy.com/search?q=nike") == SCRAPE_STATIC

    def test_known_js_heavy_domains(self):
        assert DomainRegistry.classify("https://www.aliexpress.com/wholesale?SearchText=nike") == SCRAPE_JS
        assert DomainRegistry.classify("https://www.tiktok.com/search?q=nike") == SCRAPE_JS
        assert DomainRegistry.classify("https://www.instagram.com/explore/tags/nike") == SCRAPE_JS
        assert DomainRegistry.classify("https://www.facebook.com/marketplace") == SCRAPE_JS

    def test_subdomains_are_classified_correctly(self):
        # Subdomains should inherit parent domain classification
        assert DomainRegistry.classify("https://seller.amazon.com/product") == SCRAPE_STATIC
        assert DomainRegistry.classify("https://m.aliexpress.com/wholesale?SearchText=test") == SCRAPE_JS

    def test_unknown_domains(self):
        assert DomainRegistry.classify("https://www.example.com/products") == "unknown"
        assert DomainRegistry.classify("https://counterfeit-store.shop/brand") == "unknown"
        assert DomainRegistry.classify("https://randomshop.xyz/products") == "unknown"

    def test_malformed_url_returns_unknown(self):
        assert DomainRegistry.classify("not-a-url") == "unknown"
        assert DomainRegistry.classify("") == "unknown"


# ---------------------------------------------------------------------------
# detect_requires_javascript tests (mocked HTTP)
# ---------------------------------------------------------------------------

class TestDetectRequiresJavascript:

    def _make_response(self, html: str, status_code: int = 200):
        mock_resp = MagicMock()
        mock_resp.status_code = status_code
        mock_resp.text = html
        return mock_resp

    @patch("tracemark_api.services.unified_scraper.safe_get")
    def test_empty_react_root_returns_true(self, mock_get):
        """A page with an empty #root div is a React SPA shell."""
        mock_get.return_value = self._make_response(
            "<html><body><div id='root'></div></body></html>"
        )
        assert detect_requires_javascript("https://example.com") is True

    @patch("tracemark_api.services.unified_scraper.safe_get")
    def test_content_rich_html_returns_false(self, mock_get):
        """A page with substantial text content does not need JS."""
        html = "<html><body>" + "<p>Product listing with lots of real text content.</p>" * 30 + "</body></html>"
        mock_get.return_value = self._make_response(html)
        assert detect_requires_javascript("https://example.com") is False

    @patch("tracemark_api.services.unified_scraper.safe_get")
    def test_noscript_js_warning_returns_true(self, mock_get):
        """A page that tells users to enable JavaScript needs JS rendering."""
        mock_get.return_value = self._make_response(
            "<html><body>"
            "<noscript>Please enable JavaScript to use this website.</noscript>"
            "</body></html>"
        )
        assert detect_requires_javascript("https://example.com") is True

    @patch("tracemark_api.services.unified_scraper.safe_get")
    def test_low_text_ratio_returns_true(self, mock_get):
        """Mostly script tags with almost no visible text → needs JS."""
        # Very large HTML with tiny text content
        scripts = "<script src='/webpack.chunk.js'></script>" * 20
        html = f"<html><head>{scripts}</head><body><div id='app'>x</div></body></html>"
        mock_get.return_value = self._make_response(html)
        assert detect_requires_javascript("https://example.com") is True

    @patch("tracemark_api.services.unified_scraper.safe_get")
    def test_non_200_status_returns_true(self, mock_get):
        """A 403 / 429 (bot detection) should be treated as needing JS."""
        mock_get.return_value = self._make_response("", status_code=403)
        assert detect_requires_javascript("https://example.com") is True

    @patch("tracemark_api.services.unified_scraper.safe_get")
    def test_network_error_returns_true(self, mock_get):
        """On network failure, assume JS is needed (safe default)."""
        mock_get.side_effect = ConnectionError("timeout")
        assert detect_requires_javascript("https://example.com") is True

    @patch("tracemark_api.services.unified_scraper.safe_get")
    def test_antibot_html_signatures_returns_true(self, mock_get):
        """A page containing Cloudflare or challenge signatures should return True."""
        mock_get.return_value = self._make_response(
            "<html><head><title>Just a moment...</title></head><body>cf-challenge/ray id</body></html>"
        )
        assert detect_requires_javascript("https://example.com") is True


# ---------------------------------------------------------------------------
# UnifiedScraper routing tests (mocked internal methods)
# ---------------------------------------------------------------------------

class TestUnifiedScraperRouting:
    """
    Test that scrape() calls the correct internal method based on domain type.
    We patch _scrape_static, _scrape_js, and get_cached so no real HTTP/DB calls are made.
    """

    def setup_method(self):
        from unittest.mock import patch
        self._get_cached_patch = patch("tracemark_api.services.unified_scraper.get_cached", return_value=None)
        self._get_cached_patch.start()

    def teardown_method(self):
        self._get_cached_patch.stop()

    def _make_result(self, used: str, markdown: str = "content" * 100) -> UnifiedScrapeResult:
        return UnifiedScrapeResult(url="https://example.com", title="Test", markdown=markdown, success=True, scraper_used=used)

    def test_amazon_routes_to_static(self):
        scraper = UnifiedScraper()
        with patch.object(scraper, "_scrape_static", return_value=self._make_result(SCRAPE_STATIC)) as mock_static, \
             patch.object(scraper, "_scrape_js") as mock_js:
            result = scraper.scrape("https://www.amazon.com/s?k=nike")
            mock_static.assert_called_once()
            mock_js.assert_not_called()
            assert result.scraper_used == SCRAPE_STATIC

    def test_amazon_static_failure_falls_back_to_js(self):
        """If a static domain scrape has insufficient content, it should fall back to JS scraper."""
        scraper = UnifiedScraper()
        with patch.object(scraper, "_scrape_static", return_value=self._make_result(SCRAPE_STATIC, markdown="short")) as mock_static, \
             patch.object(scraper, "_scrape_js", return_value=self._make_result(SCRAPE_JS)) as mock_js:
            result = scraper.scrape("https://www.amazon.com/s?k=nike")
            mock_static.assert_called_once()
            mock_js.assert_called_once()
            assert result.scraper_used == SCRAPE_JS

    def test_amazon_static_error_falls_back_to_js(self):
        """If a static domain scrape fails with error, it should fall back to JS scraper."""
        scraper = UnifiedScraper()
        failed_static = UnifiedScrapeResult(url="https://www.amazon.com", title=None, markdown="", success=False, error_message="Blocked", scraper_used=SCRAPE_STATIC)
        with patch.object(scraper, "_scrape_static", return_value=failed_static) as mock_static, \
             patch.object(scraper, "_scrape_js", return_value=self._make_result(SCRAPE_JS)) as mock_js:
            result = scraper.scrape("https://www.amazon.com/s?k=nike")
            mock_static.assert_called_once()
            mock_js.assert_called_once()
            assert result.scraper_used == SCRAPE_JS

    def test_aliexpress_routes_to_js(self):
        scraper = UnifiedScraper()
        with patch.object(scraper, "_scrape_js", return_value=self._make_result(SCRAPE_JS)) as mock_js, \
             patch.object(scraper, "_scrape_static") as mock_static:
            result = scraper.scrape("https://www.aliexpress.com/wholesale?SearchText=nike")
            mock_js.assert_called_once()
            mock_static.assert_not_called()
            assert result.scraper_used == SCRAPE_JS

    @patch("tracemark_api.services.unified_scraper.detect_requires_javascript", return_value=False)
    def test_unknown_domain_no_js_routes_to_static_fallback(self, mock_detect):
        """Unknown domain detected as static → scrape_with_fallback → static."""
        scraper = UnifiedScraper()
        with patch.object(scraper, "scrape_with_fallback", return_value=self._make_result(SCRAPE_STATIC)) as mock_fallback:
            result = scraper.scrape("https://randomshop.xyz/products")
            mock_fallback.assert_called_once()
            assert result.scraper_used == SCRAPE_STATIC

    @patch("tracemark_api.services.unified_scraper.detect_requires_javascript", return_value=True)
    def test_unknown_domain_needs_js_routes_directly_to_js(self, mock_detect):
        """Unknown domain heuristic detects SPA → goes directly to JS scraper."""
        scraper = UnifiedScraper()
        with patch.object(scraper, "_scrape_js", return_value=self._make_result(SCRAPE_JS)) as mock_js, \
             patch.object(scraper, "scrape_with_fallback") as mock_fallback:
            result = scraper.scrape("https://randomshop.xyz/products")
            mock_js.assert_called_once()
            mock_fallback.assert_not_called()
            assert result.scraper_used == SCRAPE_JS


# ---------------------------------------------------------------------------
# scrape_with_fallback tests
# ---------------------------------------------------------------------------

class TestScrapeWithFallback:
    def _make_static_result(self, success: bool, markdown: str = "") -> object:
        from tracemark_api.services.unified_scraper import UnifiedScrapeResult
        return UnifiedScrapeResult(
            url="https://example.com", title="T", markdown=markdown,
            success=success, scraper_used=SCRAPE_STATIC
        )

    def _make_js_result(self) -> object:
        from tracemark_api.services.unified_scraper import UnifiedScrapeResult
        return UnifiedScrapeResult(
            url="https://example.com", title="T", markdown="js content here",
            success=True, scraper_used=SCRAPE_JS
        )

    def test_good_static_result_no_js_fallback(self):
        scraper = UnifiedScraper()
        rich_markdown = "a" * 500  # well above _MIN_CONTENT_LENGTH
        with patch.object(scraper, "_scrape_static", return_value=self._make_static_result(True, rich_markdown)), \
             patch.object(scraper, "_scrape_js") as mock_js:
            result = scraper.scrape_with_fallback("https://example.com")
            mock_js.assert_not_called()
            assert result.scraper_used == SCRAPE_STATIC

    def test_empty_static_triggers_js_fallback(self):
        scraper = UnifiedScraper()
        with patch.object(scraper, "_scrape_static", return_value=self._make_static_result(True, "")), \
             patch.object(scraper, "_scrape_js", return_value=self._make_js_result()) as mock_js:
            result = scraper.scrape_with_fallback("https://example.com")
            mock_js.assert_called_once()
            assert result.scraper_used == SCRAPE_JS

    def test_failed_static_triggers_js_fallback(self):
        scraper = UnifiedScraper()
        with patch.object(scraper, "_scrape_static", return_value=self._make_static_result(False, "")), \
             patch.object(scraper, "_scrape_js", return_value=self._make_js_result()) as mock_js:
            result = scraper.scrape_with_fallback("https://example.com")
            mock_js.assert_called_once()
            assert result.scraper_used == SCRAPE_JS


# ---------------------------------------------------------------------------
# Scrape Static Antibot tests
# ---------------------------------------------------------------------------

class TestScrapeStaticAntibot:
    @patch("tracemark_api.services.unified_scraper.call_with_tracking")
    def test_scrape_static_with_antibot_returns_failure(self, mock_call):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body>Access Denied: Cloudflare ray id</body></html>"
        mock_call.return_value = mock_resp

        scraper = UnifiedScraper()
        result = scraper._scrape_static("https://example.com")
        assert result.success is False
        assert "Antibot" in result.error_message


class TestFallbackFailureLogging:
    @patch("builtins.print")
    def test_fallback_failure_prints_message(self, mock_print):
        scraper = UnifiedScraper()
        failed_static = UnifiedScrapeResult(url="https://example.com", title=None, markdown="", success=False, error_message="Static Blocked")
        failed_js = UnifiedScrapeResult(url="https://example.com", title=None, markdown="", success=False, error_message="JS Timeout", scraper_used=SCRAPE_JS)
        with patch.object(scraper, "_scrape_static", return_value=failed_static), \
             patch.object(scraper, "_scrape_js", return_value=failed_js):
            result = scraper.scrape_with_fallback("https://example.com")
            assert result.success is False
            # Verify the failure message is printed
            mock_print.assert_any_call(
                "[UnifiedScraper] Failed to scrape/retrieve information from the domain: https://example.com. "
                "Static error: Static Blocked. JS error: JS Timeout"
            )


# ---------------------------------------------------------------------------
# _looks_blocked helper tests
# ---------------------------------------------------------------------------

class TestLooksBlocked:
    def test_none_result_is_blocked(self):
        assert UnifiedScraper._looks_blocked(None) is True

    def test_failed_result_is_blocked(self):
        from tracemark_api.services.firecrawl_client import ScrapeResult
        r = ScrapeResult(url="u", title=None, markdown="", success=False, error_message="403 Forbidden")
        assert UnifiedScraper._looks_blocked(r) is True

    def test_success_but_empty_is_blocked(self):
        from tracemark_api.services.firecrawl_client import ScrapeResult
        r = ScrapeResult(url="u", title="T", markdown="short", success=True)
        assert UnifiedScraper._looks_blocked(r) is True

    def test_success_with_antibot_is_blocked(self):
        from tracemark_api.services.firecrawl_client import ScrapeResult
        r = ScrapeResult(url="u", title="T", markdown="a" * 300 + " Cloudflare ray id", success=True)
        assert UnifiedScraper._looks_blocked(r) is True

    def test_success_with_real_content_not_blocked(self):
        from tracemark_api.services.firecrawl_client import ScrapeResult
        r = ScrapeResult(url="u", title="T", markdown="Real product listing content. " * 30, success=True)
        assert UnifiedScraper._looks_blocked(r) is False


# ---------------------------------------------------------------------------
# Stealth proxy retry tests
# ---------------------------------------------------------------------------

class TestStealthProxyRetry:
    """Tests for the stealth proxy retry fallback in _scrape_js()."""

    def setup_method(self):
        """Clear in-memory caches before each test to avoid cross-test pollution."""
        from tracemark_api.services.unified_scraper import _js_cache, _js_cache_lock
        from tracemark_api.services.scrape_cache import _mem
        with _js_cache_lock:
            _js_cache.clear()
        _mem.clear()

    def _good_scrape_result(self, url: str = "https://www.amazon.com/s?k=nike") -> "ScrapeResult":
        from tracemark_api.services.firecrawl_client import ScrapeResult
        return ScrapeResult(
            url=url, title="Amazon Results",
            markdown="Product listing with lots of content. " * 30,
            html="<html>real</html>", success=True,
        )

    def _blocked_scrape_result(self, url: str = "https://www.amazon.com/s?k=nike") -> "ScrapeResult":
        from tracemark_api.services.firecrawl_client import ScrapeResult
        return ScrapeResult(
            url=url, title=None, markdown="",
            success=False, error_message="Firecrawl API returned status code 403: Blocked",
        )

    @patch("tracemark_api.services.unified_scraper.scrape_page")
    @patch("tracemark_api.services.unified_scraper.call_with_tracking")
    def test_stealth_retry_on_block(self, mock_track, mock_scrape):
        """When Firecrawl returns blocked, it should retry with proxy='stealth'."""
        blocked = self._blocked_scrape_result()
        good = self._good_scrape_result()
        # First call returns blocked, second call (stealth) returns good
        mock_track.side_effect = [blocked, good]

        scraper = UnifiedScraper()
        result = scraper._scrape_js("https://www.amazon.com/s?k=nike")

        assert result.success is True
        assert result.scraper_used == SCRAPE_JS
        assert mock_track.call_count == 2
        # Second call should be the stealth endpoint
        second_call = mock_track.call_args_list[1]
        assert second_call[0][2] == "/unified-scrape-js-stealth"

    @patch("tracemark_api.services.unified_scraper.scrape_page")
    @patch("tracemark_api.services.unified_scraper.call_with_tracking")
    def test_no_stealth_retry_on_clean_success(self, mock_track, mock_scrape):
        """When Firecrawl returns good content, no stealth retry should happen."""
        good = self._good_scrape_result()
        mock_track.return_value = good

        scraper = UnifiedScraper()
        result = scraper._scrape_js("https://www.amazon.com/s?k=nike")

        assert result.success is True
        assert mock_track.call_count == 1  # Only one call, no retry

    @patch("tracemark_api.services.unified_scraper.scrape_page")
    @patch("tracemark_api.services.unified_scraper.call_with_tracking")
    def test_stealth_retry_exhausted(self, mock_track, mock_scrape):
        """When both basic and stealth fail, result should be failure."""
        blocked = self._blocked_scrape_result()
        # Both calls return blocked
        mock_track.side_effect = [blocked, blocked]

        scraper = UnifiedScraper()
        result = scraper._scrape_js("https://www.amazon.com/s?k=nike")

        assert result.success is False
        assert mock_track.call_count == 2

    @patch("tracemark_api.services.unified_scraper.scrape_page")
    @patch("tracemark_api.services.unified_scraper.call_with_tracking")
    def test_stealth_retry_infers_country_from_amazon_de(self, mock_track, mock_scrape):
        """Scraping amazon.de without explicit location should infer DE for stealth retry."""
        blocked = self._blocked_scrape_result("https://www.amazon.de/s?k=nike")
        good = self._good_scrape_result("https://www.amazon.de/s?k=nike")
        mock_track.side_effect = [blocked, good]

        scraper = UnifiedScraper()
        result = scraper._scrape_js("https://www.amazon.de/s?k=nike")

        assert result.success is True
        # The stealth call's lambda captures the location — verify via the
        # call_with_tracking invocation that /unified-scrape-js-stealth was used
        second_call = mock_track.call_args_list[1]
        assert second_call[0][2] == "/unified-scrape-js-stealth"

    @patch("tracemark_api.services.unified_scraper.scrape_page")
    @patch("tracemark_api.services.unified_scraper.call_with_tracking")
    def test_stealth_retry_preserves_explicit_location(self, mock_track, mock_scrape):
        """If an explicit location is passed, stealth retry should use it, not infer."""
        blocked = self._blocked_scrape_result()
        good = self._good_scrape_result()
        mock_track.side_effect = [blocked, good]
        explicit_location = {"country": "GB", "languages": ["en-GB"]}

        scraper = UnifiedScraper()
        result = scraper._scrape_js(
            "https://www.amazon.com/s?k=nike",
            location=explicit_location,
        )

        assert result.success is True
        assert mock_track.call_count == 2


# ---------------------------------------------------------------------------
# Geo infer_country_from_url tests
# ---------------------------------------------------------------------------

class TestInferCountryFromUrl:
    def test_amazon_us(self):
        from tracemark_api.services.geo import infer_country_from_url
        assert infer_country_from_url("https://www.amazon.com/s?k=test") == "US"

    def test_amazon_de(self):
        from tracemark_api.services.geo import infer_country_from_url
        assert infer_country_from_url("https://www.amazon.de/s?k=test") == "DE"

    def test_amazon_co_uk(self):
        from tracemark_api.services.geo import infer_country_from_url
        assert infer_country_from_url("https://www.amazon.co.uk/s?k=test") == "GB"

    def test_ebay_de(self):
        from tracemark_api.services.geo import infer_country_from_url
        assert infer_country_from_url("https://www.ebay.de/sch/i.html") == "DE"

    def test_unknown_domain_defaults_us(self):
        from tracemark_api.services.geo import infer_country_from_url
        assert infer_country_from_url("https://www.randomshop.xyz/products") == "US"

    def test_malformed_url_defaults_us(self):
        from tracemark_api.services.geo import infer_country_from_url
        assert infer_country_from_url("not-a-url") == "US"

