# TASK-W2-A — Ads Monitoring & Domain Surveillance (Engineer A)

**Assigned to:** Gabriel (Engineer A)
**Week:** Week 2
**Priority:** 🔴 High
**Stack:** Python · FastAPI · Meta Ads Library API · Google Ads Transparency API · python-whois · BeautifulSoup · Firecrawl (Tier 3 only)

---

## Objective

Expand `gather_evidence` to cover three new evidence sources: **Google Ads**, **Meta Ads (Facebook/Instagram)**, and **WHOIS domain surveillance**. By end of week, the function must return enriched evidence covering marketplaces AND ads AND suspicious domains.

**Success test:**
```python
evidence = gather_evidence("Nike", ["amazon", "google_ads", "meta_ads", "domains"])
# Output: Evidence JSON with:
#   marketplaces: Amazon listings (from Week 1)
#   ads: Google + Meta ads using brand keyword
#   domains: Suspicious typosquatting domains from WHOIS
```

---

## Context

Week 1 delivered the Amazon scraper (Tier 1) and the `WhoisAPI` stub. Week 2 completes both the WHOIS implementation (already partially built) and adds the two official Ads API integrations (Tier 2). These are free APIs — no Firecrawl credits are used for any of these sources.

Engineer B is now connecting to the real Gemini decision agent this week, which means the `Evidence` object returned by your function will be passed to a live AI model. The richer and more structured your evidence, the better the AI decisions will be. **Do not change the `Evidence` Pydantic model structure** — only add data into the existing fields (`ads`, `domains`).

---

## Step-by-Step Implementation

### Step 1 — Complete WHOIS Domain Surveillance

The `WhoisAPI` class was stubbed in Week 1. Complete it with real lookups and expand the typosquatting variant generator.

Update `apps/api/src/tracemark_api/services/marketplace.py`:

```python
import whois
from itertools import product as iterproduct

class WhoisAPI:
    """
    Tier 2 — Free WHOIS lookups for typosquatting detection.
    Generates brand name variations and checks which are registered.
    """

    TLDS = [".shop", ".store", ".net", ".org", ".co", ".info", ".biz", ".online"]

    def check_similar_domains(self, brand_name: str) -> list[dict]:
        """
        Generates typosquatting variations of brand_name and performs WHOIS lookup.
        Returns list of registered suspicious domains.
        Skips unregistered domains silently.
        """
        variations = self._generate_variations(brand_name)
        results = []
        for domain in variations:
            try:
                w = whois.whois(domain)
                # Only report if the domain is actually registered
                if w and w.domain_name:
                    results.append({
                        "domain": domain,
                        "registrant": w.registrar or "unknown",
                        "created_date": str(w.creation_date) if w.creation_date else "unknown",
                        "expiry_date": str(w.expiration_date) if w.expiration_date else "unknown",
                        "status": "active",
                        "name_servers": w.name_servers or [],
                    })
            except Exception:
                # Domain not found or WHOIS lookup failed — not suspicious
                pass
        return results

    def _generate_variations(self, brand_name: str) -> list[str]:
        """
        Generates common typosquatting and brand-impersonation domain patterns.
        Covers: official/store/buy prefixes, misspellings, hyphenated versions.
        """
        name = brand_name.lower().replace(" ", "")
        prefixes = ["", "official-", "buy-", "get-", "real-", "authentic-", "shop-"]
        suffixes = ["", "-official", "-store", "-sale", "-outlet", "-shop", "-online"]
        # Build prefix+name+suffix combos (limit to avoid too many WHOIS calls)
        combos = set()
        for pre, suf in iterproduct(prefixes[:4], suffixes[:4]):
            combos.add(f"{pre}{name}{suf}")
        # Add direct variations
        combos.update([name, f"{name}store", f"{name}shop", f"fake{name}", f"{name}replica"])
        return [f"{combo}{tld}" for combo in list(combos)[:20] for tld in self.TLDS[:4]]
```

> **Rate limiting:** `python-whois` makes real DNS/WHOIS queries. Add `time.sleep(0.5)` between lookups if you hit rate limit errors.

---

### Step 2 — Google Ads Transparency API

Implement `GoogleAdsAPI` using the **Google Ads Transparency Center API** (free, no billing required).

```python
import requests

class GoogleAdsAPI:
    """
    Tier 2 — Google Ads Transparency Center API.
    Finds ads running for a brand keyword across Google Search + Display.
    Cost: $0 (official API, no auth required for basic queries).
    """

    BASE_URL = "https://adstransparency.google.com/api/public/ads"

    def search(self, brand_keyword: str, region: str = "US") -> list[dict]:
        """
        Searches the Google Ads Transparency database for ads mentioning brand_keyword.
        Args:
            brand_keyword: The brand name to monitor
            region: ISO country code (default US)
        Returns:
            List of ad records: advertiser, ad_text, destination_url, impressions, detected_date
        """
        try:
            params = {
                "query": brand_keyword,
                "region": region,
                "format": "json",
            }
            resp = requests.get(self.BASE_URL, params=params, timeout=10)
            if resp.status_code != 200:
                print(f"[GoogleAdsAPI] Non-200 response: {resp.status_code}")
                return []
            data = resp.json()
            return self._parse_ads(data, brand_keyword)
        except Exception as e:
            print(f"[GoogleAdsAPI] Error: {e}")
            return []

    def _parse_ads(self, data: dict, brand_keyword: str) -> list[dict]:
        """
        Parse raw API response into standardized ad record format.
        Filter to only ads where the advertiser is NOT the brand itself
        (i.e., third-party advertisers using the brand keyword).
        """
        ads = []
        for item in data.get("ads", []):
            advertiser = item.get("advertiser_name", "")
            # Skip if advertiser name contains the brand (likely legitimate)
            if brand_keyword.lower() in advertiser.lower():
                continue
            ads.append({
                "source": "google_ads",
                "advertiser": advertiser,
                "ad_text": item.get("ad_text", ""),
                "destination_url": item.get("destination_url", ""),
                "impressions": item.get("impressions_range", "unknown"),
                "detected_date": item.get("first_shown_date", ""),
            })
        return ads
```

> **Note:** If the Transparency Center API requires OAuth in production, fall back to scraping `https://adstransparency.google.com` using BeautifulSoup (Tier 1). Do not use Firecrawl for this.

---

### Step 3 — Meta Ads Library API

Implement `MetaAdsAPI` using the official **Meta Ad Library API** (free with a Meta developer account).

```python
class MetaAdsAPI:
    """
    Tier 2 — Meta Ad Library API.
    Finds ads running on Facebook and Instagram using brand keywords.
    Requires META_ADS_ACCESS_TOKEN env var (free Meta developer account).
    Cost: $0.
    """

    BASE_URL = "https://graph.facebook.com/v19.0/ads_archive"

    def search(self, brand_keyword: str, country: str = "US") -> list[dict]:
        """
        Queries the Meta Ad Library for ads mentioning brand_keyword.
        Returns ads from unrelated advertisers (potential impersonators).
        """
        import os
        access_token = os.environ.get("META_ADS_ACCESS_TOKEN")
        if not access_token:
            print("[MetaAdsAPI] META_ADS_ACCESS_TOKEN not set — skipping")
            return []
        try:
            params = {
                "access_token": access_token,
                "search_terms": brand_keyword,
                "ad_reached_countries": [country],
                "ad_type": "ALL",
                "fields": "id,ad_creative_body,page_name,ad_snapshot_url,impressions,spend",
                "limit": 50,
            }
            resp = requests.get(self.BASE_URL, params=params, timeout=15)
            if resp.status_code != 200:
                print(f"[MetaAdsAPI] Error {resp.status_code}: {resp.text[:200]}")
                return []
            data = resp.json()
            return self._parse_ads(data.get("data", []), brand_keyword)
        except Exception as e:
            print(f"[MetaAdsAPI] Exception: {e}")
            return []

    def _parse_ads(self, items: list, brand_keyword: str) -> list[dict]:
        ads = []
        for item in items:
            page_name = item.get("page_name", "")
            if brand_keyword.lower() in page_name.lower():
                continue  # Skip legitimate brand pages
            ads.append({
                "source": "meta_ads",
                "advertiser": page_name,
                "ad_text": item.get("ad_creative_body", ""),
                "destination_url": item.get("ad_snapshot_url", ""),
                "impressions": item.get("impressions", {}).get("lower_bound", "unknown"),
                "detected_date": "",
            })
        return ads
```

---

### Step 4 — Update `gather_evidence` Signature

Update the main `gather_evidence` function in `marketplace.py` to route `google_ads`, `meta_ads`, and `domains` platforms:

```python
def gather_evidence(brand_name: str, platforms: list[str]) -> Evidence:
    """
    3-tier scraping pipeline. Now supports:
      Tier 1: amazon, ebay, alibaba (requests + BeautifulSoup)
      Tier 2: google_ads, meta_ads, domains (official APIs)
      Tier 3: aliexpress (Firecrawl fallback)
    """
    import os
    if not os.environ.get("FIRECRAWL_API_KEY") and not os.environ.get("GEMINI_API_KEY"):
        return _mock_evidence(brand_name)

    scraper = MarketplaceScraper()
    raw = scraper.scrape_all_sources(brand_name, platforms)

    all_marketplace_evidence = []
    for platform, content in raw["marketplaces"].items():
        content_str = str(content) if isinstance(content, list) else (content or "")
        listings = extract_marketplace_evidence(brand_name, platform, content_str)
        all_marketplace_evidence.extend(listings)

    return Evidence(
        marketplaces=all_marketplace_evidence,
        ads=raw["ads"].get("google", []) + raw["ads"].get("meta", []),
        domains=raw["domains"],
        social=[],
        timestamp=datetime.now(),
    )
```

Also update `scrape_all_sources` to accept a `platforms` filter so it only calls the scrapers that are requested, avoiding unnecessary API calls.

---

### Step 5 — Update FastAPI Endpoint

Update `monitoring.py` to reflect the new supported platforms:

```python
class GatherEvidenceRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon", "google_ads", "domains"]
    # Supported: amazon, ebay, alibaba, aliexpress, google_ads, meta_ads, domains
```

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/services/marketplace.py` | **Update** — complete WhoisAPI, implement GoogleAdsAPI + MetaAdsAPI |
| `apps/api/src/tracemark_api/routes/monitoring.py` | **Update** — expand supported platforms list |
| `.env.example` | **Update** — add `META_ADS_ACCESS_TOKEN` |

---

## New Environment Variables

```env
META_ADS_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxx   # From Meta for Developers (free)
# GOOGLE_ADS_API_KEY not required for Transparency API basic queries
```

---

## Acceptance Criteria

- [ ] `gather_evidence("Nike", ["amazon", "google_ads", "domains"])` returns enriched `Evidence` with all three sections populated
- [ ] WHOIS check returns at least mock-style domain records (real results when DNS resolves)
- [ ] `GoogleAdsAPI.search()` returns a list (may be empty if no ads found — that is valid)
- [ ] `MetaAdsAPI.search()` skips gracefully when `META_ADS_ACCESS_TOKEN` is not set
- [ ] No Firecrawl credits are used for `google_ads`, `meta_ads`, or `domains` platforms
- [ ] `POST /api/v1/monitoring/gather-evidence` accepts the expanded platform list and returns 200
- [ ] Engineer B can pass the returned `Evidence` directly into `make_decision()` without transformation
