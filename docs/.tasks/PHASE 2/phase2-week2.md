# Phase 2 — Week 2: Headless Browser Evidence Capture

> **Goal:** Integrate Playwright to automatically screenshot flagged URLs with verifiable metadata (timestamp, IP), and wire the evidence into the case management UI.

---

## Engineer A — Playwright Screenshot Service

**Focus:** Build the headless browser microservice that captures full-page screenshots of flagged infringement URLs.

### Tasks
- [ ] Set up Playwright in `packages/screenshot-service` — install `@playwright/test`, configure headless Chromium.
- [ ] Implement `captureEvidence(url: string): Promise<EvidenceCapture>` — launches browser, navigates to URL, takes full-page screenshot, resolves public IP via `https://api.ipify.org`, records ISO timestamp.
- [ ] Output type: `EvidenceCapture { screenshotBuffer: Buffer; url: string; capturedAt: string; ipAddress: string; pageTitle: string; httpStatus: number }`.
- [ ] Store screenshot to Supabase Storage bucket `evidence-screenshots` using `supabase.storage.from('evidence-screenshots').upload(...)`.
- [ ] Add retry logic: 3 attempts with exponential backoff on navigation timeout.
- [ ] Write integration test: capture a live public URL (e.g. `https://example.com`), assert all metadata fields are populated.

### Test Command
```bash
bun run packages/screenshot-service/src/capture.test.ts
```

### Deliverable
`packages/screenshot-service/src/capture.ts` + screenshot stored in Supabase Storage.

---

## Engineer B — Evidence Persistence & AI Infringement Analysis

**Focus:** Persist captured evidence to Supabase and generate an AI-powered "Infringement Analysis" using Claude.

### Tasks
- [ ] Run Supabase migration: `evidence` table with fields `id`, `infringement_id (FK)`, `screenshot_url`, `captured_at`, `ip_address`, `page_title`, `http_status`, `ai_analysis (jsonb)`.
- [ ] Implement `persistEvidence(capture: EvidenceCapture, infringementId: string): Promise<Evidence>` — insert row, link to infringement.
- [ ] Implement `generateAnalysis(evidence: Evidence, trademark: Trademark): Promise<AIAnalysis>` — call Claude API with a structured prompt containing: trademark details, infringing URL, page title, extracted text. Return `{ summary: string; confidence: number; infringingElements: string[]; recommendation: 'takedown' | 'escalate' | 'dismiss' }`.
- [ ] Store `ai_analysis` JSON back to the `evidence` row.
- [ ] Test: mock Claude response, assert `AIAnalysis` shape is correct and persisted.

### Test Command
```bash
bun test packages/detection/src/analysis.test.ts
```

### Deliverable
`supabase/migrations/YYYYMMDD_evidence.sql` + `packages/detection/src/analysis.ts`.

---

## Engineer C — Case Detail View UI

**Focus:** Build the detailed case view that opens when a user clicks an alert, displaying all evidence and AI analysis.

### Tasks
- [ ] Create `/cases/[id]` route in the frontend — fetch infringement + evidence from new endpoints.
- [ ] Build `<CaseDetailView />` component with:
  - Infringer details panel (URL, platform, risk badge).
  - Screenshot evidence panel — display screenshot from Supabase Storage URL, overlay metadata chip (Timestamp, URL, IP Address).
  - AI Analysis panel — render `summary`, confidence meter (%), list of `infringingElements`.
- [ ] Add three action buttons: **"Generate Takedown Notice"** (routes to Document Generator), **"Escalate to Counsel"** (updates status → `escalated`), **"Mark as Safe"** (updates status → `dismissed`), with optimistic UI updates.
- [ ] Create `GET /api/infringements/:id` and `GET /api/evidence/:infringement_id` endpoints.
- [ ] Use loading skeletons while screenshot URL resolves from Supabase Storage.

### Test Command
```bash
bun run dev  # navigate to /cases/[mock-id]
```

### Deliverable
`src/pages/cases/[id].tsx` + `src/components/cases/CaseDetailView.tsx` + API routes.

---

## Integration Point (End of Week 2)
- Engineer A's `captureEvidence()` is called by Engineer B's persistence layer when a new infringement is flagged.
- Engineer C's Case Detail page pulls live data from Engineer B's endpoints.
- **Full flow test:** trigger a mock scrape → flag an infringement → capture screenshot → view in UI with AI analysis.

---

## Definition of Done
- [ ] Screenshot captured and stored in Supabase Storage for a real URL.
- [ ] Evidence row with `ai_analysis` JSON visible in Supabase dashboard.
- [ ] Case Detail page renders screenshot + metadata + AI analysis with real data.
- [ ] All three action buttons trigger correct status changes (verified via Supabase dashboard).
