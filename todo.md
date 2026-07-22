# HAKKIU — TODO

> Tick items as they are completed. Add new items as they are discovered.
> Last updated: 2026-07-21 (PRIORITY 1 complete)

---

## 🔴 PRIORITY 1 — Security Patches (2026-07-22 deep audit — see security-audit.md)

### Phase 0 — Do today (CRITICAL / account compromise risk)
- [ ] **[C1] Rotate Supabase service role key** — hardcoded in `apps/api/query_case_details.py:6`; delete or fix the file, rotate key in Supabase dashboard, update `.env`
- [ ] **[H6/H7] Staff password/email escalation** — `staff.manage` can reset/redirect any staff member's credentials (`admin-api/routes/staff.py:223–241`); add super-admin check before `auth_attrs` block
- [ ] **[C2] Infringement IDOR** — `GET /infringements/{id}`, `GET /infringements/{id}/evidence`, `PATCH /infringements/{id}/status` — add `cases.organization_id = caller_org_id` check before returning/mutating

### Phase 1 — This week (HIGH / exploitable by authenticated customers)
- [ ] **[C3] SSRF on brand official_domains** — `embedding_helper.py:116–207`: add SSRF host validation before httpx fetch of user-supplied domain URLs
- [ ] **[H1-H4] IDOR on monitoring/documents** — `monitoring.py:365,433,501`, `documents.py:12`: add org ownership check on case status, takedown PUT, takedown send-email, document send-email
- [ ] **[H5] IDOR clients PUT** — `routes/clients.py:109`: add `organization_id` clause to UPDATE query (not just the pre-check)
- [ ] **[H9/H10] Rate limiting** — install `slowapi`; 5/hr per user on check-brand, gather-evidence, check-ads, analyze; 3/hr + EmailStr validation on test-email
- [ ] **[H8] Customer app security headers** — add `public/_headers` for Cloudflare Worker (CSP, X-Frame-Options, X-Content-Type-Options)
- [ ] **[H11] Playwright SSRF** — add pre-`goto()` host validation in `playwright_client.py`
- [ ] **[M4] gather-evidence / check-ads entitlement bypass** — add plan check before triggering scrape

### Phase 2 — This sprint (MEDIUM)
- [ ] **[M11] Enable email confirmation** — `supabase/config.toml:226` → `enable_confirmations = true`; apply to production Supabase dashboard
- [ ] **[M12] Harden password policy** — `minimum_password_length = 12`, add complexity, `secure_password_change = true` in config.toml + production dashboard
- [ ] **[M2] Fix .env token write** — strip newlines from Meta token before writing; move to DB long-term
- [ ] **[H12] Restrict /internal/* routes** — IP allowlist middleware or separate port; not publicly reachable
- [ ] **[M16] Admin CSP in production** — add `apps/admin/public/_headers` for Cloudflare Worker (CSP is currently nginx-only)
- [ ] **[H14] admin-api lockfile** — run `uv lock` in `apps/admin-api/`, commit `uv.lock`, change Dockerfile to `uv sync --frozen`
- [ ] **[M6] File upload size guard** — check Content-Length before `file.file.read()` in `routes/brands.py:305`
- [ ] **[M7] Request model limits** — `max_length=200` on brand_name; `max_items=10` on platforms/official_advertisers/official_domains
- [ ] **[M1] SSRF blocklist** — replace string-prefix IP matching in `monitoring.py` with `ipaddress` module check after DNS resolution (defeats octal/hex encoding + DNS rebinding)
- [ ] **[M3] LIKE wildcard escape** — escape `%` and `_` in `infringements.py:119` platform filter

### Phase 3 — Next sprint
- [ ] **[M13] httpOnly cookie token storage** — custom Supabase storage adapter (httpOnly, Secure, SameSite=Strict)
- [ ] **[M14/M15] URL validation in frontend** — harden `ensureAbsoluteUrl`; apply to submission_url, admin portal source_url/screenshot_url
- [ ] **[L3/L4/L5] SSRF in screenshot/phash helpers** — shared SSRF-safe HTTP helper applied to `storage.py`, `embedding_helper.py:295`, `unified_scraper.py:188`
- [ ] **[H13] npm CVEs** — upgrade wrangler past 4.101.0 or add `overrides` for sharp >=0.35.0; upgrade dompurify >=3.4.12
- [ ] **[M21] Admin Dockerfile** — change `npm install --no-audit` to `npm ci`
- [ ] **[M22/L16] Pin Docker images** — SHA256 digests on all base images; pin uv version
- [ ] **[L17] Dependency scanning** — add Dependabot config, `pip-audit` in CI, `npm audit --audit-level=high` in CI
- [ ] **[L12] Comp plan fix** — set `subscription.status='active'` in comp path (`internal.py:331`)
- [ ] **[L13] Stripe sig_header null-check** — explicit guard before `construct_event`
- [ ] **[M9/M10] Paginate admin endpoints** — paginated `list_users()`, LIMIT on list_organizations/list_customers

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

## 🟡 PRIORITY 4 — Production Deployment (Hetzner CCX13)

- [ ] Provision Hetzner CCX13 instance (Ubuntu)
- [ ] Dockerize API, admin-api, admin frontend, customer frontend
- [ ] `docker-compose.yml` for production
- [ ] Caddy reverse proxy + Let's Encrypt SSL
- [ ] GitHub Actions CI/CD pipeline (lint → test → build → deploy)
- [ ] Automated DB + Storage backups to Hetzner Storage Box

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
- [x] Supabase table: log scraper failures per-platform — `scraper_health_log` migration `20260721000001` (⚠️ NOT yet applied to live DB — run `supabase db push`)
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
