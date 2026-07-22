# HAKKIU Security Audit — 2026-07-22

Full-codebase audit across 10 attack surfaces, run in parallel by specialized agents.

---

## IMMEDIATE ACTION REQUIRED

### Rotate the Supabase service role key NOW

`apps/api/query_case_details.py:6` contains a hardcoded service role key (`sb_secret_***REVOKED***`) pointing at the live production DB (`kdiyjwwejrdqnccfqhyv.supabase.co`). This key bypasses all RLS. It was previously fixed but re-introduced by an automated bot commit.

**Steps:**
1. Go to Supabase dashboard → Settings → API → Rotate service role key.
2. Update `.env` with the new key.
3. Fix or delete `apps/api/query_case_details.py` (it's a debug script, safe to delete).
4. Consider `git filter-repo` to scrub the key from history.

---

## Critical Findings

| ID | Area | File | Issue |
|----|------|------|-------|
| C1 | Secrets | `apps/api/query_case_details.py:6` | Hardcoded Supabase service role key in repo |
| C2 | IDOR | `routes/infringements.py:137,161,181` | GET / GET evidence / PATCH status — zero org ownership check; any authenticated user can read or modify any org's infringement |
| C3 | SSRF | `services/embedding_helper.py:116-207` | User-controlled `official_domains` / `website` brand fields fetched via httpx + Firecrawl with no host validation |

---

## High Findings

| ID | Area | File | Issue |
|----|------|------|-------|
| H1 | IDOR | `routes/monitoring.py:365` | POST case status — no case ownership check |
| H2 | IDOR | `routes/monitoring.py:433` | PUT takedown — no org ownership check |
| H3 | IDOR | `routes/monitoring.py:501` | POST takedown send-email — no ownership check; combined with H2 = read-modify-send any org's takedown |
| H4 | IDOR | `routes/documents.py:12` | POST document send-email — no ownership check |
| H5 | IDOR | `routes/clients.py:109` | PUT client UPDATE uses only client_id; org stripped from write (TOCTOU) |
| H6 | Privilege Escalation | `admin-api/routes/staff.py:229` | `staff.manage` can reset any staff member's password including super-admins → full account takeover |
| H7 | Privilege Escalation | `admin-api/routes/staff.py:223` | `staff.manage` can change any staff member's email → lock out super-admin and take over account |
| H8 | No CSP | Customer Cloudflare Worker | Zero Content-Security-Policy on customer frontend; no X-Frame-Options |
| H9 | Rate Limiting | `routes/monitoring.py:105,129,218` | check-brand / gather-evidence / check-ads have no per-user rate limit; one JWT can exhaust all outbound API quota |
| H10 | SMTP Relay | `routes/monitoring.py:476` | Test-email endpoint accepts any recipient string — open SMTP relay for all customers |
| H11 | SSRF | `services/playwright_client.py:10` | Playwright browser navigates to scraper-derived URLs with no IP blocklist |
| H12 | Internal API | `routes/internal.py` | `/internal/*` routes mounted publicly; only protected by shared secret with no network-level restriction |
| H13 | Dependencies | root `package.json` | 8 HIGH npm advisories: `undici` TLS bypass, `ws` DoS, `sharp` libvips CVEs (wrangler chain) |
| H14 | Dependencies | `apps/admin-api/` | No lockfile — every production build resolves deps fresh from PyPI (supply chain risk) |

---

## Medium Findings

| ID | Area | File | Issue |
|----|------|------|-------|
| M1 | SSRF | `routes/monitoring.py:19` | SSRF blocklist bypassable via octal/hex IP encoding and DNS rebinding |
| M2 | Injection | `services/marketplace.py:2300` | `.env` file write via internal token endpoint; newline in token value can inject new env vars |
| M3 | Injection | `routes/infringements.py:119` | LIKE wildcard injection via `platform` filter (no data modification possible, but filter bypass) |
| M4 | IDOR | `routes/monitoring.py:105,129` | gather-evidence / check-ads bypass all entitlement checks — Starter plan can trigger unlimited scrapes |
| M5 | IDOR | `routes/monitoring.py:93` | make-decision bypasses entitlement enforcement |
| M6 | DoS | `routes/brands.py:305` | File upload reads entire body into memory before size check |
| M7 | DoS | Scan request models | `platforms`, `official_advertisers` lists have no max_items limit |
| M8 | DoS | `routes/brands.py:243` | reference-content/refresh has no rate limit |
| M9 | DoS | `admin-api/routes/search.py:38` | `auth.admin.list_users()` called on every search request — full user table scan |
| M10 | DoS | `admin-api/routes/organizations.py:86` | `list_organizations` fetches all orgs + all related tables with no LIMIT |
| M11 | Auth | `supabase/config.toml:226` | Email confirmation disabled — anyone can register with someone else's email |
| M12 | Auth | `supabase/config.toml:182` | Password minimum is 6 chars, no complexity; UI claims 8; `secure_password_change = false` |
| M13 | Auth | `src/lib/supabase.ts` | JWTs stored in localStorage (XSS-accessible); no httpOnly cookie adapter |
| M14 | XSS | `src/routes/monitoring.$caseId.takedown.tsx:177` | `submission_url` placed in `href` with no protocol validation |
| M15 | XSS | `apps/admin/src/pages/CaseDetail.tsx:187` | DB-sourced URLs (`screenshot_url`, `source_url`) in `href`/`src` with no protocol validation in admin |
| M16 | Headers | Admin Cloudflare Worker | Admin CSP lives only in nginx.conf — not applied in production (Cloudflare Worker serves production) |
| M17 | Billing | `services/entitlements.py:28` | Entitlements eventually-consistent; `past_due` window grants access for 3-7 days after payment failure |
| M18 | Admin | `admin-api/routes/organizations.py:319` | `remove_member` returns 200 on non-existent membership; writes false audit evidence |
| M19 | Admin | `admin-api/routes/cases.py:122` | Bulk case update has no org-scoped permission granularity for staff |
| M20 | Auth | `supabase/config.toml` | Production Supabase rate limits unverified; no CAPTCHA on auth forms |
| M21 | Dependencies | `apps/admin/Dockerfile:6` | `npm install --no-audit` suppresses vulnerability alerts in Docker build |
| M22 | Dependencies | All Dockerfiles | Base images unpinned (`python:3.11-slim`, `node:22-alpine`, `nginx:alpine`) |
| M23 | Dependencies | `npm` | `dompurify ≤3.4.11` has 9 XSS bypass CVEs (transitive) |

---

## Low Findings

| ID | Area | File | Issue |
|----|------|------|-------|
| L1 | IDOR | `routes/brands.py:375` | Asset delete write unscoped (TOCTOU after org-scoped read) |
| L2 | IDOR | `routes/infringements.py:56` | Missing org falls back to user_id — inconsistent isolation |
| L3 | SSRF | `services/storage.py:46` | `upload_screenshot` fetches attacker-reachable image URLs with no host validation |
| L4 | SSRF | `services/embedding_helper.py:295` | `compute_screenshot_phash` fetches URLs from scraper evidence with no blocklist |
| L5 | SSRF | `services/unified_scraper.py:188` | JS-detect probe sends unvalidated GET to unknown domain URLs |
| L6 | SMTP | `routes/monitoring.py:501` | Takedown send-email has no deduplication/cooldown (resend loop) |
| L7 | Auth | `admin-api/routes/staff.py:166` | Audit log IP uses `request.client.host` — wrong behind any proxy |
| L8 | Auth | `src/lib/supabase.ts:41` | `is_admin` flag fetched from profiles but never enforced server-side |
| L9 | Auth | `services/impersonation.py:42` | Impersonation magic link has no consumption tracking; localhost default for CUSTOMER_APP_URL |
| L10 | XSS | `src/lib/utils.ts:8` | `ensureAbsoluteUrl` doesn't explicitly reject `javascript:` or `data:` URIs |
| L11 | XSS | `apps/admin/src/pages/CustomerDetail.tsx:115` | `action_link` passed to `window.open` without protocol check |
| L12 | Billing | `routes/internal.py:331` | Comp plan path doesn't set `subscription.status='active'`; relies on fragile fallback |
| L13 | Billing | `routes/billing.py:546` | No explicit null-check for `sig_header` before `construct_event` |
| L14 | Billing | `entitlements.py:283` | `resolve_detection_depth` returns `tier2` for all plans (depth gating not yet enabled) |
| L15 | Dependencies | Both `pyproject.toml` | All deps use `>=` ranges with no upper bound |
| L16 | Dependencies | Dockerfiles | `uv:latest` tag in Docker COPY — unpinned |
| L17 | Dependencies | Entire repo | No Dependabot, no `pip-audit`, no `npm audit` in CI |

---

## Remediation Plan — Prioritized

### Phase 0 — Do today (blocking)

1. **[C1] Rotate Supabase service role key** — delete or fix `query_case_details.py`, rotate key in dashboard, update `.env`.
2. **[H6/H7] Fix admin staff password/email escalation** — add `require_super_admin` check before any `auth_attrs` update in `PATCH /staff/{id}`.
3. **[C2] Fix infringement IDOR** — all three infringement endpoints must join through `cases` and assert `cases.organization_id = caller_org_id`.

### Phase 1 — This week (critical attack surface)

4. **[C3] SSRF on brand official_domains** — add `_PRIVATE_NETS` check (or proper `ipaddress` resolution check) in `_fetch_page_text` and `ensure_official_site_reference`.
5. **[H1-H4] Fix remaining IDOR endpoints** — monitoring case status, takedowns, documents: add org ownership check via case/report lookup before any mutation or email send.
6. **[H10] Fix open SMTP relay** — add `EmailStr` validation, per-user rate limit (e.g. 3/hour), and restrict `test/email` to the user's own verified email.
7. **[H9] Add rate limiting** — install `slowapi`; apply `5/hour` limit per user on check-brand, gather-evidence, check-ads, analyze, reference-content/refresh.
8. **[H8] Add security headers to customer Cloudflare Worker** — create `public/_headers` file with CSP, X-Frame-Options, X-Content-Type-Options.

### Phase 2 — This sprint

9. **[H11] Playwright SSRF** — add pre-`goto()` host validation blocking RFC 1918 / loopback / link-local.
10. **[M11] Enable email confirmation** — set `enable_confirmations = true` in `supabase/config.toml` and apply to production in Supabase dashboard.
11. **[M12] Harden password policy** — `minimum_password_length = 12`, `password_requirements = "lower_upper_letters_digits"`, `secure_password_change = true`.
12. **[M2] Fix .env token write** — strip newlines from token before writing; long-term move to DB storage.
13. **[H12] Restrict internal API** — add IP allowlist middleware or deploy internal routes on a separate port/process not exposed publicly.
14. **[M16] Fix admin CSP in production** — configure headers in Cloudflare Worker or add `apps/admin/public/_headers`.
15. **[H14] Add admin-api lockfile** — run `uv lock` in `apps/admin-api/`, commit `uv.lock`, change Dockerfile to `uv sync --frozen`.
16. **[M6] Fix file upload memory** — check `Content-Length` header before reading; stream-read with byte cap.
17. **[M7] Add request model limits** — `max_length=200` on `brand_name`; `max_items=10` on `platforms`, `official_advertisers`, `official_domains`.

### Phase 3 — Next sprint

18. **[M9/M10] Paginate admin endpoints** — replace `list_users()` full scan with paginated calls; add `LIMIT` to `list_organizations`, `list_customers`.
19. **[M13] httpOnly cookie storage** — implement custom Supabase storage adapter using httpOnly cookies instead of localStorage.
20. **[M14/M15] Fix URL validation in frontend** — harden `ensureAbsoluteUrl` to reject non-https; apply to `submission_url`, admin portal `source_url`/`screenshot_url`.
21. **[L3/L4/L5] SSRF in screenshot/phash/scraper** — add SSRF-safe HTTP helper and apply everywhere httpx/requests fetches external URLs from evidence data.
22. **[H13] Fix npm CVEs** — upgrade `wrangler` past 4.101.0 or add `overrides` for `sharp >=0.35.0`; upgrade `dompurify >=3.4.12`.
23. **[M21] Fix Dockerfile** — change `npm install --no-audit` to `npm ci` in `apps/admin/Dockerfile`.
24. **[M22/L16] Pin Docker images** — pin base images to SHA256 digests or explicit patch-level tags; pin `uv` to specific version.
25. **[L17] Add dependency scanning** — add Dependabot config, `pip-audit` in CI, `npm audit --audit-level=high` in CI.

---

## Finding Count by Severity

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 14 |
| Medium | 23 |
| Low | 17 |
| **Total** | **57** |
