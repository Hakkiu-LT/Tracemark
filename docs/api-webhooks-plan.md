# HAKKIU — Public API + Webhooks: Detailed Implementation Plan

> Status: **PLAN / not started.** This document is the single source of truth for building
> a customer-facing REST API and outbound webhooks for HAKKIU, plus the admin-portal controls
> to decide *who* gets API/webhook access and to track *everything* they do.
>
> Author pass: research + code investigation done via 4 sub-agents (backend, admin portal,
> DB/events, external best-practice deep-research). Verified by a second review agent (see end).

---

## 0. Current state (what exists today)

- **Dashboard tab was a mockup and has been removed** (`src/routes/settings.tsx`, commit `02f309b`):
  fake key `mg_live_•••• 4f9a`, dead "Reveal"/"Rotate" buttons, no webhooks UI. Nothing behind it.
- **No customer `api_keys` table** exists in any of the 62 migrations.
- **No customer-facing key auth** — the main API (`apps/api`) only accepts a Supabase JWT via
  `get_current_user` / `get_current_profile` (`apps/api/src/tracemark_api/dependencies.py:23-79`).
  Auth is browser→JWT, not developer→API-key.
- **No public API surface** — all routes are under `/api/v1` and assume a logged-in browser session.
- **No webhook delivery infra** at all.
- ⚠️ **`api_usage_records` / `ApiUsageTracker` is unrelated** — it meters HAKKIU's *own* consumption
  of third-party APIs (Google SERP, Firecrawl, Gemini). It must NOT be conflated or collided with a
  customer key system. Keep the new tables entirely separate.
- **Existing analog for delivery**: `notification_deliveries` + `dispatch_notifications()` /
  `log_delivery()` (`apps/api/.../services/notifications.py`, `services/delivery_log.py`). The webhook
  delivery system should mirror this design (one row per delivery attempt, status sent/failed/skipped).

**Conclusion:** this is a from-scratch build of a new product surface, not "wiring up existing UI."

---

## 1. Goals & non-goals

### Goals
1. A **read-first public REST API** so customers can pull their detections/cases/takedowns into
   their own systems (SIEM, BI, internal dashboards).
2. **Outbound webhooks** so customers get pushed events (new infringement, takedown sent, etc.)
   without polling.
3. **Admin-portal control plane**: staff decide which organizations get API/webhook access, issue
   and revoke keys, see every key and webhook, and read a full audit/usage log. (Mandatory per
   `CLAUDE.md` parity rule.)
4. **Customer dashboard UI** (rebuild the removed tab) to self-manage keys + webhook endpoints —
   *only if the org has API access enabled by staff*.
5. **Public documentation** (OpenAPI + guides) of Stripe-tier quality.

### Non-goals (v1)
- OAuth 2.0 / delegated third-party apps (Bearer API key is sufficient for machine-to-machine).
- Write endpoints that mutate cases/takedowns via API (v1 is **read-only** + webhook management;
  triggering takedowns via API is a fast-follow, behind a `takedowns:write` scope).
- Billing/metering-based pricing of API calls (track usage now; monetize later).

---

## 2. Key architecture decisions

| Decision | Choice | Why |
|---|---|---|
| **API auth** | Bearer **API key** in `Authorization: Bearer hkq_...` | Consensus for B2B server-to-server data APIs (Stripe/OpenAI/Twilio). Simpler than OAuth, easy to rotate, no user delegation needed. |
| **Where the public API lives** | New router in the **main API** (`apps/api`), mounted at `/api/public/v1` (separate from the JWT-only `/api/v1`) | Keeps public surface isolated from the browser API; different auth dependency; independent versioning + rate limits. |
| **Key storage** | Store **only `sha256(key)`** + prefix + last-4 + scopes + org_id. Show full key once. | If DB leaks, hashes are useless. Keys are high-entropy so SHA-256 is correct (bcrypt/argon2 unnecessary). |
| **Key format** | `hkq_sk_live_<32B base64url>_<6-char checksum>` | Distinctive prefix → secret-scanning friendly; checksum → reject malformed keys without a DB hit. |
| **Test-mode keys** | ⚠️ **Deferred out of v1** (verified) | There is no sandbox dataset — one Supabase project holds all real customer rows. A `hkq_sk_test_` key would either see real data (pointless) or nothing (useless). Ship **live keys only** in v1; add test mode only if/when a synthetic-fixtures sandbox per org is scoped (§13). The `environment` column stays for forward-compat. |
| **Tenant isolation** | Every key → exactly one `organization_id`; every query filtered by it **server-side**; add **RLS** as belt-and-suspenders | #1 multi-tenant risk. Never trust an org id from the request. Mirrors existing security-hardening work. |
| **Resource IDs in API** | Prefixed random public IDs (`inf_…`, `case_…`) — never raw DB PKs; **404 (not 403)** for cross-tenant | Prevents enumeration/IDOR and "exists-but-forbidden" oracle. |
| **Pagination** | **Cursor-based** (opaque base64 `next_cursor`) | Stable under continuous inserts (detections stream in), index-scan performant, no offset-walking. |
| **Webhook signing** | HMAC-SHA256 over `"{timestamp}.{raw_body}"`, header `Hakkiu-Signature: t=…,v1=…` + `Hakkiu-Event-Id` | Stripe/Svix standard; timestamp inside signature prevents replay; 5-min tolerance; constant-time compare. |
| **Webhook delivery engine** | **Build in-house first**, mirroring `notification_deliveries`; keep a documented option to swap to **Svix** if scale demands | In-house reuses existing patterns and avoids a vendor dependency for v1; Svix is the escape hatch. |
| **Who controls access** | **Staff, via admin portal.** `org_settings.api_access_enabled` gates whether an org can even create keys/webhooks. | Business wants to hand API access to specific customers (Pro/Enterprise), not everyone. |
| **Docs** | A **separately-built, sanitized OpenAPI 3.1 schema for only the public router**, served on a dedicated docs host/route | ⚠️ Verified — cannot just "lean on FastAPI auto-emit" (see §2.1 + §10). |

### 2.1 Load-bearing precondition — SINGLE-PROCESS deploy
⚠️ Verified: `apps/api/Dockerfile` runs `uvicorn main:app` with **no `--workers`** and
`docker-compose.yml` has no replicas. This single-process fact is what makes an **in-process webhook
worker thread safe** (no duplicate delivery) and the **in-memory rate limiter correct**. This is a
hard precondition, not an assumption to leave implicit:
- If Hetzner ever adds uvicorn workers or replicas, BOTH the webhook worker (double-send) and the
  in-memory rate limiter (per-process buckets) break.
- **Guard now**: gate the worker behind an env flag (e.g. `WEBHOOK_WORKER_ENABLED`) so exactly one
  instance runs it, and select due deliveries with `FOR UPDATE SKIP LOCKED` (raw SQL/RPC) or a
  claim-column so the design survives a future multi-process move.

---

## 3. Data model (new Supabase migration)

New migration file: `supabase/migrations/<YYYYMMDD>000001_public_api_and_webhooks.sql`
(apply with `supabase db push`; timestamp format `YYYYMMDD000NN_snake_case.sql`).

### 3.1 `org_settings` — add access flags
```sql
ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS api_access_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS api_rate_limit_per_min  INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS webhooks_enabled        BOOLEAN NOT NULL DEFAULT FALSE;
```
`api_access_enabled` is the master switch staff flip per organization.

### 3.2 `api_keys` — customer keys
```sql
CREATE TABLE public.api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,                 -- human label ("Production integration")
    key_hash        TEXT NOT NULL UNIQUE,          -- sha256(full_key), hex
    key_prefix      TEXT NOT NULL,                 -- "hkq_sk_live_" (for display + scan)
    last_four       TEXT NOT NULL,                 -- "a8Kx"
    environment     TEXT NOT NULL DEFAULT 'live'   CHECK (environment IN ('live','test')),
    scopes          TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {'cases:read','infringements:read'}
    created_by      UUID,                          -- profiles.id (customer) or NULL if staff-issued
    created_by_staff UUID,                          -- staff_accounts.id if staff-issued (admin portal)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,                   -- NULL = no expiry
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,                   -- soft delete; NULL = active
    revoked_reason  TEXT
);
CREATE INDEX idx_api_keys_org        ON public.api_keys(organization_id);
CREATE INDEX idx_api_keys_hash       ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_active     ON public.api_keys(organization_id) WHERE revoked_at IS NULL;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;   -- service-role bypasses; RLS blocks anon/authenticated direct reads
```

### 3.3 `api_request_log` — every authenticated API call (usage + audit)
```sql
CREATE TABLE public.api_request_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id      UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL,
    method          TEXT NOT NULL,
    path            TEXT NOT NULL,
    status_code     INTEGER NOT NULL,
    latency_ms      INTEGER NOT NULL,
    ip              TEXT,
    user_agent      TEXT,
    rate_limited    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_req_org     ON public.api_request_log(organization_id, created_at DESC);
CREATE INDEX idx_api_req_key     ON public.api_request_log(api_key_id, created_at DESC);
-- Never store the key itself, only api_key_id.
```
> ⚠️ Verified — enable RLS + **FORCE RLS** on `api_request_log`, `webhook_events`, and
> `webhook_deliveries` too (not just `api_keys`/`webhook_endpoints`), to match
> `20260731000003_force_rls_customer_tables.sql`. `organization_id` on these three is a plain UUID
> with no FK, so decide the org-deletion policy: **retain-for-audit** (state it) or add a cleanup job.
> `api_request_log.api_key_id` uses `ON DELETE SET NULL` (good — preserves the audit trail).
> Note: this is separate from `api_usage_records` (third-party metering). Different table, different purpose.

### 3.4 `webhook_endpoints` — customer-registered destinations
```sql
CREATE TABLE public.webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,                 -- HTTPS only (validated)
    description     TEXT,
    event_types     TEXT[] NOT NULL DEFAULT '{}',  -- subscribed events; '*' = all
    signing_secret  TEXT NOT NULL,                 -- whsec_...; used for HMAC (stored plaintext, needed to sign)
    status          TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','disabled','auto_disabled')),
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    created_by      UUID,
    created_by_staff UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    disabled_at     TIMESTAMPTZ
);
CREATE INDEX idx_webhook_ep_org ON public.webhook_endpoints(organization_id);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
```
> ⚠️ Verified — `signing_secret` must be recoverable to compute HMAC on send, but storing it in
> **plaintext is below this codebase's security bar** (July-2026 hardening + RLS-everywhere). A DB
> read would let an attacker forge signed events to the customer's endpoint. **Encrypt at rest NOW
> (app-layer envelope encryption with a key in `.env`), not as a follow-up.** Enable RLS + FORCE RLS
> on this table.

### 3.5 `webhook_events` — the canonical event that occurred (fired once)
```sql
CREATE TABLE public.webhook_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- becomes evt_<id> in the envelope
    organization_id UUID NOT NULL,
    event_type      TEXT NOT NULL,                 -- 'infringement.created', etc.
    payload         JSONB NOT NULL,                -- the data.object
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_events_org ON public.webhook_events(organization_id, created_at DESC);
```

### 3.6 `webhook_deliveries` — one row per (event × endpoint) attempt trail
```sql
CREATE TABLE public.webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,
    endpoint_id     UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','dead')),
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 8,
    next_attempt_at TIMESTAMPTZ,                   -- backoff schedule
    last_status_code INTEGER,
    last_error      TEXT,
    response_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at    TIMESTAMPTZ
);
CREATE INDEX idx_webhook_deliv_due   ON public.webhook_deliveries(next_attempt_at) WHERE status = 'pending';
CREATE INDEX idx_webhook_deliv_org   ON public.webhook_deliveries(organization_id, created_at DESC);
CREATE INDEX idx_webhook_deliv_event ON public.webhook_deliveries(event_id);
```

---

## 4. Public API surface (v1, read-only)

Mounted at **`/api/public/v1`** in `apps/api`, new dependency `require_api_key(scope)`.

### 4.1 Resources & endpoints
| Method | Path | Scope | Returns |
|---|---|---|---|
| GET | `/brands` | `brands:read` | List monitored brands (`brands` table, org-scoped) |
| GET | `/brands/{id}` | `brands:read` | One brand |
| GET | `/cases` | `cases:read` | List scan cases (cursor paginated) |
| GET | `/cases/{id}` | `cases:read` | Case + decision summary |
| GET | `/infringements` | `infringements:read` | List detections; filters: `risk_level`, `status`, `platform`, `brand_id`, `since` cursor |
| GET | `/infringements/{id}` | `infringements:read` | One detection with signed screenshot URL |
| GET | `/infringements/{id}/evidence` | `infringements:read` | Evidence items (signed URLs) |
| GET | `/takedowns` | `takedowns:read` | List takedown reports + status |
| GET | `/takedowns/{id}` | `takedowns:read` | One takedown |
| GET | `/webhooks` | `webhooks:manage` | List this org's webhook endpoints |
| POST | `/webhooks` | `webhooks:manage` | Register endpoint (returns signing secret once) |
| PATCH | `/webhooks/{id}` | `webhooks:manage` | Update url/events/status |
| DELETE | `/webhooks/{id}` | `webhooks:manage` | Remove endpoint |
| POST | `/webhooks/{id}/test` | `webhooks:manage` | Send a `ping` test event |
| GET | `/events/{id}` | any | Fetch a past event (for replay/debug) |

### 4.2 Public read models (map DB → stable public JSON, hiding internal PKs)
- **Infringement** (from `infringements`, joined to parent `cases`):
  `{ id: "inf_…", case_id: "case_…", brand_name (from cases join), platform, url (=source_url),
     risk_level, match_score, match_type, status, detection_region, screenshot_url (signed),
     flagged_at, created_at, updated_at }`
  > ⚠️ Verified: the `infringements` table has **no `brand_id`**, **no `confidence`**, and **no
  > `detected_at`** column. `brand_name` lives on the parent `cases` row (derive via join);
  > timestamps are `flagged_at`/`created_at` (`updated_at` added by `20260725000001`). `confidence`
  > exists only on `evidence_items.confidence` — expose from there if needed, else omit.
- **Case**: `{ id, brand_name, status, detection_region, target_regions, created_at, updated_at,
     decision: { risk_level, recommended_action, confidence_score, summary } }`
- **Takedown**: `{ id, case_id, platform, platform_category, infringing_url, submission_method,
     status, submitted_at, created_at }`
- **Brand**: `{ id, brand_name, website, platforms, target_regions, status, last_scan_at }`

**Field policy**: signed, short-lived URLs for screenshots (never raw bytes); PII (seller contact,
submission email) gated behind explicit scopes and omitted by default; internal scoring internals
(`tier0/1/2_score`, embeddings) are NOT exposed.

### 4.3 Cross-cutting API behavior
- **Errors**: stable envelope `{ "error": { "type", "code", "message", "doc_url" } }`.
- **Rate limit**: ⚠️ Verified — do **NOT** hand-roll a second token bucket. `slowapi` already exists
  (`services/rate_limit.py`, `Limiter(key_func=_user_key)`). **Extend slowapi** with a dynamic
  per-key limit read from `org_settings.api_rate_limit_per_min`. Return `429` + `Retry-After` +
  `X-RateLimit-Limit/Remaining/Reset`. NOTE: slowapi state is **in-memory / per-process** — fine
  for the current single-process deploy (see §2.1), but breaks if we ever scale to >1
  worker/replica; document this precondition and revisit with Redis/DB counter if scaling.
- **Pagination**: `?limit=` (max 100) + `?cursor=`; response `{ data: [...], next_cursor, has_more }`.
- **Versioning**: date-pinned `Hakkiu-Version` header; default to latest; changelog documented.
- **Request logging**: ⚠️ Verified — must be **async / best-effort, never on the blocking hot path**.
  A synchronous Supabase insert per read request adds a full round-trip to p50 latency and creates
  write-amplification. Use a FastAPI `BackgroundTask` or an in-memory batch that flushes periodically;
  **a log-write failure must never fail the API request**. (The existing sync `log_delivery` only
  fires on notification events, not per-request — it is NOT a precedent for hot-path logging.)

---

## 5. API key system

### 5.1 Generation (admin portal OR customer dashboard, both allowed if org enabled)
```
raw = secrets.token_urlsafe(32)                       # ≥256 bits
body = f"hkq_sk_{env}_{raw}"
checksum = sha256(body).hexdigest()[:6]
full_key = f"{body}_{checksum}"                        # shown to user ONCE
store: key_hash=sha256(full_key), key_prefix=f"hkq_sk_{env}_", last_four=full_key[-4:]
```

### 5.2 Validation (`require_api_key(scope)` dependency)
1. Read `Authorization: Bearer <key>`; reject if missing.
2. Verify checksum suffix locally (reject malformed with 401, no DB hit).
3. `sha256(key)` → look up `api_keys` by `key_hash` (indexed).
4. Reject if not found / `revoked_at` set / `expires_at` passed.
5. Load `organization_id`; verify `org_settings.api_access_enabled` (else 403 "API access not enabled").
6. Check requested `scope` ∈ `scopes` (else 403 "insufficient scope").
7. Enforce rate limit (token bucket keyed on `api_key_id`).
8. Update `last_used_at` (throttled write, e.g. once/min).
9. Attach `org_id` + `api_key_id` to request state; all queries filter by that org id.

### 5.3 Lifecycle operations
- **Create** (customer `POST /api/public/v1`... via dashboard, or staff via admin) → return full key once.
- **Rotate** → create new, keep old valid for **24h grace**, then auto-revoke; email owner.
- **Revoke** → set `revoked_at`; immediate.
- **Expiry** → optional; pre-expiry email at T-7d.
- **Secret scanning** → register `hkq_sk_live_` with GitHub Secret Scanning Partner Program;
  a verification webhook auto-revokes leaked keys (fast-follow).

---

## 6. Webhook system

### 6.1 Event catalog (dotted `resource.action`)
| Event | Fired when | Source hook (file:line today) |
|---|---|---|
| `infringement.created` | new detection persisted | `services/persistence.py:~215` (`persist_infringement`) — currently HIGH-risk only for email; **webhook should fire for all risk levels** |
| `infringement.status_changed` | per-copycat status PATCH | `routes/infringements.py:~367` (no dispatch today — add hook) |
| `case.created` | case created in check-brand | `routes/monitoring.py:~287` (no dispatch today — add hook) |
| `case.status_changed` | case escalated/dismissed/etc | `routes/monitoring.py:~346` (extends existing `dispatch_notifications`) |
| `takedown.created` | takedown report generated | `services/takedown.py:~620` (no dispatch today — add hook) |
| `takedown.status_changed` | pending→sent→acknowledged | `routes/monitoring.py:~448` (no dispatch today — add hook) |
| `takedown.sent` | takedown email sent | `routes/monitoring.py:~543` (extends existing `log_delivery`) |
| `scan.completed` | check-brand pipeline finishes | `routes/monitoring.py` end of `/check-brand` |

Implementation: a single `emit_event(org_id, event_type, data)` helper (new
`services/webhooks.py`) that (1) inserts a `webhook_events` row, (2) finds matching enabled
`webhook_endpoints` for the org (by `event_types` or `*`), (3) inserts one `webhook_deliveries`
row per endpoint with `next_attempt_at = now()`. Call `emit_event(...)` at each hook above —
best-effort (never block/breaks the main flow if webhook infra errors).

> ⚠️ **CRITICAL — `infringement.created` idempotency (verified against `services/persistence.py`).**
> `persist_infringement` does two things that break a naïve emit:
> 1. It **upserts** on `(case_id, source_url)` — a re-run of check-brand *updates* an existing row
>    rather than inserting, so there is no clean "created" signal.
> 2. It **early-returns on cross-case dedup** (if the same URL already has an open infringement for
>    that org+brand) — so re-detections would never reach an emit point.
>
> Rules the implementation MUST follow:
> - Emit `infringement.created` **only on a true INSERT** (detect new row vs upsert-update; e.g.
>   compare the upsert result, or check existence before writing). Never emit "created" for an update.
> - Emit from **one choke point** with a **dedup guard** (e.g. unique key or existence check on
>   `webhook_events` per `(org, event_type, resource_id)` within a window) so a re-scan can't
>   double-fire. Prefer this over scattering `emit_event` across 8 call sites.
> - Consider `infringement.updated` as a separate event for status/score changes, keeping `.created`
>   strictly for first detection.

> ⚠️ Verified — the file:line references in the table above are **approximate and partly stale**
> (e.g. `takedown.created` is in `generate_takedown_reports` at `services/takedown.py:~449`, not
> `_persist_reports:~602`; `infringement.status_changed` is `update_infringement_status` at
> `routes/infringements.py:~341`; `takedown.status_changed` is the PUT at `monitoring.py:~414`).
> The *events* are all real and add-able — but re-locate each function by name at implementation time,
> don't trust the line numbers.

### 6.2 Envelope (sent to customer URL)
```json
{ "id": "evt_<uuid>", "type": "infringement.created", "created": 1712345678,
  "api_version": "2026-08-01", "data": { "object": { ...public read model... } } }
```
Headers: `Hakkiu-Signature: t=<unix>,v1=<hex hmac_sha256(secret, "t.body")>`,
`Hakkiu-Event-Id: evt_<uuid>` (stable across retries → consumer idempotency),
`Content-Type: application/json`, `User-Agent: Hakkiu-Webhooks/1`.

### 6.3 Delivery worker
- A background thread/loop in the main API (same pattern as existing startup threads in
  `main.py:154-218`, e.g. cleanup/digest threads), gated by `WEBHOOK_WORKER_ENABLED` (§2.1).
- ⚠️ Verified — **use a dedicated Supabase client for the worker thread.** `get_supabase()` returns
  one module-global client (`services/database.py`); supabase-py's sync client is not documented as
  thread-safe for concurrent use, and a tight poll loop hammering the DB alongside request handlers
  is riskier than the existing low-frequency threads. Create a separate client instance for the worker.
- Every few seconds: `SELECT ... FROM webhook_deliveries WHERE status='pending' AND next_attempt_at <= now() ... FOR UPDATE SKIP LOCKED LIMIT N` (or a claim-column update) so delivery is exactly-once
  per attempt even if the worker is ever parallelized.
- ⚠️ Verified — **re-validate the destination URL with `services/ssrf.py` (`validate_ssrf_url` /
  `safe_get`) on EVERY delivery attempt, not just on registration.** DNS rebinding: an attacker can
  register a benign URL then re-point DNS to an internal address (`169.254.169.254`, private ranges).
  Reject redirects during delivery.
- For each: sign + POST with timeout (e.g. 10s). `2xx` → `succeeded` + `delivered_at`; reset endpoint
  `consecutive_failures=0`. Non-2xx/timeout → increment `attempt_count`, set backoff
  `next_attempt_at` (immediate→5s→5m→30m→2h→5h→10h→10h). At `max_attempts` → `dead`.
- Endpoint auto-disable: if `consecutive_failures` crosses threshold (e.g. 15) → set
  `status='auto_disabled'`, email owner + Slack alert.
- **Manual replay**: from admin portal AND customer dashboard (re-enqueue a `dead`/`failed` delivery).
- Delivery semantics documented: **at-least-once, no ordering guarantee** → consumers must dedupe on
  `Hakkiu-Event-Id` and be order-independent.

### 6.4 Registration verification
- URL must be HTTPS + publicly reachable; on create, send a `ping` event and require a 2xx before
  marking `enabled` (or mark `enabled` immediately but surface the ping result).

---

## 7. Admin portal integration (MANDATORY — parity rule)

Follows the exact existing pattern (permission gate → `customer_sb()` query → `write_audit_log`).

### 7.1 New permissions (add to BOTH files, keep in sync)
`apps/admin-api/src/tracemark_admin_api/permissions.py` **and** `apps/admin/src/lib/permissions.ts`:
```
api_access.view      — see an org's API access status, keys (metadata only), usage
api_access.manage    — toggle api_access_enabled, set rate limit
api_keys.create      — issue a key on behalf of an org
api_keys.revoke      — revoke a key (destructive)
webhooks.view        — see an org's webhook endpoints + delivery log
webhooks.manage      — create/edit/disable endpoints on behalf of an org
webhooks.replay      — re-enqueue a failed/dead delivery
```
Add to `ROLE_PRESETS`: `dev`=view perms; `admin`=all except destructive.
> ⚠️ Verified — there is **no `super-admin` role preset**. `is_super_admin` is a boolean flag that
> short-circuits to `ALL_PERMISSIONS` in `resolve_effective_permissions` (`permissions.py:~83`).
> Both `permissions.py` and `permissions.ts` must be edited in sync.

### 7.2 New admin-api routes
New file `apps/admin-api/.../routes/api_access.py`:
- `GET /orgs/{org_id}/api-access` → status + keys (metadata) + recent usage summary
- `PATCH /orgs/{org_id}/api-access` → toggle enabled / rate limit (audit log)
- `POST /orgs/{org_id}/api-keys` → issue key (return once; audit log) — *delegates key creation to
  a main-API `/internal/*` endpoint if generation logic lives there, per the "ops run in main API"
  rule; otherwise create directly via `customer_sb()`*
- `POST /orgs/{org_id}/api-keys/{key_id}/revoke` → revoke (audit log)
- `GET /orgs/{org_id}/api-usage` → aggregate from `api_request_log`
New file `apps/admin-api/.../routes/webhooks_admin.py`:
- `GET /orgs/{org_id}/webhooks` → endpoints + delivery stats
- `POST|PATCH|DELETE /orgs/{org_id}/webhooks[/{id}]` → manage (audit log)
- `GET /orgs/{org_id}/webhook-deliveries` → delivery log (filter status)
- `POST /webhook-deliveries/{id}/replay` → re-enqueue (audit log)

Register both routers in `apps/admin-api/.../main.py`.

### 7.3 New admin frontend
- Extend `apps/admin/src/pages/OrganizationDetail.tsx` with an **"API & Webhooks"** section/tab:
  - Toggle "API access enabled" (`<Can permission="api_access.manage">`).
  - Table of keys (name, prefix+last4, scopes, created, last used, status) + "Issue key" + "Revoke".
  - Table of webhook endpoints (url, events, status, failure count) + manage + "Replay" on deliveries.
  - Usage panel (calls/day, error rate, rate-limit hits) from `api_request_log`.
- Optionally a global `apps/admin/src/pages/ApiUsage.tsx` (cross-org) and `WebhookDeliveries.tsx`.
- Register pages in `apps/admin/src/router.tsx`; gate every control with `<Can>`.
- Every mutation calls `write_audit_log(staff, "api_keys.create"|..., target_type, target_id, target_org_id, metadata, ip)`.

---

## 8. Customer dashboard UI (rebuild the removed tab)

Only render the tab if the org has `api_access_enabled` (fetch from a `/api/v1/settings/api` endpoint
in the main API, JWT-auth, `require_owner` for writes).
- Re-add **"API & Webhooks"** tab in `src/routes/settings.tsx`.
- **API keys**: list (prefix+last4, scopes, created, last used), "Create key" (shows full key once
  in a copy-once modal), "Rotate", "Revoke". Real `onClick` handlers → new `src/lib/api.ts` calls.
- **Webhooks**: list endpoints, add endpoint (url + event checkboxes), show signing secret once,
  "Send test event", per-endpoint delivery log with replay.
- If `api_access_enabled=false`: show a "Contact us to enable API access" state (no create controls).

New main-API customer endpoints (JWT + `require_owner`), under `/api/v1/settings`:
`GET/POST/DELETE /api-keys`, `POST /api-keys/{id}/rotate`, `GET/POST/PATCH/DELETE /webhooks`,
`POST /webhooks/{id}/test`, `GET /webhooks/{id}/deliveries`, `POST /webhook-deliveries/{id}/replay`.
These share the same service layer as the public `/api/public/v1/webhooks` management endpoints.

---

## 9. Security requirements (checklist)

- [ ] Keys hashed at rest (SHA-256); plaintext shown once; never logged.
- [ ] Checksum pre-validation before DB lookup.
- [ ] Every public endpoint scoped by `organization_id` from the key — server-side only.
- [ ] RLS enabled on `api_keys`, `webhook_endpoints` (+ others); service-role only for the API layer.
- [ ] Prefixed random public IDs; 404 (not 403) for cross-tenant access.
- [ ] Per-key token-bucket rate limiting; `429`/`Retry-After`/`X-RateLimit-*`.
- [ ] Scopes enforced per key (least privilege); read-only default.
- [ ] `api_request_log` for every call; PII scrubbed from logs.
- [ ] Webhook HMAC-SHA256 signing + 5-min replay window + constant-time compare.
- [ ] Webhook URLs HTTPS-only; SSRF guard (reject internal/private IP ranges — reuse SSRF learnings
      from the July 2026 security hardening).
- [ ] Signing secrets stored protected; rotation supported.
- [ ] Admin key/webhook lifecycle mutations audited via `write_audit_log`.
- [ ] Constant-time compare for the API-key hash lookup path where feasible (hash lookup is already
      not directly comparable, so timing risk is low; still avoid early-return oracles).
- [ ] Test vs live key separation.
- [ ] Enrollment in GitHub secret-scanning partner program (fast-follow).

---

## 10. Documentation deliverables

- [ ] **OpenAPI 3.1 spec** for `/api/public/v1`. ⚠️ Verified — this needs real plumbing, not
      "auto-emit": `main.py:39-41` sets `docs_url/redoc_url/openapi_url=None` for the WHOLE app in
      production, and FastAPI has no built-in per-router OpenAPI toggle. **Build a separate, sanitized
      OpenAPI schema containing only the public router's routes** (e.g. `get_openapi(...)` filtered to
      the public router) and serve it explicitly. Also ⚠️ `Caddyfile` sets
      `Content-Security-Policy "default-src 'none'"` on `api.hakkiu.com`, which will break any
      browser-rendered Scalar/Redoc served from that host — **serve docs on a different host/route**
      (`docs.hakkiu.com` or `hakkiu.com/docs/api`) with its own CSP. Update `Caddyfile` + `main.py`.
- [ ] **Getting started + auth guide** — how to get a key (contact/enable flow), Bearer usage,
      test vs live, scopes.
- [ ] **Webhook guide** — event catalog, envelope schema, HMAC verification code samples in
      **Node + Python**, retry/replay behavior, "send test event", idempotency guidance.
- [ ] **Error reference** — the stable error envelope + codes.
- [ ] **Rate-limit page** — tiers, headers, backoff.
- [ ] **Versioning + dated changelog** (`Hakkiu-Version`).
- [ ] Internal `docs/DEPLOYMENT.md` update — new env vars, worker thread, Caddy routing for
      `/api/public/*` (and confirm `/api/v1/internal/*` stays edge-blocked).

---

## 11. Phased implementation plan

**Phase 0 — Decisions & schema (0.5–1d)**
- Confirm open questions (§13). Author + `supabase db push` the migration (§3).

**Phase 1 — API keys + public read API (3–5d)**
- `services/api_keys.py` (generate/hash/validate), `require_api_key` dependency, rate limiter,
  request-log middleware. Public router `/api/public/v1` with brands/cases/infringements/takedowns
  read endpoints + cursor pagination + error envelope. Unit + integration tests.

**Phase 2 — Webhooks (4–7d)**
- Tables done in Phase 0. `services/webhooks.py` (`emit_event`, signing), delivery worker + backoff +
  dead-letter + auto-disable. Wire `emit_event` into the 8 event hooks (§6.1). Public webhook mgmt
  endpoints + `/test` + replay. Tests incl. a local receiver that verifies signatures.

**Phase 3 — Admin portal parity (2–3d)**
- Permissions (both files), admin-api routes (§7.2), admin UI in OrganizationDetail + optional
  global pages, audit logging on every mutation.

**Phase 4 — Customer dashboard UI (2d)**
- Rebuild the settings tab (§8), gated by `api_access_enabled`.

**Phase 5 — Docs + hardening (2–3d)**
- OpenAPI publish, guides with code samples, changelog. SSRF guard, secret-scanning enrollment,
  final security review (`/security-review`).

_Total rough estimate: **~3–4 weeks** of focused work (revised up after verification review)._
⚠️ Verified — the original 2–3w was optimistic. **Phase 2 (webhooks) is the most underestimated**
(realistically 7–10d once idempotency, thread-safety, SSRF-on-send, and 8 hook sites are done right),
and **Phase 5 (docs)** needs real plumbing for the public-only OpenAPI + docs host (§10), not just
"render Redoc". Phases 1, 3, 4 estimates are credible.

Update `plan.md`, `todo.md`, `docs/.roadmap/roadmap.md` as phases complete (⚠️ Partial until BOTH
customer app and admin portal are wired, per CLAUDE.md).

---

## 12. File-by-file change map

**Main API (`apps/api`)**
- `supabase/migrations/<new>.sql` — all tables (§3).
- `services/api_keys.py` *(new)* — generation, hashing, validation.
- `services/webhooks.py` *(new)* — `emit_event`, signing, delivery worker.
- `dependencies.py` — add `require_api_key(scope)`.
- `main.py` — mount `/api/public/v1` router; start webhook delivery thread; request-log middleware.
- `routes/public_api.py` *(new)* — read endpoints + webhook management.
- `routes/settings_api.py` *(new)* — customer JWT endpoints for keys/webhooks (§8).
- Event hooks: edits in `services/persistence.py`, `routes/monitoring.py`, `routes/infringements.py`,
  `services/takedown.py` to call `emit_event(...)`.

**Admin API (`apps/admin-api`)**
- `permissions.py` — new permission keys + presets.
- `routes/api_access.py` *(new)*, `routes/webhooks_admin.py` *(new)*.
- `main.py` — register routers.

**Admin FE (`apps/admin`)**
- `src/lib/permissions.ts` — mirror new perms.
- `src/pages/OrganizationDetail.tsx` — API & Webhooks section.
- `src/pages/ApiUsage.tsx`, `src/pages/WebhookDeliveries.tsx` *(optional, new)*.
- `src/router.tsx` — routes.

**Customer FE (`src/`)**
- `src/routes/settings.tsx` — rebuild API & Webhooks tab (gated).
- `src/lib/api.ts` — key/webhook management calls.

**Docs**
- Public API docs site + guides; `docs/DEPLOYMENT.md` env/routing updates.

---

## 13. Open questions (need product/business decision)

1. **Who gets API access?** Confirm it's Pro/Enterprise-gated via `api_access_enabled` (staff-flipped).
2. **Read-only v1?** Confirm no write endpoints (no API-triggered takedowns) in v1.
3. **Key issuance flow** — can customers self-issue once enabled, or must staff issue every key?
4. **Webhook engine** — build in-house (plan default) vs adopt Svix now?
5. **Docs hosting** — `hakkiu.com/docs/api` vs a separate `docs.` subdomain?
6. **Which events matter most** to launch with (all 8, or a subset — e.g. `infringement.created`,
   `takedown.status_changed`, `scan.completed`)?
7. **PII policy** — expose seller contact / submission emails behind a scope, or omit entirely in v1?

---

## 14. Env vars to add
- `PUBLIC_API_ENABLED` (feature flag), `WEBHOOK_WORKER_ENABLED` (elects the single worker instance),
- `WEBHOOK_SIGNING_VERSION` (=`v1`), `HAKKIU_API_VERSION` (=date),
- `WEBHOOK_SECRET_ENC_KEY` (app-layer encryption key for `signing_secret` at rest),
- (reuse existing `SUPABASE_*`, `INTERNAL_API_SECRET`, `MAIN_API_URL`).

---

## 15. Verification review — status & residual risks

This plan was **independently ultrathink-reviewed by a second agent against the real codebase.** The
review **confirmed the architecture is sound and well-grounded** (auth model, admin-parity approach,
delivery-log mirroring, single-process worker pattern, schema ALTERs, the slowapi discrepancy, and the
`api_usage_records` collision risk all check out). All verified corrections have been folded inline
above (marked "⚠️ Verified"). Summary of what changed vs the first draft:

1. **Infringement read model** — removed non-existent columns (`brand_id`, `confidence`,
   `detected_at`); map to real columns + join `cases.brand_name` (§4.2).
2. **`infringement.created` idempotency** — added the "emit only on true INSERT + dedup guard" contract
   because `persist_infringement` upserts and early-returns on cross-case dedup (§6.1). **This is the
   single biggest correctness risk** — design it before wiring any hook.
3. **Rate limiter** — reuse/extend slowapi, don't hand-roll; documented per-process limitation (§4.3).
4. **Request logging** — must be async/best-effort, never on the blocking hot path (§4.3).
5. **Test-mode keys** — deferred out of v1 (no sandbox dataset exists) (§2, §13).
6. **Docs** — public-only OpenAPI needs explicit plumbing; prod disables app-wide OpenAPI and the API
   host CSP blocks rendered docs → serve on a separate host (§10).
7. **Webhook worker** — dedicated Supabase client + `FOR UPDATE SKIP LOCKED` + single-process env gate
   (§2.1, §6.3).
8. **SSRF** — re-validate destination on every send (DNS rebinding), not just registration (§6.3).
9. **`signing_secret`** — encrypt at rest NOW, not as a follow-up (§3.4).
10. **RLS + FORCE RLS** on all new tables incl. `api_request_log`/`webhook_events`/`webhook_deliveries`;
    org-deletion retention policy decided (§3.3).
11. **Estimate** — revised to **3–4 weeks**; Phase 2 + Phase 5 were underestimated (§11).

**Reviewer verdict:** sound and complete enough to start building Phase 0–1, but **not safe to build
as-written** until the critical gaps (esp. #2 idempotency and #6 docs mechanism) are designed in —
which this revision now captures. Green-light to proceed once the §13 open questions are answered.
