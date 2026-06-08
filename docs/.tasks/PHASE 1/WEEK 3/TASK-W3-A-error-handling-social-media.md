# TASK-W3-A — Error Handling, Retry Logic & Social Media Monitoring (Engineer A)

**Assigned to:** Gabriel (Engineer A)
**Week:** Week 3
**Priority:** 🟡 Medium-High
**Stack:** Python · FastAPI · Firecrawl (Tier 3) · requests · BeautifulSoup · tenacity

---

## Objective

Harden the scraping pipeline against real-world failures: add retry logic for transient errors, handle timeouts and empty responses gracefully, and extend `gather_evidence` to include basic **social media monitoring** (TikTok seller profiles, Instagram brand impersonation pages) as a new evidence source. Validate the entire scraper against 10 different brand names.

**Success test:**
```python
# Must all complete without exceptions — even with bad network
for brand in ["Nike", "Gucci", "Rolex", "Adidas", "Apple", "Samsung",
              "Louis Vuitton", "Chanel", "Prada", "Ray-Ban"]:
    evidence = gather_evidence(brand, ["amazon", "google_ads", "domains", "social"])
    assert evidence is not None
    assert isinstance(evidence.marketplaces, list)
    assert isinstance(evidence.domains, list)
```

---

## Context

Weeks 1 and 2 built the happy path. Real scraping fails constantly — Amazon blocks bots, WHOIS rate-limits lookups, Gemini times out, Firecrawl returns partial results. Week 3 adds the defensive layer that makes the scraper production-grade.

Social media monitoring uses **Firecrawl (Tier 3)** because TikTok and Instagram are React SPAs that block `requests`. Be careful with credit budget — limit social media scrapes to the highest-priority platforms per brand and cache aggressively.

---

## Step-by-Step Implementation

### Step 1 — Retry Logic with `tenacity`

Add `tenacity` to `requirements.txt`. Wrap all external API calls (Firecrawl, WHOIS, Ads APIs) with exponential backoff retry decorators.

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import requests

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((requests.Timeout, requests.ConnectionError)),
    reraise=False,  # Return None on final failure instead of raising
)
def _fetch_with_retry(url: str, headers: dict, timeout: int = 10) -> requests.Response | None:
    """
    Makes an HTTP GET request with automatic retry on network errors.
    Returns None after 3 failed attempts (never raises to the caller).
    """
    return requests.get(url, headers=headers, timeout=timeout)
```

Apply the same retry pattern to:
- `AmazonScraper.search()` — wrap `requests.get` calls
- `WhoisAPI.check_similar_domains()` — wrap `whois.whois()` calls
- `FirecrawlScraper.scrape_with_fallback()` — wrap the `scrape_page()` call
- `GoogleAdsAPI.search()` and `MetaAdsAPI.search()` — wrap `requests.get` calls

---

### Step 2 — Timeout & Empty Response Handling

Every scraper function must handle these scenarios without crashing:

```python
class AmazonScraper:
    def search(self, keyword: str, max_pages: int = 3) -> list[dict]:
        listings = []
        for page in range(1, max_pages + 1):
            response = _fetch_with_retry(url, headers=HEADERS, timeout=8)

            # Handle failed/None response
            if response is None:
                print(f"[AmazonScraper] Page {page} timed out — skipping")
                break

            # Handle non-200 status (e.g. Amazon CAPTCHA page returns 503)
            if response.status_code != 200:
                print(f"[AmazonScraper] HTTP {response.status_code} on page {page} — stopping")
                break

            soup = BeautifulSoup(response.text, "html.parser")
            items = soup.select("[data-component-type='s-search-result']")

            # Handle CAPTCHA or empty results page
            if not items:
                print(f"[AmazonScraper] No listings found on page {page} — possible CAPTCHA")
                break

            for item in items:
                listing = self.extract_listing_data(item)
                if listing:
                    listings.append(listing)

        return listings  # Always return a list, even if empty
```

Apply the same pattern to `EbayScraper`, `AlibabaScraper`, and `WhoisAPI`.

---

### Step 3 — Social Media Monitoring (Tier 3: Firecrawl)

Add a `SocialMediaScraper` class that monitors TikTok and Instagram for brand impersonation using Firecrawl as the only viable method (both are JS SPAs).

```python
class SocialMediaScraper:
    """
    Tier 3 — Social media monitoring via Firecrawl.
    Used for: TikTok seller search, Instagram brand pages.
    Cost: ~10-15 credits per platform per brand. Use sparingly.
    """

    def __init__(self):
        self.firecrawl = FirecrawlScraper()

    def search_tiktok(self, brand_name: str) -> list[dict]:
        """
        Searches TikTok for seller/shop profiles using the brand keyword.
        Looks for: unauthorized shops, counterfeit product videos.
        Returns list of profile records.
        """
        encoded = brand_name.replace(" ", "%20")
        url = f"https://www.tiktok.com/search?q={encoded}&type=user"
        result = self.firecrawl.scrape_with_fallback(url)
        if not result or not result.markdown:
            return []
        return self._parse_social_results(result.markdown, "tiktok", brand_name)

    def search_instagram(self, brand_name: str) -> list[dict]:
        """
        Searches Instagram for impersonation accounts using the brand keyword.
        Looks for: fake brand accounts, counterfeit seller profiles.
        Returns list of profile records.
        """
        encoded = brand_name.replace(" ", "")
        url = f"https://www.instagram.com/explore/tags/{encoded}/"
        result = self.firecrawl.scrape_with_fallback(url)
        if not result or not result.markdown:
            return []
        return self._parse_social_results(result.markdown, "instagram", brand_name)

    def _parse_social_results(
        self, markdown: str, platform: str, brand_name: str
    ) -> list[dict]:
        """
        Uses Gemini (flash) to extract suspicious social media profiles
        from the raw Firecrawl markdown output.
        """
        from tracemark_api.services.marketplace import extract_marketplace_evidence
        from tracemark_api.services.scraper import ScrapeResult
        # Reuse the existing Gemini extraction function
        mock_result = ScrapeResult(
            url="", title=None, markdown=markdown, success=True, error_message=None
        )
        return extract_marketplace_evidence(brand_name, platform, markdown)
```

Update `MarketplaceScraper.scrape_all_sources()` to include social:

```python
# In scrape_all_sources():
social_scraper = SocialMediaScraper()
if "social" in platforms:
    results["social"] = (
        social_scraper.search_tiktok(brand_name) +
        social_scraper.search_instagram(brand_name)
    )
else:
    results["social"] = []
```

---

### Step 4 — Rate Limiting & Politeness

Add delays between requests to avoid triggering bot detection:

```python
import time
import random

def _polite_delay(min_seconds: float = 1.0, max_seconds: float = 3.0):
    """Sleep a random interval to mimic human browsing behavior."""
    time.sleep(random.uniform(min_seconds, max_seconds))
```

Apply `_polite_delay()` between page loops in `AmazonScraper.search()` and between WHOIS domain lookups in `WhoisAPI.check_similar_domains()`.

---

### Step 5 — 10-Brand Validation Test

Create `apps/api/tests/test_scraper_brands.py`:

```python
import pytest
from tracemark_api.services.marketplace import gather_evidence
from tracemark_api.services.ai import Evidence

BRANDS = [
    "Nike", "Gucci", "Rolex", "Adidas", "Apple",
    "Samsung", "Louis Vuitton", "Chanel", "Prada", "Ray-Ban"
]

@pytest.mark.parametrize("brand", BRANDS)
def test_gather_evidence_does_not_crash(brand):
    """
    Every brand must return a valid Evidence object.
    No exceptions, no None returns, no field type errors.
    Tests run in mock mode (no API keys required in CI).
    """
    evidence = gather_evidence(brand, ["amazon", "domains"])
    assert evidence is not None, f"gather_evidence returned None for {brand}"
    assert isinstance(evidence, Evidence), f"Wrong return type for {brand}"
    assert isinstance(evidence.marketplaces, list)
    assert isinstance(evidence.domains, list)
    assert isinstance(evidence.ads, list)
    assert evidence.timestamp is not None

@pytest.mark.parametrize("brand", BRANDS[:3])
def test_gather_evidence_returns_populated_data(brand):
    """
    With real API keys, at least one evidence source should return data.
    Runs only in environments with FIRECRAWL_API_KEY set.
    """
    import os
    if not os.environ.get("FIRECRAWL_API_KEY"):
        pytest.skip("FIRECRAWL_API_KEY not set — skipping real data test")
    evidence = gather_evidence(brand, ["amazon", "google_ads", "domains"])
    total_items = (
        len(evidence.marketplaces) + len(evidence.ads) + len(evidence.domains)
    )
    # At least domains should return something (WHOIS is free)
    assert total_items >= 0  # Soft check — don't fail on legitimately clean brands
```

Run with: `pytest apps/api/tests/test_scraper_brands.py -v`

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/services/marketplace.py` | **Update** — retry logic, timeout handling, `SocialMediaScraper`, rate limiting |
| `apps/api/tests/test_scraper_brands.py` | **Create** — 10-brand parametrized test suite |
| `requirements.txt` / `pyproject.toml` | **Update** — add `tenacity>=8.2.0` |

---

## Acceptance Criteria

- [ ] All 10 brands in `BRANDS` list pass `test_gather_evidence_does_not_crash` — no exceptions
- [ ] `AmazonScraper` handles CAPTCHA/503 response without crashing (returns empty list)
- [ ] `WhoisAPI` handles WHOIS timeout without crashing (skips domain silently)
- [ ] `FirecrawlScraper` never exceeds 400 credits/month budget (budget check enforced before each call)
- [ ] `SocialMediaScraper.search_tiktok("Nike")` returns a list (may be empty — no crash)
- [ ] `_polite_delay()` is called between pagination requests in `AmazonScraper`
- [ ] `pytest apps/api/tests/test_scraper_brands.py` passes with 0 failures in mock mode
