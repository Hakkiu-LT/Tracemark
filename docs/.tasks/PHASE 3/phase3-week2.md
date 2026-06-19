# Phase 3 — Week 2: Email Notification Delivery

> **Goal:** Wire outbound notifications — Email notifications and direct document delivery — so that every infringement found and takedown action automatically alerts the user via email.

---

## Engineer A — Email Notification Service (Python Backend)

**Focus:** Build the outbound email notification service that fires on key case events and sends structured emails to the user.

### Tasks
- [ ] Create `tracemark_api/services/notifications.py` — implement `send_email_notification(event: dict, recipient_email: str) -> None` using an email dispatch mechanism (e.g., SMTP or a configured third-party mailer service).
- [ ] Email template for a `new_infringement` event:
  - Subject: `🔴 New HIGH Risk Infringement Found — {brand_name}`
  - Body: Include platform, infringing URL, risk level, and a link to view the case at `{app_url}/cases/{id}`.
- [ ] Define helper functions/templates for events: `new_infringement`, `takedown_generated`, `case_escalated`, `case_dismissed`.
- [ ] Implement `dispatch_notifications(event: dict) -> None` — resolves user's email and sends the notification, catching and logging failures without crashing.
- [ ] Write integration tests in `apps/api/tests/test_notifications.py` to assert correct email generation and delivery flows.

### Test Command
```bash
pytest tests/test_notifications.py
```

### Deliverable
`apps/api/src/tracemark_api/services/notifications.py` + tests passing.

---

## Engineer B — Email Event Triggers & Delivery Log (Python Backend)

**Focus:** Hook `dispatch_notifications` into the case lifecycle events and persist a delivery log to Supabase for auditability.

### Tasks
- [ ] Run Supabase migration: `notification_deliveries` table with fields `id`, `event_type`, `infringement_id (FK)`, `payload (jsonb)`, `status` (`sent | failed | skipped`), `delivered_at`, `error_message`.
- [ ] Trigger `dispatch_notifications({ "type": "new_infringement", ... })` inside the existing infringement persistence function — fires automatically on every new HIGH-risk flag.
- [ ] Trigger `dispatch_notifications({ "type": "takedown_generated", ... })` inside document saving function — fires when a document is saved with `status: 'draft'`.
- [ ] Trigger notifications when corresponding action buttons are clicked via `POST /api/v1/cases/{id}/status`.
- [ ] Implement `log_delivery(event: dict, ok: bool, error: str = None) -> None` — insert a `notification_deliveries` row after every notification dispatch attempt.
- [ ] Write integration test: create a mock infringement → assert a `notification_deliveries` row is inserted with correct status.

### Test Command
```bash
pytest tests/test_delivery_log.py
```

### Deliverable
`supabase/migrations/YYYYMMDD_notification_deliveries.sql` + `apps/api/src/tracemark_api/services/delivery_log.py` + triggers wired into persistence layer.

---

## Engineer C — Notification Settings UI & Email Actions (React Frontend)

**Focus:** Build the Notification settings panel where users configure their notification email, and wire the "Send via Email" button in the Document Generator.

### Tasks
- [ ] Create `/settings/notifications` route in frontend TanStack Router — renders `<NotificationSettingsPanel />`.
- [ ] Build `<NotificationSettingsPanel />` with a configuration card:
  - **Email card:** text input for `NOTIFICATION_EMAIL`, a "Test Connection" button that calls `POST /api/v1/notifications/test/email` and shows a success/error toast.
  - Persists the email to Supabase `org_settings` table (keyed by `organization_id`).
- [ ] Wire **"Send via Email"** button in `<DocumentActions />`: calls `POST /api/v1/documents/{id}/send-email` → returns delivery outcomes → renders toast.
- [ ] Create FastAPI endpoint `POST /api/v1/notifications/test/email` — fire a test email notification payload and return delivery status.
- [ ] Create `POST /api/v1/documents/{id}/send-email` endpoint in FastAPI — fetches the document, calls `dispatch_notifications({ "type": "takedown_generated", ... })`, and returns delivery results.
- [ ] Add `<NotificationDeliveryLog />` component at the bottom of the Notifications page — table showing last 20 `notification_deliveries` rows with status badges.

### Test Command
```bash
npm run dev  # navigate to settings, test inputs and buttons
```

### Deliverable
`src/routes/settings.notifications.tsx` + `src/components/settings/NotificationSettingsPanel.tsx` + FastAPI endpoints.

---

## Integration Point (End of Week 2)
- Email notification fires automatically when `persist_infringement` is called with a HIGH-risk match.
- "Send via Email" button in the Document Generator UI completes the full circuit: generate document → click send → Email delivered → `notification_deliveries` row logged.

---

## Definition of Done
- [ ] Email notification delivered to user's configured email for a new HIGH-risk infringement.
- [ ] `notification_deliveries` rows inserted for every dispatched event.
- [ ] Notifications settings page saves email and test connections work.
- [ ] "Send via Email" button in Document Generator triggers delivery and shows toast.
