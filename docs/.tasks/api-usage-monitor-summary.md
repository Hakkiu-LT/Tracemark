# API Usage Monitor & Rate-Limit Wrapper — Summary

This document describes the design and changes introduced by the **API Usage Monitor & Rate-Limit Wrapper** feature. The goal was to establish a centralized system to track API limits and wrap outgoing third-party calls to prevent budget exhaustion and CAPTCHA blockages.

**Affected files:**

| File | Change Type |
|---|---|
| `apps/api/src/tracemark_api/services/api_usage_tracker.py` | **NEW** |
| `apps/api/src/tracemark_api/routes/usage.py` | **NEW** |
| `apps/api/src/tracemark_api/services/marketplace.py` | Modified |
| `apps/api/src/tracemark_api/main.py` | Modified |
| `src/routes/api-usage.tsx` | **NEW** |
| `src/lib/types/api-usage.ts` | **NEW** |
| `src/components/app-sidebar.tsx` | Modified |
| `apps/api/tests/test_api_usage_tracker.py` | **NEW** |
| `apps/api/tests/test_meta_token.py` | **NEW** |
| `apps/api/tests/test_meta_refresh.py` | **NEW** |

---

## What Changed and Why

### Backend: Centralized API Usage Tracker (`api_usage_tracker.py`)

A pure-Python registry and monitoring service was added to track all external API endpoints in an in-memory storage (with hooks prepared for persistent PostgreSQL or Redis backends).

#### 1. API Registry & Category Configuration
Outlines all registered APIs, category definitions, free daily/monthly caps, and required environment variables:
* **`google_serp`**: Google Search Organic scraper (100 daily limit).
* **`whois`**: WHOIS queries via `python-whois` (500 daily limit).
* **`google_ads`**: Google Ads Transparency (100 daily limit).
* **`meta_ads`**: Meta Ad Library Graph API (200 daily limit, requires `META_ADS_ACCESS_TOKEN`).
* **`firecrawl`**: Firecrawl JS scraper (400 monthly credit limit, requires `FIRECRAWL_API_KEY`).
* **`gemini_flash`**: Gemini 2.5 Flash API calls (1,500 daily limit, requires `GEMINI_API_KEY`).
* **`gemini_pro`**: Gemini 2.5 Pro API calls (50 daily limit, requires `GEMINI_API_KEY`).
* **`html_scraper`**: Free local static HTTP scrapers (999,999 daily limit).

#### 2. Tracking Wrappers
Exposes two core tracking wrappers to measure execution latency, track success/fail rates, deduct custom token counts, and throw safety checks:
* **`call_with_tracking`**: Sync wrapper.
* **`async_call_with_tracking`**: Async wrapper.

If a service reaches 100% capacity, further calls throw an `ApiLimitError` immediately to shield the IP/credentials from being blacklisted.

#### 3. API Statistics endpoint
Exposes `GET /api/v1/usage-stats` (configured in [usage.py](file:///c:/Users/gaboS/Desktop/Tracemark/apps/api/src/tracemark_api/routes/usage.py)), providing:
* Real-time summaries per API.
* Statistics grouped by active developer/user emails (`caller_id`).
* UTC hourly call frequencies over the last 24 hours.

---

## Frontend: Surveillance Dashboard (`api-usage.tsx`)

Created a dedicated, responsive dashboard under the `/api-usage` route, accessible by both `brand_owner` and `law_firm` personas.

### Key Layout Sections:

1. **Destructive Alert Banner**: Spawns warning notices if any external API limits are exhausted, listing the blocked service names.
2. **Surveillance Status Grid**: Lists all active trackers with progress bars that dynamically transition from green to amber (>50%) to red (>80%) depending on usage percentages. Includes tooltips warning if required API environment variables are missing.
3. **Usage by Developer (Table)**: Provides an organic matrix grouping today's call frequency totals dynamically per developer email.
4. **24h System Activity (Chart)**: Uses `recharts` to render a bar graph showing system-wide API query distribution hourly over the trailing 24 hours.

---

## Flow Diagram

```
FastAPI Router / Endpoint
         │
         ▼
Orchestration layer (e.g., gather_evidence)
         │
         ▼
call_with_tracking(api_key, caller_id, ...)
         │
  ┌──────┴────────────────────────────┐
  ▼                                   ▼
[tracker.is_blocked() == True]   [tracker.is_blocked() == False]
  │                                   │
  ▼ (Abort & Shield)                  ▼ (Execute API Function)
Raise ApiLimitError             Record Start Time -> fn()
                                      │
                                      ▼
                                Record Latency, Success/Fail, Credits
                                      │
                                      ▼
                                return result (or re-throw exceptions)
```
