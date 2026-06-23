# Backend Tasks

This document contains all backend services, engines, databases, API endpoints, and migrations for Phase 2 and Phase 3.

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## Detection Engine Foundation

### Keyword/Image Matcher
| Task | Status | Notes |
|---|---|---|
| `keyword_matcher()` (Levenshtein fuzzy) | ✅ Done | `services/detection.py` — uses rapidfuzz `partial_ratio`, threshold=0.80 |
| `hash_matcher()` (pHash via ImageHash) | ❌ Missing | `detection.py` exists but no image hash matcher yet |
| Unit tests `test_matchers.py` | ❌ Missing | Not in `apps/api/tests/` |
| `MatchResult` Pydantic model | ✅ Done | Defined in `services/detection.py` |

### Risk Scorer & Persistence
| Task | Status | Notes |
|---|---|---|
| `infringements` Supabase migration | ✅ Done | `20260617000002_infringements.sql` — correct schema |
| `risk_scorer()` | ✅ Done | Implemented in `services/persistence.py` |
| `persist_infringement()` | ✅ Done | Implemented in `services/persistence.py` (upsert by `case_id+source_url`) |
| Integration tests `test_persistence.py` | ✅ Done | File exists in `apps/api/tests/` |
| `notification_sent_at` column (replaces `webhook_sent_at`) | ✅ Done | `20260618000001_notification_sent_at.sql` — partial index on NULL rows included |

---

## Headless Browser Evidence Capture

### Firecrawl Screenshot Service
| Task | Status | Notes |
|---|---|---|
| `screenshot.py` / `unified_scraper.py` evidence capture | ✅ Done | Firecrawl (`firecrawl_client.py`) + Playwright (`playwright_client.py`) both active. WebP compression added to `storage.py` (~76% smaller vs PNG) |
| Playwright added to backend deps | ✅ Done | `playwright_client.py` implemented by Gabriel |
| Supabase Storage bucket `evidence-screenshots` | ✅ Done | Auto-created by `_ensure_bucket()` in `storage.py` |
| `evidence` table migration | ✅ Done | `20260618000002_evidence.sql` — `infringement_id`, `screenshot_url`, `ai_analysis (jsonb)`, RLS enabled |
| `persist_evidence()` | ✅ Done | Implemented in `services/persistence.py` |

### Gemini AI Analysis
| Task | Status | Notes |
|---|---|---|
| `generate_analysis()` in `ai.py` | ⚠️ Partial | `ai.py` exists and calls Gemini, but operates on the full check-brand pipeline (not per-evidence row). No `AIAnalysis` schema returned per spec. |
| `ai_analysis (jsonb)` stored on evidence row | ⚠️ Partial | Column exists in `evidence` table; `persist_evidence()` accepts it — but nothing populates it yet |

---

## Batch Detection, OCR & Email Notifications

### Batch Detection & OCR
| Task | Status | Notes |
|---|---|---|
| `batch_detect()` with `asyncio.gather` | ❌ Missing | Runs scraping batches concurrently |
| Image OCR (pytesseract / Gemini vision) | ❌ Missing | Extracts text overlays from screenshots |
| Playwright user-agent rotation / random delays | ➖ Skipped | Not needed; handled natively by Firecrawl |
| Load test (50 listings, <30s) | ❌ Missing | — |
| `docs/phase2-detection-perf.md` | ❌ Missing | Performance logs |

### Email Notifications (replaced Slack/Zapier Webhooks)
| Task | Status | Notes |
|---|---|---|
| `send_email_notification()` in `notifications.py` | ❌ Missing | No `notifications.py` file |
| Integration tests `test_notifications.py` | ❌ Missing | — |

---

## Authentication & Payments

### Auth & RLS
| Task | Status | Notes |
|---|---|---|
| Google OAuth configured in Supabase | ⚠️ Unknown | Config in Supabase dashboard — can't verify from repo |
| `profiles` table + trigger | ✅ Done | `20260616000001_profiles.sql` — exact spec match |
| RLS policies on tables | ✅ Done | `20260617000001_profiles_rls.sql` + per-table policies |
| `GET /api/v1/me` endpoint | ✅ Done | `routes/auth.py` — validates Supabase JWT, returns `UserProfile` from `profiles` table |
| `pytest tests/test_auth.py` | ❌ Missing | — |

### Stripe Billing
| Task | Status | Notes |
|---|---|---|
| `POST /api/v1/billing/create-checkout-session` | ❌ Missing | — |
| `POST /api/v1/billing/create-portal-session` | ❌ Missing | — |
| `POST /api/v1/billing/webhook` (Stripe events) | ❌ Missing | — |

---

## Takedown Persistence & Editing API

### Takedown Enhancements
| Task | Status | Notes |
|---|---|---|
| `PUT /api/v1/monitoring/takedowns/{id}` endpoint | ❌ Missing | Update notice text and status (`pending`, `sent`, `acknowledged`) in `takedown_reports` table |
| Unit tests for `generate_takedown_reports` | ❌ Missing | Verify correct template rendering and registry mapping |
| Integration tests for takedown report updates | ❌ Missing | Test editing and status transitions in DB |

---

## Email Notification Delivery

### Notification Delivery Engine
| Task | Status | Notes |
|---|---|---|
| `notifications.py` — `send_email_notification()` | ❌ Missing | — |
| `dispatch_notifications()` for email delivery | ❌ Missing | — |
| `notification_deliveries` Supabase migration | ❌ Missing | — |
| `log_delivery()` + event triggers (new_infringement, takedown_generated, etc.) | ❌ Missing | — |
| `POST /api/v1/monitoring/takedowns/{id}/send-email` endpoint | ❌ Missing | Backend API supporting sending the notice text via email SMTP |
| `test_notifications.py` + `test_delivery_log.py` | ❌ Missing | — |

---

## Law Firm Mode

### Multi-client System & Organization Settings
| Task | Status | Notes |
|---|---|---|
| Law Firm custom email branding (firm name, logo) in notifications | ❌ Missing | Custom details attached to organization settings |
| `clients` Supabase migration + `client_id` FK on cases/infringements | ❌ Missing | — |
| Client CRUD endpoints (`routes/clients.py`) | ❌ Missing | — |
| `GET /api/v1/clients/{id}/billing` endpoint | ❌ Missing | — |
| Per-client RLS policies | ❌ Missing | Isolates client data |
