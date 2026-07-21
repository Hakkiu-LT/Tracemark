# HAKKIU — Active Plan

> Update this file after every session or planning conversation.
> Last updated: 2026-07-21 (session 5)

---

## Just completed: Rebrand Tracemark → HAKKIU (visible identity)

Product renamed from "Tracemark" to "HAKKIU" across all USER-FACING surfaces + new
brand assets. Safe discriminator used: capital `Tracemark` = brand text (changed);
lowercase `tracemark` = infra (python packages `tracemark_api`/`tracemark_admin_api`,
domains `tracemark.ai/.io`, storage keys) — deliberately LEFT intact to avoid a
breaking refactor.

- **Assets:** `public/hakkiu-logo-symbol.png` + `favicon-32x32.png` added to BOTH the
  customer app (repo-root `public/`) and admin app (`apps/admin/public/`).
- **Logo mark:** new `HakkiuMark` component in each app renders the hedgehog symbol as a
  CSS mask filled with `currentColor` (adapts to any background). Replaced the old
  `ShieldCheck` brand mark in: customer sidebar, landing nav, auth screen; admin sidebar
  + SignIn. Wordmark text → "HAKKIU" / "HAKKIU Admin".
- **Text:** all page `<title>`/meta/OG, footers, copy, test-email strings, "Vision API"
  attribution, Stripe seed product names, FastAPI Swagger titles → HAKKIU (43 code
  occurrences via subagent + brand-mark files by hand + all `*.md` docs).
- **Favicon** wired into customer `__root.tsx` head + admin `index.html`.
- **Out of scope / flagged (NOT changed):** python package/module names & imports, DB
  tables, Supabase `project_id`, domains + emails (HAKKIU domain not provisioned yet),
  localStorage keys (would log users out), wrangler/docker image names.
- Verified: customer + admin `tsc --noEmit` clean; all 4 services restarted; logo +
  favicon served (200 image/png) on both apps; titles render "HAKKIU".

---

## Earlier: PRIORITY 6 — Scraper Health Monitoring (⚠️ 1 step pending)

Per-platform scraper health, surfaced in the Admin Portal. **No push alerting** —
degraded platforms are flagged in-page only (decision confirmed this session).

- DB: `scraper_health_log` migration `20260721000001` (append-only). **⚠️ NOT yet applied
  to the live DB — run `supabase db push` to finish.**
- Main API: new `services/scraper_health.py` (`record_scrape`, `classify_error`, async
  `probe()` helper, `run_reachability_probes()`). `marketplace.batch_detect` now wraps
  every platform scrape in `scraper_health.probe(...)`, recording per-platform
  success/latency/error. A daily reachability-probe daemon thread added in `main.py` startup.
- Admin API: `GET /scraper-health` (`routes/scraper_health.py`) aggregates per-platform
  success rate/latency/last-failure + Firecrawl credits (from `api_usage_records`), gated by
  new `scraper_health.view` permission (added to `permissions.py` + `permissions.ts`).
- Admin FE: `ScraperHealth.tsx` page (KPI cards, per-platform table, degraded badges,
  24h/7d toggle, isError retry) + route `/monitoring/scrapers` + nav entry.

Verified: both backends import cleanly, admin app `tsc` clean, scraper test suite green
(1 pre-existing unrelated google_ads test failure). Remaining: apply the migration, then
smoke-test the endpoint/page against real data.

**Drill-down added (session 5):** `brand_name` and `caller_id` columns added to
`scraper_health_log` via migration `20260721000002`. `record_scrape` and `probe` signatures
extended with those keyword args; all 12 `batch_detect` platform closures now pass both
through. `run_reachability_probes` passes `caller_id="system"`. Admin API: new
`GET /scraper-health/{platform}/events` endpoint (window/status/source filters, up to 1000
rows). Admin FE: `ScraperHealthDetail.tsx` with three filter Button-groups, events table
(time, brand, country, status badge, latency, error type + detail), isError/isLoading states.
Platform names in `ScraperHealth.tsx` are now clickable links. Route
`/monitoring/scrapers/$platform` wired in `router.tsx`.

---

## Next focus: Automation Rules Builder (🔴 HIGH PRIORITY)

This is the next major feature. It lets users define if/then rules so that
detected infringements are handled automatically — without manual review per
case. Competitors (MarqVision Smart Rules, Podqi) already have this.

### Why this first?
- Biggest competitive gap at SMB price points right now.
- Closes the detection pipeline loop: infringements are already persisted; rules
  is the layer that acts on them automatically.
- Does not require new scraping work — pure business logic on existing data.

### High-level approach

#### 1. DB migration — `automation_rules` table
Columns: `id`, `org_id`, `name`, `enabled`, `conditions` (jsonb), `actions`
(jsonb), `created_at`. Conditions: platform, confidence_threshold, risk_level,
keyword_match. Actions: auto_takedown | escalate | notify | dismiss.

#### 2. Rules evaluation engine (`services/rules_engine.py`)
Called from `persist_infringement()` after a new infringement is saved.
Loads all enabled rules for the org, evaluates conditions against the new
infringement, executes matching actions.

#### 3. Customer API endpoints (`routes/rules.py`)
- `GET  /api/v1/rules` — list rules for the org
- `POST /api/v1/rules` — create rule
- `PUT  /api/v1/rules/{id}` — update rule
- `DELETE /api/v1/rules/{id}` — delete rule

#### 4. Customer frontend (`/settings/automation`)
- Rules list with enable/disable toggles.
- Rule creation dialog: condition selectors + action selector.
- Rules activity log (which rule fired on which case).

#### 5. Admin portal parity (mandatory per CLAUDE.md)
- `apps/admin-api`: expose rules read/write across all orgs, gated by `rules.view`/`rules.edit`.
- `apps/admin`: surface under Company detail view, gated with `<Can>`.
- Add `rules.view`, `rules.edit` to `permissions.py` + `permissions.ts`.

---

## Revised Priority Order (after security audit + competitor analysis)

### Priority 1 — Security patches (1–3 days, do BEFORE any production traffic)

Three HIGH-severity issues found in the admin portal. Must fix first.

1. **Privilege escalation** (`routes/staff.py:242`) — any admin-role staff can
   call `set_permissions` on themselves. Fix: add self-modification block + change
   guard to `require_super_admin`.
2. **Super-admin lockout via `is_active=False`** (`routes/staff.py:182–195`) — 
   the lockout guard only checks `is_super_admin=False`, not `is_active=False`.
   Fix: extend lockout check to cover deactivation of the last active super-admin.
3. **Live Supabase URL in tracked `.env.example`** — replace the real project URL
   with a placeholder. Consider `git filter-repo` scrub if repo becomes public.

Plus these MEDIUM fixes (bundle into the same PR):
- Fix `type="text"` → `type="password"` on 3 password inputs (Staff.tsx:219,
  StaffDetail.tsx:140, CustomerEditDialog.tsx:94) — 30 min.
- Gate `DELETE /cases/{case_id}` behind `require_super_admin` instead of
  `customers.edit` (cases.py:135).
- Add file size (10 MB) + MIME type validation on brand asset uploads
  (brands_admin.py:113).
- Add security headers to `apps/admin/nginx.conf` (CSP, X-Frame-Options, HSTS
  etc.).

### Priority 2 — Automation Rules Builder (finish it — in progress)

See section above.

### Priority 3 — Amazon SES email integration

Required before phishing/domain pipeline, user invites, and growth in
transactional email volume. No dependencies.

### Priority 4 — Production deployment (Hetzner CCX13)

Security + SES should be resolved before going live. Once done, Hetzner
unblocks everything that requires a stable URL (Stripe webhooks, Supabase auth
callbacks, Meta App Review).

### Priority 5 — Admin portal improvements (one sprint after Hetzner)

Cases page becomes unusable at scale without server-side filtering. Key fixes:
- Server-side filtering on Cases, Customers, Organizations, Audit pages.
- Error states on all list pages (currently: empty table = 500 error, undetectable).
- Brands top-level page (backend ready, no `/brands` route exists yet).
- Audit log filters + pagination (backend ready, UI sends no params).
- Customer delete button + Add member to org dialog.
- Meta token exchange UI (currently requires manual curl).

### Priority 6 — Scraper Health Monitoring

The manual audit portion can be a side task during security sprint. Full
automated suite and metrics dashboard come after Hetzner (you need stable
infra to run daily crons against).

### Priority 7 — Phishing site detection + domain takedown pipeline

First differentiated platform expansion. Depends on SES (for abuse notification
emails) and stable production infra. Opens a new buyer segment (any company with
a domain, not just brand owners). HAKKIU already has WHOIS + domain
surveillance — extend with:
- Newly registered lookalike domain detection.
- Automated ICANN/registrar abuse report submission.

### Priority 8 — Multi-model AI routing

Strategically important but not customer-visible right now. Gemini works.
Deprioritize until volume justifies failover + cost optimization.

### Priority 9 — Seller/actor network clustering (biggest long-term moat)

When the same operator appears on Amazon + eBay + AliExpress, link those cases
into a network and enable a single takedown targeting all platforms. No self-serve
competitor offers this. Start with: same seller name + similar pHash across
platforms as a heuristic. Depends on scraper health (reliable per-platform data)
and sufficient case volume.

### Priority 10 — Rogue mobile app detection + paid ad abuse monitoring

Quick coverage wins. App Store / Play Console public APIs → scan for brand
name/logo → generate abuse reports. Google Ads Transparency + Meta Ad Library
scrapers already partially exist.

---

## Competitive Context (as of 2026-07-21)

**Market structure:** bifurcated between enterprise-only ($25K–$100K+/yr, sales-led:
Red Points, Corsearch, MarqVision, BrandShield) and nascent self-serve AI players
(Podqi, Bolster, Doppel — specific threat vectors only).

**HAKKIU's clearest position:** self-serve, transparent pricing, same-day
activation, multi-channel brand protection for SMB + growth-stage brands. No major
player owns this position.

**Top 5 differentiating features to build (by competitive impact):**
1. Seller/actor network clustering — no self-serve competitor has this.
2. Phishing site detection + domain takedown — opens a new buyer segment.
3. Rogue mobile app detection — zero self-serve competition.
4. Paid ad abuse monitoring — Google + Meta scrapers already partially exist.
5. Consumption-based pricing tier — pay-per-takedown, no monthly minimum. Stripe
   already supports metered billing. No competitor offers this model at SMB.

**Threats to watch:**
- **Podqi** — most direct competitor (same automation-first, self-serve angle),
  General Catalyst backed, 1.2-day resolution claims.
- **Doppel** — $600M valuation, 3x ARR, moving fast into the enterprise segment.
- **Sentryc** — reportedly financially distressed → potential EU customer
  acquisition opportunity.

---

## Architecture notes (stable)

- One shared `.env` at repo root — no per-app env files.
- Admin portal reads/writes the SAME Supabase tables as the customer app.
- All cross-app operations (SMTP, entitlements, metrics) go through main-API
  `/internal/*` endpoints, never duplicated in admin-api.
- Supabase migrations: `supabase/migrations/` — apply with `supabase db push`.
- Audit log: every admin mutation calls `write_audit_log`.
