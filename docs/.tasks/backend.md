# Backend Tasks Roadmap

This document outlines the priority ordering for backend services, engines, databases, API endpoints, and migrations across all development phases (Phase 1, Phase 2, and Phase 3).

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## 1. Phase 1: MVP Foundations (Done)
*Establishes the initial scraping engine, AI analysis framework, and database models.*

| Task | Status | Notes |
|---|---|---|
| Multi-tier `gather_evidence` scraper | ✅ Done | Scraping engine routing to BS4 custom scrapers, WHOIS, and Firecrawl fallback |
| Amazon Tier 1 (requests + BS4) scraper | ✅ Done | Custom parser extracting titles, prices, and links without Firecrawl credits |
| WHOIS Typosquatting lookup generator | ✅ Done | Generates domain variations and queries registry data via python-whois |
| Extra WHOIS Metadata Parsing | ✅ Done | Extracts registration age, registrar dates, name servers, registrant organization/country, and contact email |
| AI Domain Triage & Similarity Scorer | ✅ Done | Uses Gemini 2.5 Flash to evaluate domain name + WHOIS metadata, determine copycat status, and assign similarity scores |
| `cases`, `evidence`, `decisions` schema migrations | ✅ Done | Supabase database migrations establishing tables, FKs, and RLS policies |
| LangGraph brand-check AI pipeline | ✅ Done | Orchestrates evidence gathering, Gemini-based analysis, and decision creation |
| `/api/v1/monitoring/gather-evidence` endpoint | ✅ Done | Exposes scraping and typosquatting results to client |
| `/api/v1/monitoring/make-decision` endpoint | ✅ Done | Triggers AI analysis on evidence and outputs structured risk scores |
| Google & Meta Ads Library checks | ✅ Done | Scrapes ad platforms to identify trademark infringements |
| DMCA notice generator backend stub | ✅ Done | Notice text auto-generation templates |
| Social media scrapers (Instagram, TikTok) | ✅ Done | Scrapes brand profiles via Firecrawl |
| Confidence scoring & weights tuning | ✅ Done | Composite scoring based on text overlap and image similarity |

---

## 2. Platform Scrapers Implementation (Done)
*Specific parsers and scraping logic for all target channels using custom elements or API integrations.*

| Platform | Scraper Class / Target | Status | Routing / Method |
|---|---|---|---|
| **Amazon** | `AmazonScraper` | ✅ Done | Static HTML (requests + BS4, $0) |
| **eBay** | `EbayScraper` | ✅ Done | Static HTML (requests + BS4, $0) |
| **AliExpress** | `AliExpressScraper` | ✅ Done | JS-heavy (Firecrawl, 10 credits/call) + Gemini structured extraction |
| **Shopify** | `ShopifyScraper` | ✅ Done | Hybrid (direct JSON products.json API + Google SERP discovery, $0) |
| **Etsy** | `EtsyScraper` | ✅ Done | Static HTML search card parsing (requests + BS4, $0) |
| **Facebook Marketplace**| `FacebookMarketplaceScraper` | ✅ Done | JS-heavy (Firecrawl) + Gemini structured extraction |
| **TikTok** | `TikTokScraper` | ✅ Done | JS-heavy (Firecrawl) + video description and views extraction |
| **Instagram** | `InstagramScraper` | ✅ Done | JS-heavy (Firecrawl) + caption and usernames extraction |
| **Google Shopping** | `GoogleShoppingScraper` | ✅ Done | Static HTML parsing (requests + BS4, $0) |
| **Domain Surveillance** | `GoogleSERPAPI` + `WhoisAPI` | ✅ Done | SERP search links + WHOIS registry checks and whitelisting |
| **Google Ads** | `GoogleAdsAPI` | ✅ Done | Google Ads Transparency Center JSON API query with HTML fallbacks |
| **Meta Ads** | `MetaAdsAPI` | ✅ Done | Graph API v19.0 query with screenshot capture & token exchanges |
| **Alibaba** | `AlibabaScraper` | ✅ Done | Static HTML parsing (requests + BS4, $0) |

---

## 3. Phase 2: Core Detection & Verification (Done)
*These tasks complete the foundational matchers, image inspection, and concurrency.*

| Task | Status | Notes |
|---|---|---|
| `MatchResult` Pydantic model | ✅ Done | Defined in `services/detection.py` — supports `keyword`, `image_hash`, `none` match types |
| `keyword_matcher()` (Levenshtein fuzzy) | ✅ Done | `services/detection.py` — uses rapidfuzz `partial_ratio`, threshold=0.80 |
| `hash_matcher()` (pHash via ImageHash) | ✅ Done | `services/detection.py` — uses `imagehash.phash`, Hamming distance, max_distance=10 |
| Unit tests `test_matchers.py` | ✅ Done | 28 tests in `apps/api/tests/test_matchers.py` — covers keyword, hash, OCR, model validation |
| Image OCR (Gemini Vision) | ✅ Done | `ocr_extract_text()` in `services/detection.py` — uses Gemini 2.5 Flash vision |
| `generate_analysis()` in `ai.py` (AIAnalysis schema) | ✅ Done | `AIAnalysis` model + `generate_evidence_analysis()` in `services/ai.py` — structured per-evidence output via Gemini Vision |
| `ai_analysis (jsonb)` stored on evidence row | ✅ Done | `persist_evidence()` auto-populates when `brand_name` is provided |

---

## 4. Phase 2: Scraping Concurrency & Performance (Done)
*Optimizes the scraping pipelines for concurrent execution to resolve network latency bounds.*

| Task | Status | Notes |
|---|---|---|
| Playwright added to backend deps | ✅ Done | `playwright_client.py` implemented |
| Supabase Storage bucket `evidence-screenshots` | ✅ Done | Auto-created by `_ensure_bucket()` in `storage.py` |
| `evidence` table migration | ✅ Done | `20260618000002_evidence.sql` — RLS enabled |
| `persist_evidence()` | ✅ Done | Implemented in `services/persistence.py` |
| `batch_detect()` with `asyncio.gather` | ✅ Done | Implemented concurrently using asyncio.to_thread wrappers |
| Concurrency performance validation | ✅ Done | Bounded by slowest single query rather than sum of latency |

### Scraper Concurrency Performance Log
- **Environment:** Local Python 3.11.9, simulating 500ms network round-trip time (RTT) per platform across 13 channels.

| Strategy | Total Duration | Speedup Factor | Concurrency Target Met (<30s) |
|---|---|---|---|
| **Sequential (Old)** | `6.5059s` | 1.00x (Baseline) | ❌ No (scaled linearly with platform count) |
| **Concurrent (New)** | `0.5087s` | **12.79x faster** | **✅ YES** |

---

## 5. Phase 2: Takedown Management & Database Persistence (Done)
*Enables the editing and management of takedown actions.*

| Task | Status | Notes |
|---|---|---|
| `infringements` Supabase migration | ✅ Done | `20260617000002_infringements.sql` — correct schema |
| `risk_scorer()` | ✅ Done | Implemented in `services/persistence.py` |
| `persist_infringement()` | ✅ Done | Implemented in `services/persistence.py` (upsert by `case_id+source_url`) |
| Integration tests `test_persistence.py` | ✅ Done | File exists in `apps/api/tests/` |
| `notification_sent_at` column | ✅ Done | `20260618000001_notification_sent_at.sql` — partial index on NULL rows |
| `PUT /api/v1/monitoring/takedowns/{id}` endpoint | ✅ Done | Update notice text and status (`pending`, `sent`, `acknowledged`) in `takedown_reports` table |
| Unit tests for `generate_takedown_reports` | ✅ Done | Verify correct template rendering and registry mapping |
| Integration tests for takedown report updates | ✅ Done | Test editing and status transitions in DB |

---

## 6. Phase 2: Security, Admin & Payments
*Gatekeeps resources and sets up payment/billing sessions.*

| Task | Status | Notes |
|---|---|---|
| `profiles` table + trigger | ✅ Done | `20260616000001_profiles.sql` — exact spec match |
| RLS policies on tables | ✅ Done | `20260617000001_profiles_rls.sql` + per-table policies |
| `GET /api/v1/me` endpoint | ✅ Done | `routes/auth.py` — validates Supabase JWT, returns `UserProfile` |
| Google OAuth configured in Supabase | ✅ Done | Enabled on Supabase dashboard, Client ID/Secret added |
| Restrict `/api/v1/usage-stats` to allowed admin emails | ✅ Done | `ADMIN_EMAILS` env var, 403 if email not in list — `routes/usage.py` |
| `pytest tests/test_auth.py` | ✅ Done | 7 tests — /me JWT validation, admin 403/200, no-token 401 |
| `POST /api/v1/billing/create-checkout-session` | ❌ Missing | Stripe checkout session creation |
| `POST /api/v1/billing/create-portal-session` | ❌ Missing | Stripe billing portal redirect session |
| `POST /api/v1/billing/webhook` | ❌ Missing | Handle Stripe events and update organization subscription status |

---

## 7. Phase 3: Document Persistence & Notifications (Done)
*Stores generated legal notices, logs email dispatches, and handles client scoping.*

| Task | Status | Notes |
|---|---|---|
| `notification_deliveries` Supabase migration | ✅ Done | `20260625000002_notification_deliveries.sql` — RLS enabled |
| `notifications.py` — `send_email_notification()` | ✅ Done | SMTP dispatch with template support (new_infringement, takedown_generated, case_escalated, case_dismissed) |
| `dispatch_notifications()` for email delivery | ✅ Done | Resolves recipient email (checks org settings, env fallbacks) |
| `log_delivery()` + event triggers (new_infringement, etc.) | ✅ Done | `services/delivery_log.py` + trigger `persistence.py` HIGH risk |
| `POST /api/v1/monitoring/takedowns/{id}/send-email` endpoint | ✅ Done | Sends takedown notice text via SMTP, records log, updates status |
| `test_notifications.py` + `test_delivery_log.py` | ✅ Done | All 11 tests passing (`test_notifications.py` + `test_delivery_log.py`) |
| `documents` Supabase migration | ✅ Done | `20260625000001_documents.sql` — FK to infringements, RLS enabled |
| `legal-documents` Storage bucket | ✅ Done | Auto-created by `_ensure_bucket()` in `document_persistence.py` |
| `persist_document()` | ✅ Done | `services/document_persistence.py` — uploads bytes, inserts row, returns record |
| `get_documents_by_infringement()` | ✅ Done | `services/document_persistence.py` — newest-first query |
| `test_document_persistence.py` | ✅ Done | 7 tests, all passing — mocked, no real Supabase needed |

---

## 8. Phase 3: Advanced Features & Law Firm Mode
*Scaling the platform to multi-client usage and advanced vector similarity search.*

| Task | Status | Notes |
|---|---|---|
| Neural/Vector Matcher (CLIP + pgvector) | ❌ Missing | Advanced logo/visual similarity search using CLIP embeddings and Supabase pgvector |
| `clients` Supabase migration + `client_id` FK on cases/infringements | ❌ Missing | Database migration to isolate client accounts under a single org |
| Client CRUD endpoints (`routes/clients.py`) | ❌ Missing | Management endpoints for clients |
| `GET /api/v1/clients/{id}/billing` endpoint | ❌ Missing | Specific billing/usage metrics per client |
| Per-client RLS policies | ❌ Missing | Database level isolation of client data |
| Law Firm custom email branding (firm name, logo) | ❌ Missing | Customize notification styles based on active firm/organization settings |
| Law Firm branding inside generated PDFs | ❌ Missing | Dynamically inject legal firm details into downloaded notices |

---

## 9. Geo-Targeted Scans & Proxy Location Management
*Allows routing scans through country-specific proxies to discover geo-fenced copycat ads and listings.*

| Task | Status | Notes |
|---|---|---|
| Database: target locations on cases/brands | ❌ Missing | Introduce support for target country codes (e.g. `['US', 'DE', 'GB']`) in cases / brand entities |
| Proxy Integration: multi-region proxy configuration | ❌ Missing | Build configuration module mapping country codes to residential/data-center proxies |
| Scraper: Google Search & Ads geo-targeting | ❌ Missing | Pass regional params (e.g. `gl`, `lr`, `cr`) and route queries through local country proxies |
| Scraper: Localized marketplace sessions (Amazon, eBay, AliExpress, Alibaba) | ❌ Missing | Configure region-specific delivery postcodes/cookies and run requests via corresponding target country proxies |
| Scraper: Meta Ads Ad Library country routing | ❌ Missing | Map search regions to Meta's Ad Library country query filter parameter |
| Scraper: Social media crawlers (Instagram, TikTok) | ❌ Missing | Route social crawls through regional proxies to simulate local feeds and bypass geo-blocks |
| Unit tests for proxy routing & parameter mapping | ❌ Missing | Validate proxy selection logic based on requested brand monitoring regions |
