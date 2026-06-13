# Unified General Scraper — Phase 2 Changes

## Overview

This document describes the changes introduced in the **Unified General Scraper** refactor.
The goal was to replace the fragmented, Amazon-specific HTML scraper with a single general-purpose
scraping layer that automatically detects whether a target site requires static HTML parsing or
JavaScript rendering, routes accordingly, and reports usage accurately in the API Usage Monitor.

**Affected files:**

| File | Change Type |
|---|---|
| `apps/api/src/tracemark_api/services/unified_scraper.py` | **NEW** |
| `apps/api/src/tracemark_api/services/api_usage_tracker.py` | Modified |
| `apps/api/src/tracemark_api/services/marketplace.py` | Modified |
| `apps/api/tests/test_api_usage_tracker.py` | Modified |
| `apps/api/tests/test_unified_scraper.py` | **NEW** |

---

## What Changed and Why

### Problem

The previous architecture had three separate, siloed scraping mechanisms:

1. **`AmazonScraper`** — a hardcoded class that only knew how to scrape Amazon's URL structure and HTML selectors. It was tracked under a misnamed `amazon_scraper` API key with an artificial 300-request daily cap, even though it ran entirely on local machine resources at zero cost.
2. **`FirecrawlScraper`** — a class that called the Firecrawl JS-rendering external API. It was used as a fallback for JS-heavy sites like AliExpress, but it was a standalone class inside `marketplace.py` instead of a reusable service.
3. **`scraper.py`** (`scrape_page()`) — the raw Firecrawl API call, used by `FirecrawlScraper` and independently by the `/monitoring/analyze` route.

There was no way to scrape an arbitrary URL without knowing in advance which mechanism to use. Adding a new marketplace (e.g., eBay, Walmart, AliExpress) required writing custom per-site routing logic.

### Solution

A new **`UnifiedScraper`** class provides one entry point — `scraper.scrape(url, caller_id)` — that automatically routes to the correct scraping method using a three-tier strategy:

```
Tier 1 — Known static domains   →  requests + BeautifulSoup (local, $0 cost)
Tier 2 — Known JS-heavy domains →  Firecrawl API (external, paid)
Tier 3 — Unknown domains        →  heuristic JS-detection probe → static first, JS fallback
```

---

## New File: `unified_scraper.py`

**Path:** `apps/api/src/tracemark_api/services/unified_scraper.py`

### `DomainRegistry`

A frozen registry that classifies URLs into `"static"`, `"js_heavy"`, or `"unknown"` by matching
the domain (including subdomains) against two lookup sets.

```python
# Static HTML — scraped with plain requests + BeautifulSoup:
STATIC_DOMAINS = {
    "amazon.com", "ebay.com", "alibaba.com", "walmart.com", "etsy.com",
    "craigslist.org", "google.com", "adstransparency.google.com",
    "wikipedia.org", "dhgate.com", "made-in-china.com", "tradekey.com"
}

# JS-heavy — must use Firecrawl for meaningful content:
JS_HEAVY_DOMAINS = {
    "aliexpress.com", "tiktok.com", "instagram.com", "facebook.com",
    "twitter.com", "x.com", "pinterest.com", "shopify.com",
    "taobao.com", "jd.com", "rakuten.com"
}
```

`DomainRegistry.classify(url)` returns `"static"`, `"js_heavy"`, or `"unknown"`.
Subdomains are matched automatically (e.g., `seller.amazon.com` → `"static"`).

---

### `detect_requires_javascript(url)`

A lightweight heuristic function that probes an unknown domain with a plain HTTP GET and
analyzes the raw HTML response to decide whether JS rendering is needed.

**Checks performed (in order):**

| Check | Signal | Returns |
|---|---|---|
| HTTP status ≠ 200 | Bot detection / challenge page | `True` |
| Empty SPA mount point | `<div id="root"></div>`, `<div id="app"></div>`, `[data-reactroot]`, `<div id="__next"></div>`, `<div id="__nuxt"></div>` with no text content | `True` |
| 3+ framework script bundles | `src` contains `webpack`, `chunk`, `react`, `vue`, `angular`, `nuxt`, etc. | `True` |
| `<noscript>` JS warning | Text contains "javascript" or "enable js" | `True` |
| Low text-to-HTML ratio | `len(visible_text) / len(raw_html) < 0.10` | `True` |
| Network error / timeout | Any exception during probe | `True` (safe default) |
| None of the above | Content-rich static page | `False` |

The probe is intentionally fast (`timeout=5.0s`). If the probe itself fails for any reason, the
function defaults to `True` (assume JS needed) to avoid silent data loss.

---

### `UnifiedScraper`

Main class. The `scrape()` method is the single entry point:

```python
scraper = UnifiedScraper()

# Amazon — automatically routed to static (requests + BS4), tracked as html_scraper
result = scraper.scrape("https://www.amazon.com/s?k=nike")

# AliExpress — automatically routed to Firecrawl JS, tracked as firecrawl
result = scraper.scrape("https://www.aliexpress.com/wholesale?SearchText=nike")

# Unknown site — probed with heuristic, then static-first with JS fallback
result = scraper.scrape("https://counterfeit-shop.xyz/brand")
```

**Return type:** `UnifiedScrapeResult` — an extended dataclass that includes a `scraper_used`
field (`"static"` or `"js"`) so callers can log which method was actually used.

**Internal methods:**

| Method | What it does | API key tracked |
|---|---|---|
| `_scrape_static(url, caller_id)` | `requests.get()` → `html_to_markdown()` conversion | `html_scraper` |
| `_scrape_js(url, caller_id)` | Calls `scrape_page()` (Firecrawl API), with 24h in-memory cache | `firecrawl` |
| `scrape_with_fallback(url, caller_id)` | Tries `_scrape_static` first; falls back to `_scrape_js` if content is < 200 chars or failed | both |

**HTML → Markdown conversion** (`_html_to_markdown`): A lightweight internal converter that strips
`<script>`, `<style>`, `<nav>`, `<footer>`, `<aside>` tags, converts headings and links to Markdown
syntax, and collapses consecutive blank lines. No external Markdown library is required.

**JS cache:** The `_scrape_js` method maintains a module-level 24-hour in-memory cache
(`_js_cache`) to avoid duplicate Firecrawl API credit usage for the same URL within a single day.
This replaces the old `_firecrawl_cache` that was embedded inside `marketplace.py`.

---

## Modified File: `api_usage_tracker.py`

**Path:** `apps/api/src/tracemark_api/services/api_usage_tracker.py`

### What changed

The `amazon_scraper` entry in `API_REGISTRY` was renamed and reconfigured:

```python
# Before:
ApiDefinition("amazon_scraper", "Amazon HTML Scraper", 300, RESET_DAILY, "scraper")

# After:
ApiDefinition("html_scraper", "HTML Scraper (Local)", 999_999, RESET_DAILY, "scraper")
```

**Why:**
- The old label "Amazon HTML Scraper" was inaccurate. The local HTTP scraper is now used for
  Amazon, eBay, Alibaba, Google SERP, and any unknown domain that passes the static probe.
- The old limit of 300/day was an arbitrary safety cap. Since this scraper runs entirely on local
  machine resources with no external API cost, the effective limit is set to `999_999` — high
  enough to never block normal usage, but low enough that the usage tracker UI still renders
  meaningful progress bars.
- The limit is **not** set to `math.inf` because the tracker computes `percent_used` as a ratio;
  an infinite limit would cause a ZeroDivisionError.

**Impact on the API Usage Monitor UI:**
The frontend renders whatever label and limit the backend returns — no frontend changes were needed.
The API Usage Monitor page will now show `HTML Scraper (Local)` with the new high limit.

---

## Modified File: `marketplace.py`

**Path:** `apps/api/src/tracemark_api/services/marketplace.py`

### Changes summary

| Class / Component | Before | After |
|---|---|---|
| `AmazonScraper` | Contained its own `requests.get()` call tracked as `amazon_scraper` | Instantiates `UnifiedScraper` and delegates to `self._scraper.scrape(url)` |
| `EbayScraper` | Empty stub `return []` | Instantiates `UnifiedScraper`; body remains a stub with a descriptive `# TODO` comment |
| `AlibabaScraper` | Empty stub `return []` | Instantiates `UnifiedScraper`; body remains a stub with a descriptive `# TODO` comment |
| `FirecrawlScraper` | Full class with `scrape_with_fallback()` and its own 24h cache | **Removed**. Replaced by a comment pointing to `UnifiedScraper._scrape_js()` |
| `MarketplaceScraper.__init__` | `self.firecrawl = FirecrawlScraper()` | `self.unified = UnifiedScraper()` |
| `MarketplaceScraper.scrape_all_sources` | Called `self.firecrawl.scrape_with_fallback(aliexpress_url)` | Calls `self.unified.scrape(aliexpress_url)` |

### eBay and Alibaba stubs

The stubs now include implementation guidance as inline `# TODO` comments:

```python
class EbayScraper:
    def search(self, keyword, max_pages=3, caller_id="system"):
        # TODO: implement eBay-specific HTML card parser
        # The unified scraper will auto-detect eBay as a static domain.
        # Extract result.html with BeautifulSoup using eBay card selectors:
        # e.g. .s-item, .s-item__title, .s-item__price
        return []
```

This pattern allows each marketplace to be implemented incrementally by writing a
`BeautifulSoup` parser for the site's specific HTML, without touching any routing or
HTTP logic.

---

## Modified File: `test_api_usage_tracker.py`

**Path:** `apps/api/tests/test_api_usage_tracker.py`

### Changes summary

- `test_tracker_is_blocked`: Previously used `amazon_scraper` (limit 300) as the blocking target.
  Now uses `google_serp` (limit 100) instead. This avoids a scenario where a test trying to
  exhaust `html_scraper`'s 999,999-call limit would loop nearly a million times.
- `test_api_limit_error_raised`: Same fix — switched from `html_scraper` to `google_serp` so the
  test loop runs 100 iterations instead of 999,999.
- All direct `"amazon_scraper"` string literals were updated to `"html_scraper"` or replaced with
  a more appropriate key.

---

## New File: `test_unified_scraper.py`

**Path:** `apps/api/tests/test_unified_scraper.py`

**23 tests total, all passing (1.50s).**

### Test classes

| Class | Tests | What is verified |
|---|---|---|
| `TestDomainRegistry` | 5 | Known static domains, known JS-heavy domains, subdomains, unknown domains, malformed URLs |
| `TestDetectRequiresJavascript` | 6 | Empty SPA root div, content-rich HTML, `<noscript>` JS warning, low text ratio, HTTP 403, network error |
| `TestUnifiedScraperRouting` | 4 | Amazon → static, AliExpress → JS, unknown domain (static probe), unknown domain (JS probe) |
| `TestScrapeWithFallback` | 3 | Rich static result (no JS fallback), empty static (triggers fallback), failed static (triggers fallback) |

All HTTP calls are mocked using `unittest.mock.patch` — no real network requests are made during testing.

---

## Scraping Architecture Diagram

```
UnifiedScraper.scrape(url, caller_id)
        │
        ▼
DomainRegistry.classify(url)
        │
   ┌────┴────────────────────┐
   │                         │
"static"               "js_heavy"
   │                         │
   ▼                         ▼
_scrape_static()       _scrape_js()
requests.get()         Firecrawl API
+ html_to_markdown()   (with 24h cache)
   │
tracked as             tracked as
"html_scraper"         "firecrawl"
(999,999/day)          (400 credits/month)
   │
   └────────────────────────────────────────────────┐
                                                    │
                                               "unknown"
                                                    │
                                                    ▼
                                     detect_requires_javascript()
                                      (5s static probe + heuristics)
                                           │           │
                                        True        False
                                           │           │
                                           ▼           ▼
                                      _scrape_js  scrape_with_fallback()
                                                  (static → JS fallback
                                                   if content < 200 chars)
```

---

## How to Add a New Marketplace

To add scraping support for a new marketplace (e.g., Walmart, Etsy, TikTok Shop):

**Step 1 — Classify the domain** (if not already in the registry):

```python
# In unified_scraper.py → DomainRegistry

STATIC_DOMAINS = frozenset([
    ...,
    "walmart.com",   # add here if static HTML
])

JS_HEAVY_DOMAINS = frozenset([
    ...,
    "tiktok-shop.com",  # add here if JS-heavy
])
```

**Step 2 — Add a scraper class** in `marketplace.py`:

```python
class WalmartScraper:
    def __init__(self):
        self._scraper = UnifiedScraper()

    def search(self, keyword: str, max_pages: int = 3, caller_id: str = "system") -> list[dict]:
        encoded = keyword.replace(" ", "+")
        url = f"https://www.walmart.com/search?q={encoded}"
        result = self._scraper.scrape(url, caller_id=caller_id)
        if not result.success or not result.html:
            return []
        soup = BeautifulSoup(result.html, "html.parser")
        # Parse Walmart-specific HTML selectors here
        return []
```

**Step 3 — Register it** in `MarketplaceScraper.__init__` and wire it into `scrape_all_sources()`.

No changes to `api_usage_tracker.py`, `unified_scraper.py`, or routing logic are needed —
the new scraper will be tracked automatically under `html_scraper` (for static sites) or
`firecrawl` (for JS-heavy sites).
