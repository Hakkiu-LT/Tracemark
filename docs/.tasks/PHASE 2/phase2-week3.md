# Phase 2 — Week 3: Polish, Edge Cases & End-to-End Integration

> **Goal:** Harden the detection + evidence pipeline, fix edge cases, and deliver a fully integrated, demo-ready Phase 2 system.

---

## Engineer A — Scraper Robustness & Detection Accuracy

**Focus:** Stress-test the detection engine with real brand data, fix edge cases, and improve matcher accuracy.

### Tasks
- [ ] Run keyword + image matcher against 10 different brand names from Supabase (use real Orbio World brands if available, otherwise generate test fixtures).
- [ ] Fix false-positive rate: tune Levenshtein threshold per platform (stricter for exact brand names, looser for descriptions).
- [ ] Add support for **image OCR** on screenshot thumbnails — extract visible text from screenshots using `tesseract.js`, feed into keyword matcher for a second-pass check.
- [ ] Implement `batchDetect(trademarks: Trademark[], listings: Listing[]): Promise<FlaggedListing[]>` — process all trademarks in parallel with `Promise.allSettled`, log failed items without crashing.
- [ ] Add Playwright screenshot retry specifically for bot-blocked pages (rotate user-agent strings, add random delay 1–3s).
- [ ] Write a load test: flag 50 listings across 5 brands, assert < 30s total runtime.

### Test Command
```bash
bun test packages/detection/src/matchers.test.ts --coverage
bun run packages/screenshot-service/src/load.test.ts
```

### Deliverable
Updated `matchers.ts` with OCR pass + `batchDetect` + load test results documented in `docs/phase2-detection-perf.md`.

---

## Engineer B — Confidence Scoring Refinement & Notification Webhooks

**Focus:** Improve AI analysis quality, add webhook triggers for Slack/Zapier, and harden the persistence layer.

### Tasks
- [ ] Refine `riskScorer`: weight `ai_analysis.confidence` into the final `risk_level` calculation (e.g. `HIGH` only if matcher score > 0.8 AND AI confidence > 0.75).
- [ ] Handle empty evidence gracefully: if screenshot fails (e.g. 404, bot block), mark evidence as `capture_failed` and still persist the infringement with `risk_level` based solely on keyword match.
- [ ] Build `sendWebhookNotification(infringement: Infringement): Promise<void>` — POST to configurable Slack webhook URL and Zapier webhook URL stored in env vars `SLACK_WEBHOOK_URL` / `ZAPIER_WEBHOOK_URL`.
- [ ] Slack payload format: brand name, risk level (with emoji 🔴🟡🟢), platform, infringing URL, link to Case Detail page.
- [ ] Write integration test mocking webhook endpoints with `msw` (Mock Service Worker).
- [ ] Add `webhook_sent_at` column to `infringements` table via migration.

### Test Command
```bash
bun test packages/detection/src/webhooks.test.ts
```

### Deliverable
`packages/detection/src/webhooks.ts` + `supabase/migrations/YYYYMMDD_webhook_sent_at.sql` + Slack notification firing on new HIGH-risk infringement.

---

## Engineer C — UI Polish, Filters, Error States & End-to-End Demo

**Focus:** Deliver a polished, demo-ready frontend for Phase 2 covering all new screens and edge case states.

### Tasks
- [ ] **Dashboard Alert Feed:**
  - Add filter bar: filter by Risk Level, Platform, Status, Date Range.
  - Add sorting: newest first / highest risk first.
  - Render real data from `GET /api/infringements` (replace all mock fixtures).
- [ ] **Case Detail View:**
  - Show `capture_failed` state with a warning banner when screenshot is unavailable.
  - Add "Retry Screenshot" button that calls `POST /api/evidence/retry/:infringement_id`.
  - Add case timeline sidebar showing status history changes.
- [ ] **Error & Loading States:**
  - Global error boundary with "Something went wrong — retry" UI.
  - Skeleton loaders on all data-fetching components.
  - Toast notifications on action success/failure (Takedown generated, Escalated, Dismissed).
- [ ] **End-to-End Demo Script:**
  - Document a clickable demo path in `docs/phase2-demo.md`: add brand → trigger mock scan → view flagged alert → open case → view screenshot + AI analysis → click "Generate Takedown Notice".
- [ ] Visual QA: test on mobile viewport (375px), tablet (768px), desktop (1440px).

### Test Command
```bash
bun run dev  # walk through demo script
```

### Deliverable
All UI components updated with real data, error states, and filters. `docs/phase2-demo.md` completed.

---

## Integration Point (End of Week 3 — Phase 2 Complete)
- Full pipeline live: scraper flags → matcher detects → Playwright captures evidence → Claude analyzes → Supabase persists → UI renders → Slack notified.
- **Final integration test:** run `batchDetect` for 2 brands, confirm 2+ infringements appear in the Alert Feed with screenshots, AI analysis, and a Slack notification received.

---

## Definition of Done — Phase 2 Complete
- [ ] Detection pipeline processes 10+ brands without unhandled errors.
- [ ] Screenshots stored for all non-blocked URLs; `capture_failed` handled gracefully.
- [ ] AI analysis JSON present on all evidence rows.
- [ ] Slack webhook fires on every new `HIGH` risk infringement.
- [ ] Dashboard Alert Feed and Case Detail View display 100% real data.
- [ ] All action buttons (Takedown, Escalate, Dismiss) update Supabase correctly.
- [ ] Demo script in `docs/phase2-demo.md` works end-to-end without errors.
- [ ] No TypeScript errors (`bun run typecheck` passes).
