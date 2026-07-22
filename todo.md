# HAKKIU — TODO

> Tick items as they are completed. Add new items as they are discovered.
> Last updated: 2026-07-22 (Architecture refactoring P1.5 steps 1–6 complete)

---

## 🔴 PRIORITY 1 — Security Patches (2026-07-22 deep audit — see security-audit.md)

### Phase 0 — Do today (CRITICAL / account compromise risk)
- [x] **[C1] Rotate Supabase service role key** — hardcoded key removed from `query_case_details.py`; new `sb_secret_*` key generated in Supabase dashboard and set in `SUPABASE_SERVICE_ROLE_KEY`
- [x] **[H6/H7] Staff password/email escalation** — super-admin guard added before auth_attrs write in `admin-api/routes/staff.py`
- [x] **[C2] Infringement IDOR** — all 3 endpoints now join through `cases.organization_id` via `_infringement_or_404` helper

### Phase 1 — This week (HIGH / exploitable by authenticated customers)
- [x] **[C3] SSRF on brand official_domains** — new `services/ssrf.py` validator applied in `embedding_helper.py` (all 3 fetch sites), `follow_redirects=False`
- [x] **[H1-H4] IDOR on monitoring/documents** — `_assert_case_in_org` / `_assert_takedown_in_org` helpers added; case status, takedown PUT, takedown send-email, document send-email all org-scoped
- [x] **[H5] IDOR clients PUT** — UPDATE query now includes `.eq("organization_id", org_id)`
- [x] **[H9/H10] Rate limiting** — `slowapi` installed; 5/hr on check-brand, gather-evidence, check-ads, analyze; 3/hr + EmailStr on test-email
- [x] **[H8] Customer app security headers** — `public/_headers` created with CSP, X-Frame-Options, HSTS
- [x] **[H11] Playwright SSRF** — SSRF guard added before `page.goto()` in `playwright_client.py`
- [x] **[M4] gather-evidence / check-ads entitlement bypass** — `_require_paid_plan` gate added (returns 402 for free-tier users)

### Phase 2 — This sprint (MEDIUM)
- [x] **[M11] Enable email confirmation** — `enable_confirmations = true` in `supabase/config.toml` (must also apply in Supabase dashboard for production)
- [x] **[M12] Harden password policy** — `minimum_password_length = 12`, `password_requirements = "lower_upper_letters_digits"`, `secure_password_change = true`
- [x] **[M2] Fix .env token write** — newlines stripped from Meta token before writing
- [x] **[H12] Restrict /internal/* routes** — IP allowlist middleware added in `main.py`; loopback + Docker bridge allowed; configurable via `INTERNAL_API_ALLOWED_IPS`
- [x] **[M16] Admin CSP in production** — `apps/admin/public/_headers` created for Cloudflare Worker
- [x] **[H14] admin-api lockfile** — `uv lock` run, `uv.lock` committed, Dockerfile updated to use `uv export --frozen` + `uv pip install`
- [x] **[M6] File upload size guard** — 10 MB cap + MIME allowlist in `routes/brands.py`
- [x] **[M7] Request model limits** — `max_length=200` on brand_name; list field caps added to all scan request models
- [x] **[M1] SSRF blocklist** — `monitoring.py` MonitorRequest now uses `validate_ssrf_url()` (DNS-rebinding-resistant) instead of string-prefix `_PRIVATE_NETS`
- [x] **[M3] LIKE wildcard escape** — `%` and `_` escaped in `infringements.py` platform filter

### Phase 3 — Next sprint
- [x] **[M13] httpOnly cookie token storage** — custom `secureCookieStorage` adapter in `src/lib/supabase.ts` + `apps/admin/src/lib/supabase.ts`; uses `Secure; SameSite=Strict` cookies (full httpOnly requires server-side proxy)
- [x] **[M14/M15] URL validation in frontend** — `ensureAbsoluteUrl` hardened in `src/lib/utils.ts` + added to `apps/admin/src/lib/utils.ts`; applied to `submission_url` in takedown route + admin `screenshot_url`, `source_url`, `file_url` in `CaseDetail.tsx`
- [x] **[L3/L4/L5] SSRF in screenshot/phash helpers** — `validate_ssrf_url()` added to `unified_scraper.py:detect_requires_javascript` + `_scrape_static`; `storage.py` and `embedding_helper.py` were already protected
- [x] **[H13] npm CVEs** — wrangler bumped to `^4.4.0`; `overrides` added for `sharp >=0.35.0` + `dompurify >=3.2.0` in `apps/admin/package.json`
- [x] **[M21] Admin Dockerfile** — already uses `npm ci --no-fund` (no change needed)
- [x] **[M22/L16] Pin Docker images** — uv pinned to `0.10.10` in both Python Dockerfiles; TODO comments added for SHA256 base image pinning
- [x] **[L17] Dependency scanning** — `.github/dependabot.yml` created (npm + pip + actions); `.github/workflows/ci.yml` created with `pip-audit` + `npm audit --audit-level=high`
- [x] **[L12] Comp plan fix** — `"status": "active"` added to subscription update in comp path (`internal.py`)
- [x] **[L13] Stripe sig_header null-check** — explicit 400 guard added before `construct_event` in `billing.py`
- [x] **[M9/M10] Paginate admin endpoints** — `.limit(1000)` on all table queries in `customers.py`, `organizations.py`; `list_users(page=1, per_page=1000)` in `customers.py` + `search.py`

### Previously completed security items
- [x] `routes/staff.py` — Block self-permission grant: `require_super_admin` + `staff_id == staff.id` guard
- [x] `routes/staff.py` — Super-admin lockout covers `is_active=False` on last active super-admin + self-deactivation
- [x] `apps/admin-api/.env.example` — Replace real Supabase URL with placeholder
- [x] `Staff.tsx:219`, `StaffDetail.tsx:140`, `CustomerEditDialog.tsx:94` — `type="password"` on all three password inputs
- [x] `routes/cases.py:135` — Change `DELETE /cases/{case_id}` guard from `customers.edit` to `require_super_admin`
- [x] `routes/brands_admin.py:113` — Add file size (10 MB max) + MIME type validation on brand asset uploads
- [x] `apps/admin/nginx.conf` — Add CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS headers
- [x] `main_api.py:21` — Replace silent `INTERNAL_API_SECRET` fallback with `RuntimeError` on startup if not set
- [x] All route files — Pass `request.client.host` as `ip` param to every `write_audit_log` call
- [x] `routes/customers.py:186` — Raise customer password minimum from 6 to 8 characters
- [x] `permissions.py` + backend — Enforce `billing.view` server-side

---

## 🔴 PRIORITY 1.5 — Codebase Architecture Refactoring (prieš Automation Rules)

### Žingsnis 1 — Debug skriptas + tranco failas
- [x] `git rm apps/api/query_case_details.py`
- [x] `git rm --cached apps/api/src/tracemark_api/services/tranco_top_100k.txt` + `.gitignore`
- [ ] **Rotavimas:** Supabase dashboard → rotate service role key (key buvo git istorijoje!)

### Žingsnis 2 — pytest į CI
- [x] `.github/workflows/ci.yml` — pridėti `test-python-api` job su pytest
- [x] Patikrinti kurie testai reikalauja tikro Supabase → pažymėti `@pytest.mark.integration`

### Žingsnis 3 — `conftest.py`
- [x] Sukurti `apps/api/tests/conftest.py` su bendru `client`, `auth_user`, `auth_profile`
- [x] Palaipsniui migruoti testų failus (po vieną, tikrinant po kiekvieno)

### Žingsnis 4 — organization_id dublikacijos (po vieną failą)
- [x] `routes/infringements.py` — `get_current_user` → `get_current_profile`, pašalinti `_get_user_organization_id`
- [x] `routes/documents.py` — `get_current_user` → `get_current_profile`, pašalinti `_doc_org_id`
- [x] `routes/monitoring.py` — `_require_paid_plan(profile)` refaktoringas (pašalina ir async problemą)
- [x] `routes/clients.py` — migruota į `get_current_profile` (visi 5 handlers)

### Žingsnis 5 — async/sync sumaišymas
- [x] `monitoring.py` `check_brand` — `asyncio.to_thread` ant `_reject_if_brand_locked`; `import asyncio` perkeltas į modulio lygį
- [x] `billing.py` `stripe_webhook` — turi `await request.body()`, async paliktas

### Žingsnis 6 — Zustand ↔ Supabase (fazėmis)
- [x] Faza 6.0: `serverId?: string` į `Mark` tipą (`store.ts`)
- [x] Faza 6.1: saugoti `serverId` iš `getBrands()` atsakymo (`monitoring.tsx:151-163`)
- [x] Faza 6.2: `handleSave` — naudoja `editingMark.serverId` kaip pirminį šaltinį (pašalina dublikatus)
- [x] Faza 6.3: `updateMark` → saugo `serverId` po sėkmingo save
- [x] Bump localStorage: `tracemark-store-v7` → `v8`

---

## 🔴 PRIORITY — Pricing Redesign (Red Points model: 1 self-serve configurator + Professional + Enterprise)

> Deep research complete (2026-07-22). Concrete pricing set. See plan.md for full spec.
> Self-serve: $129/mo (1 brand) → $389/mo (5 brands) + add-ons. Professional + Enterprise = lead form.
> Key differentiator: "Never charged per detection. Never charged per takedown."

### Backend
- [ ] `billing_config.py` — add `self_serve` base plan; `SELF_SERVE_PLANS = ("self_serve",)`
- [ ] `entitlements.py` — `self_serve` base (all 12 platforms, daily monitoring)
- [ ] `seed_stripe.py` — Stripe prices: base €849/mo; TM add-ons €149/€269/€349/€469/€579; per-marketplace €40/mo (11 prices, one per platform); domain protection €649/mo. Monthly only. Sandbox first.
- [x] Migration: `sales_leads` table — `supabase/migrations/20260722000001_sales_leads.sql`
- [x] `routes/leads.py` — `POST /api/v1/leads` (public, no auth) + rate-limit 3/hr per IP; registered in `main.py`

### Customer Frontend
- [ ] `src/lib/billing.ts` — restructure PLANS for self_serve checkout
- [x] New `PricingConfigurator` component in `pricing.tsx`: TM count buttons (1-5) + marketplace checkboxes (Amazon included, 11×€40) + domain toggle (€649) + live total
- [x] `pricing.tsx` — 3-card layout: Self-Serve configurator, Professional, Enterprise
- [x] `RequestPricingModal` — 6-field form → `POST /api/v1/leads` → thank-you state; `request-pricing-modal.tsx`

### Admin Portal (mandatory parity)
- [x] `admin-api/routes/leads.py`: `GET /leads` (paginated, filter by status/tier) + `PATCH /leads/{id}`, gated `leads.view`/`leads.edit`
- [x] Add `leads.view`, `leads.edit` to `permissions.py` AND `permissions.ts`; `sales` role preset gets both
- [x] `apps/admin/src/pages/Leads.tsx` — table with tier, company, email, brand_count_range, status badge, mark-contacted/close actions
- [x] `apps/admin/src/router.tsx` — `/leads` route added
- [x] `apps/admin/src/components/layout.tsx` — "Sales Leads" nav item under Customers group

---

## 🔴 PRIORITY 2 — Automation Rules Builder

### Backend
- [ ] DB migration: `automation_rules` table (id, org_id, name, enabled, conditions jsonb, actions jsonb, created_at)
- [ ] `services/rules_engine.py` — evaluate rules against a new infringement
- [ ] Hook rules engine into `persist_infringement()` (called after save)
- [ ] `routes/rules.py` — GET / POST / PUT / DELETE `/api/v1/rules`
- [ ] Unit tests for rules engine

### Customer Frontend
- [ ] `/settings/automation` route + page
- [ ] Rules list with enable/disable toggles
- [ ] Rule creation dialog (condition selectors + action picker)
- [ ] Rules activity log (which rule fired on which case)

### Admin Portal (mandatory parity)
- [ ] `apps/admin-api`: rules CRUD endpoints across all orgs
- [ ] Add `rules.view`, `rules.edit` to `permissions.py` AND `permissions.ts`
- [ ] `apps/admin`: surface rules under Company detail view, gated with `<Can>`

---

## 🟡 PRIORITY 3 — Amazon SES Email

- [ ] Configure AWS SES, verify domain DNS (SPF, DKIM, DMARC)
- [ ] Wire Supabase Auth custom SMTP to AWS SES
- [ ] Set up `noreply@tracemark.ai` and `support@tracemark.ai`
- [ ] HTML email templates (infringement alerts, takedown confirmations, weekly reports)

---

## 🟡 PRIORITY 4 — Production Deployment (Hetzner CCX13) — domain hakkiu.com

### Prepared in repo (config ready — session 8)
- [x] Dockerize API, admin-api, admin frontend, customer frontend (all 4 Dockerfiles exist)
- [x] Customer `src/Dockerfile` — rewritten from `bun run dev` → production build + `wrangler dev --local` (workerd). Verified: built worker serves SSR HTTP 200. glibc base for workerd.
- [x] `docker-compose.yml` — Caddy service + `caddy_data`/`caddy_config` volumes + frontend VITE_* build args added
- [x] `Caddyfile` — 4 subdomains (hakkiu.com, admin/api/admin-api.hakkiu.com) + www→apex redirect + auto Let's Encrypt + customer CSP/security headers (api.tracemark.ai→api.hakkiu.com)
- [x] `.dockerignore` — excludes `.env`, `.wrangler`, `dist` from customer image (secret-leak fix)
- [x] `.env.production.example` — production URLs/CORS for hakkiu.com + secret placeholders
- [x] `.github/workflows/deploy.yml` — SSH auto-deploy after green CI on main (appleboy/ssh-action)
- [x] `scripts/backup.sh` — nightly pg_dump → local + Hetzner Storage Box, 14-day rotation
- [x] `docs/DEPLOYMENT.md` — full server-hardening runbook (deploy user, SSH keys-only, ufw, fail2ban, unattended-upgrades, docker) + DNS + first deploy + external-service wiring + verification

### User must run (needs their credentials — instructions in docs/DEPLOYMENT.md)
- [ ] DNS: A records (@, www, admin, api, admin-api) → 116.202.8.87 (+ AAAA for IPv6)
- [ ] Server hardening: deploy user, SSH keys-only, ufw (80/443/SSH), fail2ban, unattended-upgrades, Docker
- [ ] Clone to `/opt/hakkiu`, create `.env` from `.env.production.example`, fill secrets (Stripe LIVE keys)
- [ ] First deploy: `docker compose build && up -d`; confirm Caddy issues certs
- [ ] GitHub repo secrets: SSH_HOST / SSH_USER / SSH_KEY (+ SSH_PORT) for the deploy workflow
- [ ] Stripe webhook → https://api.hakkiu.com/api/v1/billing/webhook; Supabase Auth Site/Redirect URLs
- [ ] Backups: install postgresql-client, set DATABASE_URL, add cron
- [ ] Verification checklist (all 5 hostnames load over HTTPS; scan + Stripe checkout work)

---

## 🟡 PRIORITY 5 — Admin Portal Improvements

### Quick wins (do first, 30 min – 2 hours each)
- [x] Fix `Dashboard.tsx` — "Cases needing attention" now filters `status=pending|error` only
- [x] Fix `CaseDetail.tsx` — replace `history.back()` with `navigate({ to: '/cases' })` after delete
- [x] `CustomerDetail.tsx` — show `current_period_end` on billing card
- [x] `Cases.tsx` — company name column now links to OrganizationDetail
- [x] `Dashboard.tsx` — audit action codes mapped to human-readable labels via `ACTION_LABELS` in `lib/utils.ts`
- [x] Add `<CopyableId>` clipboard component — used in CustomerDetail (id + org), Audit log (target_id)
- [x] `CustomerDetail.tsx` — organization_id now shows org name + link to OrganizationDetail

### Server-side filtering + pagination (highest operational impact)
- [x] `Cases.tsx` — `?status=` wired to backend; risk_level filter client-side; sortable columns added
- [x] `Customers.tsx` — email/name search input (client-side filter, backend doesn't support ?email=)
- [x] `Organizations.tsx` — plan filter dropdown + sortable MRR column added
- [x] `Audit.tsx` — action filter + staff search + load-more (+100) wired to `?action=&limit=` params

### Error states (all list pages currently show empty table on 500/403)
- [x] `Customers.tsx` — `isError` branch with retry button
- [x] `Organizations.tsx` — `isError` branch with retry button
- [x] `Cases.tsx` — `isError` branch with retry button
- [x] `Audit.tsx` — `isError` branch with retry button
- [x] `Staff.tsx` — `isError` branch with retry button

### Missing features (backend exists, no UI)
- [x] Add `/brands` top-level route + filterable cross-org brands table (`Brands.tsx`)
- [x] Add audit log `target_id` links to entity pages (customer/org/staff → direct link; brand/case → org link)
- [x] `CustomerDetail.tsx` Danger Zone — "Delete Customer" button with confirm dialog, gated `<Can permission="customers.delete">`
- [x] `OrganizationDetail.tsx` Members section — "Add Member" dialog using `POST /organizations/{id}/members`
- [x] `BrandEditDialog` — `platforms` + `target_regions` textarea fields added
- [x] Add `/integrations` page — Meta token exchange UI (`Integrations.tsx`)
- [x] Mutation pending states on "Remove member" and "Delete brand" buttons

### Dashboard metrics
- [x] Add KPI cards: Total MRR, Paying Orgs count, Free Orgs count (computed from already-fetched `/organizations`)
- [x] Add takedown pipeline mini-stats: pending / sent / acknowledged counts (`GET /stats/takedowns` endpoint + Dashboard KPI cards)

### Cases UX
- [x] Add checkbox column + bulk action bar (Mark Reviewed / Dismiss / Escalate) to Cases table
- [x] Add `risk_level` filter dropdown to Cases page
- [x] Add sortable columns to Cases table (Brand, Risk, Status, Infringements)

---

## 🟡 PRIORITY 6 — Scraper Health Monitoring (mostly done — see note)

- [ ] Manual audit: test all 12 platforms locally and confirm parsers still work (manual QA task, not code)
- [x] Automated cron: daily **lightweight reachability probe** per platform (`scraper_health.run_reachability_probes`, wired as a daemon thread in `main.py` startup). Cheap HTTP GETs — no Firecrawl JS scrapes.
- [x] Supabase table: log scraper failures per-platform — `scraper_health_log` migration `20260721000001` (applied to live DB ✅)
- [~] Alerting: **in-page warnings only for now** — degraded platforms flagged in the admin Scraper Health page (`is_degraded`). Slack/SMTP push alerting deferred.
- [x] Admin dashboard: real-time per-platform success rate, latency, recent failures + Firecrawl credit usage. `GET /scraper-health` (admin-api) + `ScraperHealth.tsx` page, gated by `scraper_health.view`.

> Data source: every scraper call in `marketplace.batch_detect` now records health per platform via `scraper_health.probe(...)`. Firecrawl credits read from existing `api_usage_records`. Remaining to finish P6 fully: apply the migration, then (optional) add push alerting.

- [x] Per-platform drill-down: `brand_name`/`caller_id` columns added to `scraper_health_log` (migration `20260721000002`), `GET /scraper-health/{platform}/events` admin-api endpoint, `ScraperHealthDetail.tsx` page with window/status/source filters, platform names in list page are now clickable links.

---

## 🟡 PRIORITY 7 — Phishing Site Detection + Domain Takedown Pipeline

- [ ] Extend WHOIS domain surveillance with newly-registered lookalike domain detection
- [ ] Add MX record detection for phishing-capable domains
- [ ] Automated ICANN/registrar abuse report submission
- [ ] Surface phishing cases in the customer dashboard (separate from marketplace counterfeits)
- [ ] Admin portal parity: phishing cases view + management

---

## PRIORITY 8 — Multi-Model AI Routing

### Backend
- [ ] Abstract Gemini calls behind a `LLMClient` interface (LiteLLM or custom)
- [ ] Benchmark Claude + DeepSeek-VL + Qwen-VL vs Gemini for visual detection (price/performance)
- [ ] Add auto-retry + failover (Gemini rate-limit → Claude/DeepSeek transparently)

---

## PRIORITY 9 — Seller/Actor Network Clustering

- [ ] Heuristic: link cases with same seller name + similar pHash across platforms
- [ ] UI: "network" view grouping linked cases
- [ ] Single cross-platform takedown request targeting all linked listings
- [ ] Admin portal: network graph / cluster view

---

## PRIORITY 10 — Rogue App Detection + Paid Ad Monitoring

### Rogue App Detection
- [ ] Apple App Store + Google Play public API scan for brand name/logo
- [ ] Generate App Store / Play Console abuse reports
- [ ] Admin portal parity: rogue app cases view + management

### Paid Ad Abuse Monitoring
- [ ] Extend Google Ads Transparency scraper for unauthorized brand ads
- [ ] Extend Meta Ad Library scraper for unauthorized brand ads
- [ ] Surface paid ad abuse cases in customer dashboard
- [ ] Admin portal parity: paid ad cases view + management

---

## PRIORITY 11 — Org Multi-Member Self-Serve (§10 Fazė F)

- [ ] Customer-side member invitation endpoints + SMTP emails + activation tokens
- [ ] Customer-app org switcher UI
- [ ] Member invite modal on customer side
- [ ] Zustand store scoped by `organization_id`

---

## PRIORITY 12 — SEO & Web Analytics

- [ ] Google Analytics 4 (GA4): embed tag management on landing, pricing, checkout routes; track session events and churn
- [ ] Google Search Console: DNS verification, monitor organic keyword queries, search impressions, CTR
- [ ] Conversion tracking: custom GA4 events (plan selected, checkout complete, add-on upgraded)
- [ ] `sitemap.xml` generator + `robots.txt` for marketing pages

---

## PRIORITY 13 — UI Case / Alert Decoupling (Patrick's Review)

### Customer Frontend
- [ ] Decouple scan results into individual UI cases — each infringement from `infringements` table shown as independent card with per-item actions (takedown, escalate, whitelist, dismiss)
- [ ] Patrick's frontend review: UI cleanups and adjustments as advised

### Backend
- [ ] Patrick's backend review: route cleanup, refactoring, test stabilization

---

## PRIORITY 14 — Advanced Logo & Image Similarity

### Backend
- [ ] `embedder.py` — CLIP embeddings replacing pHash for robust visual matching; evaluate DeepSeek-VL / Qwen-VL vs OpenAI/Gemini for price-performance
- [ ] `gemini_check.py` — wire `generate_evidence_analysis` into Tier 2 pipeline for Gemini Vision adjudication (1 call per copycat screenshot, after Tier 0/1 filters discard non-matches)
- [ ] CV-based logo cropping — Gemini-based or OpenCV/YOLO logo region extraction from screenshots before embedding comparison

---

## Backlog / future

- [ ] MFA + domain-restricted logins for admin staff
- [ ] Consumption-based pricing tier (pay-per-takedown via Stripe metered billing)
- [ ] China domestic platform coverage (Pinduoduo, Goofish, WeChat, Douyin)

---

## Done (recent, for reference)

- [x] Admin portal: PRIORITY 5 complete — Brands page, Integrations page, sortable Cases, filters, error states, CopyableId, audit links, Delete Customer, Add Member, BrandEditDialog platforms/regions, Dashboard MRR KPIs, bulk case actions (Mark Reviewed/Dismiss/Escalate), takedown pipeline mini-stats (pending/sent/ack'd KPI cards)
- [x] Security: super-admin guards on role/is_active/permissions changes; password fields fixed
- [x] Admin portal: staff detail editor, role-based super-admin
- [x] Admin portal: charge-now billing + invoice dates
- [x] Admin portal: full customer editing (email/name/password, brand fields+photos)
- [x] Admin portal: billing comp/charge
- [x] Single root `.env` for whole monorepo
- [x] Organizations + organization_members schema + backfill migration
- [x] Member management in admin portal (OrganizationDetail view)
- [x] All core features §1–§9 complete (scrapers, AI, billing, takedowns, geo scanning, law firm mode, etc.)
