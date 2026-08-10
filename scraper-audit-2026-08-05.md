# Scraper & Detection Audit — 2026-08-05

Deep audit of the entire scraping + detection stack by 4 parallel specialist agents,
then key findings independently verified. Investigation only — no code changed.

Files audited: `unified_scraper.py`, `firecrawl_client.py`, `playwright_client.py`,
`ssrf.py`, `domain_whitelist.py`, `marketplace.py` (2321 lines), `detection_funnel.py`,
`detection.py`, `decision.py`, `evidence_scorer.py`, `ai.py`, `embedding_helper.py`,
`scrape_cache.py`, `scraper_health.py`, `resource_monitor.py`, `rate_limit.py`,
`api_usage_tracker.py`, `routes/monitoring.py`, `routes/infringements.py`.

---

## THE HEADLINE: three defects that make the product silently not work

The product's core promise is "continuous monitoring that reliably finds infringements."
Three independently-verified defects break that promise, and all three fail **silently**
(they produce "0 infringements found", never an error):

1. **No scan scheduler exists** (`main.py:155-220`). Scanning is 100% on-demand — it only
   happens when a user hits `POST /monitoring/check-brand`. There is no cron, no timer, no
   background job. A `brands.last_scan_at` column exists but nothing reads it for scheduling.
   → A "monitoring" product that never re-monitors. A copycat that appears tomorrow is never
   found until a human manually re-runs the scan. **VERIFIED.**

2. **`gemini-3.5-flash` is not a real model** (`ai.py:216,262,415,551`, `detection.py:188`).
   Google has no 3.5-flash (2.5 → 3.0, no 3.5). Every Tier-2 LLM call 404s → the except path
   fails **closed to DISMISS** (`ai.py:432-443`). If this ID is live in prod with a key set,
   the entire AI adjudication tier silently dismisses everything. **VERIFIED — needs urgent
   check of prod API logs.**

3. **A blocked/broken scraper reports "0 infringements", not an error, and nothing alerts.**
   `unified_scraper.py:486` returns `success=False, markdown=""` on CAPTCHA/403/429; every
   marketplace scraper turns that into `[]` (false negative). `scraper_health.py` records
   `success=True` when a scrape returns an *empty* list (`:90`) and treats a soft-block 200
   "enter CAPTCHA" page as healthy (`:142-151`). There is no alerting anywhere. So a scraper
   that quietly breaks (selector rot or IP ban) shows green forever. **VERIFIED.**

---

## CRITICAL (silently produces false negatives / broken core function)

- **No scheduler** — see headline #1. (`main.py:155-220`, `monitoring.py:217`)
- **Bot-block swallowed as empty results** — see headline #3. Never surfaced to `blocked_apis`
  or the customer. (`unified_scraper.py:486`, all scrapers in `marketplace.py`)
- **`gemini-3.5-flash` invalid → LLM tier fails closed to DISMISS** — see headline #2.
- **Marketplace/social/ad matching ignores the listing title.** `_score_marketplace` matches
  only `seller_name + listing_url` (`detection_funnel.py:225`); `MarketplaceEvidence` has no
  title field at all (`ai.py:38-45`). "Genuine Nike Air Max" by seller "shoe_store_88" scores
  ~0 on the brand. The single most important counterfeit signal (the title) is never read.
- **Tier 1 (embedding + logo pHash) silently no-ops** whenever the brand has no uploaded
  reference assets (`detection_funnel.py:596-629`) — i.e. for most self-serve customers the
  entire visual/semantic layer is off, with no telemetry saying so.
- **`except Exception: return None` per-card in all 4 HTML extractors** (`marketplace.py:351,
  484,649,950`) silently drops listings with zero logging — a counterfeit can vanish.
- **`_mock_evidence` fabricates infringements** when API keys are missing
  (`marketplace.py:2058-2059,2214`) — a misconfigured prod would ship fake data as real.
- **Firecrawl "success" not content-validated.** A rate-limit *placeholder* body comes back
  with `success=True` (documented in `test_firecrawl_scrape.py:81-89`); `_scrape_js` accepts
  it (`unified_scraper.py:573`) and caches it 24h — page never re-examined.
- **SSRF guard NOT applied on the Firecrawl path** (`_scrape_js` never calls
  `validate_ssrf_url`, contrast `_scrape_static:468`). Playwright validates once then
  `page.goto` follows redirects with fresh DNS (TOCTOU + no per-hop revalidation).
- **No eval / ground-truth dataset.** Every threshold is a hardcoded magic number
  (`detection_funnel.py:49-55,510-511`; `detection.py:33,72`). Nobody can state the
  false-negative rate. Tests only assert on hand-picked "Derila"/"Nike" cases.

## HIGH

- **No homoglyph / Unicode / leet handling** — `N1KE`, Cyrillic `Nіke`, full-width `Ｎｉｋｅ`
  all fall to ~0.75/0.0 and are missed (`detection.py:30-65,205`). Core counterfeit evasion.
- **`partial_ratio` substring false positives** on short brands: `Nike`~"bike"=0.75,
  `Vans`~"advanced"=0.75 (`detection.py:58`). No word-boundary / min-length guard.
- **Ambiguous items persisted as MEDIUM infringements** with no per-item LLM ruling —
  there is NO per-item Tier-2 stage; `make_decision` emits one case-level verdict only
  (`detection_funnel.py:505`, `monitoring.py:323`). The "unsure" bucket becomes customer cases.
- **Prompt-injection from scraped seller text/screenshots** into the decision LLM — raw
  `model_dump()` of seller/ad/domain fields (`ai.py:393-399`) + attacker-controlled screenshot
  images to Gemini Vision (`ai.py:527-548`). A listing can say "return risk_level=LOW".
- **No retries anywhere** in the fetch layer (`unified_scraper.py:479,551`,
  `firecrawl_client.py:76`). One transient blip = permanent miss until next scan.
- **Failed Firecrawl scrape negative-cached 24h** (`unified_scraper.py:561`) — a page that
  errored once is invisible for a day.
- **API cost/usage limits are GLOBAL, not per-tenant** (`api_usage_tracker.py:86,197-205`).
  Firecrawl 400/mo and Gemini 20/day are shared across ALL orgs; one heavy org starves
  everyone. Counters are in-memory per-process (`:347`) → unreliable across workers/restart.
- **Scan runs inline in the HTTP request** (`monitoring.py:219-354`) — no BackgroundTasks,
  no queue, no `wait_for` timeout. Up to 20 platforms × N regions hold the connection open.
- **USD-only price parsing** + hardcoded `$` on eBay API (`marketplace.py:403,1897`) — €/£/¥
  prices lost or mislabeled.
- **Page-1-only coverage** for all Firecrawl platforms; `max_pages=2-3` cap elsewhere —
  coverage silently capped, reads as "clean" (`marketplace.py:737,852,875,302,423`).
- **No proxy / UA rotation / rate-limit / session** on static requests — predictable blocking
  (`unified_scraper.py:42`, `marketplace.py:255`).

## MEDIUM

- Stale 24h scrape cache can hide new infringements on the monitored page itself
  (`scrape_cache.py:37-42`); `content_hash` change-detection column exists but is never
  populated (`:141-155`).
- Evidence score measures *quantity* not *match quality* (`evidence_scorer.py:101-104`);
  disconnected from the per-item tier scores; the LLM anchors on this count-based number.
- Non-determinism: live SSL/HTTP checks + `gemini-2.5-pro`→flash fallback mean the same
  listing can get a different verdict on re-scan (`detection_funnel.py:113`, `ai.py:258-269`).
- Resource monitor only *observes* — no threshold, back-pressure, or kill-switch; nothing
  prevents an OOM from concurrent inline scans (`resource_monitor.py:58-71`).
- `contains_antibot` is a substring match on generic tokens ("captcha","access denied") →
  false-flags legitimate pages and (for static domains) escalates them to paid Firecrawl.
- pHash logo matching is coarse (`max_distance=10`) and the extractor only regex-scans `<img>`
  for the literal "logo", missing CSS-bg / SVG / JS logos → falls back to hashing the whole
  screenshot (`embedding_helper.py:347-443,678`).
- `obvious_copycat` auto-flag from a single deterministic signal catches legit resellers/ads
  (`detection_funnel.py:140-171`).
- Rate limiter keys on the rotating bearer token (weak per-user limit) and has no global
  outbound ceiling to protect target sites (`rate_limit.py:9-14`).
- Playwright leaks the browser on exception — `browser.close()` only on happy path, no
  try/finally (`playwright_client.py:23-39`) → zombie Chromium on the (frequent) failures.

## COVERAGE GAPS (platforms a TM tool should cover but doesn't)

- **Temu** (arguably #1 counterfeit surface today) and **Shein** — absent.
- **Walmart, DHgate, Made-in-China, TradeKey, Taobao/Tmall, JD, Rakuten** — listed in
  `DomainRegistry` but have **NO scraper class** (dead routing entries).
- **TikTok Shop** — the TikTok scraper hits video `/search`, not the Shop product surface.
- FB Marketplace / TikTok / Instagram are markdown-only with no structured extraction (thin).
- Missing: Mercado Libre, Wish, Poshmark, Depop, Vinted, Lazada, Shopee, Allegro, Newegg.

## CODE QUALITY

- `scrape_all_sources` (`marketplace.py:1489`) and `batch_detect` (`:1625`) are two near-
  identical 130-line routing implementations → guaranteed drift.
- The `wrap_*` closure is copy-pasted 11× in `batch_detect`; MD5 API-signer duplicated in
  Alibaba + AliExpress; `build_search_urls` and `_build_domain_evidence` are dead in prod
  (only tests use them).
- Whole fetch layer logs via `print`, not `logging` → failures can't be aggregated/alerted.
- Tests mock `UnifiedScraper.scrape` and hardcode the *same* brittle selectors, so a green
  suite cannot detect real-world selector rot or live bot-blocks. No 403/429/CAPTCHA tests.

## POSITIVE FINDINGS (things done right)

- Endpoint tenant isolation is solid: org-scoped joins, 404-not-403 on mismatch, batch
  screenshot-sign authorizes each path (`infringements.py:77-98,138-143,213-317`).
- `ssrf.py` itself is well-designed (DNS-rebind guard, per-redirect revalidation in
  `safe_get`) — the problem is it isn't applied on the Firecrawl/Playwright paths.
- Tier-2 decision is exactly 1 LLM call per scan (bounded, cheap) — good design.
- `ApiLimitError` is consistently re-raised, not swallowed.

---

## Suggested fix order

1. **Verify prod Gemini model ID immediately** (headline #2) — if broken, the whole AI tier
   is dismissing everything right now.
2. **Add a scan scheduler** (headline #1) — a periodic worker that re-scans monitored brands
   using `brands.last_scan_at`. Without this the product is point-in-time, not monitoring.
3. **Distinguish "blocked/errored" from "empty"** end-to-end (headline #3) — propagate a
   status, alert on scraper health drops, stop reporting blocks as "0 infringements".
4. **Feed listing titles into matching** (`detection_funnel.py` C1) — the pipeline is blind to
   the main counterfeit signal.
5. Close the SSRF gaps on Firecrawl/Playwright paths.
6. Add homoglyph/Unicode normalization + word-boundary guards to the fuzzy matcher.
7. Per-tenant cost caps; move scans to background jobs; add retries + content validation.
8. Build a labeled eval set so any threshold change is measurable.
