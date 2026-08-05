# HAKKIU — Active Plan

> **Session 53 (2026-08-05) — Plan limits are WHITELISTS, not counts (correction of Session 52).**
> Feedback: staff don't set "max N regions / M marketplaces" (a count). They agree a concrete
> plan with the customer — e.g. "2 brands, scan ONLY Amazon, ONLY USA" — and must whitelist the
> SPECIFIC marketplaces & regions the customer may use. Everything is PICKED (no free-text), and
> a person who knows nothing can set it up because the admin sees the full list to choose from.
>
> **Model (org_entitlement_overrides):** `brands_limit int` (max count, unchanged) +
> `allowed_platforms text[]` + `allowed_regions text[]` (whitelists; NULL/empty = all allowed).
> Regions are COUNTRY-CODE granularity so "only USA" works.
>
> **What shipped (code, Session 53):**
> - DB `20260805000004_allowed_lists_limits.sql`: drops the count columns from ...000003, adds the
>   two `text[]` whitelists; `create_brand_checked` now enforces SUBSET membership (raises
>   `PLATFORM_NOT_ALLOWED` / `REGION_NOT_ALLOWED`). Same RPC signature.
> - main-api `brands.py`: `_org_limits` returns the whitelists; `_enforce_allowed_lists` (edit)
>   + create error mapping → 403 with the offending value(s) named.
> - admin-api: `LimitsResponse`/`UpdateLimitsRequest` carry `allowed_platforms`/`allowed_regions`;
>   set stores empty→NULL (unrestricted); `brands_admin` subset-enforces on create/edit.
> - admin FE: `PlatformPicker`/`RegionPicker` refactored to an `available` (whitelist-to-SHOW) prop.
>   `LimitsCard` = brand-count + "Allow all" toggles + pickers to choose the allowed marketplaces/
>   regions (admin SEES the full list). Brand dialogs show ONLY the allowed options.
> - customer FE `monitoring.new.tsx`: platform picker filtered to the plan; region picker rebuilt to
>   COUNTRY level (grouped) filtered to the plan; default selection reconciled to the whitelist;
>   count-cap UI removed. `api.ts` `PlanLimits` = { brands, allowed_platforms, allowed_regions }.
> - Tests rewritten for NOT_ALLOWED codes + `_enforce_allowed_lists`.
>
> **Verified:** ruff (both src) clean; admin+customer tsc clean; brand tests pass; both apps boot.
> **PENDING: user runs `supabase db push` (`20260805000004`) + deploy.** Permission keys unchanged.

> **Session 52 (2026-08-05) — Brands = monitored assets + 3-dimensional plan limits (reflected customer-side).**
> Builds on Session 51. Goal: (1) admin "Add brand" mirrors the customer "Add monitored asset"
> (selectable marketplace/region PICKERS, not free-text); (2) plan limits span THREE axes —
> **brands** (org-total), **regions-per-brand**, **marketplaces-per-brand**; (3) limits are
> reflected AND enforced on the customer side (pickers cap selection, brand cap blocks "Start
> Monitoring"); (4) creating a company now KICKS staff into Plan & Limits first.
>
> **Design decision — limit semantics:** regions & marketplaces are **per-brand caps** ("each
> monitored asset may target up to N regions and M marketplaces"), which maps cleanly to the
> per-brand pickers and to "you can only select up to your plan." `brands_limit` stays org-total.
> All three: NULL/-1 = unlimited.
>
> **What shipped this session (code):**
> - DB `20260805000003_per_brand_limits.sql`: `org_entitlement_overrides` += `regions_per_brand_limit`,
>   `platforms_per_brand_limit`; `create_brand_checked` RPC now enforces per-brand region/platform
>   caps atomically (raises `REGION_LIMIT_REACHED` / `PLATFORM_LIMIT_REACHED`), same signature.
> - main-api `brands.py`: `GET /brands` returns real 3-axis `limits` + real `usage.limit`; create maps
>   the 2 new RPC errors → 403; edit enforces per-brand caps via `_enforce_per_brand_caps`.
> - admin-api: `LimitsResponse`/`UpdateLimitsRequest` + get/set carry all 3 axes (audited); admin brand
>   create maps new errors → 403; admin brand edit enforces the caps too.
> - admin FE: new `lib/brand-options.ts` (mirrors customer platforms/regions); `PlatformPicker`/
>   `RegionPicker` checkbox grids (cap-aware); BrandCreate/BrandEdit dialogs use them; `LimitsCard`
>   edits all 3 caps; New-company → detail page auto-opens Plan & Limits in edit mode (sessionStorage flag).
> - customer FE: `monitoring.new.tsx` caps the pickers to the plan, blocks "Start Monitoring" at the
>   brand cap, surfaces server 403 messages; `dashboard.tsx` "Monitored marks" shows `used / limit`;
>   `api.ts` `BrandsResponse` gains `limits: PlanLimits`.
> - Tests: 3 new brand-limit tests (region/platform RPC 403 + `_enforce_per_brand_caps` unit tests).
>
> **Verified:** ruff (both src) clean; admin+customer `tsc` clean; 233 API tests pass (1 unrelated
> live Meta-Ads-cred failure); both apps boot; admin-parity green. **PENDING: user runs
> `supabase db push` (migration `20260805000003`) + deploy.** Permission keys unchanged (limits.view/
> manage + brands.create already exist → still in sync).

> **Session 51 (2026-08-05) — Admin Portal onboarding repair (company → users → logins → brands → limits).**
> Full plan below. Four subagents audited the admin portal; this session turns the diagnosis into
> a solid, defended implementation plan spanning DB → backend → FE → UX.
> **STATUS: CODE BUILT + verified** (ruff/tsc/secret-scan/admin-parity green; 228 API tests pass, 1
> unrelated live-cred failure; both apps boot). **PENDING: user runs `supabase db push` (2 additive
> migrations) + deploy.** See `todo.md` for the exact remaining steps. Details unchanged below.

## Session 51 plan — Admin onboarding fix

### Root causes (verified in code)

| # | Symptom | Root cause | File |
|---|---|---|---|
| 1 | "Can't create company" | `create_organization` derives `org_id` from the owner's existing profile → hijack/500; unpaginated `list_users()` breaks owner-dedup past 50 users | `organizations.py:169-178`, `:30` |
| 2 | "Creates AND auto-assigns people" | Uses owner's **home org** (id=user.id) as the company org → `handle_new_user` trigger membership + endpoint upsert land on the SAME org → looks pre-populated | `organizations.py:176-200` + trigger `groups_v1.sql:205` |
| 3 | "Don't see where to set up logins" | Logins CAN be created but (a) no discoverable entry point after creating an empty company, (b) **no credential delivery** — user created with `email_confirm:true`, no invite/reset email ever sent | `organizations.py`, `customers.py:199-207` |
| 4 | "Can't add a brand" | No `POST /brands` in admin-api, no "Add brand" button — staff can only edit/delete | `brands_admin.py` |
| 5 | "Can't add limits" | Entitlements gutted in Stripe pivot: table `org_entitlement_overrides` orphaned, service deleted, no route/UI/permission | `entitlement_overrides` migration exists; service `.pyc` only |

North-star UX: **Create company → land on its page → add users there → hand them a login link.** One obvious path, no hidden auto-assignment, no manual password hand-off.

### Data model (the correct wiring)

```
auth.users ──trigger handle_new_user──▶ personal "home" org (id = user.id), owner membership
     └── assign_user_to_group(user, COMPANY_org, role) ──▶ profiles.organization_id = COMPANY_org (active) + membership
organizations(COMPANY) 1─* organization_members *─1 users;  1─1 org_settings;  1─* brands;  1─1 org_entitlement_overrides
```
Rule: a **company org is always a fresh `uuid4()`**, never a user's home org. Members attach via the existing transactional `assign_user_to_group` RPC.

### Phases

**Phase 0 — DB** (migration `2026080500000x_onboarding_fixes.sql`, `supabase db push` via CLI, NOT MCP):
1. `org_settings.notification_email` → DROP NOT NULL (owner-less company has no recipient yet; kills the fake `org-xxxx@internal.hakkiu.com` hack).
2. Verify `brands.user_id`; if NOT NULL → DROP NOT NULL (admin-created brand has no single acting customer).
3. Limits reuse existing `org_entitlement_overrides` — no new table.
4. `_recipient_for_org` (main-api) treats null/empty email as "no recipient".

**Phase 1 — Fix `create_organization`** (admin-api): rewrite to mirror the CORRECT pattern already in `customers.py`:
- Always `org_id = uuid4()`; INSERT (not upsert) organizations + org_settings.
- If `owner_email`: reuse `_find_auth_user_by_email` + orphan cleanup + 409-on-active (extract to shared `services/auth_users.py`), create auth user if new, then `assign_user_to_group(user, org_id, 'owner')`.
- Build the response row locally (no re-fetch that can 500 after a successful write).
- Shared paginated `list_all_auth_users()` → fix `organizations.py:30/169` + `impersonation.py:47`.

**Phase 2 — Onboarding UX** (admin FE):
- `CreateOrgDialog` → company-only fields (name, industry, persona); remove inline owner section. On success → navigate to detail page.
- `OrganizationDetail`: when `members.length===0` show a prominent empty-state "This company has no logins yet → **Create first user**" (opens existing `CreateUserDialog`). The single obvious answer to "where do I set up logins".

**Phase 3 — Credential delivery** (the real "set up logins" fix):
- main-api: `/internal/customers/send-invite` mints a Supabase link (`generate_link` invite/recovery) + sends via Resend using new `customer_invite_html`.
- admin-api `main_api.py`: `send_customer_invite(...)` bridge.
- admin-api `customers.py`: make `password` OPTIONAL (blank → random pw + auto invite); new `POST /customers/{id}/send-invite` (perm `customers.create`, audited).
- admin FE: `CreateUserDialog` "Send invite link (no password)" toggle; "Send login link" button on Customer/Org detail.

**Phase 4 — Brand create in admin** (parity):
- admin-api `brands_admin.py`: `POST /brands` (org_id + brand fields) via `customer_sb()`, `status:'active'`, `user_id`=org's first owner or NULL. Perm **`brands.create`**, audited; enforces limit via main-api.
- Permissions: add `brands.create` to BOTH catalogs (+ admin preset).
- admin FE: "Add brand" + `BrandCreateDialog` on `OrganizationDetail` (org known from context).

**Phase 5 — Limits** (re-activate, minimal + ENFORCED, reuse existing table):
- main-api: rebuild minimal `services/entitlements.py` `get_brand_limit(org_id)` from `org_entitlement_overrides.brands_override` (null/-1 = unlimited); enforce in `create_brand` (used>=limit → 403); `/internal/entitlements/{org_id}` GET+PUT.
- admin-api: `GET/PUT /organizations/{org_id}/limits` → proxy to main-api internal (entitlement writes live in main API per CLAUDE.md). Perm **`limits.manage`**, audited.
- Permissions: `limits.view` + `limits.manage` in both catalogs (+ admin preset).
- admin FE: "Plan & Limits" card on `OrganizationDetail` (brands used/limit + editable cap + note), gated `<Can>`.

**Phase 6 — Cleanup**: remove stale `entitlements.cpython-314.pyc`; fake-email hack (Phase 0/1); orphan `GET /monitoring/resources/status` (wire or delete); nav `startsWith` → segment match.

### Admin-parity checklist (per new resource)
view route (all orgs, `require_permission`) · edit route writing SAME customer tables · `write_audit_log` on every mutation · permission key in BOTH catalogs · UI gated `<Can>` · main-API ops via `/internal/*`.

### Test plan
Empty company appears + empty-state · owner create w/ & w/o password → invite delivered (to Alert Email per project rule) → customer login works · existing active email → 409 not hijack · orphan email → cleaned+recreated · >50 users → dedup+emails correct · admin brand visible to customer · limit=N, add N+1 → 403 both sides.

### Sequencing
P0→P1 (unblocks creation, highest) → P4 → P3 → P2 → P5 → P6. Each phase ships with parity + tests.

### ⚔️ Adversarial review — corrections & hardening (4 critic agents, DEFENDED)

Two FACTUAL corrections the review forced (both verified in code):
- **`org_entitlement_overrides` was DROPPED** (`20260728000001_drop_billing_tables.sql:34`, CASCADE) — the table does NOT exist and nothing enforces limits. Phase 5 must RECREATE it (new migration), not "reuse". Enforcement layer must be rebuilt too.
- **Customer app has NO set-password route** (`src/routes/` = callback/sign-in/sign-up only). An invite/recovery link currently lands nowhere → Phase 3 MUST first build a customer `/auth/reset-password` route calling `supabase.auth.updateUser({password})`. Until then, "send login link" is a broken promise.
- Minor: `brands.user_id` is already nullable → Phase 0 step 2 REMOVED (no-op).

Hardening decisions (resolving the hardest questions):

1. **Company-create becomes company-ONLY** — remove `owner_email`/`owner_password` from `create_organization` entirely. This dissolves the hijack bug, the double-membership bug, and the "adopt vs 409" policy conflict at once (org-create no longer touches auth). Owners are added on the detail page via `create_customer` (which already has the correct 409/orphan policy). Kept fast by **auto-opening the Create-User dialog** on a fresh 0-member company detail page (feels like one flow, UX critic's regression concern answered).
2. **Personal-org leak fixed deterministically** — add `organizations.is_personal boolean` (trigger sets TRUE; staff-created company orgs FALSE). List filter becomes `WHERE NOT is_personal` — replaces the fragile domain-string heuristic that leaks `.co.uk`/subdomain names. Personal home orgs are NEVER deleted (keeps `remove_user_from_group`'s `home_organization_id` fallback valid).
3. **Atomicity** — in create-user/attach: if `create_user` succeeds but `assign_user_to_group` fails, DELETE the just-created auth user (only when WE created it this call), then raise → no orphan accumulation. Apply consistently in the shared `services/auth_users.py`.
4. **Credential delivery** — DEFAULT stays staff-set password (always works, no lockout). Passwordless+invite is an OPTIN. `generate_link` type = **`recovery`** (users are created `email_confirm:true`; `invite` is for unconfirmed users — wrong here), matching the existing staff reset flow. If the recovery email send fails → return error + idempotent "Resend login link". Users table gets a **login-status badge** (never-signed-in vs active) via `last_sign_in_at`.
5. **Limits — single enforcement path (no bypass)** — recreate a MINIMAL `org_entitlement_overrides` (org_id + `brands_limit int` + note + ts; drop unused feature-flag columns, YAGNI). Enforce in ONE place: a SECURITY-DEFINER RPC `create_brand_checked(org_id,…)` that takes `pg_advisory_xact_lock(org)` → counts → inserts atomically (the real DB-level guard against the count-then-insert race). BOTH the customer `create_brand` AND admin brand-create call this same RPC → admin path can't bypass the cap (resolves the Phase 4/5 contradiction). `brands_limit` NULL/-1 = unlimited; row-absent = unlimited.
6. **Permissions split** — `limits.manage` = **admin/super-admin ONLY** (raising a cap is a commercial concession, not a support action — never in `sales`). `limits.view` = dev+admin. `brands.create` = admin+sales (creating within cap is legit onboarding). New **`customers.invite`** key for send-invite (gated/revoked independently of create).
7. **Security on invite/create** — login-minting + send-invite use **`critical=True` audit written BEFORE the mutation** (matches impersonate). send-invite always sends to the STORED email (caller can't redirect) and records the exact target email in the audit row (closes the email-swap→invite takeover vector). Generated random password is passed ONLY to `create_user` — never returned, logged, or put in audit metadata (create audit gets the same redaction guard `update_customer` already has).
8. **`/internal/*` guards** — every new internal route (`/internal/customers/send-invite`, `/internal/brands`, `/internal/entitlements/{org}`) MUST include `Depends(verify_internal_secret)` explicitly. Entitlement compute/enforce + Resend sends genuinely belong in main-api (justifies the round-trip); admin-api proxies.
9. **Perf** — resolve member emails on org-detail via targeted `get_user_by_id(member_id)` for the small member set, NOT `list_users()` over all users. Full paginated `list_all_auth_users()` (loop until short page) only where a whole map is needed (customer list).
10. **Error mapping** — `main_api._request` passes 4xx `detail` through WITHOUT the "Main API error:" prefix (only prefix 5xx), so a limit-exceeded 403 reads cleanly in the FE toast.
11. **notification_email nullable** — DB allows NULL (owner-less org has no recipient); `_recipient_for_org` + weekly digest skip NULL; the CUSTOMER settings save keeps an app-level non-empty check so a customer can't blank their own breach alerts.
12. **Keep the re-fetch** — `create_organization` still returns `get_organization()` (contract fidelity); the real fix is making that read not 500 (targeted email resolution, #9).

**⛔ Pre-flight ops gate (DB critic):** before any brands/limits migration, run `supabase migration list` on the CLI-linked prod project and confirm `20260728000003` + `20260802000*` are APPLIED (MEMORY says a prod push was pending re-auth). Re-auth CLI and apply the backlog FIRST — the tenancy assumptions depend on the membership-gate RLS being live.

Revised sequencing: **Pre-flight** → P0 (DB: is_personal, notification_email nullable) → P1 (company-only create) → P2 (detail empty-state + auto-open create-user) → P4 (brand create via RPC) → P5 (recreate limits table + RPC enforcement + admin UI) → P3 (customer reset-password route + invite delivery) → P6 (cleanup).

---

> **Session 50 (2026-08-05) — Automated code-review "judge" (CI quality gate).**
> Looked at a `~/Desktop/judge-templates` folder (a portable `@judge` code-review agent) and
> evaluated it with subagents against our real code. **Conclusion: the generic FastAPI variant
> misfits us** — it assumes a service/repository/UnitOfWork/ORM architecture, but our backends
> call Supabase directly (no repos/ORM/typed errors), so copying it would produce ~30/43
> false-positive rules. Built a HAKKIU-specific gate instead, in TWO layers that both run on
> GitHub automatically (no one has to remember to invoke it).
> **Layer 1 — deterministic (added to `.github/workflows/ci.yml`, so `deploy.yml` gates on it):**
> - `lint-python` — ruff on both backends. `[tool.ruff] select = E9,F,I` added to each
>   `pyproject.toml` (syntax, pyflakes, import order). Kept minimal on purpose — the full
>   default set flags the FastAPI `Depends()` idiom (B008, 148×) as violations.
> - `secret-scan` — `scripts/scan-secrets.sh`: greps only git-tracked files (so the git-ignored
>   `.env` is never scanned) for high-confidence credential patterns, with a placeholder allowlist.
> - `admin-parity` — `scripts/check-admin-parity.sh`: enforces the CLAUDE.md parity rule
>   (customer route → admin route + permission key). SKIP list + KNOWN_GAPS baseline so CI is
>   green today but any NEW uncovered route fails.
> - `typecheck-customer` — customer-app `tsc --noEmit` (was missing from CI).
> **Layer 2 — AI review (BUILT, then REMOVED on user request):** `pr-review.yml` +
> `REVIEW.md` (`anthropics/claude-code-action@v1`) reviewed every non-draft PR; verified it
> passed in CI (skips green without a key). User dropped it over per-PR cost (~€1/PR on
> Sonnet), so ONLY the free deterministic Layer 1 ships. To revive: restore the 2 files +
> add an `ANTHROPIC_API_KEY` repo secret. Options if revisited: on-demand `@claude review`
> trigger, or the Haiku model, to cut cost.
> **Real findings fixed while making the baseline green:**
> - **Latent bug:** `import io` missing in `services/embedding_helper.py` → `NameError` at runtime
>   in the phash path. Added the import.
> - **Leaked secret:** a LIVE Resend key was committed in `.env.example` (since `f473d72`) →
>   replaced with a placeholder. ⚠️ It remains in git history — **rotate the Resend key** (todo.md).
> - Removed 4 dead assignments ruff flagged (`base_url`, `rank`, `loop`, `target_is_super`);
>   verified none were live logic/guards (the `target_is_super` one only looked like a guard —
>   the real privilege check uses the actor's `staff.is_super_admin`).
> **Verified:** ruff clean both backends, both scripts green locally, customer+admin `tsc` pass,
> 222 API tests pass (the 1 failure is an unrelated LIVE Firecrawl test that skips in CI), all
> workflow YAML parses. **Not committed/pushed yet — awaiting user go (Slack posts on push).**
> **Deferred:** `clients.py` has NO admin parity (real gap, baselined in the script); building it
> is separate feature work. `apps/admin-api` still has no tests.

> **Session 49 (2026-08-05) — Login brute-force protection (hCaptcha).**
> Two Explore agents audited both auth surfaces (admin portal + customer dashboard) for
> rate-limiting / brute-force defenses. **Finding: there were NONE.** Both logins run
> client-side via `supabase.auth.signInWithPassword()` straight to Supabase (browser →
> `*.supabase.co`), so they bypass our FastAPI backends entirely — meaning `slowapi`
> (which only guards leads/support/monitoring + admin password-reset) can never sit in
> front of password guessing. No account lockout, no failed-attempt tracking, no CAPTCHA,
> no Caddy `rate_limit`; fail2ban is SSH-only. Sole defense = unconfigured Supabase GoTrue
> defaults.
> **Fix chosen: hCaptcha at the auth layer** (where login actually happens), because it
> stops bots before any password attempt reaches Supabase, needs no auth-flow rewrite, and
> has no lockout-DoS risk. Rejected a backend login-proxy + account-lockout as a heavier
> phase-2 option.
> **Implemented (code):**
> - `@hcaptcha/react-hcaptcha` added to root + `apps/admin`.
> - Widget wired into `src/components/auth/auth-screen.tsx` (sign-in **and** password-reset,
>   both hit Supabase directly) and `apps/admin/src/pages/SignIn.tsx` (sign-in; admin
>   password-reset already has `slowapi` limits via admin-api). Token passed as
>   `options.captchaToken`; single-use tokens reset after each attempt. Gated on
>   `VITE_HCAPTCHA_SITE_KEY` so local dev without the key still works.
> - **Invisible mode** (user pref): `size="invisible"`, no visible box. `getCaptchaToken()`
>   calls `captchaRef.execute({ async: true })` at submit time and passes the token straight
>   to Supabase; challenge only pops for suspicious traffic. Buttons no longer gate on a
>   pre-solve. hCaptcha widgets render in an iframe so their internals can't be restyled —
>   invisible was the cleanest way to keep the form's design intact.
> - **Keys wired for the whole build chain:** `VITE_HCAPTCHA_SITE_KEY` is a build-time var
>   — added as a build arg in `docker-compose.yml` (frontend + admin) and `ARG`/`ENV` in
>   `src/Dockerfile` + `apps/admin/Dockerfile`, else it never reaches the bundle. Documented
>   in `.env.production.example` too.
> - **Enabled in prod Supabase (2026-08-05):** user turned on Attack Protection → hCaptcha
>   with the real secret. Real site key is `c6d861a0-a358-41da-8412-3a1cb2fc74be` (public);
>   it's set in the local root `.env` for testing. ⚠️ Because the Supabase project is SHARED,
>   enabling it means the LIVE prod frontend (which has no widget yet) now fails logins until
>   the new frontend is deployed — deploy or temporarily disable CAPTCHA is required.
> - **Verified working (2026-08-05):** local invisible flow confirmed — hCaptcha dashboard
>   showed ~12 "Passive" verifications; a wrong-password attempt returned "invalid
>   credentials" (not a captcha error), proving the token is issued + verified end-to-end.
> - **Tier decision — STAY ON BASIC (free).** hCaptcha Passive Mode (99.9% silent) is a Pro
>   feature ($99–139/mo); Basic is free/unlimited/GDPR-compliant but shows a visible image
>   challenge on submit. For a low-volume B2B login (public signup disabled, staff provision
>   logins), that friction is fine and security is identical. The Pro trial auto-drops to
>   Basic on 2026-08-19 with no charge/card — just don't subscribe. No code change: invisible
>   mode degrades gracefully (silent on Pro, challenge-on-click on Basic). Revisit Pro only if
>   high-volume public forms are added or the login friction bothers customers.
> - **Single hCaptcha site, multiple hostnames** (NOT separate admin/landing sites): both apps
>   auth against the SAME Supabase project, which holds ONE captcha secret, and a sitekey/secret
>   must be a matching pair — so two sites is impossible here. The one site's Hostnames must list
>   `hakkiu.com`, `admin.hakkiu.com`, `localhost`.
> - CSP updated in all 4 places to allow `hcaptcha.com`/`*.hcaptcha.com` (script/style/
>   connect/frame): root `Caddyfile`, `public/_headers`, `apps/admin/nginx.conf`,
>   `apps/admin/public/_headers`.
> - `.env.example`: documented `VITE_HCAPTCHA_SITE_KEY`.
> **Manual step still required (blocks it working in prod):** create a free hCaptcha app at
> dashboard.hcaptcha.com, put the **site key** in `.env` (`VITE_HCAPTCHA_SITE_KEY=`) and the
> **secret key** into Supabase → Authentication → Attack Protection → Enable CAPTCHA
> (hCaptcha). Without the Supabase side enabled, tokens are sent but never verified.
> **Parked (phase 2, optional):** thin admin login-proxy (browser → admin-api → Supabase) to
> host real account-lockout + per-IP `slowapi` on password attempts; Caddy `rate_limit` plugin.

> **Session 48 (2026-08-03) — Notification Log P0: completeness + cleanup.**
> The Admin Portal Notification Log (`admin.hakkiu.com/monitoring/notifications`) was flooded with
> junk: paired empty "Sent" + "Skipped (could not resolve org from case test-case-123)" rows, no real
> emails visible. 4 Explore agents audited the backend, dispatch logic, frontend, and the full email
> inventory. **Root cause = a double-logging bug:** `routes/monitoring.py` called `log_delivery(ok=True)`
> a SECOND time right after `dispatch_notifications()` (which already logs its own sent/failed/skipped
> row on every path) — so every escalate/dismiss wrote a phantom "sent" row (no recipient/subject/org)
> on top of the honest one. Combined with `test-case-123` test residue, the log was unusable. Also
> found: the page claimed "every dispatch attempt (email / webhook)" but **6 of 13 email types bypassed
> the log entirely** (lead alerts, lead confirmations, demo confirmations, support requests, admin
> password resets, customer test emails), and there are no webhooks.
> **Fixes (P0 — completeness + cleanup):**
> - Removed the redundant `log_delivery` in `monitoring.py` escalate/dismiss (dispatch already logs).
> - Wired `log_delivery` into the 6 previously-invisible emails: `new_lead`, `lead_confirmation`
>   (`routes/leads.py`), `demo_confirmed` (admin path `routes/internal.py` + Slack path
>   `routes/slack_interactions.py`), `support_contact` (`routes/support.py`), `password_reset`
>   (`routes/internal.py` — **without** `body_html`, since it embeds a live reset link), `test`
>   (`routes/monitoring.py`). All best-effort so logging never breaks a send.
> - Frontend `NotificationLog.tsx`: added the 6 new event types to the filter + labels; fixed the
>   misleading "email / webhook" subtitle to "email".
> - Cleanup migration `20260803000001_notification_deliveries_cleanup.sql`: deletes the `test-case-123`
>   residue and the phantom "sent" case_escalated/case_dismissed duplicates (uniquely identified by
>   null recipient+subject). **Needs `supabase db push` to apply to prod.**
> **P1 (same session) — "who received what" redesign.** User feedback: the log showed opaque IDs and
> skipped noise, no email body, no sense of WHO got the email. Redesigned it into a real email log:
> - Backend `notification_log.py`: enrich each row with **brand_name** (case → brand_name, fallback
>   `payload.brand_name`) and **recipient_name** (matched by email: `sales_leads` first/last name for
>   demo/lead emails, `auth.users` → `profiles.full_name` for customer users, static role labels like
>   "HAKKIU sales team" for staff/platform emails). New `hide_skipped` query param.
> - Frontend `NotificationLog.tsx`: columns now **Customer** (org name, linked to org detail) · **Brand**
>   (linked to the case) · **Recipient** (name + email) · Event · Subject · Status, with an inline error
>   line on failed rows. Default view "Sent & failed" hides the intentional skipped rows; a view switcher
>   exposes Delivered / Failed / Skipped / Everything. Honest new subtitle.
> - **Delete (single + bulk):** new `notification_log.delete` permission (mirrored in permissions.py +
>   permissions.ts, granted to `admin` + super-admin). Single: `DELETE /notification-log/{id}` +
>   trash-icon Actions column. Bulk: `POST /notification-log/bulk-delete` (`{ids}`, capped 500/req, one
>   summary audit row) + a checkbox column (select-all/indeterminate) and a sticky "Delete selected" bar,
>   following the Cases.tsx bulk pattern. Both hard-delete, audit (compact metadata, no body_html), and
>   confirm first; deleting only removes the record — it never unsends/resends.
> - Verified: admin-api `py_compile` OK, admin FE `npm run typecheck` clean. Needs admin-api + main-API
>   uvicorn restart to take effect.
> **Deferred (P2):** free-text search (recipient/org/case), date-range filter, Retry/Resend for failed
> sends via a main-API `/internal/*` endpoint, and caching the `list_users` call. See todo.md.

> **Session 47 (2026-08-02) — Groups Feature V1 (Organizations, Roles & Hakkiu Staff Org).**
> Built customer "Groups" by promoting `organizations` / `organization_members` tables into a proper
> multi-tenant workspace model.
> - **Roles:** `owner` (read/write access to brands, settings, monitoring) & `member` (read-only access). Removed legacy `admin` org role (migrated to `owner`).
> - **Hakkiu Staff Org:** Nil UUID `00000000-0000-0000-0000-000000000000` created for Hakkiu staff, completely isolating staff profiles from customer companies. Hakkiu staff org is excluded from customer listings in admin portal.
> - **Fallback & RPCs:** Added `home_organization_id` on `profiles` (protected by trigger). Added transactional RPCs `assign_user_to_group` and `remove_user_from_group` for group assignment & fallback to original personal org.
> - **Database Migration & RLS:** Migration `20260802000001_groups_v1.sql` (schema, backfill, RPCs, trigger updates, dropped `profiles.is_admin`) & `20260802000002_rls_membership_gate.sql` (RLS membership/owner gates).
> - **API & UI Wiring:** Main API dependencies updated (`CurrentProfile.org_role` + `require_owner` dependency on all write endpoints; notification fallbacks updated to query `organization_members` role owner). Admin API & UI updated (`CustomerEditDialog`, `CustomerDetail`, `OrganizationDetail` updated with group & role assignment). Customer app UI updated (read-only state for `member` role).
> flow so a demo can be CONFIRMED from Slack — see the customer's requested times, pick one, paste a
> Google Meet link, confirm — exactly like the admin portal does. 2 Explore agents mapped the full
> admin demo-confirm flow (`sales_leads` table: `proposed_slots`/`scheduled_at`/`meeting_link`/
> `confirmed_at`/`status`; admin-api `POST /leads/{id}/confirm` → update row + `main_api.send_demo_confirmation`
> email + `write_audit_log`, gated by `leads.confirm`) and the existing Slack code. Key facts that
> shaped the design: Slack FREE tier = no Workflow Builder + 90-day history + 10-app cap, so the OWN
> backend is the automation engine and Slack is just the delivery/interaction surface; `admin_audit_log.staff_id`
> is NULLABLE (FK ON DELETE SET NULL) so a Slack action can be audited without a staff session.
> **Design (all in MAIN api — it's reliably public, already writes `sales_leads`, owns the Resend email,
> and can reach `admin_audit_log`):** demo notification gets a "✅ Confirm demo" button (lead_id + raw
> slots in its value) → click = `block_actions` → `views.open` a modal (radio of slots in OUR tz + a
> meeting-link input; needs a BOT TOKEN) → submit = `view_submission` → BackgroundTask confirms
> (update `sales_leads` confirmed_at/meeting_link/scheduled_at/status=contacted → SAME "demo confirmed"
> Resend email → `admin_audit_log` insert with `staff_email=slack:<user>`) → rewrite the source message
> to "✅ Confirmed" via `response_url`. Auth = Slack request SIGNATURE (`SLACK_SIGNING_SECRET`, v0 HMAC,
> 5-min replay window); the Slack workspace is the trust boundary (staff-only), mirroring `leads.confirm`.
> Parity rule satisfied: writes the SAME table the admin UI writes (reflects on both sides) + audits.
> Built: `services/slack.py` (+`verify_slack_signature`/`slack_api`/`respond_via_response_url`);
> `routes/slack_interactions.py` (`POST /api/v1/slack/interactions`); `leads.py` (capture lead id + attach
> button, gated on both env vars so it's dormant/omitted when unconfigured); `main.py` router; env docs.
> Verified import + signature smoke test + modal builder + route registration. **Dormant until the user
> sets `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` and points the app's Interactivity Request URL at
> `/api/v1/slack/interactions`.** Broader context: this was step 1 of a Slack free-tier ideation — other
> high-ROI ideas parked in todo/roadmap (tee existing detection/takedown events to Slack, reliability
> alerts, daily digest, more slash commands).

> **Session 45 (2026-07-30) — Slack lead notifications (two channels).** User: post a Slack
> notification for every new lead, into TWO SEPARATE channels — demo bookings vs call/sales requests.
> 2 Explore agents mapped the lead flow + config/HTTP conventions. Findings: leads land in
> `routes/leads.py::create_lead` → `sales_leads` insert → `_send_lead_notification` (Resend, best-effort
> try/except) → `_send_lead_confirmation`; `source ∈ {request_demo, call_request, pricing_modal}`; config
> is plain `os.environ.get` (no Settings class); outbound HTTP uses `httpx.post` with a timeout; no prior
> Slack code. Built: `services/slack.py` (`post_to_slack(webhook_env_var, text, blocks)` — httpx 10s,
> best-effort, never raises, no-op if env unset); `leads.py` `_SOURCE_SLACK_WEBHOOK` routing map
> (request_demo→SLACK_WEBHOOK_DEMO, call_request+pricing_modal→SLACK_WEBHOOK_CALL) + `_send_slack_notification`
> called after the staff email; Block Kit message mirrors ONLY submitted fields (honesty pass). Env docs in
> `.env.example` + `.env.production.example`. Verified py_compile + import + a routing/no-op unit check.
> **Feature is a safe no-op until webhooks are configured.** NEXT (USER): create 2 incoming webhooks at
> api.slack.com/apps (one per channel), give me the URLs → I set them in root `.env`, you set them on the
> Hetzner `.env` + restart the main API. Then commit+push (auto-deploys).

> **Session 44 part 3 (2026-07-30) — Show the actual email body.** User wanted to see the real email,
> not the JSON. Migration `20260730000005` adds `body_html TEXT` (applied to prod). Capture point:
> `send_email_notification()` now returns its rendered html; `dispatch_notifications._sent` + welcome +
> weekly_digest + takedown_submitted persist it via `log_delivery(body_html=...)`. Admin expandable row
> renders it in a `<iframe sandbox="" srcDoc={html}>` (no scripts / isolated styles) as the primary view;
> JSON payload demoted to a collapsible toggle; placeholder for skipped/historical rows. Deployed
> `ac2bc8c`. Verified py/tsc/build. NEXT: after deploy, generate a real email (add a brand → welcome, or
> a HIGH-risk detection) to see a fully-rendered row. Then Goal 2 landing PSI (needs GOOGLE_API_KEY).

> **Session 44 part 2 (2026-07-30) — Notification Log → FULL email log.** User asked to enrich the
> new log so it shows recipient + subject + org per email. Flow: 2 Explore agents mapped the send path +
> all 12 `log_delivery` call sites; a Plan critic caught the key error (customer alerts send via DIRECT
> `send_email()` inside `dispatch_notifications()`, NOT via `send_email_notification()` — so that's the
> logging choke point). User decisions: full coverage (incl. welcome + weekly_digest, previously
> unlogged); skips logged as `status='skipped'` with reason; migration applied by me.
> Built: migration `20260730000004` (add organization_id/recipient/subject nullable + backfill via
> infringement/payload→case→org + index + RLS direct-org branch); `log_delivery()` gains those params +
> status override; `dispatch_notifications()` logs at every exit (sent/failed/skipped); removed redundant
> success logs at 3 call sites (kept exception net); takedown_submitted logs recipient; welcome +
> weekly_digest instrumented; admin reads columns w/ legacy fallback + Subject column.
> Migration blocker resolved: the demo-scheduling branch's `...002/...003` migrations were applied to
> prod but not on main → `db push` refused. Fixed by committing those 2 .sql files to main (reconcile
> history), renaming mine to `...004`. **Migration applied to prod via `supabase db push`; code deployed
> `23d338b` (auto-deploy).** Verified py/tsc/build. NEXT: after deploy, reload Notification Log → confirm
> recipient/subject/org populate on new sends. Then Goal 2 landing PSI (needs GOOGLE_API_KEY).

> **Session 44 part 1 (2026-07-30) — Admin Notification Log + landing deploy/PSI prep.** Two goals.
> **Goal 1 (DONE, code):** the Priority-3 "admin email-logs" item. Investigated via 2 Explore agents +
> a Plan critic that surfaced the key gotcha: `notification_deliveries` has NO organization_id and NO
> recipient/subject columns — org lives one/two FK hops away (infringement_id→case→org, or payload.case_id),
> recipient only in some payloads. Decisions (asked user): (a) name it "Notification Log", not "Email Logs"
> (honest — no recipient/subject); (b) resolve org via read-only lookups, NO migration, NO touching the hot
> write path in delivery_log.py; NULL-org rows show "System". Built: `apps/admin-api/routes/notification_log.py`
> (`GET /api/v1/notification-log`, `require_permission("notification_log.view")`, 3 batched flat lookups
> infringements→cases→organizations — deliberately NOT a 2-hop PostgREST embed, which the critic flagged as
> unproven here); `notification_log.view` added to permissions.py + permissions.ts + dev preset (admin
> auto-includes); `apps/admin/pages/NotificationLog.tsx` (Monitoring nav, status/event filters, offset
> paging, expandable payload). Verified: admin-api imports OK, admin tsc 0, admin build OK.
> **Goal 2 (BLOCKED on user — no creds in this env):** deploy the already-committed session-41 image/font/
> JS-split perf work + re-measure PSI. Deploy is manual SSH to Hetzner; PSI needs a key. User will (a) run
> the deploy manually with `--build`, (b) add `GOOGLE_API_KEY` to `.env` so I can query PSI v5. Deploy cmd:
> `cd /opt/hakkiu && git reset --hard origin/main && docker compose up -d --build && docker compose restart caddy && docker image prune -f`
> NEXT: after user deploys + adds the key, run a PSI check on hakkiu.com (mobile) vs baseline 71/FCP 4.2s/LCP 4.7s.
> Then commit+push session-44 (auto-deploys once live), restart admin-api uvicorn, click-test the page.

> **Session 44b (2026-07-30) — Multi-slot upgrade + stale-server fix.** Two follow-ups after the
> initial single-slot build: (1) the customer-reported 422 "Field required (tier)" was a STALE main-API
> process from before session 43 — fixed by restarting uvicorn (CLAUDE.md: always restart after main-API
> edits). (2) Per user request, the scheduler is now **multi-select**: the visitor picks EVERY time
> they're free (removable chips), and staff pick the ONE that suits us in the admin Confirm panel (radio
> list → sets `scheduled_at`). New column `proposed_slots jsonb` (migration `20260730000003`, APPLIED to
> prod). Emails now list all offered times; the "confirmed" email still sends the single chosen slot.
> Frontend `DemoSlot`→`DemoAvailability` (`slots: string[]`); POST sends `proposed_slots` (not
> `scheduled_at`). Admin `DemoScheduling` shows the offered list as pick-one radios. Migrations
> `20260730000002` + `20260730000003` both APPLIED to prod.

> **Session 44 (2026-07-30) — Demo scheduling (Calendly-style booking) — IN PROGRESS.**
> Goal: after the Book-a-demo form, insert a "Select a Date & Time" step (like Calendly). Visitor
> picks a day + 30-min time slot (any time — it is a *request*, no calendar sync, no slot locking),
> then the SAME animated "Thank you" modal appears. Staff manage it in the Admin Portal: they see the
> requested slot, and **Confirm** it (entering a video meeting link) which emails the customer.
> Decisions (confirmed with user): availability = free request; multiple bookings per slot allowed;
> meeting = video, link pasted by admin at confirm; emails = 2 to customer ("received" on submit +
> "confirmed" on admin action) + existing staff alert.
> Data: migration `20260730000002` adds `scheduled_at timestamptz`, `scheduled_timezone text`,
> `meeting_link text`, `confirmed_at timestamptz` to `sales_leads` (booking state derived:
> scheduled_at set + confirmed_at null = "requested"; confirmed_at set = "confirmed").
> Flow: customer FE `book-demo-modal.tsx` gains a `step: "form" | "schedule"` gate; new
> `demo-scheduler.tsx` (reuses `ui/calendar` = react-day-picker) collects the slot; POST `/api/v1/leads`
> now carries `scheduled_at` + `scheduled_timezone`. Main API sends a "received" confirmation showing the
> requested time. New `POST /internal/leads/send-demo-confirmation` sends the "confirmed" email
> (time + Meet link). Admin: new `leads.confirm` permission (both catalogs), `POST /leads/{id}/confirm`
> in admin-api (updates row → calls main_api → audit log), Confirm UI in `Leads.tsx` detail row.
> Files: NEW `src/components/landing/demo-scheduler.tsx`, `supabase/migrations/20260730000002_*`;
> EDIT `book-demo-modal.tsx`, `lead-modal-shell.tsx`, `apps/api/.../routes/{leads,internal}.py`,
> `apps/api/.../services/email_templates.py`, `apps/admin-api/.../routes/leads.py`,
> `apps/admin-api/.../{permissions.py,main_api.py}`, `apps/admin/src/{lib/permissions.ts,pages/Leads.tsx}`.

> **Session 43 (2026-07-30) — Lead-form honesty pass.** Goal: email + admin portal must show ONLY
> what a visitor actually fills in the Book-a-demo / Talk-to-sales forms — no invented values.
> 3 subagents traced the full chain (form → `POST /api/v1/leads` → `sales_leads` → staff email + admin).
> Findings & fixes:
> - **Fake `tier`** (the reported bug): both modals hardcoded `tier: "professional"` / `"enterprise"`
>   though HAKKIU has no tiers. It surfaced in the staff email (subject fallback + "Tier" row +
>   preheader) and the admin Leads table (column, badge, tier filter). Removed end-to-end — origin is
>   already carried by `source` (`request_demo` / `call_request`). Migration `20260730000001` relaxes the
>   `tier` NOT NULL + CHECK so inserts can omit it (**pending `supabase db push` — REQUIRED**).
> - **5 dead qualification fields** (`role`, `regions`, `brand_names`, `marketplaces`,
>   `current_solution`) from the retired `/request-demo` wizard showed as permanent "—" rows in the admin
>   detail view. No live form sends them → removed from the admin display + `Lead` interface. Kept as
>   inert optional backend fields (email already hides them when empty) in case the wizard returns.
> - Left alone: `interest` folded into `message` on Talk-to-sales (honest — it's the user's real choice);
>   legacy `pricing_modal` source enum (no form emits it, harmless).
> Files: `src/components/landing/{book-demo,talk-to-sales}-modal.tsx`,
> `apps/api/.../routes/leads.py`, `apps/api/.../services/email_templates.py`,
> `apps/admin-api/.../routes/leads.py`, `apps/admin/src/pages/Leads.tsx`, migration `20260730000001`.

> **Session 42 (2026-07-30) — TODO/roadmap reconciliation audit.** Ran 4 subagents to check the
> tracking files against the ACTUAL code + git state (not just what the docs claimed). Findings:
> - Working tree is CLEAN; all recent work is committed+merged to `main` (session 40 status
>   workflow, session 38 SEO, session 41 `perf/landing-js-split` merged in `565aec2`). The old
>   "UNCOMMITTED" notes were stale — corrected.
> - Checked off items already done in code but left unticked: Gemini-Vision `generate_evidence_analysis`
>   IS wired into the pipeline (`persistence.py:214` → `ai.py`), Google Ads Transparency + Meta Ad
>   Library scrapers exist (`marketplace.py`), `scripts/backup.sh` exists, phishing groundwork
>   (`detection_funnel.py` lookalike/typosquat categorization). roadmap.md "Gemini Visual
>   Verification ❌ Missing" was WRONG → fixed to ✅ Done.
> - Confirmed genuinely NOT done (correctly still open): Automation Rules Builder, Multi-Model AI
>   Routing, Seller Network Clustering, Org Multi-Member Self-Serve, admin email-logs page,
>   onboarding nudge/dunning schedulers, scraper push alerting, blog guides, landing social-proof bar.
> - **Admin per-copycat DELETE — DONE (re-implemented fresh on `main`).** The customer app could
>   delete one copycat but admin-api could not (only PATCH). Rather than raw-merge the stale
>   `feature/admin-per-copycat-delete` branch (82 commits behind, conflicts), I re-applied the tiny
>   delta fresh on main: `DELETE /infringements/{id}` in `infringements_admin.py` (best-effort
>   screenshot cleanup + org-resolved `write_audit_log`), new `infringements.delete` destructive
>   permission in both `permissions.py` + `permissions.ts`, and a `<Can>`-gated trash button per
>   copycat row in admin `CaseDetail.tsx`. Verified: backend py_compile OK, admin tsc 0, admin build
>   OK. The stale branch was then deleted (local + remote; commit was `fbebbce`, recoverable via reflog).
> NEXT: commit + push (auto-deploys to Hetzner); after deploy, restart admin-api uvicorn (no --reload)
>   and click-test the delete button. Then session-41 work below — deploy + re-run PSI, decide on CSS.

> **Session 41 (2026-07-30) — Mobile perf: safe image optimization.** PSI on hakkiu.com:
> mobile Perf 71 (FCP 4.2s / LCP 4.7s), desktop 95. Diagnosed via subagents: render-blocking
> CSS (~27KiB gzip, 190ms), many self-hosted font files in the critical chain, and oversized
> logos. Did the ZERO-RISK, visually-identical wins only: `public/hakkiu-lockup.png` 1054×300
> 76KiB → 421×120 26KiB (−65%; it's an alpha mask shown ≤36px, so downscaling is invisible);
> all 12 `src/images/platforms/*.png` 256×256 → max 96px (−25%, shown ≤40px). No code changes
> (same filenames/format/imports). Build ✓, no visual change. Did NOT preload the lockup (it's
> the nav logo, not LCP — preloading would compete with critical CSS/fonts). DEFERRED the big
> lever — critical-CSS inlining / route CSS-split — because it risks FOUC and could change the
> look; agreed to measure image wins first. Originals backed up in /tmp/hakkiu-img-backup/.
> NEXT: deploy, re-run PSI, then decide on the CSS work.

> Update this file after every session or planning conversation.
> Keep it SHORT: what we are building right now, why, and how. History lives in git + `todo.md`.
> Last updated: 2026-07-30 (session 42 reconciliation audit — see top block. History below from
> session 40 — **Per-copycat status workflow FIXED** + **takedown page
> un-broken**. 1) Prod DB had the original 3-value `infringements_status_check` re-created by a
> schema sync, so the API silently remapped analyzing/complete/… → reviewed/dismissed while
> returning the requested status — the /cases list never reflected the user's choice. Fix:
> migration 20260729000001 (full workflow CHECK, PUSHED to prod) + honest PATCH endpoint +
> Jira-like inline status dropdown on every /cases row (`CaseStatus.tsx`) + admin `INFR_STATUS`
> parity. 2) `/cases/$id/takedown` showed "Case not found." for every real case — it read the
> legacy zustand mock store instead of the API; rewritten on `getInfringementById` with real
> evidence/letters, a webhook that actually POSTs, and `takedown_sent` persisted via the API.
> 3) Restored the platform reporting link on the takedown page (`platform-reporting.ts` mirrors
> the backend PLATFORM_REGISTRY; "Submit to the platform" card + Mark-as-Submitted) and fixed
> dashboard "Active infringements" to count every copycat not closed (safe/complete/rejected),
> live-feed status filter aligned to the canonical workflow. tsc 0 / build 0 / DB verified.
> **Uncommitted.** NEXT: restart main API, click-test, commit+push+deploy. Session-38 SEO
> batches remain uncommitted too.) Session 41 (2026-07-30) — built the **cross-scan scrape cache + detection dedup:**
> new `scrape_cache` table + `services/scrape_cache.py` (in-mem LRU → DB → live fetch, 24h TTL via
> `SCRAPE_CACHE_TTL_HOURS`, URL normalization so token rotation/param order don't split the cache);
> wired into `UnifiedScraper.scrape()` so EVERY per-platform scraper hits it; added `from_cache` flag
> on `UnifiedScrapeResult` + `put_cached` at the static & JS success paths (replaces the ephemeral
> `_js_cache`). `persistence.py`: `_find_open_infringement` skips re-adding a copycat URL that already
> has an OPEN infringement for the same org+brand until that case → Complete/Rejected; safe/dismissed
> block forever (matches the user's "safe = never scrape again" ask). Verified against prod:
> cache write/read round-trip + skip-query finds the live `analyzing` infringement `005b5eb0…`.
> ⚠️ Prod migration drift: remote has untracked `20260730000002..000005` (someone else's) and a
> collision on `20260730000001`; `db push` is blocked, so `scrape_cache` was created via `db query`
> and the file is renamed to idempotent `20260730000006_scrape_cache.sql` for when drift is
> reconciled. **Restart the main API** to load it; all uncommitted.

## 🔎 SEO — where we are (session 36 snapshot for post-compaction)
- **Done & live in prod:** Sprint 1 (schema foundation, canonicals, keyword title, self-hosted OG, removed fabricated stats), Sprint 2 (FAQ + FAQPage schema, question-format H3s, expanded copy, FAQ nav link, llms.txt v1.1), M1 (/about "The team" 5 members + real photos in `public/team/*.jpeg` + LinkedIn + foundingDate 2026 + Organization `employee` schema). AI Overview already cites HAKKIU.
- **Done this session (Batch 1, NOT yet committed/deployed):** og:url on all 11 public routes; WebPage JSON-LD with datePublished/dateModified on `/`; Organization logo→ImageObject(512×421); robots max-snippet meta + og:image:width/height(1920×1080) in __root; ContactPoint areaServed/availableLanguage; /about keyword title; dropped `Allow: /request-demo` from robots.txt (sitemap was already clean). Verified: tsc 0, 3 routes 200, SSR carries all tags, 4 JSON-LD blocks valid.
- **Health 58→~70** (pre-Batch-1). SEO/Best-Practices/A11y Lighthouse = 100/100/97; Perf=72 (LCP 4.4s is the one real CWV problem — fonts render-block + unused JS + Caddy asset caching).
- **Batch 2 DONE this session (uncommitted at time of writing):** B2-1 self-hosted fonts (14 woff2 in public/fonts/, latin+latin-ext, @font-face + preload, Google Fonts link removed — kills the ~820ms render-blocking request); B2-2 Caddy immutable caching for /assets/* + /fonts/* (Caddyfile is repo-mounted so it auto-deploys — not manual; validated); B2-3 lazy-loaded the 2 lead modals (own chunks now); B2-4 hero above-the-fold Reveals use a new `eager` pure-CSS entrance so the LCP H1 paints at first render instead of waiting for JS (likely the biggest LCP win). B2-5 a11y contrast deferred (need the exact Lighthouse node). All tsc 0 / build 0 / routes 200 / no warnings.
- **Batch 3 DONE this session (uncommitted):** FAQ expanded to 130–160-word answers + a 7th
  comparison Q (FAQPage schema now 7 Q); /about got 6 real `<h2>`s + a "How it works" section +
  expanded copy + internal links (text-ratio 6.1%→8.2%); product mock labelled "Example" + fake hash
  neutralised; calculator methodology note; llms.txt v1.2 with a Preferred-citation block. IMPORTANT:
  used the rewrite to CORRECT truthfulness overclaims (portal auto-dispatch / 1-click / Amazon Brand
  Registry / "cryptographic timestamps" / "0–100% threat score" / "court-ready" / features "Direct API
  removal") that the code does not support — kept everything defensible. tsc 0 / build 0 / routes 200.
- **Deferred:** B3-2 per-member roles+bios (need from Martynas); B3-8 HowTo schema (deprecated — skip);
  B2-5 one a11y contrast warning (need the exact Lighthouse node).
- **Next actions:** commit Batch 3, deploy, then **re-run PageSpeed** (LCP 4.4s→<2.5s, CLS still 0)
  **and a GEO/SEO audit** to confirm content gains. Batch 4 (off-site authority) is the remaining lever.
- **Blocked on Martynas:** real testimonial (H3); /about role titles+bios; exact Martynas LinkedIn URL (current has š/č, may be broken sameAs).


---

## 🔍 Active — SEO audit fix plan (session 33)

`/seo audit https://hakkiu.com/` scored the marketing site **58/100**. Strong foundation
(SSR works, robots.txt + security headers A+, llms.txt present, all images have alt) but
four Critical gaps. Full findings live in `todo.md` → "PRIORITY 13 — SEO audit fixes".

**Scope note (CLAUDE.md parity rule):** these are marketing-site / meta / static-content
changes only. They do NOT create, store, or change *customer* data, so **no Admin Portal
wiring is required** for any item here. Do not add admin-api routes for SEO meta/schema.

### Sprint 1 — code fixes, no external deps — ✅ DONE (session 33)
> Implemented: SocialProof section removed (social-proof.tsx + count-up.tsx deleted); JSON-LD via
> TanStack `script:ld+json` meta (Org+WebSite in __root, SoftwareApplication on /, AboutPage/
> ContactPage + BreadcrumbList on about/contact); canonicals on / + about + contact + 8 legal pages;
> keyword-first homepage title; OG image self-hosted at public/og-image.png. C3 dropped as obsolete
> (CountUp deleted with its only caller). Verified tsc --noEmit=0 + SSR HTML. Original items:

1. **C1 — fabricated social proof (integrity risk).** `src/components/landing/social-proof.tsx`
   ships a `// TODO: swap the metrics + quote for verified figures before launch` with 4 made-up
   numbers (1,842 / 99.4% / <4h / 12) + an anonymous "Head of Legal, Vilnius" quote, all LIVE.
   → Remove the unverified counts and anonymous quote (or replace with real, attributable ones).
   Blocks all other SEO work — E-E-A-T penalty + reputational risk while it's up.
2. **C2 — zero structured data.** Add JSON-LD via TanStack `head()` `scripts`:
   `__root.tsx` → Organization + WebSite (@graph, every page); `index.tsx` → SoftwareApplication
   (NO `offers`/price — pricing is contact-only per the book-a-demo pivot); `about.tsx` /
   `contact.tsx` / `request-demo.tsx` → BreadcrumbList + AboutPage/ContactPage/WebPage.
   ⚠️ Verify the `scripts` key actually renders inside `<head>` via `<HeadContent />`.
3. **C3 — CountUp renders "0" in SSR HTML.** `src/components/landing/count-up.tsx` inits
   `useState(0)` → crawlers without JS read "0". Init `value` to `to` and gate the animation
   behind a client-only `mounted` flag so SSR + first hydration show the final number.
4. **H1 — keyword-less title.** `index.tsx` title "…Protect your brand at internet speed"
   → "HAKKIU — Trademark Monitoring & Brand Protection Software" (also og:title/twitter:title).
5. **H2 — no canonical anywhere.** Add per-route `{ rel: "canonical", href }` to index/about/
   contact/request-demo/legal.* head().
6. **M4 — OG image on r2.dev UUID URL.** Serve from `hakkiu.com/og-image.png`; update `__root.tsx`.
   Verify: `tsc --noEmit` clean, dev 200, Google Rich Results Test passes, re-run `/seo schema`.

### Sprint 2 — content + on-page — ✅ MOSTLY DONE (session 34)
> Implemented: new always-visible FAQ section (faq.tsx, 6 truthful Q&A, `<h3>`+`<p>` so answers
> are in SSR HTML) + FAQPage JSON-LD from shared FAQ_ITEMS; question-format `<h3>` + expanded
> copy on Coverage/Workflow/Features; "FAQ" nav hash link (H5 middle-intent path); llms.txt v1.1
> (+/about,/contact,/legal/security + version header). Used FAQPage not QAPage (correct type for
> multi-Q&A; no Google rich result either way post-May-2026 — value is AI/Bing). tsc=0, routes 200,
> 4 valid JSON-LD types. BLOCKED on real facts: H3 (named testimonial), M1 (/about team+founding).
> Original items:
7. **H4** question-format H2/H3 in coverage/features/workflow ("How does AI detect counterfeits?").
8. **H6** expand each section intro to 80–120 words (currently hero ~28 words → not citable).
9. **M3** add a Q&A section marked up with **QAPage** (NOT FAQPage — Google retired FAQ rich
   results May 2026); 5–7 definitional/process questions.
10. **H3** replace testimonial with a named, attributed quote + metric (needs client approval).
11. **H5** add a middle-intent CTA (sample evidence packet / "how pricing works" anchor) —
    today every CTA forces a demo booking.
12. **M1** `/about` — add founding year + 1–2 named team members.
13. **M2** `public/llms.txt` — add `/about`, `/contact`, `/legal/security` + version/last-updated header.
14. **L1** ensure `public/sitemap.xml` `<lastmod>` is stamped at build.

### Sprint 3 — content program + external authority (weeks, higher effort)
15. **C4** 3 SERP-matching pages: comparison ("HAKKIU vs Red Points"), solution ("Trademark
    Monitoring for Law Firms"), guide ("How to detect counterfeits on Amazon"). The homepage
    can't rank for buyer queries — those SERPs reward comparison/solution page types.
16. **M5** establish G2 / Capterra / YouTube / LinkedIn footprint (strongest AI-citation signals).
17. Wikipedia notability groundwork (press, Crunchbase) — long tail.

**Leading indicator (don't re-audit to check):** GSC non-branded impressions + Rich Results
Test status after schema deploy. If non-branded impressions stay flat 4 weeks post Sprint 3,
the new pages still don't match SERP page-type — revisit content format.

**Not measurable this session:** Core Web Vitals (needs `GOOGLE_API_KEY` for PSI/CrUX);
backlinks limited to Common Crawl tier (add Moz/Bing keys for DA/PA).

---

## 🎨 Previous — Brands-count field + landing at root (session 31)

Two changes to the public site (customer app):
- **Brands-count field** — added a required "How many brands do you protect?" Select
  to BOTH lead modals (`book-demo-modal.tsx`, `talk-to-sales-modal.tsx`). It posts the
  existing `brand_count_range` field (values `1 / 2-3 / 4-5 / 6-10 / 11-20 / 20+`, matching
  the `sales_leads` CHECK constraint). No DB/API/admin/email work was needed — that pipeline
  already existed end-to-end (`LeadRequest` model, `sales_leads` column, `new_lead_html`
  "Brands (count)" row, Admin Portal Leads "Brands" column). The forms simply weren't sending it.
- **Landing at site root** — the marketing page now lives at `/` instead of `/landing`.
  `src/routes/index.tsx` IS the landing page; `src/routes/landing.tsx` is a permanent redirect
  to `/` that preserves `?book=demo|sales` deep links. Updated all 13 internal links (nav, footer,
  sidebar, legal, auth), both programmatic redirects (`request-demo`, `auth.sign-up`), the
  confirmation-email CTA, the Docker healthcheck, and SEO files (sitemap/robots/llms). Verified:
  `tsc` clean, `vite build` OK, `/` → 200, `/landing` → 307 to `/`, both modals show the new field.

---

## 🎨 Landing + info-page polish (session 28)

Frontend pass on the public site (customer app), planned via subagent audits:
- **Landing background** — one page-wide animated grid (`InfiniteGridBackdrop fixed`, `src/components/ui/the-infinite-grid.tsx`) mounted once in `landing.tsx`; `.technical-paper` sections made transparent (dark sections at 85%) so it reads as ONE continuous field. Old dot-matrix + blueprint construction lines removed.
- **CTAs** — all "Book a demo" buttons now use a rainbow gradient button (`src/components/ui/rainbow-button.tsx`, magicui/21st) across nav, hero, workflow, final-cta, footer. Tailwind v4 animation wired in `styles.css` (`--animate-rainbow` + `@keyframes`).
- **Coverage** — static icon grid → real platform logos in a scrolling **Marquee** (`src/components/ui/marquee.tsx`, magicui/21st); `--animate-marquee` in `styles.css`.
- **Product proof** — duplicate detect→verify→enforce card grid → one compact process ribbon (distinct from the Workflow steps).
- **Legal pages** — `legal-layout.tsx` upgraded: auto TOC sidebar + scrollspy, responsive/zebra tables, stronger heading hierarchy, `<code>` styling, "last updated" badge, back-to-top. Lifts all 10 legal pages.
- **About + Contact** — moved off the legal template to full marketing pages (LandingNav + grid + Card grids + RainbowButton + Reveal).
- **Nav** — reordered links + theme toggle; "Talk to sales" → outline.
- **Coverage** — converted from a dark section to light like the rest; marquee edges now use a CSS mask (fade to transparent) so there's no visible start/end seam.
- **Friendly errors** — no raw technical text shown to users anymore: `error-state.tsx` (the "Signal lost" boundary) uses friendly bucket copy instead of `error.message`; lead modals map network failures to "Connection lost…"; all app-route `toast.error` calls dropped raw `err.message` titles/descriptions for short friendly lines.
- 21st MCP added but its tools load only at next session start — used 21st components via the magicui/21st registry (web) this session.

**Remaining (needs product decision):** deeper landing de-dup (Workflow vs Features overlap), mobile version of the Features quadrant diagram, Final-CTA orphaned-logo column. Re-run with 21st MCP live next session for richer component swaps.

---

## 🎨 Landing page "technical-paper" redesign (session 27)

Rebuilt the marketing landing (`/landing`) to the reference mockups (`~/Desktop/redisign`):
an off-white technical-paper surface (24px dot matrix + sparse blueprint construction lines),
graphite type, black conversion actions, mint (`#18c889`) system accents, and two inverse dark
sections (Coverage, Final CTA). Section order: Hero → Product proof → Coverage (dark) → How it
works → Platform architecture → Risk calculator → Final CTA (dark) → Footer.

**Preserved 100% (no logic touched):** `LeadModalsProvider` / `useLeadModals()`, both modals'
submit → `/leads` fetch + payload + validation + `trackLead` GA4 + success swap, all real
links (legal, /about, /contact, /dashboard, /auth), theme toggle, cookie consent. Motion is
CSS + IntersectionObserver only (shared `reveal.tsx`), respects `prefers-reduced-motion`; the
dot grid is never animated. New shared primitives: `reveal.tsx`, `blueprint.tsx`,
`product-window.tsx`. New sections: `product-proof.tsx`, `final-cta.tsx`. Validated: `tsc
--noEmit`, ESLint (landing files clean), and `vite build` all pass.

---

## Where the project stands today

- **Live in production** on Hetzner CCX13 (116.202.8.87), all 5 hostnames on HTTPS via Caddy +
  Let's Encrypt. Deploys are manual (`git pull && docker compose up -d --build`) until the
  `SSH_*` GitHub Actions secrets are added by repo-admin.
- **Book-a-demo business model** — no pricing/Stripe/plan-gating anywhere. Public site shows
  "Book a demo" / "Contact sales" → leads land in `sales_leads` + email staff via Resend.
  After a demo, **staff create customer logins from the Admin Portal**. Access = having a login.
- **Admin Portal** can now onboard a customer end-to-end: create company + owner + extra users
  (`POST /organizations`, session 18), on top of the existing full customer/case/brand control.
- **Core product is complete** — 12-platform scraping, Gemini Vision scoring, takedown docs +
  delivery, geo/region scanning, WHOIS domain tracking, law-firm multi-client mode, per-copycat
  cases in the customer UI, Resend transactional + digest emails, scraper-health dashboard.

See `todo.md` for the exact open-item checklist and `docs/.roadmap/roadmap.md` for the
feature-by-feature status.

---

## 🔴 Current focus — Automation Rules Builder (PRIORITY 2)

The next major feature. Let customers define if/then rules so detected infringements are
handled automatically, without manual review per case (Red Points sells this as "Unlimited
Automation Rules" — our biggest competitive gap at SMB price points).

**Why this next:** it closes the detection loop. Infringements are already persisted; rules are
the layer that acts on them. Pure business logic on existing data — no new scraping work.

**Approach:**
1. **DB migration** — `automation_rules` table: `id`, `org_id`, `name`, `enabled`,
   `conditions` (jsonb: platform, confidence_threshold, risk_level, keyword_match),
   `actions` (jsonb: auto_takedown | escalate | notify | dismiss), `created_at`.
2. **`services/rules_engine.py`** — loads enabled rules for the org, evaluates conditions
   against a new infringement, executes matching actions. Called from `persist_infringement()`.
3. **`routes/rules.py`** — GET / POST / PUT / DELETE `/api/v1/rules`, org-scoped. Unit tests.
4. **Customer FE** — `/settings/automation`: rules list + enable/disable toggles, creation
   dialog (condition selectors + action picker), activity log (which rule fired on which case).
5. **Admin parity (mandatory per CLAUDE.md)** — rules CRUD across all orgs in `apps/admin-api`;
   `rules.view` / `rules.edit` in `permissions.py` + `permissions.ts`; surface under Company
   detail in `apps/admin`, gated with `<Can>`.

---

## Loose follow-ups before/alongside the next feature

- **Legal/company pages (session 21)** — built 10 footer pages (About, Contact + 8 legal:
  Privacy/Terms/Cookies/AUP/DPA/Sub-processors/Security/Imprint), new footer with LinkedIn, wired
  to sitemap/robots. Remaining USER ACTIONS: fill real company facts in `src/lib/company.ts`
  (entity name, reg code, address, VAT), create `privacy@`/`legal@`/`security@`/`support@` aliases,
  lawyer review, and **build a GA4 cookie-consent banner** (Consent Mode v2) — the one real
  compliance gap left.

- **Supabase Auth → disable public sign-ups** — code+config done (session 20): `auth-screen.tsx`
  is sign-in only, `config.toml` `enable_signup=false`. ⚠️ **Still needs the prod Dashboard toggle**
  (Auth → Sign In / Up) to block direct anon-key `/auth/v1/signup` — no access token here to do it
  via API. Drop-billing migration `20260728000001_drop_billing_tables.sql` **applied to prod**
  (session 20) — subscriptions/invoices/stripe_events/entitlement tables removed.
- **Supabase Auth URLs** — Site URL + redirect URLs for `hakkiu.com` / `admin.hakkiu.com`,
  enable Confirm email.
- **Resend USER ACTIONS** — verify `hakkiu.com` domain (SPF/DKIM), set the real `RESEND_API_KEY`,
  wire Supabase Auth SMTP relay to Resend.
- **CI auto-deploy** — repo-admin (SuperGabSq) must add `SSH_HOST/USER/PORT/KEY` Actions secrets.
- ✅ (session 19) Closed the session-18 admin-onboarding follow-ups: "Add existing" is now a
  debounced user search-select (was raw UUID); staff tables verified applied to prod via
  `supabase migration list`; legacy reset/CORS/email stragglers aligned to the canonical
  `hakkiu.com` (user-confirmed).

---

## Next major features after Automation Rules (priority order)

1. **Phishing site detection + domain takedown** (§7) — newly-registered lookalike domain
   detection + MX check + automated registrar abuse reports. Opens a new buyer segment.
2. **Seller/actor network clustering** (§9) — link cases with the same seller + similar pHash
   across platforms; single cross-platform takedown. Biggest long-term moat.
3. **Multi-model AI routing** (§8) — abstract Gemini behind an `LLMClient` interface with
   failover. Deprioritized until volume justifies it.
4. **Rogue app + paid-ad abuse monitoring** (§10), **advanced CLIP/logo similarity** (§14),
   **customer-side org multi-member self-serve** (§11).

---

## Architecture notes (stable)

- One shared `.env` at the repo root — no per-app env files.
- The Admin Portal reads/writes the SAME Supabase tables as the customer app (parity, not a copy).
- Cross-app operations (SMTP sends, entitlements-era internals, metrics) go through main-API
  `/internal/*` endpoints (shared `INTERNAL_API_SECRET`), never duplicated in admin-api.
- Supabase migrations live in `supabase/migrations/` — apply with `supabase db push` (the CLI is
  linked to the real HAKKIU project; the MCP points at a DIFFERENT DB — do HAKKIU DB work via CLI).
- Every admin mutation calls `write_audit_log`.
- Customer frontend builds for the Cloudflare Workers runtime; self-hosted under `workerd` via
  `wrangler dev --local` (glibc Docker base — musl/alpine can't run the workerd binary).

---

## Competitive context (brief)

Market is bifurcated: enterprise-only ($25K–$100K+/yr, sales-led: Red Points, Corsearch,
MarqVision, BrandShield) vs. nascent self-serve AI players (Podqi, Bolster, Doppel). HAKKIU's
position = multi-channel brand protection for SMB + growth-stage brands via a demo-led sales
motion. Watch: **Podqi** (most direct, automation-first), **Doppel** ($600M val, moving fast),
**Sentryc** (reportedly distressed → potential EU customer acquisition opportunity).
