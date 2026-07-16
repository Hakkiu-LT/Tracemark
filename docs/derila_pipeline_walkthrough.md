
# Tracemark Scraping & Detection — Updated Pipeline (Derila example)

> The full pipeline as it runs after all improvements: SerpApi unified Google Ads, deterministic parsing (no Gemini for extraction), tiered detection funnel (Tier 0 → Tier 1 → Tier 2), `official_domains` whitelist, Approach A logo extraction, and single-node `gemini-3.5-flash` adjudication.

---

## 1. Trigger & Pre-checks

`POST /monitoring/check-brand` (`monitoring.py:214`)

```json
{
  "brand_name": "Derila",
  "platforms": ["amazon", "google_ads", "meta_ads", "domains"],
  "official_advertisers": ["Orbio World", "Derila Official"],
  "official_domains": ["derila.com", "orbioworld.com"],
  "target_regions": ["US"]
}
```

**What runs:**
1. `_enforce_scan_entitlements` (`monitoring.py:155`) — checks platform count, domain tracking, region count against the caller's plan. (Admins are automatically resolved to the `"enterprise"` plan with unlimited benefits, bypassing these limits.)
2. `_reject_if_brand_locked` (`monitoring.py:193`) — queries `brands` table for `status == "locked"`.
3. `resolve_detection_depth(profile.entitlements)` (`entitlements.py`) — returns `"tier2"` (full funnel for all plans today; this is the hook for future plan-gating).
4. Scraping begins.

---

## 2. Scraping (concurrent, deterministic parsing)

`check_brand` calls `scrape_evidence` = `gather_evidence` (`marketplace.py:2027`), passing `official_domains` for whitelist filtering.

`MarketplaceScraper.batch_detect` (`marketplace.py:1592`) runs `asyncio.gather` over per-(platform, country) tasks:

| Platform | Scraper | What it captures |
|---|---|---|
| **Amazon** | `AmazonScraper.search` (`marketplace.py:278`) | Static HTML → BeautifulSoup → `title, price, seller, url` (structured dicts) |
| **Google Ads** | `GoogleSERPAPI.search_google_ads_page` (`marketplace.py`) | **SerpApi `engine=google_ads`** — single call returns paid ads + organic results + shopping ads + local ads |
| **Meta Ads** | `MetaAdsAPI.search` (`marketplace.py:1347`) | Graph API → `page_name, ad_text, destination_url, screenshot_url` (Meta takes screenshots at scrape time) |
| **Domains** | `GoogleSERPAPI.check_serp_domains` (`marketplace.py:1129`) | SERP results → WHOIS → `domain, registrar, creation_date, registrant_org, country` |

### What changed: Google Ads via SerpApi

Previously, Google Ads used the unreliable Google Ads Transparency Center (`adstransparency.google.com`) with an HTML scraping fallback chain (BeautifulSoup → Firecrawl → Gemini). Now it uses a **single SerpApi call** with `engine=google_ads` that returns all four data types in one response:

```json
{
  "ads": [{"title": "Cheap Derila Pillow 80% OFF", "link": "deri1a-shop.com", "description": "...", "source": "deri1a-shop.com"}],
  "organic_results": [{"link": "https://legit-derila.com/products"}, {"link": "https://deri1a.com"}],
  "shopping_results": [{"title": "Derila pillow - 50% OFF", "link": "https://cheap-shop.com/testbrand", "extracted_price": 19.99}],
  "local_ads": {"results": [{"title": "CheapDeals Inc", "description": "Derila products on sale", "link": "https://local-cheapdeals.com"}]}
}
```

All four blocks are parsed by `_parse_google_ads_response`, `_parse_shopping_results`, and `_parse_local_ads`, then merged into `results["ads"]["google"][country]`. The organic domains feed into the domain discovery pipeline. **No separate Google Ads API call needed — same `GOOGLE_SERP_API` key.**

### What changed: No Gemini for parsing

After raw scraping, evidence is extracted **deterministically** — no Gemini calls:

| Data type | Parser | How |
|---|---|---|
| **Marketplace listings** (static scrapers) | `_parse_marketplace_listings` | Converts structured dicts directly: `{title, price, seller, url}` → `MarketplaceEvidence` |
| **Marketplace listings** (JS-heavy via Firecrawl) | `_parse_marketplace_listings` | Regex on markdown: finds `[title](url)` links + `$price` patterns |
| **Domains** | `_build_domain_evidence` | Creates `DomainEvidence` directly from WHOIS data with `is_clone=True`, `similarity_score=0` — Tier 0 classifies later |
| **Social media** | `_parse_social_from_markdown` | Regex on Firecrawl markdown: finds `@handles` and platform URLs |
| **Ads** | `_ad_dict_to_evidence` | Direct dict → `AdEvidence` mapping (already structured from SerpApi/Meta API) |

### Screenshots captured for all platforms

Screenshots are now captured for **every** evidence type, not just marketplaces/domains/meta:
- Amazon listings: `_screenshot_listing(listing.listing_url)`
- Google Ads: `_screenshot_listing(ad.destination_url)`
- Meta Ads: screenshot taken at scrape time by `MetaAdsAPI._parse_ads`
- Social: `_screenshot_listing(item.post_url)`
- Domains: `_screenshot_listing(f"https://{domain_name}")`

### Official domains whitelist filtering

After all evidence is collected but before returning, `gather_evidence` filters out items pointing to official domains:

```python
if official_domains:
    # "derila.com" and "orbioworld.com" are whitelisted
    # Any listing/ad/domain whose URL matches gets removed
    all_marketplace_evidence = [m for m in ... if not _is_official_url(m.listing_url)]
    ad_evidences = [a for a in ... if not _is_official_url(a.destination_url)]
    domain_evidences = [d for d in ... if d.domain_name.lower() not in official_set]
```

So if Amazon returns a listing from `derila.com/products`, it's automatically whitelisted and never reaches the funnel.

### Example raw evidence after scraping + filtering

```
Marketplaces: [
  { seller: "SleepWell Store", url: "amazon.com/dp/B0DXY...", price: "$19.99" },        ← suspicious
  { seller: "Derila Official", url: "derila.com/products", price: "$39.00" },           ← FILTERED (official domain)
]
Ads: [
  { platform: "google_ads", copy: "Derila Pillow 80% OFF Free Shipping", url: "deri1a-shop.com" },  ← from SerpApi
  { platform: "google_shopping", copy: "Derila pillow - 50% OFF", url: "cheap-shop.com" },          ← from SerpApi shopping_results
]
Domains: [
  { domain: "deri1a.com", registrar: "GoDaddy", creation_date: "2026-06-01" },
  { domain: "derilapillowcheap.com", registrar: "Chengdu West Dimension", creation_date: "2026-07-10" },
]
Social: [
  { platform: "tiktok", handle: "deriladeals", post_url: "tiktok.com/@deriladeals/video/1" },
]
```

---

## 3. Tier 0 — Deterministic Pre-filter (no AI, milliseconds)

`run_tier0_and_filter(evidence, "Derila")` in `detection_funnel.py` runs on **every** scraped item before any LLM call.

Each item gets a `Tier0Signals` struct:

### Example: domain `deri1a.com`

| Signal | Computation | Value |
|---|---|---|
| `typosquat_distance` | `Levenshtein.distance("derila", "deri1a")` (`detection.py`) | **1** (one char swap) |
| `brand_name_match_score` | `rapidfuzz.partial_ratio("derila", "deri1a.com")` / 100 | **0.95** |
| `domain_age_days` | `datetime.now - creation_date` | **44 days** |
| `registrar_reputation` | `GoDaddy` → checked against trusted/suspicious lists | **"trusted"** |
| `ssl_issuer` | SSL cert lookup on port 443 | `"Let's Encrypt"` |
| `ssl_suspicious` | Let's Encrypt flagged | **True** |
| `ad_hijack_score` | Not an ad → None | None |

**Classification** (`_classify` in `detection_funnel.py`):
- `typosquat_distance = 1` ≤ threshold (2) → **`obvious_copycat`**
- Auto-flagged. No Tier 1 needed. No Tier 2 needed. Zero LLM calls.

### Example: domain `derilapillowcheap.com`

| Signal | Value |
|---|---|
| `typosquat_distance` | `Levenshtein("derila", "derilapillowcheap")` = **11** (too far for typosquat) |
| `brand_name_match_score` | `partial_ratio("derila", "derilapillowcheap.com")` = **0.90** |
| `domain_age_days` | **5 days** |
| `registrar_reputation` | `Chengdu West Dimension` → **"suspicious"** |
| `ssl_suspicious` | False |

**Classification:**
- Not a typosquat (distance 11 > 2)
- Brand name present (0.90 ≥ 0.95? No) → not obvious_copycat via brand match alone
- But: `domain_age < 30 days` + `registrar_reputation == "suspicious"` + brand match ≥ 0.80 → **`ambiguous`** → advances to Tier 1

### Example: Google Ad `"Derila Pillow 80% OFF Free Shipping"` → `deri1a-shop.com`

| Signal | Value |
|---|---|
| `brand_name_match_score` | `partial_ratio("derila", ad_copy)` = **1.0** |
| `ad_hijack_score` | brand in text (+40) + hijacking signals "80% OFF", "free shipping" (+20) = **60** |

**Classification:**
- `ad_hijack_score = 60` < 80 (copycat threshold) → not obvious_copycat
- `brand_name_match = 1.0` ≥ 0.95 but no domain_age signal (it's an ad) → **`ambiguous`** → advances to Tier 1

### Example: Shopping ad `"Derila pillow - 50% OFF"` → `cheap-shop.com`

| Signal | Value |
|---|---|
| `brand_name_match_score` | `partial_ratio("derila", "Derila pillow - 50% OFF")` = **1.0** |
| `ad_hijack_score` | brand in text (+40) + "50% OFF" (+20) = **60** |

**Classification:**
- `ad_hijack_score = 60` < 80 → **`ambiguous`** → advances to Tier 1

### Example: TikTok `@deriladeals`

| Signal | Value |
|---|---|
| `brand_name_match_score` | `partial_ratio("derila", "deriladeals tiktok")` = **0.91** |

**Classification:**
- Brand match 0.91 < 0.95 → **`ambiguous`** → advances to Tier 1

### Result of Tier 0:
```
Scored items:
  deri1a.com           → obvious_copycat  (score 0.85, confidence high)    ← AUTO-FLAGGED, zero LLM
  derilapillowcheap    → ambiguous        (score 0.45, confidence low)     → Tier 1
  google ad deri1a     → ambiguous        (score 0.55, confidence low)     → Tier 1
  shopping ad          → ambiguous        (score 0.55, confidence low)     → Tier 1
  tiktok @deriladeals  → ambiguous        (score 0.35, confidence low)     → Tier 1
```

Items classified `obvious_non_match` would be **removed** from evidence here. In this example, none were.

---

## 4. Tier 1 — Similarity Scoring (no LLM, depends on reference assets)

`run_tier1(evidence, scored_items, brand_id)` in `detection_funnel.py` runs **only on ambiguous items** from Tier 0.

### Brand reference assets

The user can upload a logo and a product image during brand creation (`monitoring.new.tsx`) or edit (`monitoring.tsx`). These assets are:
1. Compressed to WebP quality 85 (`storage.py:_compress_to_webp`)
2. Stored in the `brand-assets` Supabase Storage bucket
3. pHash computed locally with `imagehash` (pure math, no API, no Gemini)
4. pHash bigint stored in `brand_assets.phash` column

If the user also uploaded reference text content (their website copy), it was embedded using Gemini Embedding API (`text-embedding-004`, 768 dims) at upload time — this is a separate cheap embedding API, not the reasoning model.

### Visual similarity: Approach A logo extraction

For each ambiguous item with a screenshot, Tier 1 now tries **Approach A** first:

```
1. extract_logo_phash_from_url(source_url)
   → Fetches the page HTML
   → Searches for <img> tags with "logo" in class/alt/id/src
   → Downloads the logo image → computes pHash
   
2. If logo found → compare logo pHash vs reference logo pHash (precise)
3. If no logo found in HTML → fall back to whole-screenshot pHash vs reference (crude)
```

### Example: Google Ad → `deri1a-shop.com`

| Dimension | How | Result |
|---|---|---|
| `text_similarity` | Embed ad copy with Gemini Embedding → cosine vs reference content | **0.71** (mentions Derila but different copy) |
| `visual_similarity` | Approach A: fetch `deri1a-shop.com` HTML → find `<img class="logo">` → pHash vs reference logo | **0.82** (found a logo in HTML, similar to reference) |
| `logo_similarity` | Same as above (logo-specific) | **0.82** |
| `product_similarity` | pHash of screenshot vs reference product image | **0.45** (different product photo) |
| `content_hash` | SHA-256 of evidence text | `"b7c3..."` |

**Tier 1 classification:**
- `max(0.71, 0.82, 0.82, 0.45) = 0.82` < 0.85 → not obvious_copycat
- `min(0.71, 0.82, 0.82, 0.45) = 0.45` ≥ 0.30 → not obvious_non_match
- → **`ambiguous`** → advances to Tier 2

### Example: domain `derilapillowcheap.com`

| Dimension | How | Result |
|---|---|---|
| `text_similarity` | Embed domain name → cosine vs reference content | **0.35** |
| `visual_similarity` | Approach A: fetch HTML → find logo → pHash vs reference | **0.75** (uses a similar logo) |
| `logo_similarity` | Same | **0.75** |
| `product_similarity` | pHash vs reference product image | **0.30** |

**Tier 1 classification:**
- `max(0.35, 0.75, 0.75, 0.30) = 0.75` < 0.85 → not obvious_copycat
- → **`ambiguous`** → advances to Tier 2

### Result of Tier 1:
```
Scored items (updated):
  deri1a.com           → obvious_copycat  (Tier 0, skip)         score 0.85
  google ad deri1a     → ambiguous        (→ Tier 2)              score 0.65
  shopping ad          → ambiguous        (→ Tier 2)              score 0.58
  derilapillowcheap    → ambiguous        (→ Tier 2)              score 0.48
  tiktok @deriladeals  → ambiguous        (→ Tier 2)              score 0.35
```

---

## 5. Evidence Filtering

`filter_evidence_by_scored(evidence, scored_items)` removes any items whose final verdict is `obvious_non_match` from the `Evidence` object.

---

## 6. Case Creation & Persistence

If evidence remains after filtering:

1. `create_case("Derila", organization_id, ...)` → `case_id` (`database.py:19`)
2. **Similarity Score Syncing**: The computed `overall_score` (multiplied by 100) from `scored_items` is copied back into `evidence.domains` by matching the domain URL. This ensures the individual items list their true match percentage in the UI (e.g. `90% match`) instead of defaulting to `0% match`.
3. `save_evidence(case_id, evidence)` — raw JSONB into `evidence` table
3. `persist_all_infringements(case_id, evidence, scored_items=scored_items)` (`persistence.py:223`)
   - Uses `verdict_to_risk_level(scored.verdict, scored.overall_score)` instead of the old hardcoded `risk_scorer`:

| Item | Old risk_scorer | New verdict_to_risk_level |
|---|---|---|
| `deri1a.com` | HIGH, 0.90 (domain sim ≥ 80) | HIGH, 0.85 (obvious_copycat, score ≥ 0.80) |
| google ad | HIGH, 0.90 (ads always HIGH) | MEDIUM, 0.65 (ambiguous, score ≥ 0.50) |
| shopping ad | HIGH, 0.90 (ads always HIGH) | MEDIUM, 0.58 (ambiguous, score ≥ 0.50) |
| `derilapillowcheap` | HIGH, 0.90 (sim default 90) | LOW, 0.48 (ambiguous, score < 0.50) |
| tiktok | LOW, 0.25 (followers unknown) | LOW, 0.35 (ambiguous, score < 0.40) |

4. `persist_scored_evidence_item(case_id, scored)` — writes the full structured record to `evidence_items`:
   ```json
   {
     "source_url": "https://deri1a.com",
     "platform": "domain",
     "tier0_score": 0.85,
     "tier1_score": null,
     "overall_score": 0.85,
     "verdict": "obvious_copycat",
     "category": ["typosquatting"],
     "criteria": [
       {"name": "typosquat_distance", "score": 0.9, "evidence": "Levenshtein distance: 1"},
       {"name": "brand_name_match", "score": 0.95, "evidence": "..."},
       {"name": "registrar_reputation", "score": 0.1, "evidence": "GoDaddy (trusted)"}
     ],
     "confidence": "high",
     "content_hash": null,
     "status": "new"
   }
   ```

---

## 7. Tier 2 — LLM Adjudication (single Gemini call, ambiguous only)

**Updated.** `make_decision(evidence, scored_items)` (`ai.py`) runs the LangGraph decision graph — now a **single node** with **one Gemini call**.

### What changed: Merged two nodes into one

Previously: two sequential LLM calls (Gemini Flash for summarization → Gemini Pro for decision). Now: **one `gemini-3.5-flash` call** that produces both the summary and the decision.

### Single node: `_evaluate_and_decide_node` (`ai.py`)

- Calls `score_evidence(evidence)` for the case-level quality score
- **Short-circuits** without LLM if no evidence (returns `LOW/DISMISS`)
- **Injects tiered funnel context** into the prompt:

  ```
  TIERED FUNNEL RESULTS:
  - Auto-flagged as obvious copycat (Tier 0/1): 1 items
  - Ambiguous (require your adjudication): 4 items

  PER-ITEM SCORES (ambiguous items only — focus your analysis here):
  • deri1a-shop.com | score=0.65 | criteria: text_similarity=0.71, visual_similarity=0.82, logo_similarity=0.82
  • cheap-shop.com | score=0.58 | criteria: text_similarity=0.65, visual_similarity=0.71
  • derilapillowcheap.com | score=0.48 | criteria: text_similarity=0.35, visual_similarity=0.75, logo_similarity=0.75
  • tiktok.com/@deriladeals | score=0.35 | criteria: brand_name_match=0.91

  AUTO-FLAGGED ITEMS (confirmed by deterministic signals — no adjudication needed):
  • deri1a.com | score=0.85
  ```

- The prompt tells Gemini: "Items auto-flagged by the tiered funnel have high-confidence deterministic scores — rely on those without re-evaluating. Focus your analysis on the ambiguous items."
- Calls **`gemini-3.5-flash`** with `.with_structured_output(Decision)` — Gemini is constrained to return JSON matching the `Decision` Pydantic schema:

  ```json
  {
    "risk_level": "HIGH",
    "recommended_action": "TAKEDOWN",
    "case_summary": "Multiple copycat domains and ad hijacking detected for Derila. The domain deri1a.com is a typosquat (Levenshtein distance 1) auto-flagged by deterministic signals. Four additional ambiguous items — including ads pointing to deri1a-shop.com and cheap-shop.com — show moderate visual and text similarity to the brand's reference assets.",
    "confidence_score": 0.88,
    "evidence_quality": "STRONG",
    "key_findings": [
      "deri1a.com is a typosquat (Levenshtein distance 1)",
      "Ad hijacking detected: google ads using brand name with hijacking signals",
      "Shopping ad for 'Derila pillow 50% OFF' on cheap-shop.com",
      "TikTok account @deriladeals impersonating the brand"
    ]
  }
  ```

The structured output is enforced by Gemini's function calling / response schema feature — the SDK sends the `Decision` Pydantic model's field definitions as a JSON schema, and Gemini cannot return anything outside those constraints.

### Decision persistence

`save_decision(case_id, decision, score=score)` (`monitoring.py:274`) — now passes the `EvidenceScore`, so per-category scores (`marketplace_score`, `ads_score`, `domains_score`, `evidence_score`) are persisted to the `decisions` table.

---

## 8. Takedown Reports

`generate_takedown_reports(case_id, "Derila", decision, evidence)` (`takedown.py`) — unchanged. Generates platform-specific draft complaints (DMCA, Google Ads Trademark Notice, etc.) with screenshot links and evidence details.

---

## Flow diagram (updated)

```
POST /check-brand
    │
    ├─ _enforce_scan_entitlements (plan limits)
    ├─ _reject_if_brand_locked
    ├─ resolve_detection_depth → "tier2"
    │
    ▼
SCRAPING (concurrent, per platform/country)
    │  Amazon → static HTML → BeautifulSoup → structured dicts
    │  Google Ads → SerpApi engine=google_ads → ads + organic + shopping + local_ads (ONE call)
    │  Meta Ads → Graph API → structured + screenshots at scrape time
    │  Domains → SERP + WHOIS → structured domain data
    │  Screenshots captured for ALL platforms
    │
    ▼
DETERMINISTIC PARSING (no Gemini)
    │  _parse_marketplace_listings → structured dicts or regex on markdown
    │  _build_domain_evidence → DomainEvidence directly from WHOIS
    │  _parse_social_from_markdown → regex for @handles and URLs
    │  _ad_dict_to_evidence → direct dict mapping
    │
    ▼
OFFICIAL DOMAINS WHITELIST FILTER
    │  Remove listings/ads/domains pointing to derila.com, orbioworld.com
    │
    ▼
TIER 0 — deterministic, no AI
    │  For each scraped item:
    │    • typosquat_distance (Levenshtein)
    │    • brand_name_match (rapidfuzz)
    │    • domain_age + registrar_reputation + SSL issuer
    │    • ad_hijack_score (for ads)
    │  Classify: obvious_copycat / obvious_non_match / ambiguous
    │  Remove obvious_non_match from evidence
    │
    ▼
TIER 1 — similarity, no LLM (only for ambiguous)
    │  Load brand reference assets (logos via pHash, content via embeddings)
    │  For each ambiguous item:
    │    • text_similarity (Gemini Embedding cosine vs reference content)
    │    • Approach A: extract logo from page HTML → pHash vs reference logo
    │      → fall back to whole-screenshot pHash if no logo found
    │    • logo_similarity / product_similarity (pHash)
    │    • content_hash (SHA-256 for dedup)
    │  Reclassify: obvious_copycat / obvious_non_match / ambiguous
    │  Remove new obvious_non_match from evidence
    │
    ▼
PERSIST
    │  create_case → save_evidence (JSONB)
    │  persist_all_infringements (uses tiered scores, not hardcoded rules)
    │  persist_scored_evidence_item → evidence_items table (structured per-item record)
    │
    ▼
TIER 2 — single LLM call (gemini-3.5-flash, ambiguous only)
    │  make_decision(evidence, scored_items)
    │  Single node: evaluate_and_decide
    │  Prompt includes tiered funnel results + per-item scores
    │  LLM focuses on ambiguous items; auto-flagged items pass through
    │  gemini-3.5-flash → structured Decision (HIGH/MEDIUM/LOW + TAKEDOWN/MONITOR/DISMISS)
    │  Includes case_summary (2-3 sentences) in the same response
    │
    ▼
save_decision (persists per-category scores too)
    │
    ▼
generate_takedown_reports → response
```

## LLM call summary

| Phase | Before | After |
|---|---|---|
| Marketplace extraction | 1 Gemini Flash call per (platform, country) | **0** — deterministic parser |
| Domain evaluation | 1 Gemini Flash call per batch | **0** — Tier 0 deterministic |
| Social extraction | 1 Gemini Flash call per (platform, country) | **0** — regex parser |
| Ad extraction | 1 Gemini Flash call (fallback only) | **0** — SerpApi returns structured data |
| Case summarization | 1 Gemini Flash call | **0** — merged into decision call |
| Case decision | 1 Gemini Pro call | **1 Gemini 3.5 Flash call** |
| **Total per scan** | **5-8+ LLM calls** | **1 LLM call** |

## What Gemini is still used for

| Use case | Model | When | Why |
|---|---|---|---|
| Text embeddings | `text-embedding-004` | Reference content upload + Tier 1 text similarity | Converts text to vectors for cosine comparison (50x cheaper than reasoning models) |
| Case evaluation + decision | `gemini-3.5-flash` | Tier 2 (once per case, ambiguous items only) | Final adjudication with structured `Decision` output |

Everything else — scraping, parsing, logo detection, domain classification, similarity scoring, evidence filtering, persistence — is **deterministic and free**.
