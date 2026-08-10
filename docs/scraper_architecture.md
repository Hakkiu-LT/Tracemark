# HAKKIU Scraper Architecture — Comprehensive Documentation

> **Last updated:** August 2026
> **Source:** [`apps/api/src/tracemark_api/services/marketplace.py`](../apps/api/src/tracemark_api/services/marketplace.py)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture: 3-Tier Scraping System](#architecture-3-tier-scraping-system)
3. [UnifiedScraper: The Routing Engine](#unifiedscraper-the-routing-engine)
4. [The 11 Scrapers in Detail](#the-11-scrapers-in-detail)
   - [1. AmazonScraper](#1-amazonscraper)
   - [2. EbayScraper](#2-ebayscraper)
   - [3. AlibabaScraper](#3-alibabascraper)
   - [4. EtsyScraper](#4-etsyscraper)
   - [5. AliExpressScraper](#5-aliexpressscraper)
   - [6. ShopifyScraper](#6-shopifyscraper)
   - [7. FacebookMarketplaceScraper](#7-facebookmarketplacescraper)
   - [8. TikTokScraper](#8-tiktokscraper)
   - [9. InstagramScraper](#9-instagramscraper)
   - [10. GoogleSERPAPI](#10-googleserpapi)
   - [11. MetaAdsAPI](#11-metaadsapi)
5. [MarketplaceScraper: The Orchestrator](#marketplacescraper-the-orchestrator)
6. [Evidence Pipeline](#evidence-pipeline)
7. [Health Monitoring](#health-monitoring)

---

## Overview

HAKKIU's trademark monitoring system uses **11 specialized scrapers** to detect brand infringement across the internet. These scrapers cover:

- **E-commerce marketplaces** (Amazon, eBay, Alibaba, Etsy, AliExpress, Shopify, Facebook Marketplace)
- **Social media platforms** (TikTok, Instagram)
- **Advertising networks** (Google Ads via SerpApi, Meta Ads via Graph API)

The scrapers are triggered when a user initiates a brand scan from the frontend (`POST /monitoring/check-brand`), which flows through:

```
Frontend Button Click
    → POST /monitoring/check-brand
        → gather_evidence()
            → MarketplaceScraper.batch_detect()
                → Individual Scraper.search()
                    → HTTP/API requests (mocked in tests)
            → _parse_marketplace_listings() / _parse_social_from_markdown()
        → Detection Funnel (Tier 0 → Tier 1)
        → make_decision() (AI)
        → generate_takedown_reports()
    ← Response: { case_id, evidence, decision, takedown_reports }
```

---

## Architecture: 3-Tier Scraping System

The scrapers are organized into three tiers based on **how they fetch data**:

### Tier 1 — Static HTML Scrapers (Free, Local Resources)

| Scraper | Target | Method | Cost |
|---------|--------|--------|------|
| AmazonScraper | Amazon product search | HTTP GET → BeautifulSoup HTML parsing | $0 |
| EbayScraper | eBay listings | eBay Finding API or HTTP GET → parsing | $0 |
| AlibabaScraper | Alibaba wholesale | Alibaba ICBU API or HTTP GET → parsing | $0 |
| EtsyScraper | Etsy handmade listings | HTTP GET → BeautifulSoup parsing | $0 |
| GoogleShoppingScraper | Google Shopping tab | HTTP GET → parsing | $0 |

These scrapers send plain HTTP requests with browser-like headers and parse the raw HTML response with BeautifulSoup. Amazon, eBay, and Google serve server-rendered HTML, so no JavaScript rendering is needed.

### Tier 2 — JS-Heavy Scrapers (Firecrawl / External API)

| Scraper | Target | Method | Cost |
|---------|--------|--------|------|
| AliExpressScraper | AliExpress products | AliExpress API or Firecrawl JS rendering | 10 credits/call |
| ShopifyScraper | Shopify stores | Google SERP → /products.json API | $0 (mostly) |
| FacebookMarketplaceScraper | FB Marketplace | Firecrawl JS rendering | 10 credits/call |
| TikTokScraper | TikTok search | Firecrawl JS rendering | 10 credits/call |
| InstagramScraper | Instagram hashtags | Firecrawl JS rendering | 10 credits/call |

These platforms require JavaScript execution to render content. They use **Firecrawl** (a headless browser API) to get the rendered page as markdown.

### Tier 3 — Official APIs (External APIs)

| Scraper | Target | Method | Cost |
|---------|--------|--------|------|
| GoogleSERPAPI | Google Search + Google Ads | SerpApi REST API | Per-query pricing |
| MetaAdsAPI | Facebook/Instagram Ads | Meta Graph API (ads_archive) | $0 (free Meta dev account) |

These scrapers use official or third-party APIs rather than web scraping.

---

## UnifiedScraper: The Routing Engine

**File:** [`unified_scraper.py`](../apps/api/src/tracemark_api/services/unified_scraper.py)

The `UnifiedScraper` is the smart routing layer that decides **how** to scrape any URL:

### Domain Classification

```python
class DomainRegistry:
    STATIC_DOMAINS = frozenset([
        "amazon.com", "ebay.com", "alibaba.com", "walmart.com",
        "etsy.com", "craigslist.org", "google.com", ...
    ])
    JS_HEAVY_DOMAINS = frozenset([
        "aliexpress.com", "tiktok.com", "instagram.com",
        "facebook.com", "twitter.com", "pinterest.com", ...
    ])
```

### Routing Logic

1. **Known static domain** → `_scrape_static()` — plain HTTP GET + HTML-to-Markdown conversion
2. **Known JS-heavy domain** → `_scrape_js()` — Firecrawl headless browser rendering
3. **Unknown domain** → `detect_requires_javascript()` heuristic probe, then route accordingly

### JS Detection Heuristic

For unknown domains, the scraper performs a quick HTTP probe and checks for:
- Empty SPA mount points (`#root`, `#app`, `#__next`)
- Framework script bundles (React, Vue, Angular, webpack, Next.js)
- `<noscript>` tags with "enable JavaScript" messages
- Low text-to-HTML ratio (< 10%)
- Antibot/CAPTCHA signatures (Cloudflare, reCAPTCHA, hCaptcha)

### Caching

- **Cross-scan URL cache** (`scrape_cache.py`): Prevents re-fetching the same URL within a TTL window
- **In-memory Firecrawl cache**: 24-hour LRU cache (max 512 entries) avoids duplicate Firecrawl API calls
- **API usage tracking**: All calls are tracked under `html_scraper` (static) or `firecrawl` (JS) keys

---

## The 11 Scrapers in Detail

### 1. AmazonScraper

**Class:** `AmazonScraper` (line 292)
**Category:** Marketplace — Static HTML
**Cost:** $0

#### What it does:
Searches Amazon product listings for a brand name and extracts structured product data from the search results HTML.

#### How it works:
1. Constructs Amazon search URLs: `https://www.amazon.{tld}/s?k={keyword}&page={page}`
2. Uses `UnifiedScraper.scrape()` which routes to static HTTP GET (Amazon is in `STATIC_DOMAINS`)
3. Parses the HTML response with BeautifulSoup, selecting `[data-component-type='s-search-result']` elements
4. Extracts from each product card:
   - **Title** via `h2 span`
   - **Price** via `.a-price .a-offscreen`
   - **Seller** via `.a-size-small .a-color-secondary`
   - **Product URL** via `h2 a[href]`
   - **Rating** via `.a-icon-alt`
   - **Review count** via `.a-size-small .a-link-normal`

#### Pagination & Volume:
- **Pages Checked:** Up to **3 pages** per region (`max_pages = 3` default in `AmazonScraper.search()`).
- **Loop Strategy:** Iterates `page=1..3` sequentially. Stops early if a page returns empty HTML or encounters an error.
- **Elements Checked:** Queries all `[data-component-type='s-search-result']` card elements per page (Amazon standard: **16–24 items/page**, up to **48–72 total listings** per region scan).
- **Multi-Region Scaling:** Triggered concurrently per country specified in `target_regions` (e.g. 3 regions × 3 pages = up to 9 pages / ~150–216 listings).

#### Geo support:
Supports multiple Amazon domains (US, UK, DE, FR, JP, etc.) via the `AMAZON_DOMAINS` mapping. The `country` parameter selects the correct regional Amazon site.


#### Output:
```python
[{
    "title": "Product Name",
    "price": "$29.99",
    "seller": "Seller Name",
    "url": "https://amazon.com/dp/B08XYZ...",
    "rating": "4.5",
    "reviews": "1,234",
    "ship_from": "N/A",
}]
```

---

### 2. EbayScraper

**Class:** `EbayScraper` (line 355)
**Category:** Marketplace — Static HTML / API
**Cost:** $0

#### What it does:
Searches eBay listings for brand-name products. Has a **dual strategy**: tries the eBay Finding API first (if `EBAY_APP_ID` is set), then falls back to HTML scraping.

#### How it works:

**Strategy A — eBay Finding API:**
1. Calls `https://svcs.ebay.com/services/search/FindingService/v1` with `findItemsByKeywords`
2. Parses the JSON response to extract title, URL, price, image, and seller info
3. Supports regional eBay Global IDs (EBAY-US, EBAY-GB, EBAY-DE, etc.)

**Strategy B — HTML Scraping (fallback):**
1. Constructs eBay search URLs: `https://www.ebay.{tld}/sch/i.html?_nkw={keyword}&_pgn={page}`
2. Uses `UnifiedScraper.scrape()` for static HTTP GET
3. Parses `.s-item` elements with BeautifulSoup
4. Filters out "Shop on eBay" promotional cards
5. Strips tracking parameters from listing URLs

#### Output:
```python
[{
    "title": "Listing Title",
    "price": "$24.99",
    "seller": "seller123 (99.8%)",
    "url": "https://ebay.com/itm/222",
    "image": "https://img.ebay.com/222.jpg",
    "subtitle": "Brand New",
}]
```

---

### 3. AlibabaScraper

**Class:** `AlibabaScraper` (line 488)
**Category:** Marketplace — Static HTML / API
**Cost:** $0

#### What it does:
Searches Alibaba's B2B wholesale marketplace for counterfeit or unauthorized products. **Dual strategy** like eBay: API first, HTML fallback.

#### How it works:

**Strategy A — Alibaba ICBU API:**
1. Requires `ALIBABA_APP_KEY` and `ALIBABA_APP_SECRET` environment variables
2. Calls `https://api.alibaba.com/router/rest` with `alibaba.icbu.product.search` method
3. Signs requests with MD5 hash of sorted parameters + secret
4. Parses product data from nested JSON response

**Strategy B — HTML Scraping (fallback):**
1. Constructs URLs: `https://www.alibaba.com/trade/search?SearchText={keyword}&page={page}`
2. Uses `UnifiedScraper.scrape()` for static HTML
3. Parses product elements via selectors: `.organic-list-offer-outter`, `.J-offer-wrapper`, `[data-content='productItem']`
4. Extracts title, price, and URL; fixes relative URLs with `https:` prefix

#### Output:
```python
[{
    "title": "Product Title",
    "price": "$0.50 - $1.00",
    "url": "https://www.alibaba.com/product-detail/123.html",
}]
```

---

### 4. EtsyScraper

**Class:** `EtsyScraper` (line 595)
**Category:** Marketplace — Static HTML
**Cost:** $0

#### What it does:
Searches Etsy for handmade/craft listings that may infringe on a brand's trademark.

#### How it works:
1. Constructs URLs: `https://www.etsy.com/search?q={keyword}&page={page}`
2. Uses `UnifiedScraper.scrape()` for static HTTP GET
3. Parses `.v2-listing-card` and `[data-listing-id]` elements
4. From each card, extracts:
   - **Title** from `.v2-listing-card__info h3` or `.v2-listing-card__title`
   - **Price** from `.currency-value`
   - **URL** from `a.listing-link` or `a[href*='/listing/']`
   - **Shop name** from `.v2-listing-card__shop`
   - **Image** from the first `img` tag

#### Output:
```python
[{
    "title": "Handmade Brand Item",
    "price": "29.99",
    "seller": "CraftyShop",
    "url": "https://www.etsy.com/listing/1001/...",
    "image": "https://img.etsystatic.com/1001.jpg",
}]
```

---

### 5. AliExpressScraper

**Class:** `AliExpressScraper` (line 653)
**Category:** Marketplace — JS-Heavy / API
**Cost:** 10 Firecrawl credits per call (if using Firecrawl)

#### What it does:
Searches AliExpress for counterfeit or unauthorized products. AliExpress renders its product listings with JavaScript, so it requires either the official API or Firecrawl's headless browser.

#### How it works:

**Strategy A — AliExpress Affiliate API:**
1. Requires `ALIEXPRESS_APP_KEY` and `ALIEXPRESS_APP_SECRET`
2. Calls `https://api.alibaba.com/router/rest` with `aliexpress.affiliate.product.query`
3. Signs requests with MD5 hash (same signing scheme as Alibaba)
4. Returns structured JSON data serialized as a string

**Strategy B — Firecrawl JS Rendering (fallback):**
1. Constructs URLs: `https://www.aliexpress.com/wholesale?SearchText={keyword}`
2. `UnifiedScraper` classifies `aliexpress.com` as `JS_HEAVY` → routes to Firecrawl
3. Returns **raw markdown** — structured extraction happens downstream in `_parse_marketplace_listings()` which uses regex to find `[title](url)` patterns and nearby `$price` values

#### Key difference from static scrapers:
Returns a **string** (raw markdown) instead of `list[dict]`. The downstream parser handles conversion to `MarketplaceEvidence` objects.

---

### 6. ShopifyScraper

**Class:** `ShopifyScraper` (line 748)
**Category:** Marketplace — SERP + Products API
**Cost:** $0 (Google SERP + Shopify products.json)

#### What it does:
Discovers unauthorized Shopify stores selling products under a brand name. Uses a **two-phase discovery** approach.

#### How it works:

**Phase 1 — Store Discovery:**
1. Google SERP search: `site:*.myshopify.com {brand_name}` with geo parameter
2. Scrapes Google results page via `UnifiedScraper` (static HTML)
3. Extracts `myshopify.com` URLs from Google redirect links using regex: `(https?://[\w.-]+\.myshopify\.com)`
4. Caps at 5 stores to avoid excessive probing

**Phase 2 — Product Extraction:**
1. For each discovered store, fetches `{store_url}/products.json?limit=20`
2. This is Shopify's **public products API** — no authentication needed
3. Uses SSRF-safe `safe_get()` since store URLs come from scraped Google content (attacker-influenceable)
4. Extracts: title, price (from first variant), vendor, product handle → URL, first image

#### Output:
```python
[{
    "title": "Product Title",
    "price": "$19.99",
    "seller": "FakeVendor",
    "url": "https://fakestore.myshopify.com/products/product-handle",
    "image": "https://cdn.shopify.com/img1.jpg",
}]
```

---

### 7. FacebookMarketplaceScraper

**Class:** `FacebookMarketplaceScraper` (line 814)
**Category:** Marketplace — JS-Heavy
**Cost:** 10 Firecrawl credits per call

#### What it does:
Searches Facebook Marketplace for brand-related listings. **Facebook aggressively blocks scrapers**, so this scraper returns empty gracefully when blocked.

#### How it works:
1. Constructs URL: `https://www.facebook.com/marketplace/search/?query={keyword}`
2. Uses `UnifiedScraper.scrape()` which routes to Firecrawl (Facebook is `JS_HEAVY`)
3. Passes `firecrawl_location(country)` for geo-targeting
4. **Content threshold**: Only returns content if markdown length > 100 characters
5. If content is short (< 100 chars), assumes Facebook blocked the scrape and returns empty string

#### Key behavior:
- Returns **raw markdown** (same as AliExpress)
- Facebook blocking is **expected and handled** — the scraper degrades gracefully
- Downstream `_parse_marketplace_listings()` extracts links from the markdown

---

### 8. TikTokScraper

**Class:** `TikTokScraper` (line 840)
**Category:** Social Media — JS-Heavy
**Cost:** 10 Firecrawl credits per call

#### What it does:
Searches TikTok for videos and accounts that may be promoting counterfeit or unauthorized products.

#### How it works:
1. Constructs URL: `https://www.tiktok.com/search?q={keyword}`
2. Uses `UnifiedScraper.scrape()` → Firecrawl (TikTok is `JS_HEAVY`)
3. Passes geo-location parameters for regional targeting
4. Returns **raw markdown** content

#### Downstream processing:
`_parse_social_from_markdown()` extracts:
- **@handles** via regex `@([a-zA-Z0-9_.]{2,30})`
- **Post URLs** matching `tiktok.com` patterns
- Creates `SocialEvidence` objects with handle, platform, and post_url

---

### 9. InstagramScraper

**Class:** `InstagramScraper` (line 863)
**Category:** Social Media — JS-Heavy
**Cost:** 10 Firecrawl credits per call

#### What it does:
Scrapes Instagram hashtag explore pages for brand-related posts from potentially infringing accounts.

#### How it works:
1. Converts brand name to hashtag: `brand name` → `brandname` (lowercase, no spaces)
2. Constructs URL: `https://www.instagram.com/explore/tags/{hashtag}/`
3. Uses `UnifiedScraper.scrape()` → Firecrawl (Instagram is `JS_HEAVY`)
4. Returns **raw markdown** content

#### Downstream processing:
Same as TikTok — `_parse_social_from_markdown()` extracts @handles and Instagram post/profile URLs, creating `SocialEvidence` objects.

---

### 10. GoogleSERPAPI

**Class:** `GoogleSERPAPI` (line 954)
**Category:** Ads & Domain Monitoring
**Cost:** SerpApi per-query pricing

#### What it does:
This is the **most complex scraper** — it serves two purposes:

1. **Ad hijacking detection**: Finds unauthorized Google Ads using the brand name
2. **Domain monitoring**: Discovers suspicious domains ranking for the brand name, enriches them with WHOIS data

#### How it works — Ad Detection (`search_google_ads_page`):

1. Calls SerpApi with `engine=google_ads` — returns ads, organic results, shopping ads, and local ads in **one API call**
2. Parses each result type:
   - **Paid ads** → `_parse_google_ads_response()` → extracts advertiser, ad text, destination URL
   - **Shopping results** → `_parse_shopping_results()` → extracts title, price, source
   - **Local ads** → `_parse_local_ads()` → extracts business name, description, link
   - **Organic results** → domain extraction for monitoring
3. All ad results pass through `filter_hijacking_ads()` which:
   - Filters out official advertisers (exact/substring match)
   - Scores remaining ads with `_hijacking_score()` (0-100 based on brand mention, impersonation signals)
   - Only keeps ads scoring ≥ 40

#### How it works — Domain Monitoring (`search` + `check_serp_domains`):

1. **Triple fallback search strategy:**
   - **SerpApi** (primary) → if `GOOGLE_SERP_API` env var set and not rate-limited
   - **SearchCans API** (secondary) → if `SEARCHCANS_API` set and SerpApi failed/blocked
   - **Direct Google scraping** (tertiary) → HTTP GET to google.com, parse results HTML
2. For each discovered domain:
   - Filters out official domains (brand.com, brand.net, brand.org)
   - Filters whitelisted domains (global whitelist service)
   - **Brand-relevance pre-filter**: Uses `rapidfuzz.partial_ratio()` — requires ≥ 60% similarity between domain label and brand name (prevents unrelated sites from entering the expensive WHOIS pipeline)
3. **WHOIS enrichment** via `python-whois`:
   - Registrar, creation date, expiry date
   - Name servers, registrant organization, country, email

#### Output structure:
```python
{
    "ads": [{"source": "google_ads", "advertiser": "...", "ad_text": "...", ...}],
    "organic": ["suspicious-domain.com", ...],
    "shopping": [{"source": "google_shopping", ...}],
    "local_ads": [{"source": "google_local", ...}],
}
```

---

### 11. MetaAdsAPI

**Class:** `MetaAdsAPI` (line 1376)
**Category:** Ads (Facebook/Instagram)
**Cost:** $0 (Meta developer account)

#### What it does:
Queries Meta's **Ad Library API** to find unauthorized ads running on Facebook and Instagram that use the brand name.

#### How it works:
1. Requires `META_ADS_ACCESS_TOKEN` environment variable (free Meta developer account + ID verification)
2. Calls `https://graph.facebook.com/v19.0/ads_archive` with parameters:
   - `search_terms`: brand keyword
   - `ad_reached_countries`: target country (JSON array)
   - `ad_type`: "ALL"
   - `fields`: id, ad_creative_bodies, page_name, ad_snapshot_url, impressions, spend
   - `limit`: 50
3. Parses each ad record:
   - **Advertiser**: `page_name` (the Facebook page running the ad)
   - **Ad text**: joins `ad_creative_bodies` array
   - **Destination URL**: constructs clean Ad Library URL from ad ID
   - **Screenshot**: screenshots the `ad_snapshot_url` via Firecrawl → uploads to Supabase Storage (strips access tokens before caching)
   - **Impressions**: lower bound from the impressions object
4. Filters through `filter_hijacking_ads()` with the same hijacking scoring as Google Ads

#### Error handling:
- Error code `2332002` → prints guidance to complete ID verification at Meta's Ad Library API portal
- Missing token → skips silently, returns `[]`

#### Output:
```python
[{
    "source": "meta_ads",
    "advertiser": "FakePageName",
    "ad_text": "Official Brand — 50% off...",
    "destination_url": "https://www.facebook.com/ads/library/?id=123",
    "screenshot_url": "https://supabase.co/storage/meta/shot.png",
    "impressions": 5000,
    "detected_date": "",
    "hijacking_score": 70,
}]
```

---

## MarketplaceScraper: The Orchestrator

**Class:** `MarketplaceScraper` (line 1464)

The `MarketplaceScraper` is the **central aggregator** that coordinates all 11 scrapers. It exposes two methods:

### `scrape_all_sources()` — Sequential Execution
Routes each platform from the `platforms` list to the correct scraper and collects results. Used in the simpler `check-brand` flow.

### `batch_detect()` — Concurrent Execution
The primary method used by `gather_evidence()`. Creates async tasks for each platform × country combination and runs them all concurrently with `asyncio.gather()`.

#### Result structure:
```python
{
    "marketplaces": {
        "amazon": {"US": [...], "UK": [...]},
        "ebay": {"US": [...]},
        ...
    },
    "ads": {
        "google": {"US": [...]},
        "meta": {"US": [...]},
    },
    "social": {
        "tiktok": {"US": "markdown..."},
        "instagram": {"US": "markdown..."},
    },
    "domains": [{...whois data...}],
    "timestamp": "2026-08-08T...",
}
```

---

## Evidence Pipeline

After `batch_detect()` returns raw data, `gather_evidence()` transforms it into the typed `Evidence` Pydantic model:

1. **Marketplace results** → `_parse_marketplace_listings()` → `list[MarketplaceEvidence]`
   - `list[dict]` from static scrapers: direct field mapping
   - `str` markdown from JS scrapers: regex extraction of `[title](url)` patterns + `$price` patterns

2. **Social results** → `_parse_social_from_markdown()` → `list[SocialEvidence]`
   - Extracts `@handle` patterns and platform-specific URLs

3. **Ad results** → `_ad_dict_to_evidence()` → `list[AdEvidence]`
   - Maps raw ad dicts to typed `AdEvidence` objects with platform labels

4. **Domain results** → Direct mapping → `list[DomainEvidence]`
   - WHOIS data is mapped directly to `DomainEvidence` fields

5. **Official domain filter** → Removes evidence pointing to official/whitelisted domains

---

## Health Monitoring

**File:** [`scraper_health.py`](../apps/api/src/tracemark_api/services/scraper_health.py)

Every scraper execution (live scan or daily probe) records a health row in the `scraper_health_log` table:

- **platform**: which scraper ran
- **country**: target region
- **success**: boolean
- **latency_ms**: execution time
- **error_category**: "blocked", "timeout", "http_error", "api_error", "parse_error"
- **source**: "live" (customer scan) or "probe" (daily health check)

### Daily Reachability Probes
A background cron runs `run_reachability_probes()` at startup, sending a lightweight HTTP GET to each platform's stable URL. This ensures health data exists even without customer traffic.

### Admin Dashboard
The Admin Portal's "Scraper Health" page aggregates these logs into per-platform success rates, latency metrics, and recent failure views.
