# HAKKIU — TODO

> Tick items as they are completed. Add new items as they are discovered.
> Last updated: 2026-07-27 (session 16 — book-demo form enrichment + nav cleanup)

---

## ✅ DONE — Google Analytics (GA4) (2026-07-27, session 17)

- [x] `src/routes/__root.tsx` — gtag.js snippet in `RootShell` `<head>` (GA4 property
  `G-PH8369N5PD`), SSR-rendered site-wide + hydrated client-side.
- [x] `Caddyfile` (live prod CSP) — allow `googletagmanager.com` in `script-src` and GA
  collect endpoints (`google-analytics.com`, `*.analytics.google.com`) in `connect-src`.
- [x] `public/_headers` — same CSP additions (kept in sync for Cloudflare deploys).
- [x] Verified `npm run build` bakes gtag into both server + client bundles.

---

## ✅ DONE — SEO/crawler discovery files (2026-07-27, session 17)

Goal: help search + AI crawlers discover public marketing pages while keeping the
authenticated app, admin and auth flows out of the index.

- [x] `public/robots.txt` — allow public pages (`/`, `/landing`, `/request-demo`),
  disallow `/dashboard`, `/cases`, `/monitoring`, `/clients`, `/settings`, `/auth/`,
  `/legacy/`; explicit welcome rules for GPTBot / ClaudeBot / PerplexityBot /
  OAI-SearchBot / Google-Extended; points to sitemap.
- [x] `public/sitemap.xml` — canonical URLs for `/landing` + `/request-demo` on hakkiu.com.
- [x] `public/llms.txt` — llmstxt.org-format product summary, features, audience, pricing
  note and links to public pages.
- [x] Verified `npm run build` copies all three into `dist/client/` root (served at
  `/robots.txt` etc. by the Cloudflare Workers assets binding, incl. self-hosted workerd).

---

## 🟡 DONE (code) — Enrich book-a-demo form + nav cleanup (2026-07-27, session 16)

Goal: capture much more about a prospect BEFORE the demo so the team can prepare;
confirm admin + email notifications fire; clean up the top nav.

- [x] **DB migration** `20260727000001_sales_leads_v3.sql` — add nullable columns to
  `sales_leads`: `role`, `website`, `phone`, `regions text[]`, `brand_names`,
  `marketplaces text[]`, `current_solution`, `primary_goal text[]`.
  ✅ **Applied to live DB** via `supabase db push` (2026-07-27).
- [x] **Customer form** `src/routes/request-demo.tsx` — wizard expanded 4→6 steps.
  New fields: role + phone + website (website & role REQUIRED, rest optional),
  regions (multi), brand names (text), marketplaces (multi), primary goals (multi),
  current solution (single). Reusable `ChipGroup` for single/multi; Enter-to-advance
  now ignores textarea. tsc clean.
- [x] **Backend** `apps/api/.../routes/leads.py` — `LeadRequest` + insert extended with the
  8 new fields (all optional; call-request/pricing forms unaffected).
- [x] **Email** `apps/api/.../services/email_templates.py::new_lead_html` — staff notification
  now lists role, phone, website (linked), regions, brand names, marketplaces, primary goals,
  current solution. Notification already fires to `LEADS_NOTIFY_EMAILS` on every submit. ✅
- [x] **Admin parity** `apps/admin/src/pages/Leads.tsx` — rows show role/phone (Contact) +
  website link (Company); expandable detail row shows regions, brand names, marketplaces,
  primary goals, current solution, full message. Reads via existing `select("*")` — no
  admin-api change needed. tsc clean.
- [x] **Nav** `src/components/landing/landing-nav.tsx` — removed "Sign in"; kept "Talk to sales"
  (quick modal) + "Book a demo" (now → `/request-demo` enriched wizard, was opening sales modal).
- [x] **Apply migration to live DB** (`supabase db push`) — done 2026-07-27.
- [x] **Deployed to prod** (commit `c4ac3b4`) — manual SSH to Hetzner as `deploy@116.202.8.87`
  (`git reset --hard origin/main` + `docker compose build && up -d`); all 4 domains 200,
  `/request-demo` serves the enriched wizard. Includes the Talk-to-sales modal restyle.
- [ ] Optional: E2E test one submission (verify row in admin `/leads` + staff email).

⚠️ **CI auto-deploy is broken** — the GitHub `Deploy` workflow fails on every push with
`Error: missing server host`: the repo has **no** `SSH_*` secrets. Fix = set
`SSH_HOST=116.202.8.87`, `SSH_USER=deploy`, `SSH_PORT=22`, `SSH_KEY=<~/.ssh/hakkiu priv key>`
via `gh secret set`. Until then every prod deploy must be run manually over SSH.

---

## ✅ DONE — Remove pricing/Stripe/plan-gating → book-a-demo model (2026-07-27)

Product pivot: no pricing/Stripe anywhere; site shows only "Book a demo" / "Contact sales".
Staff create dashboard logins via admin. Access = having a login (NO plan/entitlement checks).

- [x] **Customer FE (`src/`)** — deleted stripe.ts, billing.ts, entitlements.ts, plans/checkout/review/configure/billing.success/billing.cancel/settings.billing routes, pricing.tsx, ClientBillingCard. Removed `RequirePaidPlan` gate in `__root.tsx` (was bouncing logged-in users to /plans). Removed billing endpoints/types from api.ts, entitlement caps in monitoring.new. Landing CTAs → "Book a demo" (TalkToSalesModal). Removed @stripe/* deps. tsc + build clean.
- [x] **Main API (`apps/api`)** — deleted billing.py, billing_config.py, entitlements.py, seed_stripe.py, test_billing/test_entitlements. Removed `_require_paid_plan`/`_enforce_scan_entitlements`/`_reject_if_brand_locked` gates; `CurrentProfile` now = user+org only; removed internal billing/entitlement endpoints; removed stripe dep; weekly_digest targets all orgs (not subscriptions). import OK, 203 tests pass.
- [x] **Admin (`apps/admin` + `apps/admin-api`)** — deleted billing_admin.py; removed plan/subscription/MRR/entitlement-override UI + endpoints + `billing.*`/`entitlements.manage` permissions; removed orphaned `/organizations/{id}/usage` + `get_entitlements` proxy. import + build clean.
- [x] **NEW — staff can create customer logins** — `POST /customers` (`sb.auth.admin.create_user`, email_confirm), permission `customers.create` (parity in permissions.py + permissions.ts), audit-logged; "Create customer" button + dialog on Customers.tsx.
- [x] DB: no destructive migration — subscriptions/subscription_addons/invoices/org_entitlement_overrides/stripe_events tables left unused (safe/reversible).
- [x] **Deployed to server** (commit 8742239) — verified live: `/plans` 404, `/api/v1/billing/subscription` 404, all 5 domains 200. Dashboard no longer redirects to pricing.
- [x] **Fix auth session storage** (commit a52f19d) — the M13 custom single-cookie storage broke login (session > 4KB cookie limit → getSession() null → API calls sent with no Authorization header → "Failed to load infringements"). Reverted both apps to Supabase default localStorage; redeployed; verified infringements load. See [[project_security_hardening_2026_07]] (M13 reverted).
- [ ] Supabase → Auth → **disable public sign-ups** (staff-created logins only; otherwise anyone can self-register and get full access — the plan gate that used to limit this is gone).
- [x] **Purge remaining Stripe leftovers (2026-07-28)** — removed `VITE_STRIPE_PUBLISHABLE_KEY` build arg from `src/Dockerfile` + `docker-compose.yml`; stripped `*.stripe.com` / `js.stripe.com` / `hooks.stripe.com` from CSP in `Caddyfile` + `public/_headers`; deleted all `STRIPE_*` vars from `.env.example` + `.env.production.example`; removed dummy Stripe env from `ci.yml`; dropped `stripe` dep from `apps/admin-api/pyproject.toml`; cleaned Stripe from `README.md` + `docs/DEPLOYMENT.md`; deleted obsolete `docs/BILLING.md`; marked roadmap §7 REMOVED. Admin `tsc` clean.
- [ ] Optional later: drop unused billing tables + `profiles.plan` protection trigger via a forward migration (SQL migration FILES kept as DB history — safe; tables are unused, not referenced).

## Fix invisible "Explore features" button (2026-07-28)
- [x] `request-demo.tsx` SuccessScreen — the `outline` Button inherited `bg-background` (opaque white) from the variant while forcing `text-white` → white-on-white, text only faintly visible on hover. Replaced with the dark-bg outline pattern from `cta.tsx`: `bg-white/5 text-white hover:bg-white/10 hover:text-white` (translucent over the dark page, text always visible).

## Admin forgot-password (2026-07-28)
- [x] `ResetPassword.tsx` — new page: handles the recovery token (PASSWORD_RECOVERY / session), validates min-8 + match, `updateUser({ password })`, signs out, routes to sign-in.
- [x] `router.tsx` — registered public `/auth/reset-password` route.
- [x] Supabase → Auth → URL Configuration: `admin.hakkiu.com/**` + `localhost:8082/**` confirmed in Redirect URLs (verified via screenshot).

### Reset via our OWN Resend pipeline, NOT Supabase SMTP (2026-07-28)
Supabase's built-in `resetPasswordForEmail` returned **500** in prod (Supabase SMTP not
configured → "Error sending recovery email"). Rebuilt the flow so it uses the app's already-
working Resend pipeline and no longer depends on Supabase SMTP at all:
- [x] `apps/api/routes/internal.py` — new `POST /internal/auth/send-password-reset` (X-Internal-Secret): builds HTML via `_base`/`_btn`, sends via `send_email` (Resend).
- [x] `apps/admin-api/main_api.py` — `send_password_reset_email(email, reset_link)` proxy to the internal endpoint.
- [x] `apps/admin-api/routes/auth.py` — new PUBLIC `POST /staff/request-password-reset`: verifies active `staff_accounts` row → `admin_sb().auth.admin.generate_link({type:"recovery"})` (generates link, sends NO email) → hands link to main-api Resend. Always returns a neutral message (no user enumeration); origin allow-listed for the redirect base.
- [x] `apps/admin/SignIn.tsx` — "Forgot password?" now calls `adminFetch("/staff/request-password-reset")` instead of Supabase; friendly error message on failure (fixes the cryptic `{}` seen before).
- [x] Validated: admin `tsc` exit 0, main-API + admin-API import clean.
- [ ] Supabase Custom SMTP is now OPTIONAL — the built-in recovery email is bypassed. (Can still finish it as a fallback, but not required for reset to work.)

---

## 🔴 ACTIVE — Per-copycat cases in customer frontend (branch `feature/per-copycat-cases`)

Backend scan → single case + single AI prompt stays unchanged; frontend shows one case per copycat.
- [x] Migration `20260725000001_infringements_updated_at.sql` — `updated_at` column + trigger; **applied to live DB via `supabase db push`** (project re-linked in this session)
- [x] Backend `routes/infringements.py` — return item's own status (`case_status` separate, no override), no cascade to parent case on PATCH, expose `brand_name`/`client_id`/`updated_at`
- [x] Frontend `src/lib/api.ts` — extend `InfringementFeedItem`, `client_id` param on `getInfringements`
- [x] `/cases` list — one row per copycat (platform, URL, per-item risk/status/confidence), row → `/cases/$infringementId`, per-row delete
- [x] Dashboard — KPIs + 30-day success-rate trend count copycats instead of scans
- [x] `InfringementAlertFeed` — rows link to per-copycat detail `/cases/$id`
- [x] Verify: frontend tsc clean + backend pytest 233 passed
- [x] Commit + push (end of session)

## ✅ FIXED — Multi-region scans only scraped one country (session 14 follow-up)
- [x] `check_brand` now forwards `target_regions` to `scrape_evidence` (was silently dropped → scraper defaulted to US only)
- [x] Migration `20260725000002_infringements_detection_region.sql` — **applied to live DB**
- [x] `persist_infringement` saves per-item `detection_region`; `GET /infringements` prefers item region over case region
- [x] Frontend region chips/filters use real `detection_region` (hash fallback for legacy rows) — was showing arbitrary country from ID hash
- [x] Verified: pytest 233 passed, tsc clean

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
- [x] **Rotavimas:** Supabase dashboard → rotate service role key (key buvo git istorijoje!) — atlikta Phase 0 [C1]

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

## 🔴 PRIORITY — Billing Workflow Fixes (MUST fix before going live)

### Critical (production-blocking)
- [x] **`src/routes/auth.callback.tsx`** — after `exchangeCodeForSession` succeeds, read `localStorage.getItem("pending_subscription_id")`; if present → call `activateSubscription({ stripe_subscription_id })` → clear localStorage → navigate to `/dashboard`. ✅ Fixed session 11.

### High (bad UX, confuses paying customers)
- [x] **`src/routes/checkout.tsx` `OrderSummary`** — kainos rodomos teisingai (bendras total); addon line items breakdown nerodomas, bet nereikalinga.
- ~~**`src/routes/checkout.tsx` GuestCheckout** — "Already have an account?" nuoroda — nereikalinga: dashboard pasiekiamas tik pirkusiems.~~
- [x] **`src/routes/checkout.tsx` Cancel button** — "Back to review" ir "Cancel" mygtukai dabar perduoda `plan`, `interval`, `tm`, `marketplace`, `domain` params atgal į `/review`.

### Medium (polish)
- [x] **`src/routes/billing.success.tsx` CreateAccountAfterPayment** — "Resend" mygtukas pridėtas; 60s cooldown po pirmojo siuntimo.

---

## 🟡 PRIORITY — Landing Page Improvements

### Must-have before launch
- ~~**`src/components/landing/pricing.tsx` SelfServeCard** — kainos rodymas kortelėje nereikalingas; "Configurable pricing" pakankama.~~
- [x] **`src/components/landing/pricing.tsx` `PricingFAQ`** — FAQ accordion pridėtas žemiau kortelių; 5 Q&A (cancel, takedown, Amazon, Self-Serve vs Pro, annual).

### Nice-to-have (trust signals)
- [ ] **`src/components/landing/pricing.tsx`** — add social proof bar: "Trusted by X brands" + 3 short testimonial placeholders. Every competitor has this; absence looks suspicious.
- [ ] **`src/components/landing/hero-v3.tsx` or landing page** — A/B test: replace "Detect infringements before they spread" headline with benefit-first variant "Stop counterfeits from killing your brand revenue".

---

## 🔴 PRIORITY — Pricing Redesign (Red Points model: 1 self-serve configurator + Professional + Enterprise)

> Deep research complete (2026-07-22). Concrete pricing set. See plan.md for full spec.
> Self-serve: $129/mo (1 brand) → $389/mo (5 brands) + add-ons. Professional + Enterprise = lead form.
> Key differentiator: "Never charged per detection. Never charged per takedown."

### Backend
- [x] `billing_config.py` — `self_serve` plan + TM/marketplace/domain add-on keys; `SELF_SERVE_PLANS = ("self_serve", ...legacy...)`
- [x] `entitlements.py` — `self_serve` entitlement (brands=0→TM add-on sets absolute; platforms=1+marketplace qty; domain_tracking from domain add-on)
- [x] `seed_stripe.py` — EUR prices created in Stripe sandbox: base €849, TM ×1-5, marketplace €40/unit, domain €649; legacy USD plans preserved. .env updated with new price IDs.
- [x] Migration: `sales_leads` table — `supabase/migrations/20260722000001_sales_leads.sql`
- [x] Migration: `sales_leads_v2` — `20260723000001_sales_leads_v2.sql`: nullable name/company, brand_count_range CHECK widened to frontend values, `source` column added (applied ✅)
- [x] `routes/leads.py` — `POST /api/v1/leads` (public, no auth) + rate-limit 3/hr per IP; registered in `main.py`
- [x] **Lead email notifications** — `routes/leads.py` sends email to all 5 team members on every lead; `new_lead_html` template added to `email_templates.py`; `LEADS_NOTIFY_EMAILS` env var; verified delivery ✅
- [x] **Bug fix** — `brand_count_range` values reconciled (forms used `"1"`,`"2-3"` etc., backend/DB now accept same set)
- [x] **Bug fix** — `TalkToSalesModal` no longer sends empty required fields; sends `source:"call_request"` only
- [x] **[CRITICAL BUG FIX]** `routes/billing.py` `/billing/activate` — now calls `_sync_subscription_to_db` with `expand=["items"]`, writes `subscription_addons` + reconciles brand locks. Guest checkout customers no longer land with `brands=0`.
- [x] **[FIXED session 11]** `src/routes/auth.callback.tsx` — email-confirmation path now reads `pending_subscription_id` from localStorage and calls `activateSubscription` before navigating to dashboard.
- [x] `services/entitlements.py` — per-org entitlement override support: `_override_for_org`, `_apply_entitlement_override`; `resolve_entitlements_for_org` applies admin overrides on top of plan+addon
- [x] Migration: `org_entitlement_overrides` table — `supabase/migrations/20260722000002_entitlement_overrides.sql` (applied ✅)
- [x] `routes/internal.py` — GET/PUT/DELETE `/internal/orgs/{org_id}/entitlement-override` endpoints (secret-gated)

### Customer Frontend
- [x] `src/lib/billing.ts` — `self_serve` plan added; `selfServeAddons()` helper; TM/marketplace/domain price constants
- [x] New `PricingConfigurator` component in `pricing.tsx`: TM count buttons (1-5) + marketplace checkboxes (Amazon included, 11×€40) + domain toggle (€649) + live total
- [x] `pricing.tsx` — 3-card layout: Self-Serve configurator, Professional, Enterprise
- [x] `RequestPricingModal` — 6-field form → `POST /api/v1/leads` → thank-you state; `request-pricing-modal.tsx`
- [x] `configure.tsx` — `/configure` public route with live price configurator; CTA "Review & pay" → `/checkout`
- [x] `checkout.tsx` — account creation step for unauthenticated users (name/email/password) before Stripe payment; `/checkout` added to PUBLIC_PATHS
- [x] `auth.sign-up.tsx` — blocked; redirects to `/plans`; no independent registration
- [x] `auth-screen.tsx` — "Create an account" toggle removed from sign-in; replaced with "Purchase a plan" link
- [x] Payment wall (`RequirePaidPlan` in `__root.tsx`) — unauthenticated or unpaid users → `/plans`
- [x] All footers: "Sign in" → "Login"; hero: "Start monitoring" → `/plans`; "Talk to sales" → modal

### Admin Portal (mandatory parity)
- [x] `admin-api/routes/leads.py`: `GET /leads` (paginated, filter by status/tier) + `PATCH /leads/{id}`, gated `leads.view`/`leads.edit`
- [x] Add `leads.view`, `leads.edit` to `permissions.py` AND `permissions.ts`; `sales` role preset gets both
- [x] `apps/admin/src/pages/Leads.tsx` — table with tier, company, email, brand_count_range, status badge, mark-contacted/close actions; Source column added (pricing_modal/request_demo/call_request); nullable fields handled
- [x] `apps/admin/src/router.tsx` — `/leads` route added
- [x] `apps/admin/src/components/layout.tsx` — "Sales Leads" nav item under Customers group
- [x] `admin-api/routes/organizations.py` — GET/PUT/DELETE `/organizations/{id}/entitlement-override` (gated `entitlements.manage`); calls main-api via `main_api.py`
- [x] Add `entitlements.manage` permission to `permissions.py` + `permissions.ts`
- [x] `apps/admin/src/pages/OrganizationDetail.tsx` — "Custom limits override" card with full CRUD (numeric overrides + boolean feature flags + staff note); gated `<Can permission="entitlements.manage">`

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

## 🟡 PRIORITY 3 — Resend Email Integration

> Full email catalog and implementation strategy: see `plan.md` → Priority 3.
> Current state: `notifications.py` send functions are no-ops. All hooks exist — just need Resend wired in.

### Step 1 — Infrastructure setup ✅ DONE
- [x] `resend>=2.0.0` added to `apps/api/pyproject.toml` + installed via `uv add resend`
- [x] `RESEND_API_KEY=re_your_api_key_here` placeholder added to `.env` + `.env.production.example`
- [x] `apps/api/src/tracemark_api/services/email.py` — Resend wrapper (`send_email(to, subject, html)`)
- [ ] **USER ACTION NEEDED:** Sign up at resend.com, verify `hakkiu.com` domain (SPF+DKIM DNS records), replace `RESEND_API_KEY` placeholder in `.env` with real key
- [ ] **USER ACTION NEEDED:** Wire Supabase Auth → Resend SMTP relay (Supabase dashboard → Auth → SMTP: host `smtp.resend.com`, port 465, user `resend`, pass = API key)

### Step 2 — Tier 1 transactional emails ✅ DONE
- [x] `notifications.py` — replaced both no-op functions with real Resend dispatch
- [x] `email_templates.py` — all HTML templates with HAKKIU logo header (logo from `CUSTOMER_APP_URL/hakkiu-lockup.png`):
  - **Infringement alert** — risk badge, screenshot, listing URL, one-click buttons
  - **Domain lookalike alert** — domain, registration date, MX server warning
  - **Takedown submitted** — platform, submitted_at, expected response window
  - **Takedown removed** ⭐ — green celebration layout, removal timing, all-time total
  - **Takedown failed** — red layout, counter-notice warning, recommended action
  - **Test email** — for configuration verification
- [x] All existing hooks in `routes/monitoring.py`, `routes/documents.py`, `services/persistence.py` now send real emails (they call `dispatch_notifications` → `email.py` → Resend)

### Step 3 — Weekly digest ✅ DONE
- [x] `services/weekly_digest.py` — queries last 7 days per org, builds digest email
- [x] Weekly digest HTML template — headline metric, stats block, detections list, takedown status, CTA
- [x] Registered as daemon thread in `main.py` — checks every 30 min, fires Tuesdays 09:00 UTC
- [ ] Admin portal parity: `GET /admin/email-logs` endpoint + `EmailLogs.tsx` page (deferred)

### Step 4 — Onboarding emails ✅ DONE (partial)
- [x] Email **Welcome** — fires when org creates their first brand (`routes/brands.py` → `_send_welcome_email`)
- [x] Email **First detection found** ⭐ — `dispatch_notifications` detects `org_infringement_count == 1` and sends `first_detection_html` instead of the regular alert
- [ ] Email **First takedown nudge** — 48h scheduler (deferred)
- [ ] Email **Day-14 nudge** — 14-day scheduler (deferred)

### Step 5 — Dunning ✅ DONE (day 0)
- [x] Email **Payment failed — day 0** — wired into `invoice.payment_failed` Stripe webhook (`billing.py` → `_send_dunning_email`)
- [x] Payment failed HTML template — friendly tone, plan name, amount, one-click billing update link
- [ ] Email **Payment failed — day 3 + day 7** — follow-up dunning scheduler (deferred)

---

## 🟡 PRIORITY 4 — Production Deployment (Hetzner CCX13) — domain hakkiu.com

### Prepared in repo (config ready — session 8)
- [x] Dockerize API, admin-api, admin frontend, customer frontend (all 4 Dockerfiles exist)
- [x] Customer `src/Dockerfile` — rewritten from `bun run dev` → production build + `wrangler dev --local` (workerd). Verified: built worker serves SSR HTTP 200. glibc base for workerd.
- [x] `docker-compose.yml` — Caddy service + `caddy_data`/`caddy_config` volumes + frontend VITE_* build args added
- [x] **Fix compose env pass-through gap** — added `env_file: - .env` to `api` + `admin-api` (Stripe billing / Resend email / CUSTOMER_APP_URL were UNSET before → would silently break billing + email in prod). Added `VITE_STRIPE_PUBLISHABLE_KEY` build arg to frontend (`src/Dockerfile` + compose) — needed by `src/lib/stripe.ts`. Validated with `docker compose config`.
- [x] `Caddyfile` — 4 subdomains (hakkiu.com, admin/api/admin-api.hakkiu.com) + www→apex redirect + auto Let's Encrypt + customer CSP/security headers (api.tracemark.ai→api.hakkiu.com)
- [x] `.dockerignore` — excludes `.env`, `.wrangler`, `dist` from customer image (secret-leak fix)
- [x] `.env.production.example` — production URLs/CORS for hakkiu.com + secret placeholders
- [x] `.github/workflows/deploy.yml` — SSH auto-deploy after green CI on main (appleboy/ssh-action)
- [x] `scripts/backup.sh` — nightly pg_dump → local + Hetzner Storage Box, 14-day rotation
- [x] `docs/DEPLOYMENT.md` — full server-hardening runbook (deploy user, SSH keys-only, ufw, fail2ban, unattended-upgrades, docker) + DNS + first deploy + external-service wiring + verification

### Server deploy — DONE (2026-07-27, live on Hetzner CCX13 116.202.8.87)
- [x] DNS (Hostinger): A `@`/`api`/`admin`/`admin-api` → 116.202.8.87; `www` CNAME→apex; TTL 60–300. No AAAA (IPv4-only, avoids LE IPv6 issues).
- [x] Server hardening: `deploy` user + passwordless sudo; SSH keys-only (`00-hardening.conf` drop-in overrides cloud-init; root login + passwords OFF); ufw (22/80/443); fail2ban; unattended-upgrades; 4G swap; Docker 29.6 + Compose v5.3.
- [x] Repo pull access: classic GitHub PAT (`repo` scope) via `credential.helper store` (user is collaborator, no repo-admin).
- [x] `.env` on server: scp'd from local working .env, then sed'd URLs/CORS → hakkiu.com + added `SUPABASE_SECRET_KEY` (compose maps service-role from it). Stripe left as placeholders (no LIVE — moving to book-a-demo model).
- [x] First deploy: `docker compose build` (4 images) + `up -d`; **Caddy obtained all 5 LE certs**. External HTTPS verified: apex 200, www 301→apex, api+admin-api `/health` 200, admin SPA 200.

### Remaining (post-deploy)
- [ ] **Supabase Auth URLs** — Site URL `https://hakkiu.com`; Redirect URLs `https://hakkiu.com/**`, `https://admin.hakkiu.com/**`; enable Confirm email. (Needed for sign-in/email links on the new domain.)
- [ ] Functional test: sign in on customer app → run a scan (proves API + Supabase + scraping end-to-end).
- [ ] Backups: `apt install postgresql-client`, set `DATABASE_URL` in .env, cron `15 3 * * * /opt/hakkiu/scripts/backup.sh`.
- [ ] (Deferred — needs SuperGabSq repo-admin) GitHub Actions auto-deploy secrets: SSH_HOST / SSH_USER / SSH_KEY (+ SSH_PORT). Until then: manual deploy = `git pull && docker compose up -d --build`.
- [ ] (Skipped) Stripe webhook — no LIVE Stripe in book-a-demo model.
- [ ] Optional: set `GOOGLE_SERP_API` / `SEARCHCANS_API` in .env (currently blank → those scraper sources inactive).

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
