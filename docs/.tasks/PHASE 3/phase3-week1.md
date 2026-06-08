# Phase 3 — Week 1: Document Generation Pipeline

> **Goal:** Build the core document generation engine that auto-populates DMCA notices and Cease & Desist letters from templates, using case metadata and evidence collected in Phase 2.

---

## Engineer A — Template Engine & PDF/Docx Generator

**Focus:** Build the backend service that fills legal document templates with case metadata and exports them as PDF and Docx files.

### Tasks
- [ ] Create `packages/document-generator` — install `docxtemplater` + `pizzip` (Docx) and `puppeteer` (HTML→PDF).
- [ ] Write two Handlebars-compatible `.docx` template files in `packages/document-generator/templates/`:
  - `dmca-notice.docx` — with placeholders: `{{brandName}}`, `{{trademarkNumber}}`, `{{infringingUrl}}`, `{{platformName}}`, `{{evidenceScreenshotUrl}}`, `{{capturedAt}}`, `{{ipAddress}}`, `{{senderName}}`, `{{senderEmail}}`, `{{date}}`.
  - `cease-and-desist.docx` — same fields plus `{{legalBasis}}`, `{{demandDeadlineDays}}`.
- [ ] Implement `generateDocx(templateName: 'dmca' | 'cease-desist', data: DocumentData): Promise<Buffer>` — use `docxtemplater` to fill and return the populated buffer.
- [ ] Implement `generatePdf(templateName: 'dmca' | 'cease-desist', data: DocumentData): Promise<Buffer>` — render template to styled HTML, then convert to PDF via Puppeteer.
- [ ] Output type: `DocumentData { brandName: string; trademarkNumber?: string; infringingUrl: string; platformName: string; evidenceScreenshotUrl: string; capturedAt: string; ipAddress: string; senderName: string; senderEmail: string; legalBasis?: string; demandDeadlineDays?: number }`.
- [ ] Write unit tests: generate both templates as Docx and PDF, assert buffer is non-empty and mime type matches.

### Test Command
```bash
bun test packages/document-generator/src/generator.test.ts
```

### Deliverable
`packages/document-generator/src/generator.ts` + both `.docx` templates + unit tests passing locally.

---

## Engineer B — Document Metadata & Supabase Persistence

**Focus:** Design the `documents` table, persist every generated document to Supabase Storage, and wire the generation trigger from an infringement case.

### Tasks
- [ ] Run Supabase migration: `documents` table with fields `id`, `infringement_id (FK → infringements)`, `document_type` (`dmca | cease-desist`), `file_url` (Supabase Storage), `file_format` (`pdf | docx`), `generated_at`, `sent_at`, `status` (`draft | sent | acknowledged`).
- [ ] Create Supabase Storage bucket `legal-documents` (private, authenticated access only).
- [ ] Implement `persistDocument(infringementId: string, buffer: Buffer, type: DocumentType, format: 'pdf' | 'docx'): Promise<Document>` — upload buffer to `legal-documents/{infringement_id}/{type}-{timestamp}.{ext}`, insert metadata row, return full `Document` record.
- [ ] Implement `getDocumentsByInfringement(infringementId: string): Promise<Document[]>` — fetch all documents for a case, sorted newest-first.
- [ ] Write integration tests against local Supabase: generate → persist → fetch back and assert `file_url` is a valid signed URL.

### Test Command
```bash
bun test packages/document-generator/src/persistence.test.ts
```

### Deliverable
`supabase/migrations/YYYYMMDD_documents.sql` + `packages/document-generator/src/persistence.ts`.

---

## Engineer C — Document Generator UI (Side-by-Side View)

**Focus:** Build the Document Generator page with a live editable letter preview on the left and the evidence package on the right, matching the MarkGuard design system.

### Tasks
- [ ] Create `/documents/generate` route — accepts `?infringement_id=` query param, fetches infringement + evidence from existing API endpoints.
- [ ] Build `<DocumentGeneratorView />` component with two-column layout:
  - **Left panel:** Editable `<textarea>` pre-filled with AI-generated letter text (fetched from `GET /api/documents/preview?infringement_id=&type=dmca`). Includes a type selector toggle: `DMCA Notice` / `Cease & Desist`.
  - **Right panel:** Evidence package — screenshot thumbnail, metadata table (URL, IP, Timestamp), risk badge, and AI analysis summary from Phase 2.
- [ ] Add `<DocumentActions />` bar at the bottom: **"Download PDF"** button (calls `POST /api/documents/generate` with `format: pdf`), **"Download Docx"** button (`format: docx`), **"Send via Webhook"** button (stubbed for Week 2).
- [ ] Create `GET /api/documents/preview` endpoint — builds `DocumentData` from the infringement + evidence rows, renders template as plain text string (no binary yet), returns JSON `{ letterText: string, metadata: DocumentData }`.
- [ ] Wire `useDocumentGenerator()` hook to manage type toggle state, edits to the letter text, and download calls.

### Test Command
```bash
bun run dev  # navigate to /documents/generate?infringement_id=<mock-id>
```

### Deliverable
`src/pages/documents/generate.tsx` + `src/components/documents/DocumentGeneratorView.tsx` + `GET /api/documents/preview` endpoint.

---

## Integration Point (End of Week 1)
- Engineer C's "Download PDF/Docx" buttons call Engineer A's generator via Engineer B's persistence layer.
- **Shared contract:** agree on `DocumentData` TypeScript type in `packages/document-generator/src/types.ts` on Day 1 before parallel work begins.
- Full flow smoke test: open `/documents/generate?infringement_id=<real-id>` → preview letter text renders → click "Download PDF" → file downloads.

---

## Definition of Done
- [ ] Both `.docx` templates fill correctly with `DocumentData` and produce non-empty buffers.
- [ ] PDF renders with correct content (verify by opening the file).
- [ ] `documents` Supabase migration applied, file uploaded to `legal-documents` bucket.
- [ ] Document Generator page loads with pre-filled letter text and evidence panel.
- [ ] Download PDF and Download Docx buttons produce valid files.
- [ ] All three engineers have reviewed and agreed on `DocumentData` type.
