# Phase 3 — Week 3: Polish, Law Firm Mode & Production-Ready Delivery

> **Goal:** Complete the Law Firm multi-client settings, harden all Phase 3 features, run end-to-end QA across all three phases, and deliver a production-ready MarkGuard build.

---

## Engineer A — Document Quality, Edge Cases & Law Firm PDF Branding

**Focus:** Harden the document generation pipeline, handle all edge cases, and add law firm branding support to generated PDFs.

### Tasks
- [ ] Add **Law Firm branding** to the PDF template: if `persona === 'law_firm'` (from org settings), inject `firmName`, `firmLogoUrl`, `firmAddress`, and `barNumber` fields into the PDF header — pull from `org_settings` table.
- [ ] Handle missing evidence gracefully: if `evidenceScreenshotUrl` is null (`capture_failed` from Phase 2), render a "Screenshot unavailable — capture failed" notice block in the PDF instead of a broken image.
- [ ] Add `generateEvidencePackage(infringementId: string): Promise<Buffer>` — compiles a single multi-page PDF containing: cover page (case summary), evidence screenshots (one per page), AI analysis, and the generated DMCA notice. Uses `pdf-lib` to merge pages.
- [ ] Implement document expiry: add `expires_at` column to `documents` table (migration) — signed Supabase Storage URLs expire after 7 days; `getSignedUrl()` regenerates on access if expired.
- [ ] Load-test the generator: generate 20 DMCA PDFs concurrently, assert all complete in < 60s and no memory leaks (use `--expose-gc` in Bun).
- [ ] Write tests for the `generateEvidencePackage` function: assert page count ≥ 3 and all metadata fields appear in the PDF text layer.

### Test Command
```bash
bun test packages/document-generator/src/package.test.ts
bun run packages/document-generator/src/load-test.ts
```

### Deliverable
Updated `generator.ts` with branding + evidence package + `expires_at` migration + load test results in `docs/phase3-generator-perf.md`.

---

## Engineer B — Law Firm Client Management & Billing Data

**Focus:** Build the Law Firm multi-client backend: client CRUD, per-client case isolation, and billing usage aggregation.

### Tasks
- [ ] Run Supabase migration: `clients` table with fields `id`, `organization_id (FK)`, `brand_name`, `contact_name`, `contact_email`, `trademark_numbers (text[])`, `active`, `created_at`. Add `client_id (FK → clients)` column to `cases` and `infringements` tables.
- [ ] Implement client CRUD endpoints: `POST /api/clients`, `GET /api/clients`, `PUT /api/clients/:id`, `DELETE /api/clients/:id` — all scoped to `organization_id` from the authenticated session.
- [ ] Add per-client RLS policies: `cases` and `infringements` rows are only readable when `client_id` matches the requesting org's client list.
- [ ] Implement `GET /api/clients/:id/billing` — returns `{ clientId, clientName, casesThisMonth: number, infringementsFound: number, takedownsSent: number, documentsGenerated: number }` aggregated from Supabase.
- [ ] Add `organization_id` to the Supabase JWT session (via custom claims in the Auth hook) so all queries are automatically tenant-scoped without manual filtering.
- [ ] Write integration tests: create two org accounts → add clients to each → confirm org A cannot read org B's clients or cases (RLS enforcement test).

### Test Command
```bash
bun test packages/integrations/src/rls.test.ts
```

### Deliverable
`supabase/migrations/YYYYMMDD_clients.sql` + client CRUD routes in `apps/api/routes/clients.ts` + `GET /api/clients/:id/billing` + RLS tests passing.

---

## Engineer C — Law Firm Settings UI, Billing View & Final QA

**Focus:** Build the conditional Law Firm Settings tab with client management and billing, complete the persona toggle, and run full end-to-end QA across all three phases.

### Tasks
- [ ] **Persona Toggle:** wire the Brand Owner / Law Firm toggle in `/settings/general` to `org_settings.persona` in Supabase — persists across sessions. When toggled to "Law Firm", show the Clients tab in the sidebar; hide it for Brand Owner.
- [ ] **Law Firm Clients Tab** (`/settings/clients`): build `<ClientManagementTable />` — data table with columns: Client Name, Brand, Contact, Cases This Month, Takedowns, Status (Active/Inactive). Include "Add Client" modal (form with Name, Brand, Contact Email, Trademark Numbers). Include "Remove Client" with confirmation dialog.
- [ ] **Billing per Client** (`/settings/clients/:id/billing`): build `<ClientBillingCard />` — renders the 4 usage metrics from `GET /api/clients/:id/billing` in a clean card grid. Add a "Export CSV" button that downloads the metrics as a `.csv` file.
- [ ] **End-to-End QA pass** — walk through and verify the complete user journey for both personas:
  - **Brand Owner flow:** Add brand → scan runs → infringement flagged → alert in feed → open case → view screenshot + AI analysis → generate DMCA PDF → send via Slack webhook → check delivery log.
  - **Law Firm flow:** Add client → same flow as above → billing card shows correct counts → remove client → confirm data is scoped correctly.
- [ ] Fix any regressions found during QA — coordinate with A and B for backend fixes.
- [ ] Write `docs/phase3-demo.md` — step-by-step demo script for both personas, usable in a client presentation.

### Test Command
```bash
bun run dev  # walk through full QA script for both personas
```

### Deliverable
`src/pages/settings/clients.tsx` + `src/components/settings/ClientManagementTable.tsx` + `src/components/settings/ClientBillingCard.tsx` + `docs/phase3-demo.md` completed.

---

## Integration Point (End of Week 3 — Phase 3 & Full MVP Complete)
- Law Firm persona: adding a client auto-scopes all new infringements and cases to that `client_id` — verified via RLS tests.
- Full production pipeline live: Brand is added → scraper runs → matcher detects → Playwright captures evidence → Gemini analyzes → document generated → Slack notified → Law firm billing updated.
- **Final MVP integration test:** create one Brand Owner org and one Law Firm org with 2 clients → run `batchDetect` for both → confirm complete isolation between orgs in Supabase → confirm Slack fires once per HIGH infringement → confirm PDF downloads correctly for each persona.

---

## Definition of Done — Phase 3 & Full MVP Complete
- [ ] DMCA and C&D templates generate valid PDF and Docx files with all metadata fields populated.
- [ ] Evidence package PDF compiles (cover + screenshots + analysis) without errors.
- [ ] Law Firm PDF branding injects firm name, logo, and bar number correctly.
- [ ] Slack and Zapier webhooks fire on all four event types with correct payloads.
- [ ] `webhook_deliveries` table has a row for every dispatched event.
- [ ] Client CRUD endpoints are RLS-scoped — cross-org data leakage test passes.
- [ ] Billing card shows accurate aggregated counts per client.
- [ ] Both persona demo flows complete without errors (`docs/phase3-demo.md` script).
- [ ] No TypeScript errors (`bun run typecheck` passes on full repo).
- [ ] No unhandled promise rejections in production build (`bun run build` is clean).
