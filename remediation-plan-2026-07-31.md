# HAKKIU — Security Remediation Plan (2026-07-31)

Companion to `security-audit-2026-07-31.md`. Architecture-verified: each fix below was
checked against real code + data model so it does not break existing behavior.

## ✅ IMPLEMENTATION STATUS (updated 2026-07-31)

**Done in code/migrations (all backend tests green — 224 passed):**
- Phase 1: deleted `dist/server/.dev.vars` (+dup), `git rm query_case_details.py`, deleted mock
  `check_brand.py` + FE `checkBrand` fn, deleted `.env.production 2.example`, added missing vars to
  `.env.example`, removed admin `X-XSS-Protection`.
- Phase 2: H1 `safe_get` (SSRF per-hop revalidation) in ssrf.py + applied at unified_scraper ×2 +
  marketplace; H2 test-email locked to caller; H3 `/screenshots/sign` org-scoped; H5 audit
  logging+`critical` fail-closed on ALL 6 sensitive paths (impersonate, customers.delete, staff
  create/update/delete, set_permissions — delete paths reordered audit-first); M1 staff.manage create-gate;
  M2 internal-IP narrowed to pinned bridge subnet; M4 CORS prod/dev split; M17 `_js_cache` LRU+lock;
  L3 delete_client org filter; (M3 partial — test-email).
- Phase 3 (migration FILES written, NOT pushed): `20260731000001` audit append-only (H4),
  `..02` org_settings role-gate (H6), `..03` FORCE RLS (M5), `..04` handle_new_user search_path (M6),
  `..05` notification_deliveries FOR SELECT (M7), `..06` WITH CHECK profiles/clients (L7).
- Phase 4: admin CSP tightened (H9-admin + M13); Caddy blocks public `/internal/*` + CSP/frame on
  api & admin-api (M2-edge + M12); H8 compose ipam subnet + Dockerfile `--forwarded-allow-ips` CIDR;
  H7 legal-doc private signing (main-api storage+persistence+documents+internal AND admin-api cases — parity).
- Phase 5: `tests/test_ssrf.py` (21), `apps/admin-api/tests/test_permissions.py` (9) + conftest.

**⏳ OPERATOR must still do (Phase 0 — the only LIVE-exploitable items):**
1. **Rotate** the secrets that were in `dist/server/.dev.vars` (service-role, INTERNAL_API_SECRET,
   Resend, Meta, Stripe, Slack) + redeploy.
2. **Verify RLS** on prod and `supabase db push` (applies `20260728000003` + the 6 new migrations).
3. Confirm old key `sb_secret_MKex…` revoked; **scrub git history** of `query_case_details.py`, force-push.
4. Supabase dashboard: DB network restrictions + SSL (M16); confirm public signup disabled.
5. Before pushing `20260731000002` (H6): confirm no non-owner `member` rows exist, OR ship the
   settings.tsx role-gate first.
6. Redeploy so the new Dockerfile `--forwarded-allow-ips` + compose ipam subnet take effect together.

**⏭️ Deferred (documented, not silently dropped):** customer-app CSP script-hashes (needs a built
preview to verify — risks breaking GA-consent/theme if done blind); M15 evidence_items persona split
(intra-tenant only; needs exact sibling predicate from the possibly-unpushed `20260728000003`);
M14 evidence-table dedup (operator confirms live table first); M3 broad `str(e)` sweep; M8/M9/M18/L*.

---

## Guiding principles (don't break anything)
- **I (Claude) write code + migration FILES. I do NOT push to prod.** The `supabase` CLI is
  linked to the real project — `supabase db push` and all secret rotation / dashboard toggles
  are **operator (user) actions**, listed in Phase 0.
- Backends use the **service-role** key (bypass RLS + FORCE RLS). Customer app uses the **anon**
  key. So: RLS tightening never breaks the backends; it only affects the browser client — every
  RLS change below was checked against what `src/` actually writes.
- After any `apps/api` / `apps/admin-api` code change: **restart uvicorn** (no --reload).
- Work in phases; run the test suite (`apps/api/tests`) after each backend phase.
- Each change is small and reversible; migrations are additive and idempotent (`IF EXISTS`).

---

## Phase 0 — OPERATOR actions (user only; I cannot/should not do these)
These are the genuinely urgent, exploitable items. **Do these first, in parallel with my code work.**

- **[C1] Rotate the leaked live secrets** (they sat in plaintext in `dist/server/.dev.vars`):
  `SUPABASE_SERVICE_ROLE_KEY`, `INTERNAL_API_SECRET`, `RESEND_API_KEY`, `META_APP_SECRET`,
  `META_ADS_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SLACK_WEBHOOK_DEMO/CALL`.
  Update root `.env` + prod env + redeploy. (I will delete the artifact file in Phase 1.)
- **[C2] Confirm the old hardcoded key `sb_secret_MKex…` is revoked** in the Supabase dashboard
  (it differs from the live key → likely already rotated; confirm). After I `git rm` the file,
  **scrub git history** (BFG / `git filter-repo --path apps/api/query_case_details.py --invert-paths`),
  force-push, teammates re-clone.
- **[C3] Verify RLS state on prod & push pending migrations.** Run in the Supabase SQL editor:
  ```sql
  SELECT tablename, policyname, cmd FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('evidence','decisions','takedown_reports','infringements','brands');
  ```
  If any `allow_all_authenticated` / `infringements_authenticated` policy appears → `supabase db push`
  (applies `20260728000003` + the new migrations from Phase 3).
- **[M14] Resolve the duplicate `evidence` table** (too risky to auto-migrate): run `\d public.evidence`
  (or `SELECT column_name FROM information_schema.columns WHERE table_name='evidence'`). Confirm it has
  `case_id` (the live, correct one). Then I'll ship a defensive `DROP POLICY IF EXISTS "evidence_authenticated"`.
- **[M16] Supabase dashboard:** enable DB Network Restrictions (Hetzner IP + admin IPs), enforce SSL.
  Confirm public signup is disabled (per memory, code+config done; dashboard toggle pending).

---

## Phase 1 — Zero-risk cleanups (safe deletions & docs; no behavior change)
1. **[C1]** Delete `dist/server/.dev.vars` and `dist/server/.dev 2.vars` (untracked local artifacts).
2. **[C2]** `git rm apps/api/query_case_details.py` (dead debug script; not imported anywhere).
3. **[H10]** Delete the dead mock brand-check:
   - Remove `apps/api/src/tracemark_api/routes/check_brand.py` (kills `time.sleep(10)` DoS + debug `raise` + fabricated legal notices).
   - Remove its import + `include_router` at `apps/api/.../main.py:17,48`.
   - Remove the unused `checkBrand` fn at `src/lib/api.ts:65-70`. **KEEP** `CheckBrandRequest`/`CheckBrandResponse` in `src/lib/api.types.ts` — they back the real scan pipeline (`store.ts`, `escalation-email.ts`, `supabase.ts`).
4. **[L11]** Delete `.env.production 2.example` (cloud-sync duplicate; confuses operators).
5. **[M19]** Add missing vars to `.env.example`: `RESEND_API_KEY`, `ENVIRONMENT`, `INTERNAL_API_ALLOWED_IPS`, `ADMIN_EMAILS`, `EMAIL_BASE_URL`, `LEADS_RATE_LIMIT`, `SCRAPE_CACHE_TTL_HOURS`, `SEED_ADMIN_EMAIL/NAME/PASSWORD` (placeholders only).
6. **[L8]** Remove `X-XSS-Protection` from `apps/admin/nginx.conf:9` (deprecated).

## Phase 2 — Backend security code fixes (`apps/api`, `apps/admin-api`)
7. **[H1] SSRF redirect guard.** Add `safe_get(url, **kw)` to `services/ssrf.py`: validates the URL,
   then follows redirects manually (**max 5** — real marketplaces chain http→https→www→locale),
   re-running `validate_ssrf_url` on each `Location` before fetching it, and preserving the per-hop
   `_HEADERS`, `timeout`, and `call_with_tracking` wrapper; returns the final `requests.Response`. Route through it:
   - `unified_scraper.py:211` and `:462` (replace `requests.get(url, …, allow_redirects=True)`).
   - `marketplace.py:772` (the one **unguarded** scan-influenced probe) — validate + `safe_get`.
   Preserves redirect-following for legit sites (http→https, trailing slash) → no scraping breakage.
8. **[H2] Lock test-email recipient.** `routes/monitoring.py:451-471`: ignore `payload.email`, send to
   `current_user.email` (verified JWT email). **`get_current_user` returns `email or ""` — if the
   caller's email is empty, return 400, do NOT send to `""`.** Keep the `3/hour` limit.
9. **[H3] Org-scope `/screenshots/sign`** (highest care — **BLOCKED until Phase-0 M14 resolves which
   `evidence` table is live**; the union query below hardcodes `evidence.case_id`, valid only for the
   case-scoped table). `routes/infringements.py:208-232`:
   switch dep to `get_current_profile` (has `organization_id`); build the caller's **allowed-path set**
   by unioning `screenshot_url` values from (a) `evidence` JSONB arrays (marketplaces/ads/domains/social)
   for `evidence.case_id → cases.organization_id == org`, (b) `infringements.screenshot_url` via
   `cases!inner(organization_id)`, (c) `evidence_items.screenshot_url` via infringement→case. Only sign
   paths in the set; unknown/foreign → `null` (same graceful degradation the FE already handles).
   Add tests (see Phase 5).
10. **[H5] Harden admin audit writes.** `apps/admin-api/.../services/audit.py`: replace `print` with
    `logging.error(...)`; add an optional `critical: bool = False` param — when True, write audit
    **before** the mutation and raise on failure. Apply `critical=True` at the most sensitive call
    sites: impersonation, `customers.delete`, `staff` create/update/delete, `set_permissions`.
11. **[M2] Internal-route IP trust.** `apps/api/.../main.py:86-118`: keep the constant-time secret as
    the primary control. **DO NOT simply drop the `172.16.0.0/12` default** — admin-api→main-api
    `/internal/*` calls (takedown emails, Meta tokens) run over the docker bridge and would 403.
    Instead: set `INTERNAL_API_ALLOWED_IPS` explicitly to the bridge CIDR (from the `ipam` block added
    in item 16) **in the same deploy**, and only then narrow the code default. Ship the env + code together.
12. **[M3] Stop leaking `str(e)`.** Add a small helper / FastAPI exception handler that logs the detail
    server-side (with a correlation id) and returns a generic message. Replace the `detail=str(e)`
    sites in `monitoring.py`, `documents.py`, `internal.py`, `check_brand`(deleted).
13. **[M4] CORS localhost gating.** `apps/api/.../main.py:58-83`: **first split the prod origins
    (`hakkiu.com`, `api.`, `admin.`) OUT of `_local_dev_origins`** (they currently live inside it,
    lines 69-72) into a `_production_origins` list, then merge localhost only when `not _is_production`.
    Prod origins must always be allowed.
14. **[M17] Bound `_js_cache`.** `services/unified_scraper.py:320`: `OrderedDict` + `_MAX` trim + `Lock`
    (mirror `scrape_cache.py`).
15. **[L3] Org-scope `delete_client` delete.** `routes/clients.py:113`: add `.eq("organization_id", org_id)`.
16. **[H8] `--forwarded-allow-ips`.** The `tracemark` network is a plain `driver: bridge` with **no
    fixed subnet** (Docker assigns dynamically). **First add an explicit `ipam.config.subnet`** to the
    `tracemark` network in `docker-compose.yml` (e.g. `172.28.0.0/16`), then set `apps/api/Dockerfile:41`
    + `apps/admin-api/Dockerfile:34` `--forwarded-allow-ips` to that stable CIDR. This same CIDR feeds
    item 11 (`INTERNAL_API_ALLOWED_IPS`).

## Phase 3 — Database migrations (I write; USER runs `supabase db push`)
New migration files (dated `20260731000001+`), all additive & idempotent:
17. **[H4] `admin_audit_log` append-only (DB-enforced).**
    `REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM service_role, authenticated, anon;`
    + `BEFORE UPDATE OR DELETE` trigger that `RAISE EXCEPTION`. (Verified: admin-api only INSERT/SELECTs it.)
18. **[H6] `org_settings` write role-gate.** Split `org_settings_own_org` into `org_settings_read`
    (SELECT for members) + `org_settings_write` (INSERT/UPDATE for `owner`/`admin` via `organization_members`).
    Every self-signup user is `owner`, BUT the **admin portal `POST /organizations/{id}/members`
    (`apps/admin-api/.../routes/organizations.py:281`) can add `member`-role users today**, and the
    customer `settings.tsx:105,188` writes `org_settings` directly with no role gate. So this fix MUST
    ship together with: (a) a role-gate in `src/routes/settings.tsx` that hides/disables the org_settings
    controls for non-owner/admin members (read the caller's `organization_members.role`), and (b) an
    operator check that no non-owner `member` rows exist in prod before the policy is pushed. Do not defer.
19. **[M5] `FORCE ROW LEVEL SECURITY`** on customer-data tables (cases, evidence, decisions, infringements,
    takedown_reports, documents, notification_deliveries, org_settings, clients, brands, brand_assets,
    evidence_items, profiles). Verified safe (backends use service_role which bypasses FORCE).
20. **[M6] Re-pin `search_path`** on the live `handle_new_user()` (redefine the `20260720000014` version
    with `SET search_path = public, pg_temp`).
21. **[M7] `notification_deliveries` → `FOR SELECT`** (customers only read it; verified no client writes).
22. **[M15] `evidence_items` persona split** — add the same `COALESCE(persona,…)` predicate the sibling
    tables use, + matching `WITH CHECK`.
23. **[L7] Add `WITH CHECK`** to `profiles_own` (`auth.uid()=id`) and `clients_org_isolation`.
24. **[M14-followup]** After the user confirms the live `evidence` table (Phase 0), ship
    `DROP POLICY IF EXISTS "evidence_authenticated" ON public.evidence;` (defensive; only tightens).

## Phase 4 — Frontend / infra hardening
25. **[H9 admin] Drop `script-src 'unsafe-inline'`** in `apps/admin/nginx.conf:13` (admin has NO inline
    scripts — zero risk) and **[M13]** tighten `connect-src` from `https:` to an allow-list
    (self + supabase + admin-api origin + `wss://…supabase`).
26. **[H9 customer] CSP script hashes.** Compute SHA-256 of the two static inline scripts in
    `src/routes/__root.tsx:204-227` (consent-default + theme-bootstrap); replace `'unsafe-inline'` in
    the `script-src` of `Caddyfile:46` **and** `public/_headers` with `'sha256-…' 'sha256-…'`. **Must be
    verified in a built preview** (GA consent + theme toggle still work) before it's considered done —
    higher breakage risk, so it's gated behind a manual check.
27. **[M12] API-subdomain headers.** In `Caddyfile`, add to the `api.` and `admin-api.` blocks:
    `Content-Security-Policy "default-src 'none'; frame-ancestors 'none'"` + `X-Frame-Options DENY`.
    (Optional: IP-allowlist `admin-api.hakkiu.com` to office/VPN.)
28. **[H7] Private legal-doc signed URLs.** `services/document_persistence.py:62-67` writes
    `get_public_url()` into the **`documents`** table (bucket `legal-documents`) — NOT a `legal_documents`
    table. Store the **bare path** and mint `create_signed_url(path, ttl)` on read. **ALL readers of
    `documents.file_url` must sign on read (CLAUDE.md parity):** main-api `routes/documents.py:78` and
    `routes/internal.py:173`, AND the **admin portal** `apps/admin-api/.../routes/cases.py:144-154`
    (returns raw `file_url`, rendered as `<a href>` in `apps/admin/src/pages/CaseDetail.tsx:289`).
    Missing the admin reader = broken document links in the admin case view.
29. **[M10/M11] CI/CD hardening** (`.github/workflows/`): SHA-pin third-party actions; pin deploy to
    `github.event.workflow_run.head_sha`. (Config-only; low risk. Branch protection is an operator task.)
30. **[L5] Encrypt backups** (`scripts/backup.sh`): pipe through `age`/`gpg`; `chmod 700` the dir.

## Phase 5 — Tests (lock the fixes so they can't regress) — [H11]
31. `apps/api/tests/test_ssrf.py` — blocked schemes, literal private IPs, DNS-resolves-to-private, and
    the new `safe_get` redirect-hop revalidation.
32. `apps/api/tests/test_screenshots_sign.py` — a path in the caller's org signs; a foreign-org path → null.
33. `apps/api/tests/test_test_email.py` — recipient is forced to the caller's email.
34. New `apps/admin-api/tests/` — `resolve_effective_permissions` (presets, overrides, super-admin,
    stale-perm ignore) + a couple of `require_permission` route-gating tests + audit fail-closed.

---

## Sequencing & risk summary
- **Do first (Phase 0, operator):** C1 rotate, C3 verify/push — the only *live-exploitable* items.
- **Near-mechanical / low risk:** Phase 1 all; H2, M2, M3, M4, M17, L3, H8 (Phase 2); H4, M5, M6, M7,
  L7 (Phase 3); admin CSP + M12 (Phase 4).
- **Higher care (do deliberately, with tests/preview):** **H3** (screenshot org-scope — union 3 sources,
  unknown→null), **H6** (org_settings gating — safe now, needs FE coordination if team-invites ship),
  **customer CSP hashes** (verify in built preview), **H7** (must update all `file_url` readers).
- **Deferred to operator verification:** M14 (which `evidence` table is live), M16 (dashboard).

Implementation order: Phase 1 → 2 → 3 (write files) → 4 → 5, restarting uvicorn + running tests between
backend phases. A review agent validated THIS plan before any code is written.

---

## Explicitly deferred findings (not silently dropped)
- **[M1] Admin `staff.manage` self-provisions an `admin` account** — real privilege-escalation. **Triaged
  into this task as a small Phase-2 add:** gate `POST /staff` (and any role assignment) behind
  `require_super_admin`, or add a distinct `staff.create` permission NOT in the `admin` preset
  (`apps/admin-api/.../routes/staff.py:117-168`, `permissions.py`). Keep `permissions.py` ↔
  `permissions.ts` in sync (CLAUDE.md).
- **[M8] Admin mass-assignment / enum validation**, **[M9] admin unbounded-scan DoS**, **[M18]
  `_resolve_org_id` user-id-as-org fallback** — deferred to a follow-up hardening pass (correctness /
  robustness, not directly exploitable cross-tenant given service-role scoping). M18 must be revisited
  if a real multi-org membership feature ships (it interacts with H3/H6 isolation).
- **[L1,L2,L4,L6,L9,L10]** admin hardening (client separation, single-use impersonation tracking, soft
  no-op audits, extra WITH CHECKs already partly covered by L7) — deferred, low risk.

## Review corrections incorporated (2026-07-31, from principal-engineer review — verdict GO-WITH-CHANGES)
1. H7 → correct table is **`documents`**, and admin-api `cases.py` reader added (parity). 
2. M2 → set `INTERNAL_API_ALLOWED_IPS` to the bridge CIDR in the same deploy, don't just drop the default.
3. H2 → 400 on empty caller email.
4. H6 → ship FE role-gate in `settings.tsx` + operator member-row check now (admin can create members).
5. H3 → blocked until Phase-0 M14 confirms the live `evidence` table (query hardcodes `case_id`).
6. H8 → add explicit `ipam.config.subnet` to `docker-compose.yml` first, then pin to it.
7. M4 → split prod origins out of `_local_dev_origins` before gating localhost.
8. H1 → redirect cap raised to 5, per-hop headers/timeout/tracking preserved.
9. M1 → pulled into scope (Phase 2); M8/M9/M18/L* explicitly deferred above.
