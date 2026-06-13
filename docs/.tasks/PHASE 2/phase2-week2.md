# Phase 2 — Week 2: Headless Browser Evidence Capture

> **Goal:** Integrate Playwright to automatically screenshot flagged URLs with verifiable metadata (timestamp, IP), and wire the evidence into the case management UI.

---

## Engineer A — Playwright Screenshot Service (Python Backend)

**Focus:** Build the headless browser service that captures full-page screenshots of flagged infringement URLs.

### Tasks
- [ ] Set up Python Playwright in the API environment — add `playwright` to backend dependencies.
- [ ] Implement `capture_evidence(url: string) -> EvidenceCapture` in `tracemark_api/services/screenshot.py` — launches headless browser, navigates to URL, takes full-page screenshot, resolves public IP via `https://api.ipify.org`, and records ISO timestamp.
- [ ] Output type: `EvidenceCapture` object/dict containing: `screenshot_bytes`, `url`, `captured_at`, `ip_address`, `page_title`, and `http_status`.
- [ ] Store screenshot to Supabase Storage bucket `evidence-screenshots` using `supabase.storage.from_('evidence-screenshots').upload(...)`.
- [ ] Add retry logic: 3 attempts with exponential backoff on navigation timeout.
- [ ] Write integration test: capture a live public URL (e.g. `https://example.com`), assert all metadata fields are populated.

### Test Command
```bash
pytest tests/test_screenshot.py
```

### Deliverable
`apps/api/src/tracemark_api/services/screenshot.py` + screenshot stored in Supabase Storage.

---

## Engineer B — Evidence Persistence & Gemini Infringement Analysis (Python Backend)

**Focus:** Persist captured evidence to Supabase and generate an AI-powered "Infringement Analysis" using Gemini.

### Tasks
- [ ] Run Supabase migration: `evidence` table with fields `id`, `infringement_id (FK)`, `screenshot_url`, `captured_at`, `ip_address`, `page_title`, `http_status`, `ai_analysis (jsonb)`.
- [ ] Implement `persist_evidence(capture: EvidenceCapture, infringement_id: str) -> dict` — insert row, link to infringement.
- [ ] Implement `generate_analysis(evidence: dict, trademark: dict) -> dict` in `tracemark_api/services/ai.py` — call Gemini 2.5 Flash API with a structured prompt containing: trademark details, infringing URL, page title, and extracted text. Return `{ "summary": str, "confidence": float, "infringing_elements": list[str], "recommendation": "takedown" | "escalate" | "dismiss" }`.
- [ ] Store `ai_analysis` JSON back to the `evidence` row in Supabase.
- [ ] Test: mock Gemini response, assert `AIAnalysis` shape is correct and persisted.

### Test Command
```bash
pytest tests/test_ai_analysis.py
```

### Deliverable
`supabase/migrations/YYYYMMDD_evidence.sql` + updated `apps/api/src/tracemark_api/services/ai.py`.

---

## Engineer C — Case Detail View UI (React Frontend)

**Focus:** Build the detailed case view that opens when a user clicks an alert, displaying all evidence and AI analysis.

### Tasks
- [ ] Create `/cases/$id` route in the frontend using TanStack Router — fetch infringement + evidence from new endpoints.
- [ ] Build `<CaseDetailView />` component with:
  - Infringer details panel (URL, platform, risk badge).
  - Screenshot evidence panel — display screenshot from Supabase Storage URL, overlay metadata chip (Timestamp, URL, IP Address).
  - AI Analysis panel — render `summary`, confidence meter (%), list of `infringing_elements`.
- [ ] Add three action buttons: **"Generate Takedown Notice"** (routes to Document Generator), **"Escalate to Counsel"** (updates status → `escalated`), **"Mark as Safe"** (updates status → `dismissed`), with optimistic UI updates.
- [ ] Create FastAPI endpoints `GET /api/v1/infringements/{id}` and `GET /api/v1/evidence/{infringement_id}`.
- [ ] Use loading skeletons while screenshot URL resolves from Supabase Storage.

### Test Command
```bash
npm run dev  # navigate to /cases/$mock-id
```

### Deliverable
`src/routes/cases.$id.tsx` + `src/components/cases/CaseDetailView.tsx` + FastAPI endpoints.

---

## Integration Point (End of Week 2)
- Engineer A's `capture_evidence()` is called by Engineer B's persistence layer when a new infringement is flagged.
- Engineer C's Case Detail page pulls live data from Engineer B's endpoints.
- **Full flow test:** trigger a mock scrape → flag an infringement → capture screenshot → view in UI with AI analysis.

---

## Definition of Done
- [ ] Screenshot captured and stored in Supabase Storage for a real URL.
- [ ] Evidence row with `ai_analysis` JSON visible in Supabase dashboard.
- [ ] Case Detail page renders screenshot + metadata + AI analysis with real data.
- [ ] All three action buttons trigger correct status changes (verified via Supabase dashboard).
