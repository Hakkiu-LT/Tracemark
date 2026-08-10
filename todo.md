# HAKKIU — TODO

> Live checklist of **OPEN work only**. The full completed session-by-session history was archived
> to `docs/.roadmap/todo-archive.md` (and lives in git log) when this file was trimmed.
> Last cleaned: 2026-07-31 — removed the redundant session-by-session DONE detail (26→22) and a
> duplicate open-work structure; all of it survives in git log + the one-liners below. Feature-by-feature
> status: `docs/.roadmap/roadmap.md`.
>
> **How to keep this tidy:** tick items when done; when a whole batch/feature completes, move its
> detail to the archive and leave a one-liner under "Recently completed" below.

## 🟩 404/error pages leaked the private dashboard shell (Session 63, 2026-08-10)
- [x] Investigate (2 Explore subagents): confirmed root cause in `src/routes/__root.tsx` — `RequireAuth` + sidebar shell is the default branch for any non-`PUBLIC_PATHS` path, so an unmatched URL renders the 404 inside the dashboard chrome. `RequireAuth` is the ONLY auth guard (routes don't self-guard) → default is fail-safe/protected.
- [x] Adversarial reviewer agent: CHANGES-REQUIRED → APPROVED after 2 rounds. Caught the `notFoundMode:"fuzzy"` `/settings/xyz` (Outlet-less parent) edge → chrome-less non-404 page.
- [x] `src/router.tsx`: add `notFoundMode:"root"` (every unmatched URL flags the ROOT match → 404 always at RootComponent `<Outlet/>`).
- [x] `src/routes/__root.tsx`: detect not-found (`matches.some(m => m.status==="notFound" || m.globalNotFound)`) → render bare public branch (`showBare = isPublic || isNotFound`); `deferAuth` uses `showBare`.
- [x] `src/routes/__root.tsx`: 404 CTA "Back to dashboard" → "Go to homepage" (→ `/`) so logged-out visitors aren't bounced to sign-in.
- [x] `tsc --noEmit` clean.
- [ ] **VERIFY (manual, after deploy or `npm run dev`):** `/labas`, `/settings/xyz`, `/cases/<id>/garbage`, `/monitoring/<id>/garbage` — both logged-out and logged-in → standalone 404, no sidebar, HTTP 404 from SSR. Consider adding an automated test for these URL shapes.

## 🟩 GSC "pages not indexed" — SEO metadata fixes (Session 62, 2026-08-10)
- [x] Investigate (3 subagents + live `curl`): confirmed NO technical blocker — 200s, SSR, correct title/description/canonical/`robots=index,follow`, in sitemap, footer-linked. Plan at `docs/seo-indexing-plan-2026-08-10.md`, approved by independent reviewer agent.
- [x] `src/routes/legal.*.tsx` (all 8): add page-specific `og:title`/`og:description`/`twitter:*` (were inheriting generic root OG).
- [x] `src/components/landing/final-cta.tsx`: add in-content homepage links to `/solutions/brand-owners` + `/solutions/law-firms` (previously footer-only).
- [x] `public/sitemap.xml`: bump `<lastmod>` for changed pages (8 legal + home) to 2026-08-10.
- [ ] **HUMAN:** GSC → URL Inspection → Request Indexing for the 5 URLs (solutions first); confirm `sitemap.xml` submitted in GSC → Sitemaps; then wait 1–3 weeks. Ignore `http://` "page with redirect" (expected).

## 🟩 Clean white background logo chips without color inversion (Session 61, 2026-08-06)
- [x] `src/routes/monitoring.tsx`: update brand logo `<img />` containers in table view and edit modal preview to use a clean white background (`bg-white border border-border p-1 rounded-md`) in both light and dark mode, preserving original brand colors without distortion or inversion.

## 🟩 Invert brand logo colors in night mode (Session 60, 2026-08-06)
- [x] `src/routes/monitoring.tsx`: add `dark:invert` utility class to brand logo `<img />` elements in the Monitoring dashboard table and asset edit dialog previews, ensuring dark brand logos automatically invert to high-contrast light colors in night/dark mode.

## 🟩 Display uploaded brand logo image replacing colored rectangle box (Session 59, 2026-08-06)
- [x] `apps/api/src/tracemark_api/routes/brands.py`: update `list_brands` endpoint to resolve `logo_url` signed URL from `brand_assets` for each brand and include it in the response.
- [x] `src/lib/api.ts` & `src/lib/store.ts`: add `logo_url` to `BrandRecord` and `logoUrl` to `Mark` interface & `syncServerBrands`.
- [x] `src/routes/monitoring.tsx`: update brand list table to render `<img src={m.logoUrl} />` when a logo is uploaded, replacing the colored placeholder rectangle box (retaining fallback rectangle with initials when no logo is uploaded).

## 🟩 Save monitoring asset as draft in On-Hold status (Session 58, 2026-08-06)
- [x] `src/routes/monitoring.new.tsx`: wire "Save as Draft" button with `handleSaveDraft` handler to persist brand server-side with `status: "on_hold"`, upload optional logo/product images, update local store, and navigate to `/monitoring`.
- [x] `apps/api/src/tracemark_api/routes/brands.py`: update `BrandCreate` model and `create_brand` handler to accept `status` (e.g. `on_hold`) and set it on the created brand record.
- [x] `src/routes/monitoring.tsx`: update `handleToggleStatus` so pausing/activating a brand calls `updateBrand(id, { status })` on the server and invalidates the brand query cache.

## 🟩 Full cascading brand deletion across database (Session 57, 2026-08-06)
- [x] `src/routes/monitoring.tsx`: update `handleRemove` to call `deleteBrand(id)` API & invalidate TanStack Query brand cache instead of only modifying local Zustand store.
- [x] `apps/api/src/tracemark_api/routes/brands.py`: update `delete_brand` endpoint to perform a cascading purge across all matching cases, evidence, decisions, takedowns, infringements, brand assets, and storage files.
- [x] `apps/admin-api/src/tracemark_admin_api/routes/brands_admin.py`: update admin brand delete endpoint with identical cascading purge logic.
- [x] Purged legacy test brands (`testttttt`, `testas222`, `w`) and associated records from the Supabase database.

## 🟩 Auth sign-in error surfacing (Session 56, 2026-08-06)
- [x] `src/components/auth/auth-screen.tsx`: stop overriding Supabase Auth errors with generic `"Couldn't sign you in — check your email and password."`. Now logs to `console.error` and displays the exact `error.message` from Supabase (e.g. invalid credentials, unconfirmed email, captcha error).

## 🟩 Multi-company org switcher + admin "Add brand" parity + staff "Set active" (Session 55, 2026-08-06) — CODE BUILT + verified; deploy pending

Follow-up to Session 54. That made the brand list server-authoritative, but the deeper cause was
**org resolution**: the customer API scopes by one column `profiles.organization_id`, and a user in
multiple orgs (personal + shared "Hakkiu" + all-zeros staff sentinel) had no way to pick which
company is active — so brands added to a different company never showed in monitoring.

Shipped:
- [x] Main API `routes/organizations.py`: `GET /organizations/mine` + `POST /organizations/switch`
  (membership re-checked server-side; excludes the staff sentinel org); registered in `main.py`.
- [x] Customer `src/components/company-switcher.tsx` in the sidebar (shows only for ≥2 companies);
  `api.ts` `getMyOrganizations`/`switchOrganization`; `store.ts` `resetOrgScopedData` + reload on switch.
- [x] Admin `BrandCreateDialog` full parity: official domains/advertisers + logo + product image,
  uploaded after create via existing admin `POST /brands/{id}/assets` → same `brand_assets`.
- [x] Admin parity for the switch: permission `organizations.set_active` (py + ts), admin-api
  `POST /organizations/{org}/members/{user}/set-active` (audit-logged), "Set active" button in Users table.
- [x] Verified: both APIs import, both FEs `tsc` clean, admin-parity 0 new violations.
- [x] **Switcher shows only REAL companies** — `GET /organizations/mine` now hides auto-generated
  personal/home orgs (named after the signup email domain, e.g. `gmail.com` from `handle_new_user`).
  Parity with the admin Companies list (`is_personal` flag + domain-name heuristic + "has brands"
  guard). The active org is never hidden, so the switcher never goes empty. Fixes junk "gmail.com"
  appearing as a switchable company.
- [ ] **Deploy** (main-API restart + FE builds) — same as Session 54, still pending.
- [ ] Optional/needs sign-off: clean up junk test orgs + the brand stuck in the `00000000-…`
  sentinel org (visibility already fixed by the switcher, so not required).

## 🟩 Admin-created brands appear in monitoring + scan clamped to plan (Session 54, 2026-08-05) — CODE BUILT + verified; deploy pending

Two fixes to the goal "kai pridedu branda per admin kodel jo nerodo prie monitoring, ir monitorint
turi pagal limitus tik parinktuose regionuose/marketplacuose":
1. The monitoring page rendered brands ONLY from the local Zustand store (localStorage), never from
   the server — so brands created in the admin portal (or on another device) never appeared. Now the
   page fetches `GET /brands` and reconciles server brands into the local marks list.
2. `/monitoring/check-brand` accepted any platforms/regions with NO plan check — a scan could run
   outside the plan. Now it clamps (intersects) the request to the org's `allowed_platforms`/
   `allowed_regions` whitelist server-side (defence in depth).
Verified: customer `tsc` clean, api ruff (`src`) clean, module imports, 13 tests pass (8 brands + 5 new clamp).

- [x] **store.ts** `syncServerBrands(BrandRecord[])`: upsert server brands into `marks` (match by
      serverId then name; preserve local status/repeatCycle/id); apiKey→Platform-label + status mapping helpers.
- [x] **monitoring.tsx** `useQuery(["brands"])` + effect calls `syncServerBrands` on mount, so admin/
      cross-device brands show in Active monitoring.
- [x] **main-api** `monitoring.py` `_clamp_scan_to_plan(org, platforms, regions)` reads
      `org_entitlement_overrides` whitelists, intersects (empty→fall back to full allowed); called in `check_brand` before scrape.
- [x] **Tests** new `tests/test_monitoring_plan_clamp.py` (filter, unrestricted, empty-fallback, case-insensitive region, no-org).
- [x] **Pushed** to `main` (commit `8ae877f`) — Hetzner auto-deploy.
- [x] **Correction (same session):** first version only *added* server brands to the local store, so
      local-only "ghost" brands (created before, never on the server) stayed → looked like a mess.
      Made the sync **server-authoritative**: `syncServerBrands` now RECONCILES (upsert server brands,
      then drop marks whose serverId is gone + brand-owner ghosts never persisted; keep law-firm demo).
      Monitoring + Dashboard both reconcile on load, so the customer sees EXACTLY the org's server
      brands — the same records the admin portal shows. Same entity, same `brands` table, two entry
      points (customer "Add asset" / admin "Add brand"). tsc clean.
- [ ] **Smoke (post-deploy):** admin adds a brand for a company → log in as that org → Monitoring
      lists exactly that brand; scan only hits the plan's marketplaces/regions.

## 🟩 Plan limits = WHITELISTS not counts (Session 53, 2026-08-05) — CODE BUILT + verified; prod migration + deploy pending

Correction of Session 52: marketplaces/regions are now a WHITELIST of allowed values (admin picks
WHICH ones the customer may use, e.g. "Amazon only, USA only"), not a max count. Brands stays a
count. Everything is picked (no free-text); regions at country granularity so "only USA" works.
Verified: ruff (both src) clean, admin+customer tsc clean, brand tests (8) pass, both apps boot.

- [x] **DB** `20260805000004_allowed_lists_limits.sql`: drop count cols, add `allowed_platforms`/
      `allowed_regions text[]`; `create_brand_checked` subset-enforces (PLATFORM/REGION_NOT_ALLOWED).
- [x] **main-api** `brands.py`: `_org_limits` whitelists; `_enforce_allowed_lists` on edit; create
      error mapping → 403 naming the offending value(s); `GET /brands` returns the whitelists.
- [x] **admin-api** Limits models + get/set carry the whitelists (empty→NULL); `brands_admin`
      subset-enforces on create/edit.
- [x] **admin FE** pickers refactored to `available` prop; `LimitsCard` = count + "Allow all"
      toggles + allowed-marketplace/region pickers (admin sees full list); brand dialogs show only allowed.
- [x] **customer FE** `monitoring.new.tsx` filters pickers to the plan; regions rebuilt to
      country-level grouped; default reconciled to whitelist. `api.ts` PlanLimits updated.
- [x] **Tests** rewritten for NOT_ALLOWED codes + `_enforce_allowed_lists`.
- [ ] **Prod:** user runs `supabase db push` (`20260805000004`).
- [ ] **Deploy** picks up the commit. Smoke: admin set "Amazon only, USA only" → customer sees only those.

## 🟩 Brands = monitored assets + 3-dim plan limits (Session 52, 2026-08-05) — CODE BUILT + verified; prod migration + deploy pending

Plan limits now span **brands** (org-total) + **regions-per-brand** + **marketplaces-per-brand**,
reflected AND enforced on the customer side; admin brand-create mirrors the customer "Add monitored
asset" with selectable pickers; creating a company kicks staff into Plan & Limits first.
Verified: ruff (both src) clean, admin+customer `tsc` clean, 233 API tests pass (1 unrelated live
Meta-Ads-cred fail), both apps boot, admin-parity green.

- [x] **DB** `20260805000003_per_brand_limits.sql`: +`regions_per_brand_limit`, +`platforms_per_brand_limit`;
      `create_brand_checked` enforces per-brand region/platform caps (REGION/PLATFORM_LIMIT_REACHED), same signature.
- [x] **main-api** `brands.py`: `GET /brands` returns 3-axis `limits` + real `usage.limit`; create maps 2 new
      RPC errors→403; edit enforces caps (`_enforce_per_brand_caps`, `_org_limits`).
- [x] **admin-api** `organizations.py`: Limits models + get/set carry all 3 axes (audited); `brands_admin.py`
      create maps new errors→403 + edit enforces caps.
- [x] **admin FE** `lib/brand-options.ts` (mirror), `PlatformPicker`/`RegionPicker` (cap-aware), BrandCreate/Edit
      use pickers, `LimitsCard` edits 3 caps, New-company → auto-open Plan & Limits (sessionStorage flag).
- [x] **customer FE** `monitoring.new.tsx` cap pickers + block at brand cap + surface 403; `dashboard.tsx`
      shows `used / limit`; `api.ts` `BrandsResponse.limits`.
- [x] **Tests** 3 new (region/platform RPC 403 + `_enforce_per_brand_caps` units); all pass.
- [ ] **Prod:** user runs `supabase db push` (migration `20260805000003`) — auto-mode blocks it for me.
- [ ] **Deploy** picks up the commit (Hetzner). Smoke: set caps in admin → customer pickers cap + dashboard shows used/limit.
- [ ] (Optional) if the user prefers ORG-TOTAL region/marketplace limits instead of per-brand, revisit migration + enforcement.

## 🟩 Admin onboarding repair (Session 51, 2026-08-05) — CODE BUILT + verified; prod migration + deploy pending

Fixes the broken customer-onboarding flow (can't create company, auto-assigns people, no login
setup, can't add brand, can't add limits). Full plan + adversarial-review hardening in `plan.md`.
Verified: ruff clean (both backends), secret-scan + admin-parity green, customer+admin `tsc` pass,
228 API tests pass (1 unrelated LIVE Meta-Ads-credential failure), both FastAPI apps boot.

- [x] **Pre-flight:** confirmed prod migration state via `supabase migration list` — `20260728000003`,
      `20260802000*`, `20260803000001` ALL applied; local == remote. No backlog. CLI is authed.
- [x] **P0 DB migration** `20260805000001_onboarding_fixes.sql`: `organizations.is_personal bool`
      (backfilled + trigger sets TRUE); `org_settings.notification_email` DROP NOT NULL.
- [x] **P1** `create_organization` = company-ONLY (removed owner_email/password); always uuid4; INSERT;
      shared `services/auth_users.py` (paginated list, targeted `get_user_by_id`, orphan helpers);
      `create_customer` create→assign atomic rollback; `impersonation` unpaginated `list_users` fixed.
- [x] **P1** list filter → `WHERE NOT is_personal`.
- [x] **P2** FE: `CreateOrgDialog` company-only → navigates to detail; 0-member empty-state + auto-open CreateUserDialog.
- [x] **P4** admin `POST /brands` + `brands.create` (both catalogs, admin+sales) + `BrandCreateDialog`;
      customer + admin brand-create BOTH go through `create_brand_checked` RPC (no bypass).
- [x] **P5** migration `20260805000002_entitlements_and_brand_rpc.sql`: minimal `org_entitlement_overrides`
      (org_id + brands_limit + note) + SECURITY-DEFINER `create_brand_checked` (advisory-lock + count + insert);
      admin `GET/PUT /organizations/{org}/limits` (writes table directly); `limits.view` (dev+sales+admin) +
      `limits.manage` (admin/super ONLY); "Plan & Limits" card on OrgDetail.
- [x] **P3** customer `/auth/reset-password` route (`updateUser`); main-api `/internal/customers/send-invite`
      (recovery link + Resend); admin `POST /customers/{id}/send-invite` (`customers.invite`, critical audit,
      STORED email only); optional passwordless create (+ invite); login-status "Never signed in" badge;
      "Send login link" on OrgDetail rows + CustomerDetail.
- [x] **P6** removed `entitlements.cpython-314.pyc`; fake `org-xxx@internal.hakkiu.com` gone (P1);
      nav `startsWith`→segment match. (Orphan `GET /monitoring/resources/status` LEFT — harmless, no bug.)
- [x] Parity: audit-log on every new mutation; perms in BOTH catalogs (24=24 in sync); `<Can>` UI gating.
- [x] **PROD MIGRATION applied** (2026-08-05, user ran `supabase db push`): `20260805000001` +
      `20260805000002` now show Local==Remote. Benign NOTICE (DROP POLICY IF EXISTS skip). Schema live.
- [ ] **DEPLOY:** commit + push (Slack) → Hetzner picks up FE/backends. (Awaiting user "commit and push".)
- [ ] **Smoke test** (after migration): create company → auto create-user (invite) → email lands (Alert
      Email per project rule) → customer sets password → login works; add brand; set limit N, add N+1 → 403.

## 🟩 Code-review "judge" / CI quality gate (2026-08-05)

Portable `@judge` template on the Desktop misfit our direct-Supabase architecture, so built a
HAKKIU-specific gate. Two layers, both run on GitHub automatically.
- [x] Ruff config (`select = E9,F,I`) in both `apps/api` + `apps/admin-api` `pyproject.toml`.
- [x] Fixed all ruff findings green, incl. a REAL latent bug (`import io` missing in
      `services/embedding_helper.py` → runtime `NameError` in the phash path).
- [x] Removed 4 ruff-flagged dead assignments (`base_url`/`rank`/`loop`/`target_is_super`) —
      verified none were live guards.
- [x] `scripts/scan-secrets.sh` (git-tracked-only secret scan) + `scripts/check-admin-parity.sh`
      (CLAUDE.md parity rule, with SKIP list + KNOWN_GAPS baseline). Both green locally.
- [x] Wired 4 CI jobs into `ci.yml`: `lint-python`, `secret-scan`, `admin-parity`,
      `typecheck-customer`.
- [x] Verified: ruff clean, scripts green, customer+admin `tsc` pass, 222 API tests pass.
- [x] Built AI PR-review layer (`pr-review.yml` + `REVIEW.md`, `claude-code-action@v1`),
      verified it passes in CI — then **REMOVED it on user request (cost concern, ~€1/PR).**
      Only the free deterministic Layer 1 remains. To re-add later: restore those 2 files
      and add an `ANTHROPIC_API_KEY` repo secret.
- [ ] **SECURITY — rotate the Resend key.** A live key was committed in `.env.example` (now a
      placeholder) but remains in git history. Rotate it, then update the real root `.env`.
- [ ] Known gap: `clients.py` has no admin-portal parity (no `clients_admin.py`, no `clients.*`
      permission). Baselined in `check-admin-parity.sh` KNOWN_GAPS — build real coverage, then
      remove it from the allowlist.
- [ ] `apps/admin-api` still has no test suite (not covered by CI pytest).

## 🟨 Login brute-force protection — hCaptcha (2026-08-05)

Audit found NO rate-limit / brute-force defense on either login (admin or customer): both go
browser → Supabase directly, bypassing our backends. Added hCaptcha at the auth layer.
- [x] `@hcaptcha/react-hcaptcha` added to root `package.json` + `apps/admin/package.json` (installed).
- [x] `src/components/auth/auth-screen.tsx`: hCaptcha on sign-in + password-reset; `options.captchaToken`; single-use reset; gated on `VITE_HCAPTCHA_SITE_KEY`.
- [x] `apps/admin/src/pages/SignIn.tsx`: hCaptcha on staff sign-in (reset already `slowapi`-limited via admin-api).
- [x] **Invisible mode** (user pref): `size="invisible"`, no visible box; `execute({ async: true })` at submit fetches the token just-in-time. Iframe internals aren't restylable, so invisible keeps the form design clean.
- [x] **Supabase Attack Protection enabled** (2026-08-05) with real secret; real site key `c6d861a0-a358-41da-8412-3a1cb2fc74be` in local root `.env`; both dev servers verified serving invisible mode with the key inlined.
- [x] **Verified working locally** — hCaptcha dashboard showed ~12 "Passive" verifications; wrong-password attempt returned "invalid credentials" (not a captcha error), proving end-to-end issue+verify.
- [x] **Tier decision: STAY ON BASIC (free).** Passive Mode (silent) is Pro-only ($99–139/mo); Basic shows an image challenge on submit but is free/unlimited and equally secure — fine for low-volume B2B login. Pro trial auto-drops to Basic on 2026-08-19 (no charge, no card) — don't subscribe. No code change needed (invisible mode degrades gracefully).
- [x] **Decision: ONE hCaptcha site, multiple hostnames** (not separate admin/landing) — shared Supabase holds one secret, so one sitekey only.
- [ ] **MANUAL — add `admin.hakkiu.com` (and confirm `hakkiu.com`) to the hCaptcha site Hostnames**, else admin prod login fails captcha verification.
- [x] CSP allow `hcaptcha.com`/`*.hcaptcha.com` in all 4 spots: `Caddyfile`, `public/_headers`, `apps/admin/nginx.conf`, `apps/admin/public/_headers`.
- [x] **Build wiring (prod):** `VITE_HCAPTCHA_SITE_KEY` is a BUILD-time var — added it as a build arg in `docker-compose.yml` (both `frontend` + `admin`) and as `ARG`/`ENV` in `src/Dockerfile` + `apps/admin/Dockerfile`. Without this the key never reaches the bundle even if it's in `.env`.
- [x] `.env.example` + `.env.production.example`: documented `VITE_HCAPTCHA_SITE_KEY`.
- [x] Typecheck passes (admin `tsc` + customer `tsc`), lint clean.
- [x] **MANUAL — hCaptcha app created** (site `c6d861a0-...`, secret held by user).
- [x] **MANUAL — local `.env`** has the real site key (widget tested locally).
- [x] **MANUAL — Supabase Attack Protection → CAPTCHA (hCaptcha) enabled** with the secret (2026-08-05).
- [ ] 🚨 **MANUAL — set `VITE_HCAPTCHA_SITE_KEY=c6d861a0-...` in the SERVER `/opt/hakkiu/.env`.**
- [ ] 🚨 **Rebuild/redeploy frontends** (`docker compose build && up -d`, or push to main). Until then, live prod logins FAIL — Supabase now requires a captcha the deployed frontend can't produce. (Alt: temporarily disable Supabase CAPTCHA until deploy.)
- [ ] (Phase 2, optional) admin login-proxy for real account-lockout + per-IP `slowapi`; Caddy `rate_limit` plugin.

## 🟩 Customer delete: "email already exists" fix (2026-08-03)

Staff couldn't re-create a customer login after deleting it: create threw "already registered".
Root cause = the company-page "Remove" button only detached org membership (`DELETE /organizations/{org}/members/{user}`), leaving the `auth.users` row as an invisible orphan that blocked re-creation.
- [x] `apps/admin-api/.../routes/customers.py`: `create_customer` now self-heals — if the email is already registered, it checks for an orphan (no profile + no memberships); orphan → hard-delete + `customer.orphan_cleanup` audit, then recreate; active user → clear 409 message.
- [x] Added helpers `_find_auth_user_by_email` + `_is_orphan_auth_user`.
- [x] `apps/admin/.../OrganizationDetail.tsx`: the per-user button in a company now does a FULL delete (`DELETE /customers/{id}` → auth user + profile + all memberships) via a confirmation dialog, renamed "Remove" → "Delete". Keeps the last-owner guard.
- [x] **Allow attaching staff/super-admin logins to a company:** `search.py` gained an `include_staff` query param (default off — global search stays customer-only); `OrganizationDetail` "Add existing" calls `/search?...&include_staff=true`. Staff were previously filtered out of people results, so they could neither be created (email taken) nor added.
- [x] **Safety:** staff members show a **"Remove" (detach only)** button, real customers show **"Delete" (everywhere)** — driven by a new `is_staff` flag on the org members payload (`organizations.py`). `delete_customer` now hard-refuses staff accounts (400) so a super-admin login can never be nuked from a company view.
- [ ] **Restart admin-API uvicorn** so the backend changes take effect.

## 🟩 Notification Log P0 (2026-08-03) — completeness + cleanup

Fixed the Admin Portal Notification Log being flooded with junk (empty Sent + `test-case-123` Skipped pairs).
- [x] `routes/monitoring.py`: removed the redundant `log_delivery(ok=True)` after `dispatch_notifications()` (root-cause double-log that wrote a phantom "sent" row for every escalate/dismiss).
- [x] Wired `log_delivery` into 6 previously-unlogged emails: `new_lead` + `lead_confirmation` (`routes/leads.py`), `demo_confirmed` (`routes/internal.py` + `routes/slack_interactions.py`), `support_contact` (`routes/support.py`), `password_reset` (`routes/internal.py`, **no body_html** — has a live reset link), `test` (`routes/monitoring.py`).
- [x] `apps/admin/.../NotificationLog.tsx`: added the 6 new event types to filter + labels; fixed misleading "email / webhook" subtitle → "email".
- [x] Migration `20260803000001_notification_deliveries_cleanup.sql`: delete `test-case-123` residue + phantom "sent" case_escalated/case_dismissed dupes.
- [x] **DB cleanup applied to prod:** `supabase db push` ran `20260803000001` (2026-08-03) — junk rows deleted.
- [ ] **Restart main-API uvicorn** after deploy so the code changes (double-log fix + new logging) take effect.

### Notification Log P1 (2026-08-03) — usable "who received what" redesign
- [x] Backend `notification_log.py`: resolve **brand_name** (case → brand_name, fallback payload) and **recipient_name** (sales_leads by email + auth users → profiles.full_name; static role labels for staff/lead/platform emails). Added `hide_skipped` query param.
- [x] Frontend `NotificationLog.tsx`: new columns **Customer** (org, linked) · **Brand** (linked to case) · **Recipient** (name + email) · Event · Subject · Status. Inline error line for failed rows. Default "Sent & failed" view (hides skipped noise); view switcher for Delivered/Failed/Skipped/Everything. Rewrote subtitle honestly.
- [x] **Delete button** (per row): new `notification_log.delete` permission (permissions.py + permissions.ts), `DELETE /notification-log/{id}` in admin-api with `write_audit_log("notification_log.delete")`, trash icon in an Actions column gated by `canDelete` + confirm dialog. Available to `admin` + super-admin (not `dev`, which is view-only).
- [x] **Bulk delete**: `POST /notification-log/bulk-delete` (`{ids}`, capped at 500/request, single summary audit `notification_log.bulk_delete`) + checkbox column with select-all/indeterminate and a sticky "Delete selected" bar (Cases.tsx pattern). Selection clears on paging / filter change.
- Verified: admin-api `py_compile` OK, admin FE `npm run typecheck` clean.

### Notification Log — still remaining (P2, deferred)
- [ ] Free-text search by recipient / organization / case_id (currently dropdowns only).
- [ ] Date-range filter (from–to).
- [ ] Retry / Resend button for `failed` rows via a main-API `/internal/*` endpoint (SMTP runs in main API).
- [ ] Consider case-existence validation on the case-status endpoint so bogus escalates don't create skipped rows.
- [ ] Perf: `notification_log.py` now calls `auth.admin.list_users(1000)` per page load (same pattern as customers.py) — cache/scope if it gets slow.

---

## 🟩 Groups Feature V1 (2026-08-02) — Organizations, Roles & Hakkiu Staff Org

Multi-tenant workspace "Groups" feature using `organizations` and `organization_members`:
- [x] Database Migrations: `20260802000001_groups_v1.sql` (Hakkiu nil UUID org, `home_organization_id`, staff backfill, RPCs `assign_user_to_group` & `remove_user_from_group`, dropped `profiles.is_admin`) & `20260802000002_rls_membership_gate.sql` (RLS membership & owner gates).
- [x] Main API: Updated `CurrentProfile` with `org_role`, added `require_owner` dependency on all brand/monitoring/client write endpoints, updated email recipient fallbacks to query `organization_members` (role = 'owner').
- [x] Admin API: Added `HAKKIU_ORG_ID` exclusion, updated `organizations.py` and `customers.py` to use group RPCs, excluded Hakkiu staff org from customer listings, added `org_role` management.
- [x] Admin Frontend: Updated `CustomerEditDialog`, `CustomerDetail`, and `OrganizationDetail` with organization assignment, role management (`owner` / `member`), and last-owner removal protection.
- [x] Customer Frontend: Resolved `org_role` on `Profile` via `fetchProfile`, added read-only mode in UI (disabled write controls for `member` role).

---

## 🟦 Slack "Confirm demo" button (2026-07-31) — confirm a demo from Slack (like admin)

Interactive Slack app so staff confirm a requested demo slot + paste the Meet link straight
from the Slack demo notification — mirrors admin-portal `confirm_lead`, writes the SAME
`sales_leads` row, emails the customer, audits with the Slack user as actor.

Code — DONE (main API):
- [x] `services/slack.py`: `verify_slack_signature` (v0 HMAC + 5-min replay window), `slack_api`
      (bot-token Web API, e.g. views.open), `respond_via_response_url` (replace source message).
- [x] `routes/slack_interactions.py`: `POST /api/v1/slack/interactions` — block_actions → open modal
      (radio of slots + link input); view_submission → BackgroundTask confirms (update sales_leads +
      Resend email + `admin_audit_log` insert with `staff_email=slack:<user>`) + rewrites message to
      "✅ Confirmed". 3-second budget respected via BackgroundTasks.
- [x] `routes/leads.py`: capture inserted lead id; attach "✅ Confirm demo" button to the demo
      notification — ONLY when SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET are set (else omitted/dormant).
- [x] `main.py`: register router. Env docs added to `.env.example` + `.env.production.example`.
- [x] Verified: AST parse, runtime import, signature-verify smoke test, modal builder, route registered.

NEXT (USER) — one-time Slack app setup, then it goes live:
- [x] api.slack.com/apps → your existing app → Basic Information → copy **Signing Secret**.
- [x] OAuth & Permissions → add bot scope `chat:write` → Install → copy **Bot Token** (`xoxb-…`).
- [x] Interactivity & Shortcuts → ON → Request URL: `https://<api-domain>/api/v1/slack/interactions`.
- [x] Put `SLACK_SIGNING_SECRET` + `SLACK_BOT_TOKEN` in root `.env` (dev) AND Hetzner `.env` (prod),
      restart main API. Button appears on the NEXT demo lead.

## ⚡ Mobile landing performance (2026-07-31) — fixed 1–2 min mobile "frozen" load

**Root cause (verified w/ 4 subagents + build/SSR checks):** NOT bundle size or network (Caddy already
`encode zstd gzip` + immutable asset caching). It was the `<InfiniteGridBackdrop>` running a `motion`
`useAnimationFrame` 60fps loop that rewrote a full-viewport SVG grid every frame + a mouse-follow mask +
three `blur-[120px]` blobs — pegging the mobile GPU/main-thread on all 5 marketing pages.

**Done this session:**
- [x] Rewrote `src/components/ui/the-infinite-grid.tsx` → 100% CSS (no `motion`, no rAF): GPU-composited
      `.hakkiu-grid` background-position scroll, **off on mobile + prefers-reduced-motion**; static radial
      vignette replaces the cursor-follow mask; blobs use `blur-[60px]` on mobile (`md:blur-[120px]`).
- [x] Removed `motion` (framer-motion) from the client bundle entirely (verified 0 tokens in main chunk).
- [x] Added `prefers-reduced-motion` guards for `animate-rainbow` / `animate-marquee` in `styles.css`.
- [x] Deleted confirmed-dead heavy components: `cta.tsx`, `dot-field.tsx`, `scroll-velocity.tsx`,
      `features/radar.tsx` + `radar-panel.tsx` (ogl/WebGL), `features/case-panel.tsx`,
      `detection-panel.tsx` + 3 orphaned images. tsc + eslint + build + SSR smoke all green.

---

## 🔐 Security remediation (2026-07-31 deep audit) — see `security-audit-2026-07-31.md` + `remediation-plan-2026-07-31.md`

**Done in code/migrations this session (224 backend tests green):** Phase 1 cleanups; H1 SSRF redirect
guard; H2 test-email lock; H3 screenshots/sign org-scope; H4/H5 audit append-only migration + fail-closed
logging; H6 org_settings role-gate migration; H7 private legal-doc signing (main+admin parity); H8
forwarded-allow-ips + compose ipam; M1 staff.manage gate; M2/M4/M17/L3/L7/M5/M6/M7 + admin CSP + Caddy
internal-block. New tests: `test_ssrf.py`, admin-api `test_permissions.py`.

**⏳ OPERATOR (blocking — the only live-exploitable items):**
- [ ] **Rotate** leaked secrets from `dist/server/.dev.vars` (service-role, INTERNAL_API_SECRET, Resend, Meta, Stripe, Slack) + redeploy.
- [ ] **Verify prod RLS** + `supabase db push` (applies `20260728000003` + 6 new `20260731*` migrations).
- [ ] Confirm old key `sb_secret_MKex…` revoked; **scrub git history** of `query_case_details.py` (BFG), force-push.
- [ ] Supabase dashboard: DB network restrictions + SSL; confirm public signup disabled.
- [ ] Before H6 migration push: confirm no non-owner `member` rows (or ship settings.tsx role-gate first).
- [ ] Redeploy so Dockerfile `--forwarded-allow-ips` + compose ipam subnet apply together.

**⏭️ Deferred security follow-ups:**
- [ ] Customer-app CSP script-hashes (drop `'unsafe-inline'`) — compute from a built preview, verify GA-consent + theme still work.
- [ ] settings.tsx: hide org_settings controls from non-owner/admin members (pairs with H6).
- [ ] M15 evidence_items persona split; M14 evidence-table dedup; M3 broad `str(e)` sweep; M8/M9/M18/L1-L10 admin hardening.

---

## 📩 IMAP → Slack: forward info@ mailbox to a Slack channel (2026-07-31) — ⚠️ CODE DONE, config pending

> User ask: get every email sent to info@hakkiu.com (and its aliases) into a Slack channel,
> without a paid Slack "Email" app. Chosen path: own-backend IMAP poller (Hostinger IMAP →
> existing `post_to_slack`). Reuses the same webhook infra as lead notifications; no new
> Supabase tables (pure ops notification), so admin-portal parity N/A.
- [x] `apps/api/pyproject.toml`: add `imap-tools>=1.7.0`.
- [x] New `apps/api/.../services/imap_poller.py`: polls UNSEEN mail, posts each to
  `SLACK_WEBHOOK_EMAIL`, marks SEEN only after a successful post (idempotent across restarts);
  caps `IMAP_MAX_PER_POLL` to avoid backlog floods; dormant if creds unset. Import + dormant
  mode verified locally; imap-tools `fetch`/`flag` API confirmed.
- [x] `apps/api/.../main.py` startup: daemon thread runs the poller every `IMAP_POLL_SECONDS` (120s).
- [x] `.env.example` + `.env.production.example`: documented `SLACK_WEBHOOK_EMAIL`, `IMAP_*` vars.
- [x] Slack webhook created; `SLACK_WEBHOOK_EMAIL` + `IMAP_*` written to **local** repo-root `.env`.
- [x] Verified live: IMAP login OK on imap.hostinger.com:993 (info@hakkiu.com is a REAL mailbox, not
  Titan — Titan returned AccountNotFound); Slack test post OK; poll_once() forwarded the 15-email
  backlog and a 2nd run returned 0 (idempotency proven).
- [ ] **Manual (user):** add the same `SLACK_WEBHOOK_EMAIL` + `IMAP_*` vars to the **prod** `.env`
  on Hetzner (`/opt/hakkiu/.env`) and restart the api container so the poller thread starts.
- [ ] Note: `info@` mailbox password lives ONLY in the local/prod `.env` (git-ignored) — never commit
  it. Hostinger rejects the FIRST login from a new IP as anti-abuse, then allows — expect one
  transient auth fail on new hosts (prod), which the poller retries away on the next cycle.
- [x] **Per-alias routing** added: mailbox has 4 aliases (legal@/privacy@/security@/support@) all
  delivering into info@. Poller inspects To/Cc/Delivered-To/X-Original-To and routes each email to
  its own channel (`SLACK_WEBHOOK_LEGAL/PRIVACY/SECURITY/SUPPORT`); info@ + unmatched → fallback
  `SLACK_WEBHOOK_EMAIL`; multi-alias mail posts to each channel. Routing unit-tested (all 7 cases
  pass incl. Delivered-To detection). Unset alias webhook safely falls back to #info-inbox.
- [x] Slack channels #legal #privacy #security #support created; Incoming Webhook URLs pasted into
  local `.env`; verified live — a routing test post to each of the 4 channels returned OK.
- [x] **Fix "read-before-poll" misses:** switched idempotency from the \Seen flag to a dedicated
  IMAP keyword `$Forwarded` (IANA keyword; Hostinger/Dovecot support verified live). Poller now
  fetches `no_keyword=$Forwarded` with `mark_seen=False`, so reading an email in webmail no longer
  causes a miss. One-time transition run against the live mailbox: re-forwarded the missed legal@
  email (uid 19) to #legal, baselined all 20 existing messages as `$Forwarded` (skipped support@
  uid 20 — already delivered). Verified: 0 remaining, poll_once()=0, clean compile (no SyntaxWarning).
- [ ] **Manual (user):** replicate the 4 alias webhooks (+ SLACK_WEBHOOK_EMAIL + IMAP_*) into the
  **prod** `/opt/hakkiu/.env` on Hetzner, then `docker compose up -d --build api` (build, not just
  restart — new imap-tools dep + code). The `$Forwarded` baseline lives in the mailbox, so prod
  will NOT re-flood the old mail.

---

## 🚧 USER ACTIONS (external — need Martynas / credentials / dashboards)

### Company / legal
- [ ] Fill company requisites in `src/lib/company.ts` once incorporation is final (legal entity name,
  legal form, reg code, registered address, VAT, phone). One edit updates all legal pages + Imprint.
- [ ] Lawyer review of all 10 legal pages before relying on them (templates, not advice).

### Security / auth
- [ ] **Supabase Dashboard → Authentication → Sign In / Up → turn OFF "Allow new users to sign up".**
  Frontend/config (`auth-screen.tsx` sign-in only, `config.toml enable_signup=false`) is
  defense-in-depth only; a direct `POST /auth/v1/signup` with the public anon key is still accepted
  until this toggle is off. Can't be done from here (no `SUPABASE_ACCESS_TOKEN` in `.env`).

### Production / ops
- [ ] **Resend:** verify the `hakkiu.com` domain (SPF + DKIM DNS) and set the real `RESEND_API_KEY`.
- [ ] **Resend SMTP relay:** wire Supabase Auth → `smtp.resend.com:465` (user `resend`, pass = API key).
- [x] **Demo-scheduling migrations applied to prod (session 44):** `20260730000002` (scheduled_at,
  scheduled_timezone, meeting_link, confirmed_at) + `20260730000003` (proposed_slots jsonb) pushed via
  `supabase db push`. Book-a-demo multi-slot scheduler + admin Confirm are live.
- [x] **Lead-form migration applied to prod (session 43):** `20260730000001_sales_leads_drop_tier.sql`
  pushed via `supabase db push` — `tier` is now nullable (NOT NULL + CHECK dropped) so demo/call leads
  insert without the removed `tier` field.
- [ ] Functional E2E test: sign in on the customer app → run a scan (API + Supabase + scraping end-to-end).
- [ ] Backups: `apt install postgresql-client`, set `DATABASE_URL` in `.env`, add cron
  `15 3 * * * /opt/hakkiu/scripts/backup.sh` (the script already exists in `scripts/`).
- [ ] Manual audit: test all 12 scraper platforms locally, confirm parsers still work.
- [ ] (Optional) set `GOOGLE_SERP_API` / `SEARCHCANS_API` in `.env` to activate those scraper sources.

### SEO / marketing (external)
- [x] Google Search Console: DNS-verify the domain, submit the sitemap, request-index home + about.
- [ ] GA4 UI: mark `generate_lead` as a key event (conversion) — the event already fires on submit.
- [ ] Off-site authority (Batch 4) — **the real backlink work: EARN links first.** Claim G2 +
  Capterra; YouTube channel + 1 walkthrough video; Wikidata entity → add its URI to the Organization
  `sameAs`; ProductHunt / Crunchbase. (Site currently has ~0 backlinks, so this comes before any
  backlink measurement.) Feeds a real `aggregateRating` later.
- [ ] BLOCKED on real facts: named + attributed testimonial (client + quote + metric); `/about` role
  titles + 1-line bios.

---

## 🔴 NEXT FEATURE — Automation Rules Builder (Priority 2)

> If/then rules so detected infringements are handled automatically without per-case review. Closes
> the detection loop; pure business logic over existing data. Full approach in `plan.md`.

- [ ] **Backend** — migration `automation_rules` (id, org_id, name, enabled, conditions jsonb,
  actions jsonb, created_at); `services/rules_engine.py` (evaluate enabled rules vs a new
  infringement); hook it into `persist_infringement()`; `routes/rules.py` GET/POST/PUT/DELETE
  `/api/v1/rules` org-scoped + unit tests.
- [ ] **Customer FE** — `/settings/automation`: rules list + enable/disable toggles, creation dialog
  (condition selectors + action picker), activity log (which rule fired on which case).
- [ ] **Admin parity (mandatory)** — admin-api rules CRUD across all orgs; `rules.view`/`rules.edit`
  in `permissions.py` + `permissions.ts`; surface under Company detail in `apps/admin`, gated `<Can>`.

---

## 🟡 LATER FEATURES (priority order)

### Phishing site detection + domain takedown (Priority 7)
> Groundwork exists (`detection_funnel.py` already tags `lookalike_domain`/`typosquatting`; an email
> template hints at MX-based phishing). Remaining = a dedicated pipeline + phishing case type.
- [ ] Newly-registered lookalike-domain detection on the WHOIS surveillance.
- [ ] MX-record detection for phishing-capable domains.
- [ ] Automated ICANN / registrar abuse-report submission.
- [ ] Surface phishing cases separately in the customer dashboard + admin parity.

### Seller / actor network clustering (Priority 9)
- [ ] Link cases by seller name + similar pHash across platforms; "network" view UI; single
  cross-platform takedown targeting all linked listings; admin cluster/graph view.

### Rogue app + paid-ad abuse (Priority 10)
> Google Ads Transparency + Meta Ad Library scrapers already exist (`services/marketplace.py`).
- [ ] Rogue app: App Store + Play scan for brand name/logo; abuse reports; admin parity.
- [ ] Surface paid-ad abuse as its own case type (ads currently only land in `evidence.ads[]`) + admin parity.

### Advanced logo & image similarity (Priority 14)
> Gemini-Vision adjudication (`generate_evidence_analysis`) already wired into Tier 2.
- [ ] `embedder.py` — CLIP embeddings replacing pHash (evaluate DeepSeek-VL / Qwen-VL vs Gemini).
- [ ] CV-based logo cropping (OpenCV/YOLO or Gemini) before embedding.

### Multi-model AI routing (Priority 8) — deprioritized until volume justifies it
- [ ] Abstract Gemini behind an `LLMClient` interface (LiteLLM or custom) + benchmark + auto-failover.

### Org multi-member self-serve (Priority 11)
> Admin-side org + member management already exists; this is the CUSTOMER-side self-serve flow.
- [ ] Customer member-invitation endpoints + SMTP + activation tokens; org switcher UI; invite modal;
  Zustand store scoped by `organization_id`.

### Patrick's review items (Priority 13)
- [ ] Frontend: UI cleanups per Patrick's review.
- [ ] Backend: route cleanup, refactoring, test stabilization per Patrick's review.

---

## 🟢 SMALLER / OPTIONAL

### Email lifecycle (Priority 3)
- [x] **Admin Notification Log (session 44):** `GET /api/v1/notification-log` (admin-api) + `NotificationLog.tsx`
  under Monitoring. Read-only cross-org view of `notification_deliveries`; org resolved best-effort via
  infringement/payload→case→org lookups (table has no org_id). Named "Notification Log" not "email logs"
  since there are no recipient/subject columns. New perm `notification_log.view` (dev+admin).
- [ ] Onboarding nudges: "first takedown" (48h) + "day-14" schedulers.
- [ ] Dunning follow-ups: payment-failed day-3 + day-7 schedulers.

### Slack lead notifications (NEW — requested 2026-07-30)
> When a visitor submits a lead, in addition to the existing `sales_leads` insert + Resend staff
> email, post a Slack notification. **Two SEPARATE channels:** one for demo bookings
> (`source = request_demo`), one for call requests (`source = call_request` / talk-to-sales).
- [x] **Backend (main API) — DONE (session 45).** New `services/slack.py` (`post_to_slack()`,
  `httpx.post` timeout 10s, best-effort, never raises, skips cleanly if env unset). `routes/leads.py`
  now calls `_send_slack_notification()` after the staff email; routes by `source` via
  `_SOURCE_SLACK_WEBHOOK` (`request_demo`→`SLACK_WEBHOOK_DEMO`, `call_request`+`pricing_modal`→
  `SLACK_WEBHOOK_CALL`). Block Kit message shows ONLY fields the visitor submitted (name/email/
  company/brands/phone/website/message) — no invented values. Env registered in `.env.example` +
  `.env.production.example`. Verified: py_compile + import + routing/no-op unit check.
- [x] **Admin parity check — N/A.** Leads already visible/manageable in the Admin Portal Leads view;
  Slack is an outbound notification only, so no new admin CRUD. (If a delivery log is wanted later,
  mirror the `notification_deliveries` pattern.)
- [x] **LIVE in prod (session 45).** User created the 2 incoming webhooks (`#leads-demo` / `#leads-call`);
  `SLACK_WEBHOOK_DEMO` + `SLACK_WEBHOOK_CALL` set in root `.env` (dev) AND on the Hetzner server `.env`;
  `api` container force-recreated to load them. End-to-end tested on hakkiu.com: Book-a-demo → `#leads-demo`
  (with requested times), Talk-to-sales → `#leads-call`. NOTE: the webhook↔channel mapping was initially
  swapped and corrected on the server (DEMO=`B0BLGEKAGKZ`, CALL=`B0BLUGJ1R7X`).

### Scraper health (Priority 6)
- [ ] Optional Slack / SMTP push alerting for degraded platforms (currently in-page warnings only).

### Landing perf / polish
- [ ] Deploy + re-run PSI to measure the mobile Perf delta (after the session-41 image/font wins).
- [ ] DEFERRED (risky — FOUC): critical-CSS inlining or route CSS code-split (the ~27 KiB
  render-blocking stylesheet). Decide after measuring the image wins.
- [ ] B2-5: one a11y colour-contrast warning — need the exact failing node from a fresh Lighthouse run.
- [ ] (Optional) subset / drop provably-unused font weights.

### Landing trust signals (nice-to-have)
- [ ] Hero A/B: benefit-first headline test.
- [x] Decide whether to neutralize the illustrative "99.4%" / "1,842" numbers in the 2 `aria-hidden`
  decorative mockups (`product-window.tsx`, `workflow.tsx`) for consistency with the removed fake stats.

---

## 🔵 BACKLOG / FUTURE
- [ ] Social-proof bar "Trusted by X brands" + testimonials (was removed as unverified — needs real data)./
- [ ] MFA + domain-restricted logins for admin staff.
- [ ] Consumption-based pricing tier (pay-per-takedown via Stripe metered billing).
- [ ] China domestic platform coverage (Pinduoduo, Goofish, WeChat, Douyin).
- [ ] Security: M10 per-service docker-compose env — assessed NO-GO (kept `env_file`); L9 admin
  `list_users` pagination — deferred until customer count grows.
- [ ] (Much later — depends on having backlinks first) add Moz / Bing API keys so the SEO tooling
  can measure backlink DA/PA. Pointless until the off-site-authority work above has earned some
  links; today there are ~0, so the free Common Crawl tier already shows everything (nothing).

---

## ⚪ Intentional non-goals / do-NOT-re-flag
- Internal python pkg names (`tracemark_api`, `tracemark_admin_api`), docker/worker names,
  localStorage/auth storageKeys, `supabase/config.toml` project_id — KEPT on purpose (renaming is a
  separate risky refactor, not a bug).
- SEO non-findings: marketplace logos use `alt=""` WITH adjacent text labels (correct for decorative);
  FAQPage yields no Google rich result post-May-2026 (kept for AI/Bing comprehension); `foundingDate
  2026` "too new" resolves with age; CrUX field data absent = low traffic, appears as traffic grows.

---

## ✅ Recently completed (one-liners — full detail in git log + `docs/.roadmap/todo-archive.md`)
- **2026-07-31** — Fixed the link-preview image: `og:image`/`twitter:image` were serving a stale
  dashboard screenshot (old "Tracemark" branding). Replaced `public/og-image.png` with a real
  landing-page hero screenshot (Playwright capture of live hakkiu.com, consent banner dismissed,
  2400×1260 @2x), renamed to `og-image-v2.png` to bust crawler caches, updated `__root.tsx`
  (og:image + twitter:image + width/height 2400×1260). Also trimmed `todo.md` 1214→~280 lines
  (removed redundant session-by-session DONE detail + a duplicate open-work structure).
- **Session 46** — Dual-timezone demo slots: every requested/confirmed slot now shows the visitor's
  time AND ours (`Europe/Vilnius`, "our time") in Slack, both lead emails, the confirmation email, and
  admin `Leads.tsx`. Backend: new `COMPANY_TIMEZONE` + `_render_in_tz` helper in `leads.py::format_slot`
  (single label when visitor is already in our zone). Admin: matching `fmtSlot`/`fmtInTz`. No DB change.
- **Session 45** — Slack lead notifications (two channels) + merged the demo-scheduling calendar.
  New `services/slack.py` (`post_to_slack`, best-effort httpx, no-op if unset); `leads.py`
  `_send_slack_notification` routes by `source` (demo→`SLACK_WEBHOOK_DEMO`, call→`SLACK_WEBHOOK_CALL`)
  and includes the visitor's proposed demo slots (via `_lead_slots`) in the demo message. Merged
  `feat/demo-scheduling-calendar` (Calendly-style multi-slot picker + admin Confirm). Env vars in both
  `.env.*.example`; webhooks live (user-created).
- **Session 44 (part 3)** — Store + render the actual email body. Migration `20260730000005` adds
  `body_html TEXT` (nullable, applied to prod). Every send now captures its rendered HTML
  (`send_email_notification` returns it; `dispatch_notifications._sent` + welcome + digest + takedown
  persist it); admin expandable row renders it in a sandboxed iframe (`sandbox=""`) as the primary view,
  JSON payload demoted to a collapsible toggle. Historical/skipped rows show a placeholder. Deployed
  `ac2bc8c`. Verified py/tsc/build.
- **Session 44 (part 2)** — Enriched the Notification Log into a FULL email log. Migration
  `20260730000004` adds `organization_id`/`recipient`/`subject` (nullable) + backfill + index + RLS org
  branch — **applied to prod via `supabase db push`** (also committed the demo-scheduling `...002/...003`
  .sql files from `feat/demo-scheduling-calendar` to reconcile migration history that had blocked push).
  `dispatch_notifications()` now logs at every exit (sent/failed/skipped-with-reason) with recipient+
  subject+org; instrumented welcome + weekly_digest (were unlogged); admin reads columns w/ legacy
  fallback + Subject column. Deployed `23d338b`. Verified py/tsc/build. **Goal 2 (landing PSI) still
  pending USER: GOOGLE_API_KEY.**
- **Session 44 (part 1)** — Admin Notification Log (Priority 3 email-lifecycle item). Read-only cross-org
  view of `notification_deliveries`: admin-api `notification_log.py` (`GET /notification-log`, gated
  `notification_log.view`), `NotificationLog.tsx` under Monitoring. Fixed a runtime 500 (unguarded JSONB
  payload access). Deployed `ab5b726`+`c50cc0d`.
- **Session 44** — Demo scheduling (Calendly-style, MULTI-slot). Book-a-demo now has a 2nd step
  (`demo-scheduler.tsx`, reuses `ui/calendar`): visitor picks EVERY time they're free (removable chips),
  then the same animated success modal. POST `/leads` carries `proposed_slots[]` + `scheduled_timezone`;
  customer gets a "we received your availability" email listing all times; staff get the alert with the
  list. Admin `Leads.tsx`: Requested/Confirmed badge + Confirm panel with a **pick-one radio list** of
  the offered times → paste Meet link → `POST /leads/{id}/confirm` (sets `scheduled_at`) →
  `send_demo_confirmation` emails the customer the chosen slot + link (audit-logged). New perm
  `leads.confirm`. Migrations `20260730000002` + `20260730000003` (`proposed_slots jsonb`) **applied to
  prod**. (Also fixed a 422 caused by a stale pre-session-43 uvicorn — restarted it.)
- **Session 43** — Lead-form honesty pass (3 subagents audited demo/call forms → email → admin).
  Removed the fake `tier` end-to-end (both forms hardcoded professional/enterprise though HAKKIU has no
  tiers): dropped from form payloads, `LeadRequest`, staff email (subject/row/preheader), admin table
  (column, badge, filter) + admin-api filter/audit. Dropped 5 dead `/request-demo`-wizard fields
  (role/regions/brand_names/marketplaces/current_solution) from the admin detail view (always showed
  "—"). Now email + admin show ONLY what the user actually submitted. Migration
  `20260730000001` relaxes `tier` NOT NULL — **pending `supabase db push`**.
- **Session 42** — Admin per-copycat DELETE parity (`DELETE /infringements/{id}` + `infringements.delete`
  permission + gated trash button; mirrors the customer app); TODO/roadmap reconciliation audit (4
  subagents); deleted the stale `feature/admin-per-copycat-delete` branch.
- **Session 41** — Mobile perf: safe image/font optimization; landing Supabase lazy-split (−55 KiB,
  merged `565aec2`); public-page auth defer (Lever A); render-blocking-CSS Lever B declined.
- **Session 40** — Per-copycat status workflow fixed (migration `20260729000001`) + takedown page
  un-broken (real data + working webhook) + platform reporting link + dashboard "Active" fix.
- **Session 38** — SEO A/B content groups, then REMOVED all competitor "compare" pages (legal-risk call).
- **Sessions 33–36** — SEO overhaul: JSON-LD schema, canonicals, FAQ + FAQPage, self-hosted fonts,
  LCP fixes, `/about` team, content depth, `llms.txt`. Health score 58 → ~70.
- **Sessions 26–32** — Landing "technical-paper" redesign; lead modals (book-demo / talk-to-sales) +
  confirmation emails; landing moved to root `/`; brands-count field; mobile polish; consent banner + GA4.
- **Session 22** — Security re-audit: RLS reconciliation (prod cross-tenant drift fixed), SSRF guard,
  private evidence bucket + signed URLs, rate limiting, service-role key rotation + git-history purge.
- **Earlier** — Core product (12-platform scraping, Gemini Vision, takedowns, geo/WHOIS, law-firm mode,
  per-copycat cases), Admin Portal, Resend Tier-1 emails, scraper health, Hetzner deploy + CI auto-deploy.
