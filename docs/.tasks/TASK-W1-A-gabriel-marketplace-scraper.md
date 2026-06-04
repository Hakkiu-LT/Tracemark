# TASK-W1-A — Build Marketplace Scraper (Amazon via Firecrawl)

**Assigned to:** Gabriel (Engineer A)
**Week:** Week 1
**Priority:** 🔴 High
**Stack:** Python · FastAPI · Firecrawl · LangGraph · Google AI Studio (Gemini)

---

## Objective

Build a `gather_evidence` function that accepts a brand name and a list of target marketplaces, scrapes the relevant product listings using Firecrawl, and returns a structured JSON with detected listings as evidence.

**Success test:**
```python
evidence = gather_evidence("Nike", ["amazon"])
# Output: JSON with listings found on Amazon
```

---

## Context

The project already has a working Firecrawl scraper in `apps/api/src/tracemark_api/services/scraper.py`. It exposes a `scrape_page(url: str) -> ScrapeResult` function that calls the Firecrawl `/v1/scrape` API and returns markdown + HTML content. Your job is to build **on top of this** — constructing search URLs per platform, scraping the results pages, and then using a Gemini model (via `langchain-google-genai`) to extract structured listing evidence from the raw markdown.

The existing LangGraph `gather_evidence` node in `apps/api/src/tracemark_api/services/ai.py` already does a single-URL analysis. You will refactor and expand it into a proper multi-platform scraping function that can be called standalone and also plugged back into the LangGraph graph.

---

## Step-by-Step Implementation

### Step 1 — Build Platform URL Constructor

Create `apps/api/src/tracemark_api/services/marketplace.py`.

Add a function `build_search_urls(brand_name: str, platforms: list[str]) -> dict[str, str]` that returns a search URL per platform:

```python
def build_search_urls(brand_name: str, platforms: list[str]) -> dict[str, str]:
    urls = {}
    encoded = brand_name.replace(" ", "+")
    if "amazon" in platforms:
        urls["amazon"] = f"https://www.amazon.com/s?k={encoded}"
    if "ebay" in platforms:
        urls["ebay"] = f"https://www.ebay.com/sch/i.html?_nkw={encoded}"
    if "aliexpress" in platforms:
        urls["aliexpress"] = f"https://www.aliexpress.com/wholesale?SearchText={encoded}"
    return urls
```

For Week 1, only `amazon` is required. eBay and AliExpress are stubbed and can return empty results.

---

### Step 2 — Scrape Search Results per Platform

In the same `marketplace.py` file, add `scrape_platform(platform: str, url: str) -> ScrapeResult` that calls the existing `scrape_page(url)` from `scraper.py`. Wrap it with error handling:

```python
from tracemark_api.services.scraper import scrape_page, ScrapeResult

def scrape_platform(platform: str, url: str) -> ScrapeResult:
    try:
        return scrape_page(url)
    except Exception as e:
        return ScrapeResult(
            url=url,
            title=None,
            markdown="",
            success=False,
            error_message=f"[{platform}] Scrape failed: {str(e)}"
        )
```

---

### Step 3 — Extract Listings with Gemini

After scraping, feed the raw markdown into a Gemini model via `langchain-google-genai` to extract structured `MarketplaceEvidence` objects. The `MarketplaceEvidence` Pydantic model already exists in `apps/api/src/tracemark_api/services/ai.py`.

Add an `extract_marketplace_evidence` function:

```python
from langchain_google_genai import ChatGoogleGenerativeAI
from tracemark_api.services.ai import MarketplaceEvidence, Evidence
import os

def extract_marketplace_evidence(
    brand_name: str,
    platform: str,
    scrape_result: ScrapeResult
) -> list[MarketplaceEvidence]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not scrape_result.success:
        return []

    model = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0.0,
        google_api_key=api_key
    )

    prompt = f"""
You are a brand protection analyst. Below is the scraped content of a {platform} search results page for the brand "{brand_name}".

Extract every product listing that appears to be a counterfeit, unauthorized resale, or suspicious use of the brand.
For each listing return: platform name, seller name, listing URL, and price if visible.

Scraped content:
{scrape_result.markdown[:6000]}

Return a JSON array of objects with fields: platform, seller_name, listing_url, price.
If no suspicious listings found, return an empty array [].
"""
    # Use structured output bound to a list schema
    from pydantic import BaseModel
    class ListingList(BaseModel):
        items: list[MarketplaceEvidence]

    structured_model = model.with_structured_output(ListingList)
    result = structured_model.invoke(prompt)
    return result.items
```

> **Note on Google AI Studio vs direct API:** When `GEMINI_API_KEY` is a Google AI Studio key (starts with `AIza...`), `langchain-google-genai` works directly. No changes needed to the import — the same `ChatGoogleGenerativeAI` class handles both Vertex AI and AI Studio keys based on which env vars are set.

---

### Step 4 — `gather_evidence` Public Function

Now tie everything together into the main function that Week 1 tests against:

```python
from tracemark_api.services.ai import Evidence
from datetime import datetime

def gather_evidence(brand_name: str, platforms: list[str]) -> Evidence:
    """
    Main entrypoint. Scrapes all target platforms for brand_name
    and returns a populated Evidence object.
    """
    urls = build_search_urls(brand_name, platforms)
    all_marketplace_evidence = []

    for platform, url in urls.items():
        scrape_result = scrape_platform(platform, url)
        listings = extract_marketplace_evidence(brand_name, platform, scrape_result)
        all_marketplace_evidence.extend(listings)

    return Evidence(
        marketplaces=all_marketplace_evidence,
        ads=[],
        domains=[],
        social=[],
        timestamp=datetime.now()
    )
```

---

### Step 5 — Wire into FastAPI

Update `apps/api/src/tracemark_api/routes/monitoring.py` to expose `gather_evidence` via an endpoint so Domantas (Engineer C) can call it from the frontend mock:

```python
# Add this endpoint to monitoring.py
from tracemark_api.services.marketplace import gather_evidence as scrape_evidence

class GatherEvidenceRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon"]

@router.post("/gather-evidence")
def gather_evidence_endpoint(payload: GatherEvidenceRequest):
    evidence = scrape_evidence(payload.brand_name, payload.platforms)
    return evidence
```

This becomes part of the `/api/v1/monitoring/gather-evidence` route.

---

### Step 6 — Mock Mode (No API Keys)

If `FIRECRAWL_API_KEY` or `GEMINI_API_KEY` are not set, the function must still return a valid `Evidence` object with mock data so Engineer C and Engineer B can develop in parallel without real credentials:

```python
# In gather_evidence(), before calling scrape_platform:
if not os.environ.get("FIRECRAWL_API_KEY"):
    return Evidence(
        marketplaces=[
            MarketplaceEvidence(
                platform="amazon",
                seller_name="MockSeller_XYZ",
                listing_url=f"https://amazon.com/dp/MOCK123",
                price="$19.99"
            )
        ],
        ads=[], domains=[], social=[],
        timestamp=datetime.now()
    )
```

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/services/marketplace.py` | **Create** — main scraper logic |
| `apps/api/src/tracemark_api/routes/monitoring.py` | **Update** — add `/gather-evidence` endpoint |
| `apps/api/src/tracemark_api/services/ai.py` | **Read only** — reuse existing Pydantic models |
| `.env.example` | **Update** — confirm `FIRECRAWL_API_KEY` and `GEMINI_API_KEY` are listed |

---

## Acceptance Criteria

- [ ] `gather_evidence("Nike", ["amazon"])` returns a valid `Evidence` JSON object with at least mock data
- [ ] When `FIRECRAWL_API_KEY` is set, real Amazon search results are scraped via Firecrawl
- [ ] When `GEMINI_API_KEY` is set, Gemini extracts structured `MarketplaceEvidence` items from the markdown
- [ ] `POST /api/v1/monitoring/gather-evidence` returns 200 with `Evidence` JSON
- [ ] Mock fallback works with no env vars set (no crashes)
- [ ] Function is importable: `from tracemark_api.services.marketplace import gather_evidence`

---

## Environment Variables Required

```env
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxx      # From firecrawl.dev dashboard
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxx   # From Google AI Studio (aistudio.google.com)
```

---

## Notes for Integration (Week 2)

In Week 2, the `gather_evidence` function will be called by Engineer B's LangGraph decision agent as the first node in the pipeline. Keep the function signature stable: `gather_evidence(brand_name: str, platforms: list[str]) -> Evidence`. Do not change the return type.
