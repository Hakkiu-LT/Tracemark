# Phase 2 — Week 3: Polish, Edge Cases & End-to-End Integration

> **Goal:** Harden the detection + evidence pipeline, fix edge cases, and deliver a fully integrated, demo-ready Phase 2 system.

---

## Engineer A — Scraper Robustness & OCR (Python Backend)

**Focus:** Stress-test the detection engine with real brand data, fix edge cases, and improve matcher accuracy.

### Tasks
- [ ] Run keyword + image matcher against 10 different brand names from Supabase (use real brands or test fixtures).
- [ ] Fix false-positive rate: tune Levenshtein threshold per platform (stricter for exact brand names, looser for descriptions).
- [ ] Add support for **image OCR** on screenshots — extract text from screenshot buffers using Python's `pytesseract` or feed the screenshot directly into a Gemini 2.5 Flash multimodal vision call to extract visible text.
- [ ] Implement `batch_detect(trademarks: list[dict], listings: list[dict]) -> list[dict]` — process all trademarks concurrently in Python using `asyncio.gather`, logging failed items without crashing.
- [ ] Add Playwright browser retry specifically for bot-blocked pages (rotate user-agents, add random delays 1–3s).
- [ ] Write a load test: flag 50 listings across 5 brands, assert < 30s total runtime.

### Test Command
```bash
pytest tests/test_matchers.py --cov=tracemark_api
```

### Deliverable
Updated `detection.py` with OCR vision pass + `batch_detect` + load test results documented in `docs/phase2-detection-perf.md`.

---

## Engineer B — Risk Scoring & Notification Webhooks (Python Backend)

**Focus:** Improve AI analysis quality, add webhook triggers for Slack/Zapier, and harden the persistence layer.

### Tasks
- [ ] Refine `risk_scorer`: weight `ai_analysis.confidence` into the final `risk_level` calculation (e.g. `HIGH` only if matcher score > 0.8 AND AI confidence > 0.75).
- [ ] Handle empty evidence gracefully: if screenshot fails (e.g. 404, bot block), mark evidence status as `capture_failed` and still persist the infringement with a risk level based solely on keyword matches.
- [ ] Build `send_slack_notification(infringement: dict) -> None` and `send_zapier_trigger(infringement: dict) -> None` in `tracemark_api/services/webhooks.py` using `requests` or `httpx` against webhook URLs configured in environment variables.
- [ ] Slack payload format: brand name, risk level (with emoji 🔴🟡🟢), platform, infringing URL, link to Case Detail page.
- [ ] Write integration tests using a Python mocking library (e.g. `responses` or `pytest-mock`) to intercept outbound HTTP calls.
- [ ] Add `webhook_sent_at` column to `infringements` table via Supabase migration.

### Test Command
```bash
pytest tests/test_webhooks.py
```

### Deliverable
`apps/api/src/tracemark_api/services/webhooks.py` + `supabase/migrations/YYYYMMDD_webhook_sent_at.sql` + Slack notifications firing on new HIGH-risk infringements.

---

## Engineer C — UI Polish, Filters, Error States & End-to-End Demo (React Frontend)

**Focus:** Deliver a polished, demo-ready frontend for Phase 2 covering all new screens and edge case states.

### Tasks
- [ ] **Dashboard Alert Feed:**
  - Add filter bar: filter by Risk Level, Platform, Status, Date Range.
  - Add sorting: newest first / highest risk first.
  - Render real data from `GET /api/v1/infringements` (replace all mock fixtures).
- [ ] **Case Detail View:**
  - Show `capture_failed` state with a warning banner when screenshot is unavailable.
  - Add "Retry Screenshot" button that calls `POST /api/v1/evidence/retry/{infringement_id}`.
  - Add case timeline sidebar showing status history changes.
- [ ] **Error & Loading States:**
  - Global error boundary with "Something went wrong — retry" UI.
  - Skeleton loaders on all data-fetching components.
  - Toast notifications on action success/failure (Takedown generated, Escalated, Safe).
- [ ] **End-to-End Demo Script:**
  - Document a clickable demo path in `docs/phase2-demo.md`: add brand → trigger scan → view flagged alert → open case → view screenshot + AI analysis → click "Generate Takedown Notice".

### Test Command
```bash
npm run dev  # walk through demo script
```

### Deliverable
All React UI components updated with real data, error states, and filters. `docs/phase2-demo.md` completed.

---

## Integration Point (End of Week 3 — Phase 2 Complete)
- Full pipeline live: scraper flags → matcher detects → Playwright captures evidence → Gemini analyzes → Supabase persists → UI renders → Slack/Zapier notified.
- **Final integration test**: run `batch_detect` for 2 brands, confirm 2+ infringements appear in the Alert Feed with screenshots, AI analysis, and a Slack notification received.

---

## Definition of Done — Phase 2 Complete
- [ ] Detection pipeline processes 10+ brands without unhandled errors.
- [ ] Screenshots stored for all non-blocked URLs; `capture_failed` handled gracefully.
- [ ] AI analysis JSON present on all evidence rows.
- [ ] Slack webhook fires on every new `HIGH` risk infringement.
- [ ] Dashboard Alert Feed and Case Detail View display 100% real data.
- [ ] All action buttons (Takedown, Escalate, Dismiss) update Supabase correctly.
- [ ] Demo script in `docs/phase2-demo.md` works end-to-end without errors.
