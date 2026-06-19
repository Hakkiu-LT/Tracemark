# Phase 3 — Week 3: Polish, Law Firm Mode & Production-Ready Delivery

> **Goal:** Complete the Law Firm multi-client settings, harden all Phase 3 features, run end-to-end QA across all three phases, and deliver a production-ready Tracemark build.

---

## Engineer A — Document Quality & Law Firm PDF Branding (Python Backend)

**Focus:** Harden the document generation pipeline, handle all edge cases, and add law firm branding support to generated PDFs.

### Tasks
- [ ] Add **Law Firm branding** to the PDF generator: if `persona === 'law_firm'` (from org settings), inject `firm_name`, `firm_logo_url`, `firm_address`, and `bar_number` fields into the PDF header — pull from Supabase `org_settings`.
- [ ] Handle missing evidence gracefully: if screenshot is unavailable, render a "Screenshot unavailable — capture failed" notice block in the PDF template instead of a broken image.
- [ ] Add `generate_evidence_package(infringement_id: str) -> bytes` in `tracemark_api/services/document_generator.py` — compiles a single multi-page PDF containing: cover page (case summary), evidence screenshots, AI analysis, and the generated DMCA notice (use Python's `pypdf` or `PyPDF2` to merge pages).
- [ ] Implement document expiry: add `expires_at` column to `documents` table via Supabase migration — signed Storage URLs expire after 7 days; `get_signed_url()` regenerates on access if expired.
- [ ] Load-test the generator: generate 20 DMCA PDFs concurrently in Python, asserting all complete in < 60s without memory leaks.

### Test Command
```bash
pytest tests/test_document_generator.py
```

### Deliverable
Updated `document_generator.py` with branding + evidence package + `expires_at` migration + load test results documented in `docs/phase3-generator-perf.md`.

---

## Engineer B — Law Firm Client Management & Billing Data (Python Backend)

**Focus:** Build the Law Firm multi-client backend: client CRUD, per-client case isolation, and billing usage aggregation.

### Tasks
- [ ] Run Supabase migration: `clients` table with fields `id`, `organization_id (FK)`, `brand_name`, `contact_name`, `contact_email`, `trademark_numbers (text[])`, `active`, `created_at`. Add `client_id (FK → clients)` column to `cases` and `infringements` tables.
- [ ] Implement client CRUD endpoints in `apps/api/src/tracemark_api/routes/clients.py`: `POST /api/v1/clients`, `GET /api/v1/clients`, `PUT /api/v1/clients/{id}`, `DELETE /api/v1/clients/{id}` — all scoped to `organization_id` from the authenticated session.
- [ ] Add per-client RLS policies: `cases` and `infringements` rows are only readable when `client_id` matches the requesting org's client list.
- [ ] Implement `GET /api/v1/clients/{id}/billing` — returns `{ clientId, clientName, casesThisMonth: number, infringementsFound: number, takedownsSent: number, documentsGenerated: number }` aggregated from Supabase.
- [ ] Add `organization_id` to the Supabase JWT session claims so that all database queries are automatically tenant-scoped without manual filtering.

### Test Command
```bash
pytest tests/test_clients_rls.py
```

### Deliverable
`supabase/migrations/YYYYMMDD_clients.sql` + client CRUD routes in `apps/api/src/tracemark_api/routes/clients.py` + `GET /api/v1/clients/{id}/billing`.

---

## Engineer C — Law Firm Settings UI, Billing View & Final QA (React Frontend)

**Focus:** Build the conditional Law Firm Settings tab with client management and billing, complete the persona toggle, and run full end-to-end QA.

### Tasks
- [ ] **Persona Toggle:** wire the Brand Owner / Law Firm toggle in `/settings/general` to `org_settings.persona` in Supabase — persists across sessions. When toggled to "Law Firm", show the Clients tab in the sidebar; hide it for Brand Owner.
- [ ] **Law Firm Clients Tab** (`/settings/clients`): build `<ClientManagementTable />` — data table with columns: Client Name, Brand, Contact, Cases This Month, Takedowns, Status (Active/Inactive). Include "Add Client" modal (form with Name, Brand, Contact Email, Trademark Numbers). Include "Remove Client" with confirmation dialog.
- [ ] **Billing per Client** (`/settings/clients/:id/billing`): build `<ClientBillingCard />` — renders the 4 usage metrics from `GET /api/v1/clients/{id}/billing`. Add a "Export CSV" button that downloads the metrics as a `.csv` file.
- [ ] **End-to-End QA pass** — walk through and verify the complete user journey for both personas:
  - **Brand Owner flow:** Add brand → scan runs → infringement flagged → alert in feed → open case → view screenshot + AI analysis → generate DMCA PDF → send via Email → check notification delivery log.
  - **Law Firm flow**: Add client → same flow as above → billing card shows correct counts → remove client → confirm data is scoped correctly.
- [ ] Write `docs/phase3-demo.md` — step-by-step demo script for both personas, usable in a client presentation.

### Test Command
```bash
npm run dev  # walk through full QA script for both personas
```

### Deliverable
`src/routes/settings.clients.tsx` + `src/components/settings/ClientManagementTable.tsx` + `src/components/settings/ClientBillingCard.tsx` + `docs/phase3-demo.md` completed.

---

## Integration Point (End of Week 3 — Phase 3 & Full MVP Complete)
- Law Firm persona: adding a client auto-scopes all new infringements and cases to that `client_id` — verified via RLS tests.
- Full production pipeline live: Brand is added → scraper runs → matcher detects → Playwright captures evidence → Gemini analyzes → document generated → Email notification delivered → Law firm billing updated.

---

## Definition of Done — Phase 3 & Full MVP Complete
- [ ] DMCA and C&D templates generate valid PDF and Docx files with all metadata fields populated.
- [ ] Evidence package PDF compiles (cover + screenshots + analysis) without errors.
- [ ] Law Firm PDF branding injects firm name, logo, and bar number correctly.
- [ ] Email notifications fire on all four event types with correct templates.
- [ ] `notification_deliveries` table has a row for every dispatched event.
- [ ] Client CRUD endpoints are RLS-scoped — cross-org data leakage test passes.
- [ ] Billing card shows accurate aggregated counts per client.
- [ ] Both persona demo flows complete without errors (`docs/phase3-demo.md` script).
- [ ] No compilation/build errors on backend or frontend.
