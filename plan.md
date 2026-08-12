# HAKKIU — Active Plan

> **Session 65 (2026-08-11) — eBay scraper: Browse API integration (credentials now in hand).**
> Supersedes the Session 64 plan below. Investigation re-verified against the current
> code AFTER the "repairing scrappers" PRs (#106–108). 3 investigation agents + 3
> critical-question agents.

## Answering the two questions this session opened with

**1. Is the eBay API still needed, now that PRs #106–108 added a Firecrawl "stealth" proxy?**
**YES — the eBay Browse API stays the primary data path.** The stealth proxy is
*complementary, not a substitute*:
- The stealth retry (`proxy="stealth"`) lives ONLY on the Firecrawl/JS path
  (`unified_scraper.py` `_scrape_js`). eBay is in `STATIC_DOMAINS`, so **eBay never
  reaches that code today** — the recent proxy work does nothing for eBay as wired.
- Even if we routed eBay through Firecrawl, each stealth call burns ~10 Firecrawl
  credits (budget is small), the HTML/`.s-item` selectors rot, and scraping past
  Akamai is a ToS-gray area — a bad look for a *trademark-enforcement* product.
- The Browse API is free (~5,000 calls/day), returns clean structured JSON
  (title, price+currency, seller, `itemWebUrl`, `itemId`, image URLs), is
  ToS-sanctioned, and covers regions with one header switch.
- The **one** thing the API does NOT give is a rendered screenshot of the listing
  page — that is exactly where the new stealth-Firecrawl path plugs in, but **only
  for confirmed infringements** (see Workflow step 5).

**2. What is the workflow?** → see "Target eBay workflow (end-to-end)" below.

**Credential status (RESOLVED — was the Session 64 blocker):** user has a
**Production Browse API keyset — Client ID + Client Secret** (OAuth2
client-credentials). This unblocks P1. Add as `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`
to the shared root `.env`.

## What changed since Session 64 (re-verified in code)

- **Finding API is dead** — `EbayScraper._search_via_api()` still targets
  `svcs.ebay.com/.../FindingService` (retired 2025). The user's new keyset is for the
  **Browse API**, not Finding — so the existing API path must be *rewritten*, not just
  fed an env var. (`EBAY_APP_ID` ≠ `EBAY_CLIENT_ID`.)
- **P0 silent-failure bug is STILL present** (verified post-#106–108). eBay is in
  `STATIC_DOMAINS` (`unified_scraper.py:82`) → static path only. On a 403,
  `_scrape_static()` returns `success=False`, but `EbayScraper.search()`
  (`marketplace.py:437-451`) just `break`s → returns `[]`, and `scraper_health.probe()`
  (`scraper_health.py:87-105`) treats "did not raise" as `success=True`. **A live block
  is logged as a healthy 0-result scan.** No `ScraperBlockedError` exists anywhere.
- **This bug is shared by ALL static scrapers** — Amazon, Etsy, Alibaba, Google
  Shopping have the identical `if not result.success: break/return []` pattern. Fix
  must be a shared convention, not an eBay one-off.
- **Screenshot cost bug exposed by the switch** — `marketplace.py:2086-2087`
  screenshots EVERY parsed listing *before* the detection funnel runs. With the 6h
  scheduler this is a large, wasteful Firecrawl spend. Takedown reports themselves
  store no screenshot (`takedown.py`); the screenshot lives on the `infringements`
  row (`screenshot_url`).

## Fix strategy (prioritized)

- **P0 — Stop lying about blocks.** A 403/anti-bot block on a LIVE scan must surface
  as a `blocked` health event and mark the platform "unavailable", never a clean
  "0 results". Introduce a typed `ScraperBlockedError`.
- **P1 — Real data via eBay Browse API.** Replace the dead Finding API with
  `GET /buy/browse/v1/item_summary/search` + OAuth2 client-credentials token (cached
  in-process ~2h). This is the reliable, ToS-compliant primary path.
- **P2 — Evidence, cost-aware.** Screenshot `itemWebUrl` **only for confirmed
  infringements** (Playwright-first → Firecrawl-stealth fallback), not every listing.
  Feed the free API thumbnail into Tier-1 visual scoring so deferring the full-page
  screenshot doesn't blind logo/pHash matching.
- **P3 — Quota & scheduler safety.** Cap regions per brand (default `["US"]`, opt-in
  extra), cache Browse results in `scrape_cache` (TTL ≥ 6h), budget-guard against the
  5,000/day ceiling, and dedup by `itemId` so the 6h scheduler doesn't re-screenshot /
  re-file duplicate takedowns.

## Target eBay workflow (end-to-end)

```
1. Scan trigger (scheduler every 6h, or manual /monitoring/check-brand)
2. OAuth: mint App token (client_credentials, scope api_scope) — CACHE ~2h, refresh on 401
3. Browse search: GET item_summary/search?q={brand}&limit=50 per region
   header X-EBAY-C-MARKETPLACE-ID: EBAY_US | EBAY_GB | EBAY_DE ...  (2 calls/brand/region)
   cache in scrape_cache (TTL >= 6h)
4. Parse itemSummaries[] -> {title, price+currency, seller, url=itemWebUrl, itemId, image}
   (identical schema to current scraper output — nothing downstream changes)
5. Detection funnel (unchanged): Tier-0 keyword/brand match -> Tier-1 visual
   (uses the FREE API thumbnail for pHash) -> AI decision -> verdict
6. EVIDENCE — confirmed infringements ONLY: screenshot itemWebUrl
   Playwright-first (free) -> Firecrawl-stealth fallback (10 cr); dedup by itemId;
   store screenshot_url + capture timestamp + itemId on the infringement row
7. Takedown report cites itemWebUrl + references the archived screenshot
8. Health: block at any step -> ScraperBlockedError -> health row 'blocked',
   blocked_apis += 'ebay'  (customer sees "couldn't check eBay", not "0 found")
```

## Multi-agent execution plan (parallel where independent)

Wave 1 (independent — run concurrently):
- **Agent A — Browse API client.** Rewrite `EbayScraper._search_via_api()` →
  `_search_via_browse_api()` in `marketplace.py`: module-level OAuth token cache with
  expiry; `GET /buy/browse/v1/item_summary/search`; `X-EBAY-C-MARKETPLACE-ID` per
  country; map `itemSummaries[]`; preserve `$`→multi-currency (`price.value`+
  `price.currency`, fixes the audit's USD-only bug). Return `None` (→ fallback) only
  when credentials are absent. Read `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`.
- **Agent B — Kill the silent failure (shared).** Add `ScraperBlockedError`
  (`scraper_errors.py`). Add a `blocked` flag to `UnifiedScrapeResult` set in
  `_scrape_static` on 403/429/antibot. Raise it from every static scraper
  (eBay/Amazon/Etsy/Alibaba/Google Shopping) instead of `break`/`return []`. Teach
  `scraper_health.classify_error` → `"blocked"`, and `batch_detect` to append to
  `blocked_apis`.
- **Agent C — Evidence gating + cost.** Move the `_screenshot_listing` call out of
  `gather_evidence` (2086-2087) to run only on confirmed infringements; wire eBay
  `itemWebUrl` screenshots through Playwright-first → Firecrawl-stealth; dedup by
  `itemId`. Feed API thumbnail into Tier-1.

Wave 2 (depends on Wave 1 shape):
- **Agent D — Admin parity + tests + quota.** Scraper Health surfaces new `blocked`
  live events; region-cap + `scrape_cache` TTL + daily budget guard on Browse calls;
  tests: mock 403 → asserts `ScraperBlockedError` + `blocked` row; mock Browse 200 →
  asserts parsed listings + multi-currency. Admin-api/UI parity per CLAUDE.md.

Wave 3:
- **Verification.** Real Production Browse call locally (token → search → parsed
  listings); forced 403 → `blocked` (not 0-results); confirm a confirmed infringement
  gets exactly one screenshot; confirm scheduler dedups by `itemId`.

## Open questions still worth confirming (non-blocking)

- **Regions to cover** (US only, or +GB/DE/…)? Drives quota (daily calls ≈ 8 × brands
  × regions; breaks ~625 brand·regions/day). Default to `["US"]`, opt-in extra.
- **Takedown evidence**: should the notice *embed/attach* the archived screenshot +
  timestamp (schema change), or just cite the URL? Today it only cites the URL.
- **Browse keyset scope**: confirm the Production keyset can actually call
  `item_summary/search` (mint a token + one live search) before building on it.

## Decisions (locked)
- **DATA PATH = eBay Browse API** (OAuth2 client-credentials, Production). Stealth
  Firecrawl is the *evidence-screenshot fallback for confirmed hits only*, not a data
  source. Credentials in hand → P1 unblocked.

## Status — Session 66 (2026-08-12): P1 SHIPPED + P0 (eBay slice) SHIPPED, live-verified
**Done (Wave 1 — Agent A + Agent B, eBay slice):**
- `EbayScraper` now uses the Browse API: module-level OAuth2 token cache (2h TTL, 60s
  early refresh, 401 → re-mint-once-then-retry), `GET item_summary/search`,
  `X-EBAY-C-MARKETPLACE-ID` per region (`EBAY_MARKETPLACE_IDS` in `geo.py`),
  multi-currency `_format_ebay_price` (£/€/$/…), `item_id` per listing. Dead Finding
  API removed. `None`→HTML fallback only when creds absent.
- P0 honesty: new `scraper_errors.ScraperBlockedError`; `classify_error`→`"blocked"`;
  raised from eBay on 401-after-refresh/403/429/other-non-200 (+ HTML page-1 failure);
  caught in `scan_all` + `batch_detect` → `blocked_apis`. `ebay_api` (5000/day)
  registered in `API_REGISTRY`. **A live block is no longer a silent "0 results".**
- Verified: 7 unit tests green + independent reviewer agent (no blockers) + LIVE call
  on the Production keyset (Nike US → 50 `$` listings; Adidas GB → 50 `£` listings).
- Admin parity via existing surfaces: `ebay_api` in the API-usage dashboard, eBay
  `blocked` events in Scraper Health (`scraper_health_log`).

**Still open (deferred, tracked in `todo.md`):**
- P0 broaden: raise `ScraperBlockedError` from Amazon/Etsy/Alibaba/Google Shopping too
  (they still `break`/`[]` on a block); add a `blocked` flag to `UnifiedScrapeResult`.
- P2 evidence/cost: gate `_screenshot_listing` to confirmed infringements; dedup by
  `itemId`; feed API thumbnail into Tier-1.
- P3 quota/scheduler: region-cap (default `["US"]`), cache Browse in `scrape_cache`
  (TTL≥6h), dedup by `itemId`.
