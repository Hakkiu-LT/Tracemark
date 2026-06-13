# Phase 3 — Week 2: Webhook Integrations & Notification Delivery

> **Goal:** Wire outbound integrations — Slack notifications, Zapier triggers, and direct document delivery — so that every takedown action automatically notifies the right people and systems.

---

## Engineer A — Slack & Zapier Webhook Service (Python Backend)

**Focus:** Build the outbound webhook service that fires on key case events and delivers structured payloads to Slack and Zapier.

### Tasks
- [ ] Create `tracemark_api/services/webhooks.py` — implement `send_slack_notification(event: dict) -> None` using `requests` or `httpx` against `SLACK_WEBHOOK_URL`.
- [ ] Slack Block Kit payload structure for a `new_infringement` event:
  - Header block: `🔴 New HIGH Risk Infringement — {brand_name}`
  - Section: Platform, infringing URL, risk level badge emoji (🔴/🟡/🟢).
  - Actions block: two buttons — "View Case" (deep-link to `/cases/{id}`) and "Generate Takedown" (deep-link to `/documents/generate?infringement_id={id}`).
- [ ] Implement `send_zapier_trigger(event: dict) -> None` — POST structured JSON to `ZAPIER_WEBHOOK_URL`. Payload: `{ eventType, brandName, riskLevel, platform, infringingUrl, caseUrl, generatedDocumentUrl, triggeredAt }`.
- [ ] Define helper functions for events: `new_infringement`, `takedown_generated`, `case_escalated`, `case_dismissed`.
- [ ] Implement `dispatch_webhooks(event: dict) -> None` — fires Slack + Zapier concurrently, catching and logging failures without crashing.
- [ ] Write integration tests in `apps/api/tests/test_webhooks.py` using `responses` to mock HTTP queries and assert payload shapes.

### Test Command
```bash
pytest tests/test_webhooks.py
```

### Deliverable
`apps/api/src/tracemark_api/services/webhooks.py` + tests passing.

---

## Engineer B — Webhook Event Triggers & Delivery Log (Python Backend)

**Focus:** Hook `dispatch_webhooks` into the case lifecycle events and persist a delivery log to Supabase for auditability.

### Tasks
- [ ] Run Supabase migration: `webhook_deliveries` table with fields `id`, `event_type`, `infringement_id (FK)`, `payload (jsonb)`, `slack_status` (`sent | failed | skipped`), `zapier_status` (`sent | failed | skipped`), `delivered_at`, `error_message`.
- [ ] Trigger `dispatch_webhooks({ "type": "new_infringement", ... })` inside the existing infringement persistence function — fires automatically on every new HIGH-risk flag.
- [ ] Trigger `dispatch_webhooks({ "type": "takedown_generated", ... })` inside document saving function — fires when a document is saved with `status: 'draft'`.
- [ ] Trigger webhooks when corresponding action buttons are clicked via `POST /api/v1/cases/{id}/status`.
- [ ] Implement `log_delivery(event: dict, slack_ok: bool, zapier_ok: bool, error: str = None) -> None` — insert a `webhook_deliveries` row after every webhook dispatch attempt.
- [ ] Write integration test: create a mock infringement → assert a `webhook_deliveries` row is inserted with correct statuses.

### Test Command
```bash
pytest tests/test_delivery_log.py
```

### Deliverable
`supabase/migrations/YYYYMMDD_webhook_deliveries.sql` + `apps/api/src/tracemark_api/services/delivery_log.py` + triggers wired into persistence layer.

---

## Engineer C — Integrations Settings UI & Webhook Actions (React Frontend)

**Focus:** Build the Integrations settings panel where users configure their Slack/Zapier URLs, and wire the "Send via Webhook" button in the Document Generator.

### Tasks
- [ ] Create `/settings/integrations` route in frontend TanStack Router — renders `<IntegrationsSettingsPanel />`.
- [ ] Build `<IntegrationsSettingsPanel />` with two configuration cards:
  - **Slack card:** text input for `SLACK_WEBHOOK_URL`, a "Test Connection" button that calls `POST /api/v1/integrations/test/slack` and shows a success/error toast.
  - **Zapier card:** text input for `ZAPIER_WEBHOOK_URL`, same "Test Connection" flow for `POST /api/v1/integrations/test/zapier`.
  - Both cards persist the URL to Supabase `org_settings` table (keyed by `organization_id`).
- [ ] Wire **"Send via Webhook"** button in `<DocumentActions />`: calls `POST /api/v1/documents/{id}/send-webhook` → returns delivery outcomes → renders toast.
- [ ] Create FastAPI endpoints `POST /api/v1/integrations/test/slack` and `POST /api/v1/integrations/test/zapier` — fire a test event payload and return delivery status.
- [ ] Create `POST /api/v1/documents/{id}/send-webhook` endpoint in FastAPI — fetches the document, calls `dispatch_webhooks({ "type": "takedown_generated", ... })`, and returns delivery results.
- [ ] Add `<WebhookDeliveryLog />` component at the bottom of the Integrations page — table showing last 20 `webhook_deliveries` rows with status badges.

### Test Command
```bash
npm run dev  # navigate to settings, test inputs and buttons
```

### Deliverable
`src/routes/settings.integrations.tsx` + `src/components/settings/IntegrationsSettingsPanel.tsx` + FastAPI endpoints.

---

## Integration Point (End of Week 2)
- Slack notification fires automatically when `persist_infringement` is called with a HIGH-risk match.
- "Send via Webhook" button in the Document Generator UI completes the full circuit: generate document → click send → Slack message delivered → `webhook_deliveries` row logged.

---

## Definition of Done
- [ ] Slack Block Kit message delivered to test channel for a new HIGH-risk infringement.
- [ ] Zapier trigger fires with correct JSON payload.
- [ ] `webhook_deliveries` rows inserted for every dispatched event.
- [ ] Integrations settings page saves URLs and test connections work.
- [ ] "Send via Webhook" button in Document Generator triggers delivery and shows toast.
