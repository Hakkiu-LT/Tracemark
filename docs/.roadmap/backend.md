# Backend Tasks Roadmap

This document outlines the priority ordering for backend services, engines, databases, API endpoints, and migrations across all development phases (Phase 1, Phase 2, and Phase 3).

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## 1. MVP Foundations (Done)
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

## 3. Core Detection & Verification (Done)
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
| Fuzzy Domain Pre-Filter & Clone Validation | ✅ Done | Filters out non-brand relevant domains (similarity < 0.60) and ignores non-clone domains from evidence scoring |

---

## 4. Scraping Concurrency & Performance (Done)
*Optimizes the scraping pipelines for concurrent execution to resolve network latency bounds.*

| Task | Status | Notes |
|---|---|---|
| Playwright added to backend deps | ✅ Done | `playwright_client.py` implemented |
| Supabase Storage bucket `evidence-screenshots` | ✅ Done | Auto-created by `_ensure_bucket()` in `storage.py` |
| `evidence` table migration | ✅ Done | `20260618000002_evidence.sql` — RLS enabled |
| `persist_evidence()` | ✅ Done | Implemented in `services/persistence.py` |
| `batch_detect()` with `asyncio.gather` | ✅ Done | Implemented concurrently using asyncio.to_thread wrappers |
| Concurrency performance validation | ✅ Done | Bounded by slowest single query rather than sum of latency |

---

## 5. Takedown Management & Database Persistence (Done)
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

## 6. Security, Admin & Payments
*Gatekeeps resources and sets up payment/billing sessions.*

| Task | Status | Notes |
|---|---|---|
| `profiles` table + trigger | ✅ Done | `20260616000001_profiles.sql` — exact spec match |
| RLS policies on tables | ✅ Done | `20260617000001_profiles_rls.sql` + per-table policies |
| `GET /api/v1/me` endpoint | ✅ Done | `routes/auth.py` — validates Supabase JWT, returns `UserProfile` |
| Google OAuth configured in Supabase | ✅ Done | Enabled on Supabase dashboard, Client ID/Secret added |
| Restrict `/api/v1/usage-stats` to allowed admin emails | ✅ Done | `ADMIN_EMAILS` env var, 403 if email not in list — `routes/usage.py` |
| `pytest tests/test_auth.py` | ✅ Done | 7 tests — /me JWT validation, admin 403/200, no-token 401 |
| `POST /api/v1/billing/create-subscription` | ✅ Done | Stripe Elements: creates customer + incomplete subscription (plan + add-on items), returns PaymentIntent client_secret — `routes/billing.py` |
| `POST /api/v1/billing/update-subscription` | ✅ Done | Change plan/interval or reconcile add-on quantities with prorations |
| `POST /api/v1/billing/cancel-subscription` | ✅ Done | Cancel at period end / resume |
| `GET /api/v1/billing/subscription` · `GET /api/v1/billing/invoices` | ✅ Done | Read current subscription + add-ons and synced invoice history |
| `POST /api/v1/billing/create-portal-session` | ✅ Done | Stripe billing portal redirect session |
| `POST /api/v1/billing/webhook` | ✅ Done | Verifies signature; syncs `subscriptions`/`subscription_addons`/`invoices` and mirrors `profiles.plan` |
| `POST /api/v1/billing/charge-managed-takedown` | ✅ Done | Phase F: one-off $500 invoice item per successful managed takedown |
| Webhook idempotency (dedupe by event id) | ✅ Done | `stripe_events` ledger; duplicate events skipped, degrades gracefully pre-migration |
| RLS hardening (`user_id` ownership) | ✅ Done | Dedicated `user_id` column replaces the `organization_id = auth.uid()` overload; backend auto-populates |
| Stripe error handling → clean HTTP | ✅ Done | `_do_stripe` maps `CardError`→402, `StripeError`→502 (keeps CORS headers, avoids opaque 500s) |
| Stripe Price seeding helper | ✅ Done | `apps/api/scripts/seed_stripe.py` — creates Products/Prices, prints `.env` lines |
| `billing_config.py` price mapping | ✅ Done | (plan,interval)/add-on → Stripe Price IDs from env + reverse lookups |
| Unit tests `tests/test_billing.py` | ✅ Done | 11 tests (config, webhook signature, validation, managed takedown) |
| Live E2E verification | ✅ Done | 26/26 checks: create→confirm→webhook→active→update→addon→cancel→resume→invoices→managed takedown + idempotency + user_id/dedup |
| Migration `20260707000001_billing.sql` | ✅ Done | `subscriptions`, `subscription_addons`, `invoices` + `org_settings.stripe_customer_id`, RLS |
| Migration `20260707000002_billing_hardening.sql` | ✅ Done | `user_id` columns + tightened RLS, `stripe_events` idempotency table |
| Managed-takedown charge trigger | ✅ Done | Manual "Let us handle it — $500" button on the takedown page (Pro/Agency), idempotent per report id |

---

## 7. Document Persistence & Notifications (Done)
*Stores generated legal notices, logs email dispatches, and handles client scoping.*

| Task | Status | Notes |
|---|---|---|
| `notification_deliveries` Supabase migration | ✅ Done | `20260625000002_notification_deliveries.sql` — RLS enabled |
| `notifications.py` — `send_email_notification()` | ✅ Done | SMTP connectivity deactivated in favor of client-side browser/Gmail redirects |
| `dispatch_notifications()` for email delivery | ✅ Done | Simplified to lightweight print logging |
| `log_delivery()` + event triggers (new_infringement, etc.) | ✅ Done | `services/delivery_log.py` + trigger `persistence.py` HIGH risk |
| `POST /api/v1/monitoring/takedowns/{id}/send-email` endpoint | ✅ Done | Sends takedown notice text via SMTP, records log, updates status |
| `test_notifications.py` + `test_delivery_log.py` | ✅ Done | All tests updated to assert no-op/print logic |
| `decline_reason schema migration & update fallback` | ✅ Done | Added migration for decline_reason columns on cases/infringements with robust database update fallback |
| `documents` Supabase migration | ✅ Done | `20260625000001_documents.sql` — FK to infringements, RLS enabled |
| `legal-documents` Storage bucket | ✅ Done | Auto-created by `_ensure_bucket()` in `document_persistence.py` |
| `persist_document()` | ✅ Done | `services/document_persistence.py` — uploads bytes, inserts row, returns record |
| `get_documents_by_infringement()` | ✅ Done | `services/document_persistence.py` — newest-first query |
| `test_document_persistence.py` | ✅ Done | 7 tests, all passing — mocked, no real Supabase needed |

---

## 8. Law Firm Mode
*Scaling the platform to multi-client usage and firm customization.*

| Task | Status | Notes |
|---|---|---|
| `clients` Supabase migration + `client_id` FK on cases/infringements | ✅ Done | Database migration to isolate client accounts under a single org |
| Client CRUD endpoints (`routes/clients.py`) | ✅ Done | Management endpoints for clients |
| `GET /api/v1/clients/{id}/billing` endpoint | ✅ Done | Specific billing/usage metrics per client |
| Per-client RLS policies | ✅ Done | Database level isolation of client data |
| Independent Mode Isolation (Brand Owner vs. Law Firm) | ✅ Done | Ensure complete isolation between modes: brands/cases saved in Brand Owner mode (`client_id` is NULL) must not be accessible or shown under Law Firm mode configurations (`client_id` is NOT NULL), ensuring independent settings and data stores for each mode |
| Law Firm custom email branding (firm name, logo) | ✅ Done | Customize notification styles based on active firm/organization settings |
| Law Firm branding inside generated PDFs | ✅ Done | Dynamically inject legal firm details into downloaded notices |

---

## 9. Geo-Targeted Scans & Multi-Region Location Management
*Allows routing scans through region-specific APIs, parameters, and localized domains (using SerpApi, Firecrawl location payload, Meta Ad Library filters, and local marketplace domains) to discover geo-fenced copycat ads and listings.*

| Task | Status | Notes |
|---|---|---|
| Database: target locations on cases/brands | ✅ Completed | Added target_regions array and detection_region string column to `cases` table |
| Case Creation: split cases by detection region | ✅ Completed | Split scanning loop in `/check-brand` FastAPI endpoint to scan countries concurrently, saving separate cases per country code |
| API Integration: multi-region parameter mapping | ✅ Completed | Created `geo.py` module to map countries/regions to SerpApi params, Firecrawl locations, and marketplace domains |
| Parallel Scraper Execution | ✅ Completed | Orchestrated concurrent scans using `asyncio.gather` over targeted country/platform combinations |
| Scraper: Google Search & Ads geo-targeting | ✅ Completed | Configured Google SERP and Google Ads API integrations to dynamically route queries with region parameters |
| Scraper: Localized marketplace domains & sessions (Amazon, eBay, AliExpress, Alibaba) | ✅ Completed | Localized scrapers for Amazon, eBay, AliExpress, and Alibaba based on active target country |
| Scraper: Meta Ads Ad Library country routing | ✅ Completed | Forwarded mapped target country code filter into Meta Ads search queries |
| Scraper: Social media crawlers (Instagram, TikTok) | ✅ Completed | Configured Firecrawl location settings inside social media scrapers |
| Unit tests for region mapping, parallelism & parameter formatting | ✅ Completed | Added full unit coverage in `test_geo.py` and aligned all test cases |

--

## 10. Advanced Features
*Scaling the platform with advanced logo/visual copycat detection.*

| Task | Status | Notes |
|---|---|---|
| **1. Scraping Module (`scraper.py`)** | ❌ Missing | Extract candidate logos from favicon, `<meta og:image>`, and header/nav elements (using "logo" class/id/alt heuristics). Download local copies, track source URLs, and handle failures gracefully. |
| **2. CLIP Embedding & Similarity (`embedder.py`)** | ❌ Missing | Generate 512-dimensional visual embeddings for both reference and scraped logos using `open_clip` or Hugging Face `transformers` CLIP model. Calculate and sort by cosine similarity. |
| **3. Filtering Logic** | ❌ Missing | Filter scraped logos based on configurable similarity threshold (default `0.75`) and top-N limits (default `20`). |
| **4. Gemini Visual Verification (`gemini_check.py`)** | ❌ Missing | Pass candidate + reference images to `gemini-3.5-flash` (`thinking_level=high`) to obtain structured verdicts (`yes`/`no`/`maybe`), confidence scores, and visual match justifications. |
| **5. End-to-End Orchestrator (`pipeline.py`)** | ❌ Missing | Wire modules together with logging, environment variable configuration (e.g. `GEMINI_API_KEY`), and output reports in CSV/JSON format sorted by Gemini confidence. |

*Note for future database integration: Keep pgvector migration schema ready to store image vectors in Supabase table columns (`logo_embedding` and `image_embedding` as `vector(512)`) and optimize queries using HNSW cosine indexes.*
