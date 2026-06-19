# Phase 2 & Phase 3 — Backend Tasks

This document contains all backend services, engines, databases, API endpoints, and migrations for Phase 2 and Phase 3.

> Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## Phase 2 — Week 1: Detection Engine Foundation

### Keyword/Image Matcher
| Task | Status | Notes |
|---|---|---|
| `keyword_matcher()` (Levenshtein fuzzy) | ❌ Missing | No `detection.py` file exists |
| `hash_matcher()` (pHash via ImageHash) | ❌ Missing | No `detection.py` file exists |
| Unit tests `test_matchers.py` | ❌ Missing | Not in `apps/api/tests/` |
| `MatchResult` Pydantic model | ❌ Missing | — |

### Risk Scorer & Persistence
| Task | Status | Notes |
|---|---|---|
| `infringements` Supabase migration | ✅ Done | `20260617000002_infringements.sql` — correct schema |
| `risk_scorer()` | ✅ Done | Implemented in `services/persistence.py` |
| `persist_infringement()` | ✅ Done | Implemented in `services/persistence.py` (upsert by `case_id+source_url`) |
| Integration tests `test_persistence.py` | ✅ Done | File exists in `apps/api/tests/` |
| `notification_sent_at` column (replaces `webhook_sent_at`) | ❌ Missing | Needs a migration script |

---

## Phase 2 — Week 2: Headless Browser Evidence Capture

### Firecrawl Screenshot Service
| Task | Status | Notes |
|---|---|---|
| `screenshot.py` / `unified_scraper.py` evidence capture | ❌ Missing | Firecrawl integrated but evidence screenshot pipeline not fully active |
| Playwright added to backend deps | ➖ Skipped | Skipped in favor of Firecrawl API |
| Supabase Storage bucket `evidence-screenshots` | ❌ Unknown | No migration; may be configured manually |
| `evidence` table migration | ❌ Missing | Only `infringements_screenshot` column added via `20260617000003_infringements_screenshot.sql` — no full `evidence` table |
| `persist_evidence()` | ❌ Missing | — |

### Gemini AI Analysis
| Task | Status | Notes |
|---|---|---|
| `generate_analysis()` in `ai.py` | ⚠️ Partial | `ai.py` exists and calls Gemini, but it operates on the full check-brand pipeline (not evidence-linked infringement analysis). No `AIAnalysis` schema returned per the spec. |
| `ai_analysis (jsonb)` stored on evidence row | ❌ Missing | — |

---

## Phase 2 — Week 3: Batch Detection, OCR & Email Notifications

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

## Phase 2 — Week 4: Authentication & Payments

### Auth & RLS
| Task | Status | Notes |
|---|---|---|
| Google OAuth configured in Supabase | ⚠️ Unknown | Config in Supabase dashboard — can't verify from repo |
| `profiles` table + trigger | ✅ Done | `20260616000001_profiles.sql` — exact spec match |
| RLS policies on tables | ✅ Done | `20260617000001_profiles_rls.sql` + per-table policies |
| `GET /api/v1/me` endpoint | ❌ Missing | No `routes/auth.py` |
| `pytest tests/test_auth.py` | ❌ Missing | — |

### Stripe Billing
| Task | Status | Notes |
|---|---|---|
| `POST /api/v1/billing/create-checkout-session` | ❌ Missing | — |
| `POST /api/v1/billing/create-portal-session` | ❌ Missing | — |
| `POST /api/v1/billing/webhook` (Stripe events) | ❌ Missing | — |

---

## Phase 3 — Week 1: Document Generation Pipeline

### Legal Document Generator
| Task | Status | Notes |
|---|---|---|
| `document_generator.py` with `generate_docx()` + `generate_pdf()` | ❌ Missing | A `takedown.py` exists that generates Gemini-written takedown text, but no PDF/Docx export |
| DMCA + C&D `.docx` templates | ❌ Missing | No `tracemark_api/templates/` directory |
| `documents` Supabase migration | ❌ Missing | — |
| Supabase Storage bucket `legal-documents` | ❌ Missing | — |
| `persist_document()` / `get_documents_by_infringement()` | ❌ Missing | — |
| Unit tests `test_document_generator.py` | ❌ Missing | — |

---

## Phase 3 — Week 2: Email Notification Delivery

### Notification Delivery Engine
| Task | Status | Notes |
|---|---|---|
| `notifications.py` — `send_email_notification()` | ❌ Missing | — |
| `dispatch_notifications()` for email delivery | ❌ Missing | — |
| `notification_deliveries` Supabase migration | ❌ Missing | — |
| `log_delivery()` + event triggers (new_infringement, takedown_generated, etc.) | ❌ Missing | — |
| `test_notifications.py` + `test_delivery_log.py` | ❌ Missing | — |

---

## Phase 3 — Week 3: Law Firm Mode

### Multi-client System & PDF Customization
| Task | Status | Notes |
|---|---|---|
| Law Firm PDF branding (firm name, logo, bar number) | ❌ Missing | PDF generation doesn't exist yet |
| `generate_evidence_package()` multi-page PDF | ❌ Missing | Merges case details, screenshot, and notice |
| `expires_at` on `documents` table + signed URL regeneration | ❌ Missing | URL lifetime security management |
| `clients` Supabase migration + `client_id` FK on cases/infringements | ❌ Missing | — |
| Client CRUD endpoints (`routes/clients.py`) | ❌ Missing | — |
| `GET /api/v1/clients/{id}/billing` endpoint | ❌ Missing | — |
| Per-client RLS policies | ❌ Missing | Isolates client data |
