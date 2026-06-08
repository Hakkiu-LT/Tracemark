# Phase 3 — Week 2: Webhook Integrations & Notification Delivery

> **Goal:** Wire outbound integrations — Slack notifications, Zapier triggers, and direct document delivery — so that every takedown action automatically notifies the right people and systems.

---

## Engineer A — Slack & Zapier Webhook Service

**Focus:** Build the outbound webhook service that fires on key case events and delivers structured payloads to Slack and Zapier.

### Tasks
- [ ] Create `packages/integrations/src/webhooks.ts` — implement `sendSlackNotification(event: WebhookEvent): Promise<void>` using `fetch` against `SLACK_WEBHOOK_URL` env var.
- [ ] Slack Block Kit payload structure for a `new_infringement` event:
  - Header block: `🔴 New HIGH Risk Infringement — {brandName}`
  - Section: Platform, infringing URL, risk level badge emoji (🔴/🟡🟢).
  - Actions block: two buttons — "View Case" (deep-link to `/cases/{id}`) and "Generate Takedown" (deep-link to `/documents/generate?infringement_id={id}`).
- [ ] Implement `sendZapierTrigger(event: WebhookEvent): Promise<void>` — POST structured JSON to `ZAPIER_WEBHOOK_URL` env var. Payload: `{ eventType, brandName, riskLevel, platform, infringingUrl, caseUrl, generatedDocumentUrl?, triggeredAt }`.
- [ ] Define `WebhookEvent` type with subtypes: `new_infringement`, `takedown_generated`, `case_escalated`, `case_dismissed`.
- [ ] Implement `dispatchWebhooks(event: WebhookEvent): Promise<void>` — fires Slack + Zapier concurrently with `Promise.allSettled`, logs failures without throwing.
- [ ] Write integration tests using `msw` (Mock Service Worker) to intercept webhook HTTP calls and assert payload shape.

### Test Command
```bash
bun test packages/integrations/src/webhooks.test.ts
```

### Deliverable
`packages/integrations/src/webhooks.ts` + `packages/integrations/src/types.ts` + MSW tests passing.

---

## Engineer B — Webhook Event Triggers & Delivery Log

**Focus:** Hook `dispatchWebhooks` into the case lifecycle events and persist a delivery log to Supabase for auditability.

### Tasks
- [ ] Run Supabase migration: `webhook_deliveries` table with fields `id`, `event_type`, `infringement_id (FK)`, `payload (jsonb)`, `slack_status` (`sent | failed | skipped`), `zapier_status` (`sent | failed | skipped`), `delivered_at`, `error_message`.
- [ ] Trigger `dispatchWebhooks({ type: 'new_infringement', ... })` inside the existing infringement persistence function (`persistInfringement` from Phase 2) — fires automatically on every new HIGH-risk flag.
- [ ] Trigger `dispatchWebhooks({ type: 'takedown_generated', ... })` inside `persistDocument` — fires when a document is saved with `status: 'draft'`.
- [ ] Trigger `dispatchWebhooks({ type: 'case_escalated' })` and `dispatchWebhooks({ type: 'case_dismissed' })` when the corresponding action buttons are clicked via `POST /api/cases/:id/status`.
- [ ] Implement `logDelivery(event: WebhookEvent, results: SettledResult[]): Promise<void>` — upsert a `webhook_deliveries` row after every `dispatchWebhooks` call.
- [ ] Write integration test: create a mock infringement → assert a `webhook_deliveries` row is inserted with correct `event_type` and `slack_status: 'sent'`.

### Test Command
```bash
bun test packages/integrations/src/delivery-log.test.ts
```

### Deliverable
`supabase/migrations/YYYYMMDD_webhook_deliveries.sql` + `packages/integrations/src/delivery-log.ts` + triggers wired into Phase 2 persistence layer.

---

## Engineer C — Integrations Settings UI & "Send via Webhook" Button

**Focus:** Build the Integrations settings panel where users configure their Slack/Zapier URLs, and wire the "Send via Webhook" button in the Document Generator that was stubbed in Week 1.

### Tasks
- [ ] Create `/settings/integrations` route — renders `<IntegrationsSettingsPanel />`.
- [ ] Build `<IntegrationsSettingsPanel />` with two configuration cards:
  - **Slack card:** text input for `SLACK_WEBHOOK_URL`, a "Test Connection" button that calls `POST /api/integrations/test/slack` and shows a success/error toast.
  - **Zapier card:** text input for `ZAPIER_WEBHOOK_URL`, same "Test Connection" flow for `POST /api/integrations/test/zapier`.
  - Both cards persist the URL to Supabase `org_settings` table (key-value store, keyed by `organization_id`).
- [ ] Wire **"Send via Webhook"** button in `<DocumentActions />` (stubbed in Week 1): calls `POST /api/documents/:id/send-webhook` → returns `{ slackStatus, zapierStatus }` → renders outcome toast.
- [ ] Create `POST /api/integrations/test/slack` and `POST /api/integrations/test/zapier` endpoints — fire a `test_ping` event payload and return delivery status.
- [ ] Create `POST /api/documents/:id/send-webhook` endpoint — fetches the document + infringement from Supabase, calls `dispatchWebhooks({ type: 'takedown_generated', ... })`, returns delivery result.
- [ ] Add `<WebhookDeliveryLog />` component at the bottom of the Integrations page — table showing last 20 `webhook_deliveries` rows with status badges.

### Test Command
```bash
bun run dev  # navigate to /settings/integrations, test both cards
```

### Deliverable
`src/pages/settings/integrations.tsx` + `src/components/settings/IntegrationsSettingsPanel.tsx` + `POST /api/integrations/test/*` and `POST /api/documents/:id/send-webhook` endpoints.

---

## Integration Point (End of Week 2)
- Slack notification fires automatically when Engineer B's `persistInfringement` is called with a HIGH-risk match (from Phase 2 pipeline).
- "Send via Webhook" button in the Document Generator UI completes the full circuit: generate document → click send → Slack message delivered → `webhook_deliveries` row logged.
- **Full flow test:** trigger a new HIGH infringement → confirm Slack message received in test channel → open Document Generator → send via webhook → check Integrations page delivery log shows `sent`.

---

## Definition of Done
- [ ] Slack Block Kit message delivered to test channel for a new HIGH-risk infringement.
- [ ] Zapier trigger fires with correct JSON payload (verify in Zapier dashboard task history).
- [ ] `webhook_deliveries` rows inserted for every dispatched event.
- [ ] Integrations settings page saves URLs and test connections work.
- [ ] "Send via Webhook" button in Document Generator triggers delivery and shows toast.
- [ ] `dispatchWebhooks` failures do not crash the main pipeline (`Promise.allSettled` confirmed).
