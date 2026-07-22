# HAKKIU — Active Plan

> Update this file after every session or planning conversation.
> Last updated: 2026-07-22 (session 8 — Hetzner deploy prepared + pricing redesign planned)

---

## Planned: Pricing redesign — Red Points model (1 self-serve + 2 request-pricing)

Restructure pricing to mirror Red Points, adapted to what HAKKIU actually ships today.
Confirmed decisions: **self-serve = a live configurator** (pick brands/add-ons → live price →
Buy now), **two sales-led tiers** above it (Professional + Enterprise, "Request Pricing").

**Feature reality (what we can sell now — all built):** 12-platform marketplace counterfeit
detection, Gemini Vision scoring, auto takedown docs + delivery, geo/region scanning, WHOIS
domain tracking, managed takedown ($500 one-off), real-time monitoring, white-label/law-firm
mode, API access, branded PDF reports. NOT yet built (don't advertise): automation rules,
phishing/brand-impersonation, rogue apps, paid-ad monitoring, seller-network clustering.
→ Our positioning = **Counterfeits + Domain abuse**, not all 5 Red Points columns.

### Structure
- **Self-Serve (Buy now — only Stripe self-checkout):** configurator built on the EXISTING
  add-on system (`addon_brand`/`addon_domains`/`addon_region`/`addon_reports` all already exist).
  Base plan = all 12 platforms; scale via brands (1–5) + toggle add-ons; live total → checkout.
- **Professional (Request Pricing):** unlimited brands, real-time, domain tracking, managed
  takedown, priority support. Maps to `pro` entitlements. No Stripe — lead form.
- **Enterprise (Request Pricing):** white-label/multi-client, full API, custom integrations,
  SSO/SAML, SLA, EU residency. Maps to `agency`/`enterprise`. Lead form.

### Work breakdown
**Backend:** `billing_config.py`+`entitlements.py` add `self_serve` base plan, `SELF_SERVE_PLANS
= ("self_serve",)`; `seed_stripe.py` self-serve base price + reuse add-on prices; new
`sales_leads` table (migration) + `POST /api/v1/leads`.
**Customer FE:** restructure `src/lib/billing.ts` PLANS (self_serve selfServe:true;
professional/enterprise selfServe:false, monthly:null); new Red-Points-style configurator
component (live price → `checkout.tsx`); `pricing.tsx`/`plans.tsx` 3 cards — Buy now only on
self-serve, "Request Pricing" → lead-form modal → `POST /leads`.
**Admin parity (mandatory):** admin-api `GET /leads` (+ mark-contacted) gated by `leads.view`;
`leads.view`/`leads.edit` in `permissions.py`+`permissions.ts`; admin `Leads.tsx` page.
**Rollout:** pre-launch (no live customers) → clean redefine of plan keys OK; test in Stripe
sandbox first, then live.

---

## Current focus: Production deployment to Hetzner (domain hakkiu.com)

Decision (confirmed this session): **everything runs on the Hetzner server** (incl. the
customer frontend), **automatic deploy** via GitHub Actions, **Caddy** for reverse proxy +
auto-SSL. Supabase stays external.

**Subdomain map:** `hakkiu.com` + `www` → customer app · `admin.hakkiu.com` → admin FE ·
`api.hakkiu.com` → main API · `admin-api.hakkiu.com` → admin API.

**Key technical finding:** the customer app is built for the Cloudflare Workers runtime
(`@lovable.dev/vite-tanstack-config` only injects the cloudflare plugin at `command==="build"`,
so `vite preview` does NOT run workerd). We self-host by running the built worker under
`workerd` via `wrangler dev --local` — verified locally to serve full SSR HTML (HTTP 200).
`src/Dockerfile` uses a glibc base (alpine's musl can't run the workerd binary).

**All config prepared in the repo (see `docs/DEPLOYMENT.md`):** `Caddyfile`, updated
`docker-compose.yml` (Caddy + volumes + frontend build args), rewritten customer `Dockerfile`,
`.dockerignore` secret-leak fix, `.env.production.example`, `.github/workflows/deploy.yml`,
`scripts/backup.sh`. Remaining work is on the server (DNS, hardening, secrets, first deploy) —
those need the user's credentials and are documented step-by-step in `docs/DEPLOYMENT.md`.

**Trade-off noted:** `wrangler dev` self-host is fine for MVP; scaling later → `wrangler deploy`
to real Cloudflare (one command) and drop the `frontend` container.

---

## ✅ Completed: Codebase Architecture Refactoring (visi 6 žingsniai)

Visi žingsniai baigti. 229 testai praeina. TypeScript be klaidų.

### Kitas žingsnis: Automation Rules Builder (PRIORITY 2)

Tikslas: leisti administratoriams konfigūruoti automatines taisykles (pvz. "jei rizika HIGH → automatiškai generuoti takedown").

**Backend:**
- DB migration: `automation_rules` table
- `services/rules_engine.py` — evaluate rules against new infringement
- Hook into `persist_infringement()`
- `routes/rules.py` — CRUD endpoints

**Frontend + Admin Portal:**
- `/settings/automation` route
- Rules list + creation dialog + activity log
- Admin portal parity (mandatory per CLAUDE.md)

**Pastaba:** Supabase service-role key rotavimas vis dar pending (rankinis veiksmas reikalingas).

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

## Just completed: Priority 1 Phase 2 + Phase 3 — all security patches

All 10 Phase 3 items + 2 Phase 2 remaining items done:
- **[H12]** IP allowlist middleware for `/internal/*` (loopback + Docker bridge, `INTERNAL_API_ALLOWED_IPS` env)
- **[H14]** admin-api `uv.lock` committed + Dockerfile uses `uv export --frozen`
- **[M13]** Cookie storage adapter for Supabase auth in both apps (Secure + SameSite=Strict)
- **[M14/M15]** `ensureAbsoluteUrl` hardened + applied to all raw URL renders in customer + admin
- **[L3/L4/L5]** SSRF guard added to `unified_scraper.py` (detect_requires_javascript + _scrape_static)
- **[H13]** wrangler `^4.4.0` + `overrides` for sharp/dompurify in admin package.json
- **[M22/L16]** uv pinned to `0.10.10` in both Python Dockerfiles
- **[L17]** `.github/dependabot.yml` + `.github/workflows/ci.yml` (pip-audit + npm audit)
- **[L12]** Comp plan fix: `status='active'` now set in subscription update
- **[L13]** Stripe `sig_header` null-check before `construct_event`
- **[M9/M10]** Admin endpoints paginated: `.limit(1000)` on all tables, `list_users(page=1, per_page=1000)`

Priority 1 is now 100% complete. Next focus: Automation Rules Builder.

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

## Revised Priority Order (after deep security audit 2026-07-22)

### Priority 1 — Security patches (do BEFORE any production traffic)

Full audit run 2026-07-22 across 10 attack surfaces (57 findings). Full details in `security-audit.md`.

**Phase 0 — Blocking (do today):**
1. **Rotate Supabase service role key** — hardcoded in `apps/api/query_case_details.py:6`. Delete file, rotate key in dashboard, update `.env`.
2. **Admin staff privilege escalation** — `staff.manage` can reset/change-email any staff member including super-admins (`routes/staff.py:223–241`). Add `require_super_admin` check before `auth_attrs` block.
3. **Infringement IDOR (Critical)** — GET, GET evidence, PATCH status on `/infringements/{id}` have zero org ownership check. Join through `cases.organization_id` before returning/mutating.

**Phase 1 — This week:**
4. SSRF: user-controlled `official_domains`/`website` fetched via httpx with no host validation (`embedding_helper.py:116`)
5. Remaining IDOR: monitoring case status, takedowns, documents send-email
6. Open SMTP relay: `/notifications/test/email` sends to any address, no rate limit
7. Rate limiting: add `slowapi` with per-user caps on all scan endpoints
8. CSP + X-Frame-Options: add `public/_headers` to customer Cloudflare Worker

**Phase 2 — This sprint:**
9. Email confirmation disabled (Supabase config)
10. Password policy: 6-char min with no complexity in production
11. `.env` write via internal token endpoint (newline injection)
12. Restrict `/internal/*` to loopback or IP allowlist
13. Admin CSP missing in production (only in nginx.conf, not CF Worker)
14. admin-api missing lockfile (`uv lock` + commit)

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
