# Phase 3 — Week 1: Document Generation Pipeline

> **Goal:** Build the core document generation engine that auto-populates DMCA notices and Cease & Desist letters from templates, using case metadata and evidence collected in Phase 2.

---

## Engineer A — Template Engine & PDF/Docx Generator (Python Backend)

**Focus:** Build the backend service that fills legal document templates with case metadata and exports them as PDF and Docx files.

### Tasks
- [ ] Set up document dependencies in the Python backend (e.g. `python-docx` for word generation and `xhtml2pdf` or `reportlab` for HTML→PDF rendering).
- [ ] Write two legal templates in `tracemark_api/templates/`:
  - `dmca_notice.docx` (placeholders: `{{brand_name}}`, `{{trademark_number}}`, `{{infringing_url}}`, `{{platform_name}}`, `{{captured_at}}`, `{{ip_address}}`, `{{sender_name}}`, `{{sender_email}}`, `{{date}}`).
  - `cease_and_desist.docx` (same fields plus `{{legal_basis}}`, `{{demand_deadline_days}}`).
- [ ] Implement `generate_docx(template_name: str, data: dict) -> bytes` in `tracemark_api/services/document_generator.py` — uses python-docx to populate variables and return bytes buffer.
- [ ] Implement `generate_pdf(template_name: str, data: dict) -> bytes` — renders a styled HTML template populated with the data and compiles it to PDF using an HTML-to-PDF compiler.
- [ ] Output type: `DocumentData` dict containing all case/metadata details.
- [ ] Write unit tests in `apps/api/tests/test_document_generator.py`: generate Docx and PDF, assert buffer is non-empty and starts with the proper file headers.

### Test Command
```bash
pytest tests/test_document_generator.py
```

### Deliverable
`apps/api/src/tracemark_api/services/document_generator.py` + template files + unit tests passing locally.

---

## Engineer B — Document Metadata & Supabase Storage (Python Backend)

**Focus:** Design the `documents` table, persist every generated document to Supabase Storage, and wire the generation trigger from an infringement case.

### Tasks
- [ ] Run Supabase migration: `documents` table with fields `id`, `infringement_id (FK → infringements)`, `document_type` (`dmca | cease-desist`), `file_url` (Supabase Storage), `file_format` (`pdf | docx`), `generated_at`, `sent_at`, `status` (`draft | sent | acknowledged`).
- [ ] Create Supabase Storage bucket `legal-documents` (private, authenticated access only).
- [ ] Implement `persist_document(infringement_id: str, buffer: bytes, type: str, format: str) -> dict` — upload file buffer to `legal-documents/{infringement_id}/{type}-{timestamp}.{ext}`, insert metadata row in `documents` table, and return the database record.
- [ ] Implement `get_documents_by_infringement(infringement_id: str) -> list[dict]` — fetch all documents for a case, sorted newest-first.
- [ ] Write integration tests in `apps/api/tests/test_document_persistence.py` against local Supabase.

### Test Command
```bash
pytest tests/test_document_persistence.py
```

### Deliverable
`supabase/migrations/YYYYMMDD_documents.sql` + `apps/api/src/tracemark_api/services/document_persistence.py`.

---

## Engineer C — Document Generator UI (React Frontend)

**Focus:** Build the Document Generator page with a live editable letter preview on the left and the evidence package on the right.

### Tasks
- [ ] Create `/documents/generate` route in the frontend using TanStack Router — accepts `?infringement_id=` query param, fetches infringement + evidence from FastAPI endpoints.
- [ ] Build `<DocumentGeneratorView />` component with a two-column layout:
  - **Left panel:** Editable `<textarea>` pre-filled with AI-generated letter text (fetched from `GET /api/v1/documents/preview?infringement_id=&type=dmca`). Includes a type selector toggle: `DMCA Notice` / `Cease & Desist`.
  - **Right panel:** Evidence package — screenshot thumbnail, metadata table (URL, IP, Timestamp), risk badge, and AI analysis summary.
- [ ] Add `<DocumentActions />` bar at the bottom: **"Download PDF"** button (calls `POST /api/v1/documents/generate` with `format: pdf`), **"Download Docx"** button (`format: docx`), **"Send via Email"** button (stubbed for Week 2).
- [ ] Create `GET /api/v1/documents/preview` endpoint in FastAPI — builds document context, renders template as plain text string, returns JSON `{ "letter_text": str, "metadata": dict }`.
- [ ] Wire `useDocumentGenerator` custom hook to manage type toggle state, edits to the letter text, and download calls.

### Test Command
```bash
npm run dev  # navigate to /documents/generate?infringement_id=mock-id
```

### Deliverable
`src/routes/documents.generate.tsx` + `src/components/documents/DocumentGeneratorView.tsx` + FastAPI endpoints.

---

## Integration Point (End of Week 1)
- Engineer C's "Download PDF/Docx" buttons call the FastAPI generator via the persistence layer.
- **Shared contract:** agree on `DocumentData` JSON data structures before parallel work begins.
- Full flow smoke test: open `/documents/generate?infringement_id=real-id` → preview letter text renders → click "Download PDF" → file downloads.

---

## Definition of Done
- [ ] DMCA and C&D templates generate valid PDF and Docx files with all metadata fields populated.
- [ ] PDF renders with correct content.
- [ ] `documents` Supabase migration applied, file uploaded to `legal-documents` bucket.
- [ ] Document Generator page loads with pre-filled letter text and evidence panel.
- [ ] Download PDF and Download Docx buttons produce valid files.
