# Backend Tasks Roadmap

This document outlines the priority ordering for backend services, engines, databases, API endpoints, and migrations for Phase 2 and Phase 3. 

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## 1. Core Detection & Verification (High Priority)
*These tasks complete the foundational matchers and image inspection pipeline.*

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

## 2. Scraping Concurrency & Performance
*Builds on the core detection modules to handle concurrent batch runs.*

| Task | Status | Notes |
|---|---|---|
| `screenshot.py` / `unified_scraper.py` evidence capture | ✅ Done | Firecrawl + Playwright active. WebP compression added to `storage.py` (~76% smaller) |
| Playwright added to backend deps | ✅ Done | `playwright_client.py` implemented |
| Supabase Storage bucket `evidence-screenshots` | ✅ Done | Auto-created by `_ensure_bucket()` in `storage.py` |
| `evidence` table migration | ✅ Done | `20260618000002_evidence.sql` — RLS enabled |
| `persist_evidence()` | ✅ Done | Implemented in `services/persistence.py` |
| `batch_detect()` with `asyncio.gather` | ✅ Done | Implemented concurrently using asyncio.to_thread wrappers |
| Load test (50 listings, <30s) | ✅ Done | Verified ~12.8x speedup (sequential ~6.5s vs concurrent ~0.5s) |
| `docs/phase2-detection-perf.md` | ✅ Done | Documented performance log |


---

## 3. Takedown Management & Database Persistence
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

## 4. Email Notification Infrastructure
*Handles email delivery tracking and automated dispatches once takedowns are initiated.*

| Task | Status | Notes |
|---|---|---|
| `notification_deliveries` Supabase migration | ❌ Missing | Database schema for notification history and delivery statuses |
| `notifications.py` — `send_email_notification()` | ❌ Missing | Core SMTP email sending function |
| `dispatch_notifications()` for email delivery | ❌ Missing | Main event dispatcher for outbound notifications |
| `log_delivery()` + event triggers (new_infringement, etc.) | ❌ Missing | Tracks email logs and maps them to triggers |
| `POST /api/v1/monitoring/takedowns/{id}/send-email` endpoint | ❌ Missing | Backend API supporting sending the notice text via email SMTP |
| `test_notifications.py` + `test_delivery_log.py` | ❌ Missing | Integration testing for the notification module |

---

## 5. Security, Admin & Payments
*Gatekeeps resources and sets up payment/billing sessions.*

| Task | Status | Notes |
|---|---|---|
| `profiles` table + trigger | ✅ Done | `20260616000001_profiles.sql` — exact spec match |
| RLS policies on tables | ✅ Done | `20260617000001_profiles_rls.sql` + per-table policies |
| `GET /api/v1/me` endpoint | ✅ Done | `routes/auth.py` — validates Supabase JWT, returns `UserProfile` |
| Google OAuth configured in Supabase | ⚠️ Unknown | Config in Supabase dashboard |
| Restrict `/api/v1/usage-stats` to allowed admin emails | ❌ Missing | Validate user email matches allowed admin list |
| `pytest tests/test_auth.py` | ❌ Missing | Auth integration tests |
| `POST /api/v1/billing/create-checkout-session` | ❌ Missing | Stripe checkout session creation |
| `POST /api/v1/billing/create-portal-session` | ❌ Missing | Stripe billing portal redirect session |
| `POST /api/v1/billing/webhook` | ❌ Missing | Handle Stripe events and update organization subscription status |

---

## 6. Phase 3: Advanced Features & Law Firm Mode
*Scaling the platform to multi-client usage and advanced vector similarity search.*

| Task | Status | Notes |
|---|---|---|
| Neural/Vector Matcher (CLIP + pgvector) | ❌ Missing | Advanced logo/visual similarity search using CLIP embeddings and Supabase pgvector |
| `clients` Supabase migration + `client_id` FK on cases/infringements | ❌ Missing | Database migration to isolate client accounts under a single org |
| Client CRUD endpoints (`routes/clients.py`) | ❌ Missing | Management endpoints for clients |
| `GET /api/v1/clients/{id}/billing` endpoint | ❌ Missing | Specific billing/usage metrics per client |
| Per-client RLS policies | ❌ Missing | Database level isolation of client data |
| Law Firm custom email branding (firm name, logo) | ❌ Missing | Customize notification styles based on active firm/organization settings |

---

## 7. Geo-Targeted Scans & Proxy Location Management
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

