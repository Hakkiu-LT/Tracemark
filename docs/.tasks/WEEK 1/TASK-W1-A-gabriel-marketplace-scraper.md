# TASK-W1-A — Build Marketplace Scraper (Mixed Methodology)

**Assigned to:** Gabriel (Engineer A)
**Week:** Week 1
**Priority:** 🔴 High
**Stack:** Python · FastAPI · Firecrawl · requests · BeautifulSoup · LangGraph · Google AI Studio (Gemini)

---

## Objective

Build a `gather_evidence` function that accepts a brand name and a list of target platforms, scrapes relevant product listings and ads using a **3-tier mixed methodology**, and returns a structured JSON `Evidence` object.

**Success test:**
```python
evidence = gather_evidence("Nike", ["amazon", "ebay", "google_ads", "whois"])
# Output: Evidence JSON with listings, ads, and domain results
```

---

## Context

The project already has a working Firecrawl scraper in `apps/api/src/tracemark_api/services/scraper.py` that calls the Firecrawl `/v1/scrape` API. **However, using Firecrawl for every platform is expensive.** The new mixed methodology introduces two cheaper tiers that handle most platforms for free, reserving Firecrawl only as a last resort for JavaScript-heavy sites.

The existing LangGraph `gather_evidence` node in `apps/api/src/tracemark_api/services/ai.py` already does a single-URL analysis. You will refactor and expand it into a full multi-tier scraping engine.

---

## Scraping Tier Strategy

The key design principle: **route each platform to the cheapest scraper that works.**

| Tier | Method | Platforms | Cost |
|------|--------|-----------|------|
| **Tier 1** | `requests` + `BeautifulSoup` (custom scrapers) | Amazon, eBay, Alibaba, Google Shopping | $0 |
| **Tier 2** | Official APIs | Google Ads Library, Meta Ads Library, WHOIS | $0 |
| **Tier 3** | Firecrawl (fallback only) | AliExpress, Facebook Marketplace, Instagram, TikTok, any Tier-1 failure | ~5–20 credits/page |

**Firecrawl budget: max 200–400 credits/month.** Never call Firecrawl for a platform that can be scraped with `requests`. Always try Tier 1 first; escalate to Tier 3 only on failure.

---

## Step-by-Step Implementation

### Step 1 — Platform URL Constructor

Create `apps/api/src/tracemark_api/services/marketplace.py`.

Add `build_search_urls(brand_name: str, platforms: list[str]) -> dict[str, str]`:

```python
def build_search_urls(brand_name: str, platforms: list[str]) -> dict[str, str]:
    urls = {}
    encoded = brand_name.replace(" ", "+")
    # Tier 1 — custom scrapers
    if "amazon" in platforms:
        urls["amazon"] = f"https://www.amazon.com/s?k={encoded}"
    if "ebay" in platforms:
        urls["ebay"] = f"https://www.ebay.com/sch/i.html?_nkw={encoded}"
    if "alibaba" in platforms:
        urls["alibaba"] = f"https://www.alibaba.com/trade/search?SearchText={encoded}"
    # Tier 3 — Firecrawl only
    if "aliexpress" in platforms:
        urls["aliexpress"] = f"https://www.aliexpress.com/wholesale?SearchText={encoded}"
    return urls
```

For Week 1, implement **Amazon** (Tier 1) and **WHOIS** (Tier 2) fully. eBay, Alibaba, and Ads APIs are stubbed.

---

### Step 2 — Tier 1: Custom Scrapers (requests + BeautifulSoup)

Add individual scraper classes for static HTML platforms. These make direct HTTP requests — **no Firecrawl credits used.**

```python
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

class AmazonScraper:
    """Tier 1 — static HTML, no JS needed. Cost: $0."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        """
        Scrape Amazon search results pages.
        Args:
            keyword: Brand name to search
            max_pages: Number of result pages to crawl
        Returns:
            List of listing dicts: title, price, seller, url, rating, reviews, ship_from
        """
        listings = []
        encoded = keyword.replace(" ", "+")
        for page in range(1, max_pages + 1):
            url = f"https://www.amazon.com/s?k={encoded}&page={page}"
            try:
                resp = requests.get(url, headers=HEADERS, timeout=10)
                soup = BeautifulSoup(resp.text, "html.parser")
                for item in soup.select("[data-component-type='s-search-result']"):
                    listing = self.extract_listing_data(item)
                    if listing:
                        listings.append(listing)
            except Exception as e:
                print(f"[AmazonScraper] Page {page} failed: {e}")
                break
        return listings

    def extract_listing_data(self, element) -> dict | None:
        """
        Parse a single product card element from Amazon's HTML.
        Returns dict with: title, price, seller, url, rating, reviews, ship_from
        """
        try:
            title = element.select_one("h2 span")
            price = element.select_one(".a-price .a-offscreen")
            seller = element.select_one(".a-size-small .a-color-secondary")
            link = element.select_one("h2 a")
            rating = element.select_one(".a-icon-alt")
            reviews = element.select_one(".a-size-small .a-link-normal")
            return {
                "title": title.text.strip() if title else None,
                "price": price.text.strip() if price else None,
                "seller": seller.text.strip() if seller else None,
                "url": f"https://amazon.com{link['href']}" if link else None,
                "rating": rating.text.split(" ")[0] if rating else None,
                "reviews": reviews.text.strip() if reviews else None,
                "ship_from": "N/A",
            }
        except Exception:
            return None


class EbayScraper:
    """Tier 1 — stub for Week 1. Implement in Week 2."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        return []  # TODO: implement


class AlibabaScraper:
    """Tier 1 — stub for Week 1. Implement in Week 2."""

    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        return []  # TODO: implement
```

---

### Step 3 — Tier 2: Official API Clients

Add API wrapper classes for free official data sources.

```python
class WhoisAPI:
    """
    Tier 2 — WHOIS lookups for typosquatting detection.
    Uses python-whois (free). Cost: $0.
    """

    def check_similar_domains(self, brand_name: str) -> list[dict]:
        """
        Generates typosquatting variations of brand_name and checks WHOIS.
        Returns list of registered suspicious domains with registrant + creation date.
        """
        import whois
        variations = self._generate_variations(brand_name)
        results = []
        for domain in variations:
            try:
                w = whois.whois(domain)
                if w.domain_name:
                    results.append({
                        "domain": domain,
                        "registrant": w.registrar or "unknown",
                        "created_date": str(w.creation_date),
                        "status": "active",
                    })
            except Exception:
                pass
        return results

    def _generate_variations(self, brand_name: str) -> list[str]:
        """Generate common typosquatting patterns for a brand."""
        name = brand_name.lower().replace(" ", "")
        tlds = [".shop", ".store", ".net", ".org", ".co"]
        patterns = [
            f"{name}-official",
            f"{name}-store",
            f"official-{name}",
            f"buy{name}",
            f"{name}sale",
        ]
        return [f"{p}{tld}" for p in patterns for tld in tlds]


class GoogleAdsAPI:
    """
    Tier 2 — Google Ads Transparency API.
    Cost: $0. Stub for Week 1 — implement in Week 2.
    """

    def search(self, brand_keyword: str) -> list[dict]:
        return []  # TODO: implement with Google Ads Transparency Center API


class MetaAdsAPI:
    """
    Tier 2 — Meta Ad Library API (Facebook/Instagram).
    Cost: $0. Stub for Week 1 — implement in Week 2.
    """

    def search(self, brand_keyword: str) -> list[dict]:
        return []  # TODO: implement with Meta Ad Library API
```

---

### Step 4 — Tier 3: Firecrawl Fallback (Minimal Use)

Refactor the existing `scraper.py` call into a **cost-aware fallback** class. Only invoke Firecrawl after Tier 1 has been confirmed to fail.

```python
from tracemark_api.services.scraper import scrape_page, ScrapeResult
from datetime import datetime, timedelta

# In-memory cache to avoid re-scraping same URL within 24h
_firecrawl_cache: dict[str, tuple[ScrapeResult, datetime]] = {}
_credit_log: list[dict] = []

class FirecrawlScraper:
    """
    Tier 3 — fallback for JS-heavy sites (AliExpress, Facebook Marketplace, TikTok).
    Budget: 200–400 credits/month. Use sparingly.
    """

    MONTHLY_CREDIT_BUDGET = 400

    def scrape_with_fallback(self, url: str) -> ScrapeResult | None:
        """
        Smart fallback logic:
        1. Check 24h in-memory cache — return cached result if fresh
        2. Check remaining credit estimate — warn if low
        3. Only then call Firecrawl
        4. Log credit usage per URL
        Never retry a failed URL on the same calendar day.
        """
        # 1. Check cache
        if url in _firecrawl_cache:
            cached_result, cached_at = _firecrawl_cache[url]
            if datetime.now() - cached_at < timedelta(hours=24):
                return cached_result

        # 2. Check credit budget
        credits_used_this_month = sum(entry["credits"] for entry in _credit_log)
        if credits_used_this_month >= self.MONTHLY_CREDIT_BUDGET:
            print(f"[FirecrawlScraper] Monthly budget exhausted. Skipping {url}")
            return None
        if credits_used_this_month > self.MONTHLY_CREDIT_BUDGET * 0.8:
            print(f"[FirecrawlScraper] WARNING: 80% of monthly budget used.")

        # 3. Call Firecrawl
        try:
            result = scrape_page(url)
            _firecrawl_cache[url] = (result, datetime.now())
            _credit_log.append({
                "url": url,
                "timestamp": datetime.now().isoformat(),
                "credits": 10,  # Estimate; update when Firecrawl returns actual usage
            })
            return result
        except Exception as e:
            print(f"[FirecrawlScraper] Failed for {url}: {e}")
            return None
```

**Tier 3 platforms (use FirecrawlScraper for these only):**
- AliExpress — Cloudflare protection + heavy JS
- Facebook Marketplace — auth-gated SPA
- Instagram brand pages — pure React SPA
- TikTok seller profiles — infinite scroll + SPA

---

### Step 5 — `MarketplaceScraper` Aggregator

Wire all three tiers into a single orchestrator class:

```python
class MarketplaceScraper:
    """
    Main aggregator. Routes each platform to the correct scraping tier.
    Tier 1 (custom) → Tier 2 (APIs) → Tier 3 (Firecrawl fallback).
    """

    def __init__(self):
        self.amazon = AmazonScraper()
        self.ebay = EbayScraper()
        self.alibaba = AlibabaScraper()
        self.google_ads = GoogleAdsAPI()
        self.meta_ads = MetaAdsAPI()
        self.whois = WhoisAPI()
        self.firecrawl = FirecrawlScraper()  # Fallback only

    def scrape_all_sources(self, brand_name: str) -> dict:
        """
        Coordinates all tiers and returns a raw results dict.
        Tier 1 and Tier 2 calls run first; Tier 3 only if Tier 1 returns empty.
        """
        results = {
            "marketplaces": {},
            "ads": {},
            "domains": [],
            "timestamp": datetime.now().isoformat(),
        }

        # --- Tier 1: Custom scrapers ---
        results["marketplaces"]["amazon"] = self.amazon.search(brand_name)
        results["marketplaces"]["ebay"] = self.ebay.search(brand_name)
        results["marketplaces"]["alibaba"] = self.alibaba.search(brand_name)

        # --- Tier 1 → Tier 3 fallback for AliExpress ---
        aliexpress_url = f"https://www.aliexpress.com/wholesale?SearchText={brand_name.replace(' ', '+')}"
        aliexpress_result = self.firecrawl.scrape_with_fallback(aliexpress_url)
        results["marketplaces"]["aliexpress"] = aliexpress_result.markdown if aliexpress_result else ""

        # --- Tier 2: Official APIs ---
        results["ads"]["google"] = self.google_ads.search(brand_name)
        results["ads"]["meta"] = self.meta_ads.search(brand_name)
        results["domains"] = self.whois.check_similar_domains(brand_name)

        return results
```

---

### Step 6 — Extract Listings with Gemini

After collecting raw scrape results, pass them through Gemini to produce structured `MarketplaceEvidence` objects. This step applies to **Tier 1 and Tier 3 results** (Tier 2 APIs already return structured data).

```python
from langchain_google_genai import ChatGoogleGenerativeAI
from tracemark_api.services.ai import MarketplaceEvidence
from pydantic import BaseModel
import os

class ListingList(BaseModel):
    items: list[MarketplaceEvidence]

def extract_marketplace_evidence(
    brand_name: str,
    platform: str,
    raw_content: str,  # Markdown (Tier 3) or pre-serialized listing JSON (Tier 1)
) -> list[MarketplaceEvidence]:
    """
    Uses Gemini to analyze raw scraped content and extract suspicious listings.
    Returns an empty list if no API key is set or content is empty.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not raw_content.strip():
        return []

    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0.0,
        google_api_key=api_key,
    )

    prompt = f"""
You are a brand protection analyst. Below is scraped content from a {platform} search for brand "{brand_name}".

Identify every listing that appears to be counterfeit, unauthorized resale, or suspicious brand use.
For each, return: platform, seller_name, listing_url, price.

Content:
{raw_content[:6000]}

Return a JSON array. Fields: platform, seller_name, listing_url, price.
If nothing suspicious, return [].
"""
    structured_model = model.with_structured_output(ListingList)
    result = structured_model.invoke(prompt)
    return result.items
```

> **Note on Google AI Studio keys:** `ChatGoogleGenerativeAI` works directly with AI Studio keys (starting with `AIza...`). No extra config needed.

---

### Step 7 — `gather_evidence` Public Function

Tie everything together as the single public entrypoint:

```python
from tracemark_api.services.ai import Evidence
from datetime import datetime

def gather_evidence(brand_name: str, platforms: list[str]) -> Evidence:
    """
    Main entrypoint. Runs the 3-tier scraping pipeline and returns
    a fully populated Evidence object.

    Tier 1 (custom) handles Amazon/eBay/Alibaba at $0 cost.
    Tier 2 (APIs) handles ads and domain monitoring at $0 cost.
    Tier 3 (Firecrawl) handles JS-heavy sites only, within credit budget.
    """
    import os

    # --- Mock mode: no API keys set ---
    if not os.environ.get("FIRECRAWL_API_KEY") and not os.environ.get("GEMINI_API_KEY"):
        return _mock_evidence(brand_name)

    scraper = MarketplaceScraper()
    raw = scraper.scrape_all_sources(brand_name)

    all_marketplace_evidence = []

    # Process Tier 1 + Tier 3 marketplace results through Gemini
    for platform, content in raw["marketplaces"].items():
        if isinstance(content, list):
            content_str = str(content)  # Tier 1 returns list of dicts
        else:
            content_str = content or ""  # Tier 3 returns markdown string
        listings = extract_marketplace_evidence(brand_name, platform, content_str)
        all_marketplace_evidence.extend(listings)

    return Evidence(
        marketplaces=all_marketplace_evidence,
        ads=raw["ads"].get("google", []) + raw["ads"].get("meta", []),
        domains=raw["domains"],
        social=[],
        timestamp=datetime.now(),
    )


def _mock_evidence(brand_name: str) -> Evidence:
    """Returns deterministic mock data when no env vars are set."""
    return Evidence(
        marketplaces=[
            MarketplaceEvidence(
                platform="amazon",
                seller_name="MockSeller_XYZ",
                listing_url="https://amazon.com/dp/MOCK123",
                price="$19.99",
            )
        ],
        ads=[],
        domains=[
            {"domain": f"{brand_name.lower()}-official.shop", "registrant": "unknown",
             "created_date": "2025-12-10", "status": "active"}
        ],
        social=[],
        timestamp=datetime.now(),
    )
```

---

### Step 8 — Wire into FastAPI

Update `apps/api/src/tracemark_api/routes/monitoring.py`:

```python
from tracemark_api.services.marketplace import gather_evidence as scrape_evidence
from pydantic import BaseModel

class GatherEvidenceRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon", "whois"]

@router.post("/gather-evidence")
def gather_evidence_endpoint(payload: GatherEvidenceRequest):
    evidence = scrape_evidence(payload.brand_name, payload.platforms)
    return evidence
```

Route: `POST /api/v1/monitoring/gather-evidence`

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/services/marketplace.py` | **Create** — all 3-tier scraper logic |
| `apps/api/src/tracemark_api/routes/monitoring.py` | **Update** — add `/gather-evidence` endpoint |
| `apps/api/src/tracemark_api/services/ai.py` | **Read only** — reuse existing Pydantic models |
| `.env.example` | **Update** — confirm all keys listed below |

---

## New Dependencies

Add to `requirements.txt` or `pyproject.toml`:

```
requests>=2.31.0
beautifulsoup4>=4.12.0
python-whois>=0.9.0
```

> `firecrawl-py` and `langchain-google-genai` are already in the project.

---

## Acceptance Criteria

- [ ] `gather_evidence("Nike", ["amazon"])` returns a valid `Evidence` JSON — with real data when keys are set, mock data otherwise
- [ ] Amazon listings are scraped via `requests` + `BeautifulSoup` (NOT Firecrawl)
- [ ] AliExpress falls back to Firecrawl only after Tier 1 is confirmed unavailable
- [ ] Firecrawl is **never** called for Amazon, eBay, or Alibaba
- [ ] WHOIS domain check returns typosquatting variants for the brand
- [ ] `FirecrawlScraper` respects the 400-credit monthly budget and logs usage
- [ ] `FirecrawlScraper` returns cached result if URL was scraped within 24h
- [ ] `POST /api/v1/monitoring/gather-evidence` returns 200 with `Evidence` JSON
- [ ] Mock fallback works with no env vars set — no crashes, valid structure returned
- [ ] Function is importable: `from tracemark_api.services.marketplace import gather_evidence`

---

## Environment Variables Required

```env
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxx        # From firecrawl.dev — Tier 3 fallback only
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxx     # From Google AI Studio (aistudio.google.com)
# Optional for Week 2 Tier 2 API expansion:
# GOOGLE_ADS_API_KEY=...
# META_ADS_ACCESS_TOKEN=...
```

---

## Notes for Integration (Week 2)

In Week 2, the `gather_evidence` function will be called by Engineer B's LangGraph decision agent as the first node in the pipeline. **Keep the function signature stable:** `gather_evidence(brand_name: str, platforms: list[str]) -> Evidence`. Do not change the return type.

Engineer B's agent expects `evidence.marketplaces` to be a list of `MarketplaceEvidence` objects — ensure Gemini extraction populates this correctly even when Tier 1 returns raw HTML/dicts.

The Firecrawl credit log (`_credit_log`) will be wired into the Supabase `monitoring_jobs` table in Week 2 for persistent budget tracking across restarts.
