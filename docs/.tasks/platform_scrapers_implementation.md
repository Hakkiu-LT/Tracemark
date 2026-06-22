# Platform Scrapers Implementation Tasks

> **Goal:** Implement specific parsers and scraping logic for all target platforms using the `UnifiedScraper` engine, existing APIs, and Gemini AI extraction.

> **Legend:** ✅ Done · ⚠️ Partial · ❌ Missing · ➖ Skipped

---

## Current Architecture

All scrapers route through `UnifiedScraper` which auto-classifies domains:
- **Static (free, local):** Amazon, eBay, Etsy, Google Shopping → `requests` + `BeautifulSoup`
- **JS-heavy (Firecrawl credits):** AliExpress, TikTok, Instagram, Facebook, Shopify → Firecrawl API
- **Official APIs (free):** Meta Ads (Graph API), Google Ads (Transparency API), Google SERP

All scraper calls are tracked in the API Usage Monitor automatically.

---

## 1. Amazon Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `AmazonScraper`
**Routing:** Static HTML (local, $0)
| Task | Status |
|---|---|
| `AmazonScraper.search()` with paginated scraping | ✅ Done |
| HTML selectors: `[data-component-type='s-search-result']`, title, price, seller, ASIN | ✅ Done |
| `extract_listing_data()` for individual product cards | ✅ Done |
| Bot-detection handling with Firecrawl fallback | ✅ Done (via UnifiedScraper) |

---

## 2. eBay Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `EbayScraper`
**Routing:** Static HTML (local, $0)
| Task | Status |
|---|---|
| `EbayScraper` class with `UnifiedScraper` delegation | ✅ Done |
| HTML parsing with selectors: `.s-item`, `.s-item__title`, `.s-item__price`, `.s-item__link`, `.s-item__image-img` | ✅ Done |
| Extract: title, price, seller info, listing URL, image URL | ✅ Done |
| Wire into `scrape_all_sources()` | ✅ Done |

---

## 3. AliExpress Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `AliExpressScraper`
**Routing:** JS-heavy (Firecrawl, 10 credits/call)
| Task | Status |
|---|---|
| UnifiedScraper delegation for JS rendering | ✅ Done |
| Dedicated `AliExpressScraper` class (extract from inline code) | ✅ Done |
| Structured Gemini extraction for listing items (title, price, store, product ID) | ✅ Done |
| Wire as proper class in `MarketplaceScraper.__init__()` | ✅ Done |

---

## 4. Shopify Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `ShopifyScraper`
**Routing:** Direct JSON API (`/products.json`) + Google SERP discovery
| Task | Status |
|---|---|
| Implement `ShopifyScraper` class | ✅ Done |
| Fetch `{store_url}/products.json` for known Shopify stores (public API, no key) | ✅ Done |
| Google SERP search for `site:*.myshopify.com "{brand_name}"` for discovery | ✅ Done |
| Parse products: title, handle, price (variants), images, vendor | ✅ Done |
| Wire into `scrape_all_sources()` with `"shopify"` platform key | ✅ Done |

---

## 5. Etsy Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `EtsyScraper`
**Routing:** Static HTML (local, $0) — `etsy.com` already in `DomainRegistry.STATIC_DOMAINS`
| Task | Status |
|---|---|
| Implement `EtsyScraper` class | ✅ Done |
| Search URL: `https://www.etsy.com/search?q={encoded}` | ✅ Done |
| HTML parsing: `.v2-listing-card`, title, price, shop name, listing URL | ✅ Done |
| Wire into `scrape_all_sources()` with `"etsy"` platform key | ✅ Done |
| Optional: `ETSY_API_KEY` for structured API access (add to `.env.example`) | ✅ Done |

---

## 6. Facebook Marketplace Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `FacebookMarketplaceScraper`
**Routing:** JS-heavy (Firecrawl, 10 credits/call) — `facebook.com` already in `DomainRegistry.JS_HEAVY_DOMAINS`
| Task | Status |
|---|---|
| Implement `FacebookMarketplaceScraper` class | ✅ Done |
| Search URL: `https://www.facebook.com/marketplace/search/?query={encoded}` | ✅ Done |
| Firecrawl JS rendering → Gemini structured extraction | ✅ Done |
| Graceful fallback to empty list if blocked (Facebook anti-bot is aggressive) | ✅ Done |
| Wire into `scrape_all_sources()` with `"facebook_marketplace"` platform key | ✅ Done |

---

## 7. TikTok Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `TikTokScraper`
**Routing:** JS-heavy (Firecrawl, 10 credits/call) — `tiktok.com` already in `DomainRegistry.JS_HEAVY_DOMAINS`
| Task | Status |
|---|---|
| Implement `TikTokScraper` class | ✅ Done |
| Search URL: `https://www.tiktok.com/search?q={encoded}` | ✅ Done |
| Firecrawl JS rendering → Gemini extraction | ✅ Done |
| Extract: video description, creator handle, video URL, views | ✅ Done |
| Wire into `scrape_all_sources()` with `"tiktok"` platform key | ✅ Done |

---

## 8. Instagram Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `InstagramScraper`
**Routing:** JS-heavy (Firecrawl, 10 credits/call) — `instagram.com` already in `DomainRegistry.JS_HEAVY_DOMAINS`
| Task | Status |
|---|---|
| Implement `InstagramScraper` class | ✅ Done |
| Search URL: `https://www.instagram.com/explore/tags/{encoded}/` | ✅ Done |
| Firecrawl JS rendering → Gemini extraction | ✅ Done |
| Extract: post caption, post URL, username, media links | ✅ Done |
| Wire into `scrape_all_sources()` with `"instagram"` platform key | ✅ Done |

---

## 9. Google Shopping Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `GoogleShoppingScraper`
**Routing:** Static HTML (local, $0) — `google.com` already in `DomainRegistry.STATIC_DOMAINS`
| Task | Status |
|---|---|
| Implement `GoogleShoppingScraper` class | ✅ Done |
| Search URL: `https://www.google.com/search?tbm=shop&q={encoded}` | ✅ Done |
| HTML parsing with BeautifulSoup for shopping result cards | ✅ Done |
| Extract: product title, price, merchant name, product URL, image | ✅ Done |
| Wire into `scrape_all_sources()` with `"google_shopping"` platform key | ✅ Done |

---

## 10. Web Domain Discovery (SERP + WHOIS)
**Status:** ✅ Done
**File:** `marketplace.py` → `GoogleSERPAPI`
**Routing:** Static HTML + WHOIS lookups
| Task | Status |
|---|---|
| `GoogleSERPAPI.search()` with paginated Google scraping | ✅ Done |
| `check_serp_domains()` with WHOIS lookups | ✅ Done |
| Domain whitelist filtering (`domain_whitelist.py`) | ✅ Done |
| `GOOGLE_SERP_API` key for SerpApi (optional fallback) | ✅ Done |

---

## 11. Google Ads Transparency
**Status:** ✅ Done
**File:** `marketplace.py` → `GoogleAdsAPI`
| Task | Status |
|---|---|
| JSON API query | ✅ Done |
| HTML scraping fallback | ✅ Done |
| Firecrawl + Gemini extraction fallback | ✅ Done |
| Hijacking score filtering | ✅ Done |

---

## 12. Meta Ads Library
**Status:** ✅ Done
**File:** `marketplace.py` → `MetaAdsAPI`
| Task | Status |
|---|---|
| Graph API v19.0 query | ✅ Done |
| Screenshot capture and Supabase upload | ✅ Done |
| Hijacking score filtering | ✅ Done |
| Token exchange (short-lived → long-lived) | ✅ Done |

---

## 13. Alibaba Scraper
**Status:** ✅ Done
**File:** `marketplace.py` → `AlibabaScraper`
**Routing:** Static HTML (local, $0)
| Task | Status |
|---|---|
| Implement `AlibabaScraper` class | ✅ Done |
| HTML parsing: `.organic-list-offer-outter`, `.J-offer-wrapper`, `[data-content='productItem']` | ✅ Done |
| Extract: product title, price, and listing URL | ✅ Done |
| Wire into `scrape_all_sources()` with `"alibaba"` platform key | ✅ Done |

---

## Cross-Cutting Tasks

### Frontend — Platform Config
| Task | Status |
|---|---|
| Uncomment Shopify, eBay, AliExpress, Instagram, TikTok in `platforms.ts` | ✅ Done |
| Add Alibaba, Etsy, Facebook Marketplace, Google Shopping entries to `platforms.ts` | ✅ Done |
| Add `"Alibaba" \| "Etsy" \| "Facebook Marketplace" \| "Google Shopping"` to `Platform` type in `store.ts` | ✅ Done |

### Backend — Evidence Models
| Task | Status |
|---|---|
| Add `SocialEvidence` Pydantic model in `ai.py` (for TikTok/Instagram) | ✅ Done |
| Populate `Evidence.social` field with social media results | ✅ Done |

### Environment — API Keys
| Task | Status |
|---|---|
| Add `ETSY_API_KEY` to `.env.example` (optional) | ✅ Done |
| All other scrapers use existing keys or free scraping | ✅ Done |

### Tests
| Task | Status |
|---|---|
| Create `test_platform_scrapers.py` with mocked HTTP responses | ✅ Done |
| Test HTML parsing for eBay, Etsy, Google Shopping selectors | ✅ Done |
| Test Shopify `/products.json` parsing | ✅ Done |
| Test `scrape_all_sources()` with all platforms | ✅ Done |

---

## Description of Performed Changes

Here is a summary of all implementations and routing updates completed to support the 10 target platforms:

### 1. Backend Scrapers & Routing (`marketplace.py`)
- **eBay Scraper (`EbayScraper`)**: Implemented search functionality using standard HTTP requests and `BeautifulSoup` HTML parsing. Configured CSS selectors for extracting `.s-item` card titles, prices, seller info, clean listing links (stripping tracking tokens), and image links.
- **Shopify Scraper (`ShopifyScraper`)**: Developed a hybrid search scraper. For known Shopify domains, it queries the public `{store_url}/products.json` endpoint to retrieve structured product schemas cleanly without API keys. Uses Google SERP queries to discover matching Shopify sites.
- **Etsy Scraper (`EtsyScraper`)**: Created an HTML-parsing scraper using BeautifulSoup selectors for Etsy listings (`.wt-grid .v2-listing-card`, listing title, shop name, price). Added optional support for the official Etsy API via an `ETSY_API_KEY` environment variable.
- **AliExpress Scraper (`AliExpressScraper`)**: Migrated custom inline scraping into a dedicated AliExpress scraper class. Scrapes search listings via `UnifiedScraper` and runs raw markdown content through a structured Gemini extraction model.
- **Google Shopping Scraper (`GoogleShoppingScraper`)**: Created an HTML parser targeting the Google Shopping tab layout. Extracts item names, prices, sellers, and redirect URLs with automatic fallbacks for direct product page URLs.
- **Social Media Scrapers (TikTok, Instagram, Facebook Marketplace)**: Developed dedicated scraper classes using Firecrawl JS-heavy rendering fallbacks. Extracted content is passed to a Gemini model to perform zero-shot structured information extraction for suspected counterfeiting posts/listings.
- **Marketplace Integration**: Wired all new scrapers into `MarketplaceScraper.__init__()` and mapped them in `scrape_all_sources()`. Handled error boundary conditions and Pydantic validation cleanly.

### 2. Frontend Configuration & Type Safety
- **`store.ts`**: Expanded the `Platform` type union with `"Alibaba"`, `"Etsy"`, `"Facebook Marketplace"`, and `"Google Shopping"`.
- **`platforms.ts`**: Uncommented existing inactive channels and registered all newly created scrapers (including Alibaba) with their corresponding backend route keys, icons, and categories.
- **`monitoring.tsx`**: Updated the listing array `ALL_PLATFORMS` to display all active channels (including Alibaba) in the platform select dropdown on the UI.

### 3. Environment & Configuration
- **`.env.example`**: Documented the optional `ETSY_API_KEY` configuration environment variable.

### 4. Verification & Testing
- Created unit tests in `tests/test_platform_scrapers.py` covering HTML selectors, `/products.json` parser logic, JS-heavy routing path delegation, and integrated orchestrator routing. All 19 tests execute and pass successfully.
