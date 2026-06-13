# Domain Discovery Pipeline & Whitelist Filtering — Phase 2 Changes

This document describes the changes introduced in the **Domain Discovery & Whitelist Filtering** pipeline refactoring. The goal was to establish a structured, cost-efficient 4-step workflow to identify brand infringements from organic search results while skipping whitelisted and legitimate popular domains.

**Affected files:**

| File | Change Type | Description |
|---|---|---|
| `apps/api/src/tracemark_api/services/domain_whitelist.py` | **NEW** | Handles download, caching, and matching against the Tranco Top 100K list. |
| `apps/api/src/tracemark_api/services/firecrawl_client.py` | **NEW** | Renamed `scraper.py` to clarify it is the direct Firecrawl client. |
| `apps/api/src/tracemark_api/services/marketplace.py` | Modified | Links `GoogleSERPAPI` to check organic search domains against `domain_whitelist.py`. |
| `apps/api/src/tracemark_api/services/unified_scraper.py` | Modified | Updates imports of `scrape_page` and `ScrapeResult` from `firecrawl_client.py`. |
| `apps/api/src/tracemark_api/routes/monitoring.py` | Modified | Updates imports of `scrape_page` to use the new `firecrawl_client` path. |
| `apps/api/tests/test_domain_whitelist.py` | **NEW** | Verifies base registered domain parsing, caching, and whitelist checking. |
| `src/lib/store.ts` | Modified | Automatically sets mock brands (`Derila`, `Matsato`) to `"on_hold"` on load. |

---

## 4-Step Pipeline Architecture

The domain discovery workflow is split into four distinct filtering steps to minimize API charges (such as paid WHOIS and Firecrawl credits) and prevent rate limits:

```
[Step 1: Bulk Fetch from Google]
GoogleSERPAPI search queries brand keywords and extracts all search result domains (local requests, $0 cost).
         │
         ▼
[Step 2: Local Domain Whitelist]
Check extracted domains against the Tranco Top 100K list (via DomainWhitelist, $0 cost).
Skip matches to highly legitimate domains (e.g. wikipedia.org, amazon.com, etc.).
         │
         ▼
[Step 3: Fast-Filter with WHOIS]
Run WHOIS queries on the remaining suspicious domains (limit to first 5, cheap).
Check creation date, registrar details, and status.
         │
         ▼
[Step 4: Scraping & AI Analysis]
Send high-risk, non-whitelisted domains for deep scraping (UnifiedScraper)
and structured AI risk classification (Gemini).
```

---

## Implementation Details

### 1. Tranco Whitelist Integration (`domain_whitelist.py`)
* **Dynamic Downloads**: Downloads the zipped `top-1m.csv` from Tranco at startup if the local cache file is older than 7 days.
* **Efficient Storage**: Extracts and writes the top 100,000 domains to a local text file `tranco_top_100k.txt`.
* **Fallback Mode**: Includes a hardcoded dictionary of top domains (Google, Meta, Apple, etc.) to ensure the application still filters correctly in offline/air-gapped development environments.
* **Registered Base Domain Extraction**: Parses subdomains correctly using a two-character country code TLD check (e.g. `sub.adidas.com` -> `adidas.com`, `foo.bar.co.uk` -> `bar.co.uk`).

### 2. Google Organic Filtering (`marketplace.py`)
* In `GoogleSERPAPI.search()`, all domains extracted from Google search results are mapped.
* If a domain matches the brand's own official variations (`{brand}.com`, `{brand}.net`, `{brand}.org`), it is ignored.
* If a domain is whitelisted by `whitelist_service.is_whitelisted()`, it is skipped.
* Only completely unknown domains are returned for subsequent WHOIS query lookups.

### 3. File Renaming & Cleanup
* The old `scraper.py` was renamed to `firecrawl_client.py` to prevent naming collision with the main router `unified_scraper.py`.
* All importing files in routes, services, and tests were refactored to point to the new import path.

### 4. Default Pause Status for Mock Brands (`store.ts`)
* Updated the `onRehydrateStorage` hook of the Zustand store.
* Ensures that whenever the application starts, mock brands `Derila` and `Matsato` are set to `"on_hold"`. This blocks developers from accidentally triggering background scraping calls during testing.
