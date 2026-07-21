# Tracemark — TODO

> Tick items as they are completed. Add new items as they are discovered.
> Last updated: 2026-07-21

---

## 🔴 PRIORITY 1 — Security Patches (before any production traffic)

### HIGH severity (must fix immediately)
- [x] `routes/staff.py` — Block self-permission grant: `require_super_admin` + `staff_id == staff.id` guard
- [x] `routes/staff.py` — Super-admin lockout covers `is_active=False` on last active super-admin + self-deactivation
- [ ] `apps/admin-api/.env.example` — Replace real Supabase URL (`kdiyjwwejrdqnccfqhyv.supabase.co`) with placeholder `your-project-ref.supabase.co`

### MEDIUM severity (bundle into same security PR)
- [x] `Staff.tsx:219`, `StaffDetail.tsx:140`, `CustomerEditDialog.tsx:94` — `type="password"` on all three password inputs
- [ ] `routes/cases.py:135` — Change `DELETE /cases/{case_id}` guard from `customers.edit` to `require_super_admin`
- [ ] `routes/brands_admin.py:113` — Add file size (10 MB max) + MIME type validation on brand asset uploads; same fix in `routes/internal.py:84`
- [ ] `apps/admin/nginx.conf` — Add CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy headers

### LOW severity (can do in parallel)
- [ ] `main_api.py:21` — Replace silent `INTERNAL_API_SECRET` fallback with `RuntimeError` on startup if not set
- [ ] All route files — Pass `request.client.host` as `ip` param to every `write_audit_log` call (currently always NULL)
- [ ] `routes/customers.py:186` — Raise customer password minimum from 6 to 8 characters
- [ ] `permissions.py` + backend — Enforce `billing.view` server-side on `/customers/{id}` and `/organizations/{id}` endpoints (currently frontend-only)

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

## 🟡 PRIORITY 6 — Scraper Health Monitoring

- [ ] Manual audit: test all 12 platforms locally and confirm parsers still work
- [ ] Automated cron: daily integration tests against each platform
- [ ] Supabase table: log scraper failures (platform, reason, timestamp)
- [ ] Alerting: Slack/SMTP notify if success rate drops on any platform
- [ ] Admin dashboard: real-time success rate, latency, Firecrawl credit usage per platform

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
