# HAKKIU — Deep Security Audit (Red + Blue Team) — 2026-07-31

Method: 6 parallel specialist audits (main API, admin API, frontends, Supabase RLS,
infra/config, code-quality) + manual verification of every Critical. Each finding is
tagged with red-team (attack) and blue-team (fix). Findings marked **VERIFIED** were
confirmed by direct inspection during this session.

Cross-cutting theme: the whole system's tenant isolation ultimately rests on the
**Supabase service-role key** (both backends use it and bypass RLS). So every place that
key can leak, and every RLS policy that is the customer app's *only* guard, is load-bearing.

---

## 🔴 CRITICAL

### C1 — Active production service-role key (+ INTERNAL_API_SECRET, RESEND, META, Stripe, Slack) sitting in plaintext build artifact — **VERIFIED**
- **File:** `dist/server/.dev.vars` (mode `0644`), stale copy `dist/server/.dev 2.vars`.
- **Verified:** the `SUPABASE_SERVICE_ROLE_KEY` in this file is **byte-identical to the live `.env` key** — it is the current prod key, not a placeholder. Also contains live `INTERNAL_API_SECRET`, `META_APP_SECRET`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SLACK_WEBHOOK_DEMO/CALL`.
- **Not git-tracked** (gitignored — good) and **not baked into the Docker image** (`.dockerignore` excludes it). Risk is local-disk + worker-CWD exposure.
- **Red-team:** any local malware / backup-sync / shared-machine access reads the whole prod keyring. Service-role key = full read/write/delete on every tenant's data (RLS bypassed). `INTERNAL_API_SECRET` = impersonate admin-api → main-API `/internal/*` (send takedown emails, exchange Meta tokens). The file lives in the workerd `WORKDIR /app/dist/server`, so any future assets-path misconfig or path-traversal serves it over HTTP.
- **Blue-team:** (1) delete both files now; (2) **rotate** service-role key, `INTERNAL_API_SECRET`, Resend, Meta, Stripe, Slack (they've sat in plaintext); (3) stop writing `.dev.vars` into the worker CWD in prod — use Cloudflare secret bindings / container env; if it must exist, `chmod 600`; (4) add `dist/`, `*.vars` to a routine clean + a pre-commit secret scanner.

### C2 — Hardcoded service-role key committed to repo HEAD + git history (REGRESSION) — **VERIFIED**
- **File:** `apps/api/query_case_details.py:5-6` — hardcoded `supabase_url` (prod ref `kdiyjwwejrdqnccfqhyv`) + `supabase_key = "sb_secret_MKex…"`.
- **Verified:** file **is tracked in HEAD**. Git history shows it was removed twice (`254bc23 🛡️ Sentinel: [CRITICAL] Fix hardcoded Supabase secret key`, `26395ce Remove debug script`) and **re-introduced** — the exact regression both prior audits warned about. The key is **different** from the live `.env` key → likely already rotated, which downgrades live impact but does not remove the exposure.
- **Red-team:** anyone with clone/history access copies the key; if it was ever *not* revoked, it grants full cross-tenant DB access to prod.
- **Blue-team:** (1) confirm in Supabase dashboard that `sb_secret_MKex…` is revoked; (2) `git rm apps/api/query_case_details.py`; (3) purge from history (BFG / `git filter-repo`), force-push, teammates re-clone; (4) pre-commit secret scanner so a bot can't re-add it a 3rd time.

### C3 — RLS reconciliation migration `20260728000003` may not be applied to prod → broad `allow_all_authenticated` policies still live (needs live verification)
- **File:** `supabase/migrations/20260728000003_security_rls_h4_h7.sql` (header lines 5-18); project memory says "committed but prod push pending re-auth."
- The migration's own header documents a 2026-07-28 prod dump where `evidence`, `decisions`, `takedown_reports` each still had a broad `allow_all_authenticated` policy **and no scoped policy**. RLS policies are OR-combined → one broad policy defeats every scoped one.
- **Red-team (if unapplied):** any customer with the public anon key + a valid JWT runs `supabase.from('decisions').select('*')` / `evidence` / `takedown_reports` and reads **every tenant's** AI verdicts, screenshots, scores, takedown notices, infringing URLs. `FOR ALL` also permits cross-tenant write/delete.
- **Blue-team:** `supabase db push`, then verify live:
  ```sql
  SELECT tablename, policyname, cmd FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('evidence','decisions','takedown_reports','infringements','brands');
  -- must show ZERO allow_all_authenticated / infringements_authenticated policies
  ```

---

## 🟠 HIGH

### H1 — SSRF bypass via redirect in `unified_scraper` (guard only checks first hop)
`apps/api/.../services/unified_scraper.py:207/211` and `:447/462`. `validate_ssrf_url(url)` runs on the initial URL, then `requests.get(url, allow_redirects=True)` follows redirects **without re-validating the target**. Attacker's server returns `302 → http://169.254.169.254/…` or `http://127.0.0.1:8000/api/v1/internal/…`. Fix: `allow_redirects=False` or re-run `validate_ssrf_url` on every redirect `Location` (mirror the `follow_redirects=False` pattern already used in `ai.py`/`storage.py`).

### H2 — Open email relay via test-email endpoint (H10 from prior audit NOT fixed)
`apps/api/.../routes/monitoring.py:451-471` — `POST /monitoring/notifications/test/email` sends a HAKKIU-branded Resend email to **any** address; only mitigation is `3/hour` rate limit. Red-team: authenticated user sends branded phishing lures from a legit sender / burns Resend reputation. Fix: force `recipient = current_user.email`.

### H3 — `screenshots/sign` mints signed URLs for arbitrary paths with no ownership check
`apps/api/.../routes/infringements.py:208-232` — takes client-supplied storage paths, signs each, no check that the path belongs to the caller's org. Partially defeats the C5 private-bucket fix if a foreign path is known/guessed (UUID paths make blind enumeration hard → severity hinges on path exposure). Fix: resolve each path → `evidence_items`/`cases` and only sign where `organization_id == caller's org`.

### H4 — Admin audit log is NOT DB-enforced append-only; service-role can delete/rewrite it
`supabase/migrations/20260720000013_admin_audit_log.sql:24-26` claims "append-only" but there is no `REVOKE UPDATE/DELETE`, trigger, or rule. Admin-api does everything with the service-role key (bypasses RLS, but **not** table GRANTs). Red-team: anyone with the service-role key (see C1) runs `delete from admin_audit_log where staff_id=<me>` and erases evidence of impersonation / data edits. Fix: `REVOKE UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM service_role, authenticated, anon;` + a `BEFORE UPDATE OR DELETE` trigger that raises. (Best: separate hardened store.)

### H5 — Admin audit writes are best-effort/silent → privileged actions can succeed with no record
`apps/admin-api/.../services/audit.py:26-41` swallows every exception and only `print()`s. Combined with H4, a transient failure or oversized metadata → the mutation proceeds with **no audit row and no alert** (repudiation gap for impersonate / customer delete / staff create). Fix: for high-sensitivity actions write audit **before** the mutation and fail-closed; emit `logging.error` + a metric, not `print`.

### H6 — `org_settings` write not role-gated → any org member can flip tenant mode-isolation
`supabase/migrations/20260714000001_security_hardening.sql:125-142` — `org_settings_own_org` is `FOR ALL` for any member. Red-team: a low-priv law-firm member runs `update org_settings set persona='brand_owner'` — `persona` is the field every case/evidence/decision/takedown policy uses for its client-isolation split, so this reshapes what the whole org sees; also lets them redirect `notification_email`. Fix: split into SELECT-for-members + INSERT/UPDATE gated to `owner`/`admin` (SQL in the DB agent report).

### H7 — `legal-documents` bucket is private but code stores a `get_public_url()` value
`apps/api/.../services/document_persistence.py:62` stores a public URL for a private bucket (`20260714000002`). Functionally broken (404s) and a latent C5-class leak: the tempting "fix" (flip bucket public) exposes every DMCA/cease-desist PDF (names, addresses, legal claims) by URL. Fix: store the bare path, mint `create_signed_url()` on read (mirror `storage.py`).

### H8 — `--forwarded-allow-ips "*"` on both uvicorn backends → spoofable X-Forwarded-For
`apps/api/Dockerfile:41`, `apps/admin-api/Dockerfile:34`. uvicorn trusts `X-Forwarded-For` from any peer. Contained today (ports bind `127.0.0.1`, only Caddy proxies), but any container on the `tracemark` bridge (or SSRF landing on localhost, cf. H1) can forge the header → poisons **rate-limit keys** and **audit-log IPs**. Fix: set `--forwarded-allow-ips` to Caddy's subnet, not `*`.

### H9 — localStorage auth tokens + CSP `script-src 'unsafe-inline'` (both apps)
`src/lib/supabase.ts:31-45`, `apps/admin/src/lib/supabase.ts:9-19` store JWT+refresh in `localStorage`; `Caddyfile:46` + `apps/admin/nginx.conf:13` allow `'unsafe-inline'` scripts. The team's stated mitigation for localStorage is "CSP" — but `'unsafe-inline'` defeats CSP's XSS protection, so the mitigation is undercut. No active injection sink found (frontend is otherwise clean), so this is a serious defense-in-depth gap, not a live hole. Fix: replace `'unsafe-inline'` with SHA-256 **hashes** of the two static inline scripts in `__root.tsx:204/224` (admin has no inline scripts — drop it there immediately).

### H10 — Dead mock `check_brand.py` route shipped to prod: 10 s blocking sleep + debug `raise` + fabricated legal notices — **VERIFIED**
`apps/api/.../routes/check_brand.py` (~863 lines), registered `main.py:48` as `POST /api/v1/check-brand`; the `checkBrand()` FE export (`src/lib/api.ts:65`) is **never called** (the app uses `/monitoring/check-brand`). Contains `time.sleep(10)` (`:851`) in a **sync** route → each call ties up a threadpool worker (trivial DoS), a `raise Exception` on magic input `:847`, and 800 lines of hardcoded fake takedown notices. Fix: delete the file, the `include_router`, and the `checkBrand` FE export.

### H11 — Test gap: zero tests for admin-api (highest-privilege code), no SSRF tests, no IDOR tests
`apps/admin-api/` has **no `tests/`** — `require_permission`, `resolve_effective_permissions`, staff auth, impersonation, cross-org service-role reads are all untested. `services/ssrf.py` and the `_assert_*_in_org` IDOR guards have no dedicated tests. Fix: add permission-resolution, SSRF (blocked schemes / private IPs / DNS-to-private), and org-scope tests.

---

## 🟡 MEDIUM

- **M1** Non-super `staff.manage` holder can self-provision a new `admin` account → persistent backdoor. `apps/admin-api/.../routes/staff.py:117-168` + `permissions.py:67` (the `admin` preset itself contains `staff.manage`). Fix: gate `POST /staff` (and role assignment) behind super-admin, or a distinct non-preset `staff.create` permission.
- **M2** Internal-route IP allowlist trusts `request.client.host` and defaults to the whole `172.16.0.0/12`. `apps/api/.../main.py:86-118`. Behind a proxy `request.client.host` is the proxy IP; every proxied request passes. Fix: rely on the constant-time secret as primary control; narrow `INTERNAL_API_ALLOWED_IPS`, drop the `/12` default in prod.
- **M3** `str(e)` returned to clients (info leak) across `monitoring.py`, `documents.py`, `internal.py`, `check_brand`. Fix: generic message to client + correlation-id log server-side.
- **M4** CORS always merges localhost origins even in prod (`apps/api/.../main.py:58-83`, `allow_credentials=True`). Low real impact (Bearer auth, not cookies) but broadens trusted surface. Fix: gate localhost behind `if not _is_production`.
- **M5** No `FORCE ROW LEVEL SECURITY` on any table — RLS is bypassed by the table owner role and SECURITY DEFINER functions. Fix: `ALTER TABLE … FORCE ROW LEVEL SECURITY` on all customer-data tables (service-role still bypasses FORCE, so backends keep working).
- **M6** `handle_new_user()` SECURITY DEFINER re-defined **without** `SET search_path` in `20260720000014_organizations.sql:96-119` — regresses the pin added in `20260714000001`. Classic DEFINER search-path escalation. Fix: re-add `SET search_path = public, pg_temp`.
- **M7** `notification_deliveries` RLS is `FOR ALL` for customers (should be `FOR SELECT`) — a customer can tamper with their own org's delivery log. `20260714000001:106`, `20260730000004:52`.
- **M8** Mass-assignment inconsistency in admin mutations — `brands_admin.py:57` uses an `_EDITABLE` allowlist; `infringements_admin.py`, `cases.py:255` (`update_decision`), `takedowns_admin.py`, `organizations.py:253` write `model_dump()` straight through with no enum validation on `status`/`verdict`/`risk_level`. Fix: allowlist + enum validation everywhere.
- **M9** Admin DoS: full-table `auth.admin.list_users()` / unbounded scans on hot paths (`customers.py:53`, `organizations.py:29` no pagination, `search.py`, `impersonation.py:47` iterates ALL users). Low-priv `customers.view` staffer can hammer these. Fix: paginate / look up single user by id.
- **M10** Deploy does `git reset --hard origin/main` with no SHA pin (`.github/workflows/deploy.yml:39`) — prod deploys HEAD-of-main, not the exact CI-tested commit; anyone who can push main gets unreviewed prod. Fix: branch protection + pin to `github.event.workflow_run.head_sha`.
- **M11** GitHub Actions pinned to mutable tags (`actions/checkout@v5`, `setup-uv@v9.0.0`) — only `appleboy/ssh-action` is SHA-pinned. Fix: SHA-pin all third-party actions.
- **M12** `api.` / `admin-api.` Caddy blocks lack CSP / `X-Frame-Options` / `frame-ancestors` (`Caddyfile:68-95`); `admin-api` (service-role power) is internet-exposed, gated only by app auth + CORS. Fix: add `default-src 'none'; frame-ancestors 'none'` + `X-Frame-Options DENY`; consider IP-allowlisting `admin-api.hakkiu.com` to office/VPN.
- **M13** Admin SPA CSP `connect-src 'self' https:` (`apps/admin/nginx.conf:13`) — higher-privilege app has the *looser* policy; any running script can exfiltrate to any HTTPS origin. Fix: allow-list supabase + admin-api only.
- **M14** Duplicate `evidence` table definitions (`20260606…:15` case-scoped vs `20260618…:5` infringement-scoped) — RLS correctness depends on which is live in prod; the dead one carries a broad `evidence_authenticated` policy. Fix: assert `\d public.evidence`, `DROP POLICY IF EXISTS "evidence_authenticated"`, drop the dead table.
- **M15** `evidence_items` scoped policy omits the persona mode-isolation split (`20260728000002:61-86`) — intra-firm client wall not enforced on evidence_items (org-scoped, no cross-tenant leak). Fix: add the persona predicate.
- **M16** `supabase/config.toml:73-85` — DB network restrictions disabled + `allowed_cidrs=["0.0.0.0/0"]`, SSL enforcement commented out. Template governs local stack but sets a precedent. Fix: in the hosted project, restrict to the Hetzner IP + admin IPs, enforce SSL.
- **M17** Unbounded, unlocked module cache `_js_cache` in `unified_scraper.py:320` — grows one entry per URL for process lifetime + concurrent-write race. Fix: `OrderedDict` + capacity trim + `Lock` (mirror `scrape_cache._trim`).
- **M18** `_resolve_org_id` falls back to `user_id` as org when profile has no `organization_id` (`apps/api/.../dependencies.py:45-57`) — silent isolation-domain merge. Fix: provision a real org at signup; treat missing org as 403.
- **M19** `.env.example` missing required vars: `RESEND_API_KEY`, `ENVIRONMENT`, `INTERNAL_API_ALLOWED_IPS`, `ADMIN_EMAILS`, `EMAIL_BASE_URL`, `SEED_ADMIN_*` — a fresh deploy silently can't email + mis-hardens prod. Fix: add them.

---

## 🟢 LOW / hardening

- **L1** `print()` used instead of `logging` across the backend (200+ calls, `marketplace.py` alone ~100). No levels/capture. Migrate to stdlib `logging`.
- **L2** Silent `except Exception: pass` in customer email path + many services (`notifications.py:277/285`, `domain_whitelist.py:119`, etc.) — failures vanish. Log at warning.
- **L3** `delete_client` delete not org-scoped (`clients.py:113`) — existence is checked first so not exploitable, but inconsistent; add `.eq("organization_id", org_id)` to the delete.
- **L4** No rate-limit/lockout on authenticated admin routes — `slowapi` is installed app-wide but no `@limiter.limit` on any authenticated endpoint (create/delete/impersonate/search).
- **L5** Backups unencrypted (`scripts/backup.sh:35/42`) — `pg_dump | gzip | scp` full PII in cleartext. Pipe through `gpg`/`age`, `chmod 700` the dir.
- **L6** Secrets via `docker-compose environment:` are readable by any `docker`-group user via `docker inspect`. Consider Compose `secrets:` (file-mounted).
- **L7** `profiles` / `clients` RLS policies lack `WITH CHECK` — protection depends entirely on the freeze trigger. Add `WITH CHECK`.
- **L8** `X-XSS-Protection` set on admin nginx — deprecated/counterproductive; set `0` or remove.
- **L9** Impersonation magic-link: no admin-side single-use/consumption tracking; raw `action_link` returned in the HTTP response (loggable). Supabase enforces TTL/one-time, but admin has no record it was consumed.
- **L10** Leftover billing cruft surfacing fabricated data: `ClientBillingResponse` + `/clients/{id}/billing` returns `cases_count*15` as a fake credit metric; `clients.mrr` in `ClientsPage.tsx:230`. Dead-model, remove.
- **L11** `.env.production 2.example` cloud-sync duplicate in the tree — delete (confuses operators).

---

## ✅ Verified-good (previously-claimed fixes that ARE present & correct)
IDOR fixes on infringements/monitoring/documents/clients/brands (app-layer org filters);
JWT verified server-side via GoTrue (not local decode); SSRF guard with DNS-rebind check
applied on the first hop of ai/embedding/storage/playwright; private `evidence-screenshots`
+ `brand-assets` buckets with signed URLs; internal secret `hmac.compare_digest`; security-headers
middleware; staff email/password-takeover fixed (`staff.py:251`); impersonation double-gated + audited;
admin CORS locked to admin origin; **permission catalogs `permissions.py` ↔ `permissions.ts` are in sync**;
`/internal/*` duplication rule (CLAUDE.md §5) correctly followed; no real secrets committed to git
history; containers run non-root; app ports bind to `127.0.0.1`; no `latest` image tags; staff/admin
tables (`staff_permissions`, `admin_audit_log`) correctly deny anon/authenticated; no open redirect,
no XSS sink, CSRF N/A (Bearer auth); no source maps shipped; anon key (not service-role) in browser bundles.

---

## Fix priority (do in this order)
1. **C1** — delete `dist/server/.dev.vars`, rotate the leaked live secrets. *(active key exposed)*
2. **C3** — push/verify `20260728000003`; confirm no `allow_all_authenticated` policies live. *(possible cross-tenant read)*
3. **C2** — remove `query_case_details.py`, confirm old key revoked, scrub history.
4. **H1** — disable/re-validate redirects in `unified_scraper` (real SSRF bypass).
5. **H2, H3** — lock test-email to caller; org-scope `screenshots/sign`.
6. **H4, H5** — DB-enforced append-only + fail-closed audit log.
7. **H6, H7, M5, M6** — org_settings role-gate, private legal-doc signing, FORCE RLS, search_path pin.
8. **H8** — `--forwarded-allow-ips` to Caddy subnet.
9. **H9 / M12 / M13** — CSP hashes, API-subdomain headers, admin `connect-src` allow-list.
10. **H10** — delete the dead mock `check_brand.py` (removes the sleep-DoS).
11. **H11** — add admin-api / SSRF / IDOR tests so these don't regress.
