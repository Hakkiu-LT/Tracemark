"""
unified_scraper.py
==================
General-purpose web scraper with smart routing.

Strategy:
  Tier 1 - Known static domains  → requests + BeautifulSoup (free, runs on local resources)
  Tier 2 - Known JS-heavy domains → Firecrawl (paid external API, use sparingly)
  Tier 3 - Unknown domains        → heuristic JS-detection probe → static first, JS fallback

Usage
-----
    from tracemark_api.services.unified_scraper import UnifiedScraper

    scraper = UnifiedScraper()
    result = scraper.scrape("https://www.amazon.com/s?k=nike", caller_id="user@example.com")
    # result.markdown contains the page content
    # result.scraper_used is "static" or "js"
"""
from __future__ import annotations

import re
import urllib.parse
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup

from tracemark_api.services.firecrawl_client import scrape_page, ScrapeResult
from tracemark_api.services.api_usage_tracker import (
    call_with_tracking,
    ApiLimitError,
)

# ---------------------------------------------------------------------------
# Shared browser-like request headers
# ---------------------------------------------------------------------------
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ---------------------------------------------------------------------------
# ScrapeType enum-like constants
# ---------------------------------------------------------------------------
SCRAPE_STATIC = "static"
SCRAPE_JS = "js"

# Minimum meaningful content length (characters) from a static scrape
_MIN_CONTENT_LENGTH = 200


# ---------------------------------------------------------------------------
# DomainRegistry — classifies URLs into routing tiers
# ---------------------------------------------------------------------------

class DomainRegistry:
    """
    Maps known domains to their rendering requirements.

    Classification:
      "static"   — Page content is fully present in the raw HTML response.
                   Scraping with plain HTTP requests is sufficient.
      "js_heavy" — Page relies on client-side JS to render meaningful content.
                   Must be scraped with a headless browser / Firecrawl.
      "unknown"  — Not in either list; run the heuristic probe at runtime.
    """

    STATIC_DOMAINS: frozenset[str] = frozenset([
        # Marketplaces
        "amazon.com",
        "ebay.com",
        "alibaba.com",
        "walmart.com",
        "etsy.com",
        "craigslist.org",
        # Brand-monitoring targets
        "google.com",
        "adstransparency.google.com",
        "wikipedia.org",
        # Retail / wholesale
        "dhgate.com",
        "made-in-china.com",
        "tradekey.com",
    ])

    JS_HEAVY_DOMAINS: frozenset[str] = frozenset([
        # Require JS rendering
        "aliexpress.com",
        "tiktok.com",
        "instagram.com",
        "facebook.com",
        "twitter.com",
        "x.com",
        "pinterest.com",
        "shopify.com",
        "taobao.com",
        "jd.com",
        "rakuten.com",
    ])

    @classmethod
    def classify(cls, url: str) -> str:
        """
        Returns "static", "js_heavy", or "unknown".
        Matches on domain suffix so subdomains are covered automatically.
        """
        try:
            netloc = urllib.parse.urlparse(url).netloc.lower()
            if netloc.startswith("www."):
                netloc = netloc[4:]
        except Exception:
            return "unknown"

        for domain in cls.STATIC_DOMAINS:
            if netloc == domain or netloc.endswith("." + domain):
                return SCRAPE_STATIC

        for domain in cls.JS_HEAVY_DOMAINS:
            if netloc == domain or netloc.endswith("." + domain):
                return SCRAPE_JS

        return "unknown"


# ---------------------------------------------------------------------------
# JS heuristic detection
# ---------------------------------------------------------------------------

#: Script src patterns that indicate a JS-rendered Single Page Application
_SPA_SCRIPT_PATTERNS = (
    "/next/static/",
    "/_nuxt/",
    "/nuxt/",
    "webpack",
    "chunk",
    ".bundle.",
    "react",
    "vue",
    "angular",
    "ember",
    "svelte",
)

#: CSS selectors for common SPA mount-point divs
_SPA_MOUNT_SELECTORS = "#root, #app, #__next, [data-reactroot], #__nuxt"

#: Ratio of visible text to raw HTML below which we assume a JS shell
_LOW_TEXT_RATIO_THRESHOLD = 0.10

#: Common signatures indicating an antibot or challenge page (Cloudflare, CAPTCHA, etc.)
_ANTIBOT_SIGNATURES = (
    "cloudflare",
    "cf-challenge",
    "cf-browser-verification",
    "ray id",
    "ddos-guard",
    "sucuri",
    "imperva",
    "incapsula",
    "distil networks",
    "distilnetworks",
    "recaptcha",
    "hcaptcha",
    "captcha",
    "pardon our interruption",
    "block key",
    "access denied",
    "security check",
    "just a moment...",
)


def contains_antibot(html: str) -> bool:
    """Check if the HTML contains common antibot/challenge signatures."""
    if not html:
        return False
    html_lower = html.lower()
    return any(sig in html_lower for sig in _ANTIBOT_SIGNATURES)


def detect_requires_javascript(url: str, timeout: float = 5.0) -> bool:
    """
    Probe ``url`` with a plain HTTP GET and examine the raw HTML for
    signals that the page is a JS-rendered SPA or protected by antibot/CAPTCHA.

    Returns ``True`` if JS rendering or JS challenge bypass is likely required, ``False`` otherwise.
    On any network error, returns ``True`` (safer to assume JS is needed).

    Checks performed:
    1. Status codes (403, 429, 503, etc.)
    2. Common antibot/CAPTCHA signatures in the HTML response
    3. Empty SPA mount-point divs (React, Vue, Next.js, Nuxt)
    4. Multiple framework script bundles in ``<script src="...">`` tags
    5. ``<noscript>`` tag containing a "please enable JavaScript" message
    6. Low text-to-HTML ratio (< 10 %)
    """
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=timeout, allow_redirects=True)
        if resp.status_code in (403, 429, 503) or resp.status_code != 200:
            # Non-200 often means bot detection / JS challenge
            return True

        raw_html = resp.text
        if contains_antibot(raw_html):
            return True
        soup = BeautifulSoup(raw_html, "html.parser")

        # 1. Empty SPA mount points
        for mount in soup.select(_SPA_MOUNT_SELECTORS):
            if not mount.get_text(strip=True):
                return True

        # 2. Heavy SPA script bundle presence
        script_srcs = [
            (s.get("src") or "").lower()
            for s in soup.find_all("script", src=True)
        ]
        spa_script_count = sum(
            1 for src in script_srcs
            if any(pat in src for pat in _SPA_SCRIPT_PATTERNS)
        )
        if spa_script_count >= 3:
            return True

        # 3. <noscript> instructing user to enable JS
        for ns in soup.find_all("noscript"):
            text = ns.get_text().lower()
            if "javascript" in text or "enable js" in text:
                return True

        # 4. Low text-to-HTML ratio
        text_len = len(soup.get_text(strip=True))
        html_len = len(raw_html)
        if html_len > 0 and (text_len / html_len) < _LOW_TEXT_RATIO_THRESHOLD:
            return True

        return False

    except Exception:
        # Network failure, timeout, or parsing error → assume JS needed
        return True


# ---------------------------------------------------------------------------
# HTML → Markdown conversion (lightweight, no external deps)
# ---------------------------------------------------------------------------

def _html_to_markdown(html: str, url: str) -> tuple[str, str | None]:
    """
    Convert raw HTML to a clean markdown-like string suitable for AI processing.
    Also extracts the page title.

    Returns (markdown_text, title_or_None).
    """
    soup = BeautifulSoup(html, "html.parser")

    # Extract title
    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else None

    # Remove script/style/nav noise
    for tag in soup(["script", "style", "noscript", "nav", "footer", "aside", "header"]):
        tag.decompose()

    # Convert headings → Markdown heading syntax
    for level in range(1, 7):
        for tag in soup.find_all(f"h{level}"):
            text = tag.get_text(strip=True)
            tag.replace_with(f"\n{'#' * level} {text}\n")

    # Convert links → Markdown links
    for a in soup.find_all("a", href=True):
        href = a["href"]
        link_text = a.get_text(strip=True)
        if href.startswith("http") and link_text:
            a.replace_with(f"[{link_text}]({href})")
        else:
            a.replace_with(link_text)

    # Convert paragraphs
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if text:
            p.replace_with(f"\n{text}\n")

    # Collapse whitespace
    raw_text = soup.get_text(separator="\n")
    lines = [line.strip() for line in raw_text.splitlines()]
    # Remove consecutive blank lines
    clean_lines: list[str] = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                clean_lines.append("")
            prev_blank = True
        else:
            clean_lines.append(line)
            prev_blank = False

    return "\n".join(clean_lines).strip(), title


# ---------------------------------------------------------------------------
# In-memory Firecrawl cache (avoids re-scraping same URL within 24 h)
# ---------------------------------------------------------------------------
_js_cache: dict[str, tuple[ScrapeResult | None, datetime]] = {}
_JS_CACHE_TTL = timedelta(hours=24)


# ---------------------------------------------------------------------------
# UnifiedScraper — main entry point
# ---------------------------------------------------------------------------

@dataclass
class UnifiedScrapeResult:
    """Extended ScrapeResult that records which scraping method was used."""
    url: str
    title: str | None
    markdown: str
    html: str | None = None
    success: bool = True
    error_message: str | None = None
    scraper_used: str = SCRAPE_STATIC   # "static" or "js"


class UnifiedScraper:
    """
    General-purpose scraper with automatic static/JS routing.

    The ``scrape()`` method is the main entry point. It:
    1. Looks up the domain in DomainRegistry
    2. If "static"   → calls _scrape_static() directly
    3. If "js_heavy" → calls _scrape_js() directly
    4. If "unknown"  → runs detect_requires_javascript(); routes accordingly
                        and uses scrape_with_fallback() for extra resilience

    All static HTTP requests are tracked under the ``html_scraper`` key.
    All Firecrawl calls are tracked under the ``firecrawl`` key.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def scrape(
        self, url: str, caller_id: str = "system", location: dict | None = None
    ) -> UnifiedScrapeResult:
        """
        Smart-route a URL to the best available scraping method.

        Args:
            url:       The target URL to scrape.
            caller_id: User email or ID for usage tracking.
            location:  Optional geo-location payload for Firecrawl.

        Returns:
            UnifiedScrapeResult with content and metadata.

        Raises:
            ApiLimitError: If the relevant API's daily/monthly limit is exhausted.
        """
        site_type = DomainRegistry.classify(url)

        if site_type == SCRAPE_JS:
            return self._scrape_js(url, caller_id, location)

        if site_type == SCRAPE_STATIC:
            return self._scrape_static(url, caller_id)

        # Unknown domain — run heuristic then route
        needs_js = detect_requires_javascript(url)
        if needs_js:
            return self._scrape_js(url, caller_id, location)

        # Static-first with JS fallback for unknown domains
        return self.scrape_with_fallback(url, caller_id, location)

    def scrape_with_fallback(
        self, url: str, caller_id: str = "system", location: dict | None = None
    ) -> UnifiedScrapeResult:
        """
        Try a static HTTP scrape first; if the result is empty or fails,
        fall back to the Firecrawl JS scraper.

        Useful for unknown domains where you want to optimistically avoid
        burning Firecrawl credits.
        """
        static_result = self._scrape_static(url, caller_id)
        if static_result.success and len(static_result.markdown) >= _MIN_CONTENT_LENGTH:
            return static_result

        print(
            f"[UnifiedScraper] Static scrape insufficient for {url} "
            f"(content={len(static_result.markdown)} chars), falling back to JS scraper."
        )
        return self._scrape_js(url, caller_id, location)

    # ------------------------------------------------------------------
    # Private: static HTTP scrape (runs on local resources — no API cost)
    # ------------------------------------------------------------------

    def _scrape_static(
        self, url: str, caller_id: str = "system"
    ) -> UnifiedScrapeResult:
        """
        Fetch ``url`` with a plain HTTP GET and convert HTML → Markdown.
        Tracked under the ``html_scraper`` key (local resources, no API cost).
        """
        try:
            resp: requests.Response = call_with_tracking(
                "html_scraper",
                caller_id,
                "/unified-scrape",
                lambda: requests.get(url, headers=_HEADERS, timeout=10, allow_redirects=True),
            )

            if resp.status_code != 200 or contains_antibot(resp.text):
                err_msg = f"HTTP {resp.status_code}"
                if contains_antibot(resp.text):
                    err_msg = "Antibot / CAPTCHA challenge detected"
                return UnifiedScrapeResult(
                    url=url,
                    title=None,
                    markdown="",
                    success=False,
                    error_message=err_msg,
                    scraper_used=SCRAPE_STATIC,
                )

            markdown, title = _html_to_markdown(resp.text, url)
            return UnifiedScrapeResult(
                url=url,
                title=title,
                markdown=markdown,
                html=resp.text,
                success=True,
                scraper_used=SCRAPE_STATIC,
            )

        except ApiLimitError:
            raise
        except Exception as exc:
            return UnifiedScrapeResult(
                url=url,
                title=None,
                markdown="",
                success=False,
                error_message=str(exc),
                scraper_used=SCRAPE_STATIC,
            )

    # ------------------------------------------------------------------
    # Private: JS rendering via Firecrawl (external paid API)
    # ------------------------------------------------------------------

    def _scrape_js(
        self, url: str, caller_id: str = "system", location: dict | None = None
    ) -> UnifiedScrapeResult:
        """
        Scrape a JS-heavy page via Firecrawl. Uses a 24 h in-memory cache
        to avoid duplicate API calls for the same URL.

        Tracked under the ``firecrawl`` key (400 credits/month).
        """
        # Check cache first
        if url in _js_cache:
            cached_result, cached_at = _js_cache[url]
            if datetime.now() - cached_at < _JS_CACHE_TTL:
                if cached_result and cached_result.success:
                    return UnifiedScrapeResult(
                        url=cached_result.url,
                        title=cached_result.title,
                        markdown=cached_result.markdown,
                        html=cached_result.html,
                        success=True,
                        scraper_used=SCRAPE_JS,
                    )

        try:
            fc_result: ScrapeResult = call_with_tracking(
                "firecrawl",
                caller_id,
                "/unified-scrape-js",
                lambda: scrape_page(url, location=location),
                credits_used=10,
            )
        except ApiLimitError:
            raise
        except Exception as exc:
            _js_cache[url] = (None, datetime.now())
            return UnifiedScrapeResult(
                url=url,
                title=None,
                markdown="",
                success=False,
                error_message=str(exc),
                scraper_used=SCRAPE_JS,
            )

        _js_cache[url] = (fc_result, datetime.now())

        if not fc_result or not fc_result.success:
            return UnifiedScrapeResult(
                url=url,
                title=None,
                markdown="",
                success=False,
                error_message=fc_result.error_message if fc_result else "Firecrawl returned no result",
                scraper_used=SCRAPE_JS,
            )

        return UnifiedScrapeResult(
            url=url,
            title=fc_result.title,
            markdown=fc_result.markdown,
            html=fc_result.html,
            success=True,
            scraper_used=SCRAPE_JS,
        )
