# HAKKIU — TODO

> Tick items as they are completed. Add new items as they are discovered.
> Last updated: 2026-07-29 (session 31 — brands-count field in lead modals, landing moved to site root)

---

## 🔢 Brands-count field + landing at root (2026-07-29, session 31)

- [x] Added a required "How many brands do you protect?" Select to BOTH lead modals
  (`book-demo-modal.tsx`, `talk-to-sales-modal.tsx`). Posts existing `brand_count_range`
  (`1 / 2-3 / 4-5 / 6-10 / 11-20 / 20+`, matching the `sales_leads` CHECK constraint).
- [x] End-to-end wiring confirmed with NO backend changes: the field already existed in the
  `LeadRequest` model, the `sales_leads` column, the `new_lead_html` staff-email "Brands (count)"
  row, and the Admin Portal Leads "Brands" column — the forms just weren't sending it.
- [x] Moved the landing page from `/landing` to site root `/`: `routes/index.tsx` IS the landing
  page now; `routes/landing.tsx` is a permanent redirect to `/` (preserves `?book=demo|sales`).
- [x] Updated every `/landing` reference: nav (4), footer (4), sidebar (1), legal-layout (2),
  auth-screen (2); redirects in `request-demo.tsx` + `auth.sign-up.tsx`; confirmation-email CTA;
  Docker healthcheck; SEO `sitemap.xml` / `robots.txt` / `llms.txt`.
- [x] Verified: `tsc` clean, `vite build` OK (route tree regenerated), `/` → 200,
  `/landing` → 307 to `/`, both modals show the new field via headless screenshots.

## 🧩 Lead modals redesign + light-only (2026-07-29, session 30)

- [x] Deleted the ProductProof section (`product-proof.tsx` + its `landing.tsx` wiring + stale
  comment in `product-window.tsx`); landing now flows Hero → SocialProof → Coverage → …
- [x] NEW `lead-modal-shell.tsx` — shared two-column dialog frame (branded left panel: HAKKIU
  logo + eyebrow + heading + subtitle + reassurance checklist; form on the right; "handled
  securely" footer). Wider `sm:max-w-3xl`, `p-0` panels, X top-right.
- [x] `book-demo-modal.tsx` + `talk-to-sales-modal.tsx` refactored onto the shell — **fields,
  validation, submit, and API payloads unchanged**. Eyebrows "Book a demo" / "Request a call".
- [x] Removed the light/dark theme toggle everywhere: deleted `theme-toggle.tsx`, stripped it
  from `app-header.tsx` and the inline toggle from `landing-nav.tsx` (Sun/Moon + isDark state).
- [x] Forced light-only: inline guard in `__root.tsx` strips any stale `.dark` class +
  `localStorage.theme` before hydration. Inert `dark:` utility classes left as-is (harmless).
- [x] Verified: `tsc` clean, `vite build` OK, headless screenshots confirm both modals + nav.

## 🎬 Landing sections → reference mockups + motion (2026-07-29, session 29)

Ported the reference `~/Downloads/hakkiu` mockup designs into the real customer landing and
brought each to life. All motion transform/opacity only, once-on-reveal, `prefers-reduced-motion`
safe (new keyframes in `src/styles.css`).

- [x] Shared primitives: `count-up.tsx` (rAF easeOutExpo counter, reuses `useInView`),
  `progress-bar.tsx` (fill-to-width on reveal). `src/styles.css` — `hakkiu-row-in`,
  `hakkiu-sweep`, `hakkiu-blink`, `hakkiu-sheen`, `hakkiu-pulse-soft`, `hakkiu-scan-x`.
- [x] SS1 — `product-window.tsx` animated: HAKKIU logo in titlebar, staggered detection rows,
  live vertical sweep, blinking evidence-hash cursor, sheen takedown CTA, pulsing critical badge.
- [x] SS2 — NEW `social-proof.tsx` (count-up metrics grid + testimonial); wired into `landing.tsx`
  after ProductProof.
- [x] SS3 — `features/index.tsx` rebuilt as a bento grid (AI matcher HAKKIU® vs HAKK1U-Outlet,
  24/7 surveillance animated bars, forensic dossier rows, 1-click enforcement dispatch flow),
  replacing the quadrant/engine diagram.
- [x] SS4 — `workflow.tsx` step cards now carry per-stage preview panels (brand assets uploaded /
  live scan / sealed legal packet) instead of bullet lists.
- [x] Verified: `tsc` clean, `vite build` OK, headless screenshots confirm all four render.
- [ ] Replace placeholder metrics + testimonial in `social-proof.tsx` with verified figures.

## 🎨 Landing page "technical-paper" redesign (2026-07-28, session 27)

Rebuilt `/landing` to the reference mockups in `~/Desktop/redisign` (technical-paper surface,
graphite type, black CTAs, mint accents, two inverse dark sections). All lead/analytics/link
logic preserved.

- [x] CSS system in `src/styles.css` — `.technical-paper` (light) + `.technical-paper--dark`
  (24px dot matrix + faint blueprint guides), `--mint #18c889`, responsive grid density
  (24/22/18px), `hakkiu-scan` / `hakkiu-draw` / `hakkiu-packet` keyframes, all disabled under
  `prefers-reduced-motion`.
- [x] Shared primitives: `reveal.tsx` (`useInView` + `usePrefersReducedMotion` + `<Reveal>`
  once-only, transform/opacity, reduced-motion safe), `blueprint.tsx` (per-section aria-hidden
  SVG overlays), `product-window.tsx` (solid live-monitoring mock reused by hero + proof).
- [x] Hero (`hero-v3.tsx`) — technical-paper, "Protect your brand at internet speed.", Book a
  demo + Talk to sales, trust bullets, product window with single mint scan line.
- [x] NEW `product-proof.tsx` — "See an infringement move from detection to takedown." detect →
  verify → enforce flow + monitoring metrics strip.
- [x] Coverage (`coverage.tsx`) — inverse dark surface, "Every market. Every channel. One
  watchlist.", 12 channel tiles (diagonal reveal wave), "12 channels monitored · 24/7 active".
- [x] How it works (`workflow.tsx`) — "From brand asset to enforced takedown.", 3 steps on a
  process datum line with ghost step numbers; Book a demo + Talk to sales.
- [x] Platform architecture (`features/index.tsx`) — central HAKKIU engine + 4 modules with
  scalable SVG connectors (draw-in + one mint data packet); responsive stacked fallback.
- [x] Risk calculator (`exposure-calculator.tsx`) — kept ALL log-scale math/state; new
  two-column layout: light controls + inverse dark result panel ("Elevated exposure",
  exposure vectors, Get a tailored plan / Talk to sales).
- [x] NEW `final-cta.tsx` — inverse dark "Choose the next step for your brand." two paths
  (mint-highlighted Book a demo + Talk to sales) + trust bar. Replaced the old inline CTA.
- [x] Footer (`footer.tsx`) — "Keep your brand within reach." CTA strip + Product / Company /
  Legal columns (all real links kept, incl. hash anchors) + bottom rail (Legal notice, Cookie
  settings, Vilnius, Lithuania).
- [x] Nav (`landing-nav.tsx`) — links Platform / Coverage / How it works / Security; kept
  sticky-scroll, theme toggle, Talk to sales + Book a demo, all hooked to `useLeadModals()`.
- [x] `routes/landing.tsx` — reordered 8 sections, added ProductProof + FinalCTA, removed inline CTA.
- [x] Validated: `tsc --noEmit` clean, ESLint clean on landing files (2 non-blocking
  react-refresh HMR warnings), `vite build` succeeds. Dev route serves HTTP 200 with correct SSR head.
- [ ] Pending manual QA (owner): visual pass at desktop/tablet/mobile widths; both modals
  open → validate → submit → success → close; keyboard + Escape + reduced-motion.
- Note: old unused files left untouched — `cta.tsx`, `dot-field.tsx`, `features/{detection,case,radar}-panel.tsx`, `features/radar.tsx` (not imported by the new landing).

---

## 📩 Book-a-demo & Talk-to-sales modal redesign (2026-07-28, session 26)

New compact modals matching the provided mockups, with an animated "thank you" success
state and an auto-confirmation email to the lead.

- [x] Added illustrations → `public/thank-you-booking-demo.webp`, `public/thank-you-contacting-us.webp`.
- [x] `src/components/landing/lead-success.tsx` — shared animated success view (illustration →
  title → subtitle → green badge → "Back to HAKKIU" → inbox note; `motion-safe` `animate-in`).
- [x] `src/components/landing/book-demo-modal.tsx` — compact modal (First/Last, Work email,
  Company, Company website, "What would you like to protect?" select, optional notes). Posts
  `source=request_demo`, `tier=professional`; fires GA4 `generate_lead`.
- [x] Rewrote `talk-to-sales-modal.tsx` to the mockup (First/Last, Work email, Company,
  "I'm interested in" select, "How can we help?"). Posts `source=call_request`, `tier=enterprise`.
- [x] `src/components/landing/lead-modals.tsx` — `LeadModalsProvider` + `useLeadModals()` hook
  mounted once at `__root`; both modals open from anywhere without navigation. Auto-opens on
  `?book=demo|sales` and strips the param.
- [x] Retired the `/request-demo` 6-step wizard → `beforeLoad` redirect to `/landing?book=demo`
  (keeps old links / bookmarks / campaigns working).
- [x] Wired every trigger to the hook: hero, nav, landing CTA, cta.tsx, footer, workflow,
  coverage. (about / contact / auth-screen keep the `/request-demo` link → redirect fallback.)
- [x] Backend: `lead_confirmation_html()` (demo vs sales copy) + `_send_lead_confirmation()` now
  emails the lead after submit; friendlier staff-notification subject/labels per source.
- [x] Admin parity: `apps/admin/src/pages/Leads.tsx` `SOURCE_LABELS` → "Book a demo" / "Talk to
  sales" / "Pricing enquiry" (same `sales_leads` table already viewable/editable in admin).
- [x] Robust API error display: `src/lib/api-error.ts` normalises FastAPI string vs Pydantic
  array `detail` (fixes the `[object Object]` message on 422). Added Radix `DialogTitle`/
  `DialogDescription` (incl. sr-only on the success view) to clear the a11y console warning.
- [x] Follow-up tweaks (post-review): enlarged success illustration (`h-36` → `h-52`); added a
  required **Phone number** field to Talk-to-sales (sent as `phone`; already stored + shown in
  staff email and admin lead detail).
- [x] Made the lead endpoint's anti-spam rate limit env-configurable (`LEADS_RATE_LIMIT`,
  default `3/hour`) so local form testing isn't blocked by 429s after a few submits.
- [x] Design polish (subagent-planned): replaced success illustrations with tight-cropped
  LANDSCAPE webp (was 640² squares w/ baked-in white padding); `lead-success.tsx` now renders
  them `h-auto w-64` (no square distortion) with tighter spacing.
- [~] Tried an inline-SVG success art (theme-adaptive) but reverted at owner request; then
  owner supplied TWO webp variants per illustration (black art for light, white art for dark).
- [x] Theme-adaptive success illustrations via owner-supplied assets: `public/thank-you-*-black.webp`
  (light) + `-white.webp` (dark). `LeadSuccess` now takes `illustrationLight`/`illustrationDark`
  and renders both `<img>`s, toggled purely by CSS (`block dark:hidden` / `hidden dark:block`)
  off the `.dark` class on `<html>` — no JS, no flash. Solves the dark-on-dark visibility issue.
- [x] Email ↔ form parity: `new_lead_html` now renders ONLY submitted fields (conditional rows,
  no empty "—" rows) — verified Book-a-demo shows Source/Tier/Name/Email/Company/Website/Primary
  goal/Message; Talk-to-sales shows Source/Tier/Name/Email/Phone/Company/Message. Also fixed a
  latent `{_MUTED}` unescaped-placeholder bug in the old name fallback.
- [x] `tsc --noEmit` clean; `vite build` ✓; backend templates render + import OK.
- [ ] Manual visual QA in a browser (dev servers) — not run this session to avoid triggering
  live Resend emails on submit (RESEND key is live).

---

## 🏷️ Real platform logos (2026-07-28)

Replace the old 1–2 letter colored-square placeholders (e.g. orange "M" for Meta Ads) with real
brand logos across the whole app.

- [x] Generated 12 logo PNGs → `src/images/platforms/` (simple-icons brand marks in brand colors +
  Wikimedia Amazon smile; rendered @256px transparent bg via `sharp`). web-domain = neutral globe.
- [x] `src/lib/platform-logos.ts` — `getPlatformLogo()` normalizer (handles "Meta Ads" / "meta_ads" /
  "meta" / "facebook_marketplace" / "google_ads" / "domains" — lowercase + strip non-alphanumerics).
- [x] `src/components/platform-logo.tsx` — `<PlatformLogo>` white rounded chip + 2-letter fallback.
- [x] Wired customer app: `InfringementAlertFeed.tsx` (removed dead PLATFORM_THEMES), `cases.$caseId.tsx`
  (the INFRINGER METADATA badge from the screenshot), `cases.tsx` table, `monitoring.new.tsx` selector.
- [x] Admin-portal parity: copied PNGs → `apps/admin/src/images/platforms/`; twin `platform-logos.ts`
  + `platform-logo.tsx`; wired `CaseDetail.tsx`, `ScraperHealth.tsx`, `ScraperHealthDetail.tsx`.
- [x] `tsc --noEmit` clean (both apps); customer `vite build` ✓ (10 PNGs emitted, aliexpress+tiktok
  inlined as data-URIs since <4 KB).

---

## 🖼️ Error illustrations (2026-07-28)

Show a per-status illustration + the exact HTTP code whenever a load fails.
Bucket (1xx…5xx or "signal lost" = no response) picks the image; code shown as text.

- [x] `src/lib/api.ts` — new `ApiError` class carries `.status` from non-2xx responses.
- [x] `src/lib/error-status.ts` — `getErrorStatus`/`getErrorBucket`/`getMessage`; network-failure → "signal lost".
- [x] `src/components/error-state.tsx` — central `<ErrorState>` (page/block/inline variants), retry button.
- [x] Wired: `__root.tsx` boundary, `notification-delivery-log`, `InfringementAlertFeed`, `cases.tsx`, `cases.$caseId.tsx`.
- [x] `src/images/errors/` — 6 real 1024×1024 PNGs installed (1xx/2xx/3xx/4xx/5xx/signal-lost.png).
- [x] `tsc --noEmit` clean; `npm run build` ✓ (all 6 images emitted as bundle assets).
- [x] Admin-portal parity: `AdminApiError.status` in `apps/admin/src/lib/api.ts`; copied `error-status.ts`;
  new `apps/admin/src/components/error-state.tsx` (images via `/errors/*` in `apps/admin/public/errors/`).
  Wired into 9 pages (Brands, Organizations, Customers, Cases, Audit, Staff, ScraperHealth, ScraperHealthDetail, Leads)
  + global `defaultErrorComponent` in `router.tsx`. `tsc --noEmit` ✓, `vite build` ✓ (images in dist).

---

## 🔒 SECURITY — Session 22 re-audit (2026-07-28)

Full plan: `security-remediation-plan-2026-07-28.md`. 5-subagent deep audit + manual verify.

**DONE in code (this session):**
- [x] H3 SSRF — `apps/api/.../services/ai.py:494`: added `validate_ssrf_url` + `follow_redirects=False`.
- [x] H2 audit bug — `apps/admin-api/.../routes/leads.py`: fixed wrong `write_audit_log` kwargs (+ real IP).
- [x] M1 fail-open — `apps/api/.../routes/documents.py`: deny-by-default when `infringement_id` is NULL.
- [x] H1 staff takeover — `apps/admin-api/.../routes/staff.py`: super-admin required to change ANOTHER staff's email/password.
- [x] C1 (partial) — redacted the leaked service-role literal from `security-audit.md`. **Still TODO:** purge git history (filter-repo/BFG) + confirm old key revoked in Supabase.
- [x] P0 migration written + validated on throwaway PG16 (exit 0): `supabase/migrations/20260728000002_security_rls_p0.sql`
  — C2 freeze `profiles.organization_id`, C3 scope `evidence_items`, C4 scope `brand_assets`, L4 `user_is_org_member` search_path.

- [x] `supabase db push` — P0 migration APPLIED to LIVE DB (user-authorized 2026-07-28); remote now at 20260728000002. C2/C3/C4/L4 CLOSED on prod.
- [x] Backend tests: 206 pass, 1 pre-existing live-network integration fail (`test_meta_ads_credentials`, unrelated).

**DONE — session 22b (subagent-investigated, implemented + validated):**
- [x] H4 — WITH CHECK added to persona mode-isolation policies (cases/infringements/evidence/takedown_reports)
  via `ALTER POLICY ... WITH CHECK` (USING untouched → zero read risk). Migration `20260728000003_security_rls_h4_h7.sql`.
- [x] H7 — dropped `organization_id = auth.uid()` branch from `brands` policy (verified: create_brand always sets user_id). Same migration.
- [x] M2/M3 — admin-api rate limiting: slowapi added; global limiter in main.py; `request-password-reset`
  now `5/hour` per-IP + `3/hour` per-email in-process throttle. Smoke-tested (5×200 → 429).
- [x] M8 — main-api CORS: localhost origins gated behind `not _is_production`.
- [x] M9 — Caddy: security-header snippet (nosniff/HSTS/Referrer/-Server) added to api. + admin-api. blocks.
- [x] M4 — uvicorn `--proxy-headers --forwarded-allow-ips *` on both Dockerfiles (real client IP for rate-limit keys + audit logs).
- [x] L8 — pinned `appleboy/ssh-action` to SHA + `permissions: contents: read` on ci.yml + deploy.yml.
- [x] L5 — `Leads.tsx` href now uses `ensureAbsoluteUrl`.
- [x] L1 — `clients.py` billing cases count org-scoped (test updated).
- Migration `20260728000003` validated on throwaway PG16 (exit 0). Backend: 206 pass, 1 pre-existing unrelated fail.

**🚨 CRITICAL PROD RLS DRIFT (found during 003 push, 2026-07-28):**
- `supabase db dump` of LIVE prod revealed 4 core tables were CROSS-TENANT OPEN in production
  (files said scoped; reality had broad `allow_all_authenticated`): `evidence`, `takedown_reports`,
  `decisions` (broad-only), `infringements` (broad + scoped → broad wins), `cases` (`cases_own` with
  `user_id IS NULL` leak). `migration list` was in-sync yet the DB did NOT match the files.
- [x] Migration `20260728000003` REWRITTEN into a full reconciliation (drop all broad policies +
  create scoped evidence/takedown/decisions + H4 WITH CHECK on cases/infringements + H7 brands).
- [x] VALIDATED on throwaway PG16 w/ real prod policies + synthetic 2-org data: before=leak (sees 2),
  after=own-only (1 each) + cross-tenant=0 + embeds work. Exit 0.

**DEPLOYED TO PROD (2026-07-28, user-authorized):**
- [x] Code pushed to main (commits 28fc229, 8d421f4) → CI+Deploy ✓.
- [x] Migration `20260728000003` APPLIED to prod (`supabase db push`); re-dump verified all broad
  policies gone, 3 scoped policies present, cases_own + brands org=uid branch removed.
- [x] ⚠️ INCIDENT + HOTFIX: admin-api 502'd after deploy because slowapi was added to pyproject.toml
  but not `uv.lock` (Dockerfile installs `--frozen` from the lock). Symptom: admin portal login →
  "not authorized" (frontend couldn't reach 502'd /staff/me). Fixed by `uv lock` + commit 63827da +
  redeploy. admin-api /health=200 restored. LESSON: always commit uv.lock with any pyproject dep change.

**STILL PENDING (needs deploy / staging / user):
- [x] C5 — `evidence-screenshots` bucket now PRIVATE + signed URLs. DONE + deployed (2026-07-28,
  user-authorized). Backend signer (`sign_screenshot_url` accepts bare paths + legacy URLs), API
  read-signing, new `POST /infringements/screenshots/sign`, admin-api signer, frontend wiring, email
  links to app instead of expiring URLs. Migration `20260728000004` applied. VERIFIED on prod:
  bucket public=False, public URL→400 (cache-busted), signed URL→200. **USER: visual smoke-test the
  screenshots in-app (cases detail, evidence dialog, admin case detail) to confirm end-to-end render;
  rollback = `UPDATE storage.buckets SET public=true WHERE id='evidence-screenshots'`.**
- [x] C1 DONE (2026-07-28) — old key REVOKED (prod REST → 401, dead); HEAD redacted; full git history
  rewritten via `git filter-repo` (literal → `sb_secret_***REVOKED***`) across all commits+branches,
  force-pushed; fresh clone = 0 occurrences. Backup at `../Tracemark-backup.git`. ⚠️ Other devs must
  re-clone/hard-reset; Hetzner deploy self-heals on next `git reset --hard origin/main`.
- [ ] M10 — docker-compose per-service env: assessed NO-GO (too risky for the gain; keep env_file).
- [ ] L9 — admin list_users/limit(1000) pagination: deferred (low priority until customer count grows).

---

## 🔴 OPEN — Follow-ups from recent sessions

### Legal / company pages (session 21 — built; USER ACTIONS remain)
- [x] Wrote 10 footer pages: `/about`, `/contact`, `/legal/{privacy,terms,cookies,acceptable-use,
  dpa,subprocessors,security,imprint}` — GDPR Art 13+14, Art 28 DPA, cookie table, EU imprint.
  Researched via 3 subagents (legal/compliance + competitor footers + codebase map).
- [x] New footer component (`src/components/landing/footer.tsx`) with all legal links + **LinkedIn
  icon/link** (linkedin.com/company/hakkiu); shared `LegalLayout`; added to sitemap.xml + robots.txt.
  tsc + `npm run build` clean; all route chunks generated.
- [x] Requisite placeholders removed (session 21) — company registration fields (entity/code/
  address/VAT/phone) are blank in `company.ts` and the pages omit them; Imprint shows "will be
  published once finalized" instead of placeholders.
- [x] **USER ACTION — create email aliases** (forwards): `privacy@`, `legal@`, `security@`,
  `support@` `hakkiu.com` (the pages now reference these; `info@` is used for general enquiries).
- [ ] **USER ACTION — add company requisites** in `src/lib/company.ts` once incorporation is final:
  legal entity name, legal form, registration code (juridinio asmens kodas), registered address,
  VAT number, phone. One place updates all pages (Imprint auto-reveals the rows).
- [ ] **USER ACTION — lawyer review** of all legal pages before relying on them (templates, not advice).
- [x] **Cookie consent banner + Google Consent Mode v2 (session 25)** — GA4 no longer fires
  unconditionally. `<head>` sets `gtag('consent','default', …)` all-denied (Basic mode); gtag.js
  is injected only after opt-in (`src/lib/consent.ts`). Region-gated via Cloudflare `cf-ipcountry`
  (`src/lib/consent-region.ts` server fn) — banner shows only in EEA/UK; elsewhere analytics is
  auto-enabled. Banner (`src/components/consent/consent-banner.tsx`) has equal-prominence "Reject
  all" / "Accept all" + "Customise" toggle; choice persisted in localStorage (proof of consent);
  GPC/Do-Not-Track honoured as reject; footer "Cookie settings" re-opens it. GA ID moved to
  `VITE_GA_MEASUREMENT_ID`. Cookie Policy copy updated to match. (No admin-portal parity: consent
  lives client-side in localStorage, not in customer DB.)

### Book-a-demo / auth

### Book-a-demo / auth
- [x] **Frontend hardened to sign-in only** (session 20) — removed the dead-but-live
  `supabase.auth.signUp()` path from `src/components/auth/auth-screen.tsx` (now sign-in only,
  `AuthScreen` signature dropped `initialMode`); landing CTA changed "Start Monitoring Free" →
  "Book a Demo" (`/request-demo`). Typecheck clean.
- [x] `supabase/config.toml` — `enable_signup = false` in `[auth]` and `[auth.email]` (local parity).
- [ ] **USER ACTION (prod enforcement — the only complete fix):** Supabase **Dashboard →
  Authentication → Sign In / Up → turn OFF "Allow new users to sign up"**. Frontend/config changes
  are defense-in-depth only; a direct `POST /auth/v1/signup` with the public anon key is still
  accepted until this dashboard toggle is off. Cannot be done from here — no `SUPABASE_ACCESS_TOKEN`
  in `.env` for the Management API.
- [x] Forward migration **written**: `supabase/migrations/20260728000001_drop_billing_tables.sql`
  (drops `subscriptions`, `subscription_addons`, `invoices`, `stripe_events`,
  `org_entitlement_overrides` + `org_settings.stripe_customer_id`; keeps `profiles.plan` + its
  protection trigger — that trigger also guards `is_admin`). Verified zero app-code references.
- [x] Migration **applied to prod** (session 20) via `supabase db push` — verified: all 5 tables
  + `org_settings.stripe_customer_id` gone; `profiles.plan` + `is_admin` + protection trigger kept.
- [x] E2E demo-form submission **verified** (session 20) — POST `/api/v1/leads` → 201,
  row persisted in `sales_leads` with all v3 fields (arrays incl.), staff email really sent via
  Resend (routed to a test inbox to avoid founder spam), test row deleted afterward. Admin `/leads`
  reads the same table filtered by `status='pending'`, so the row surfaces there.

✅ **CI auto-deploy is LIVE** (fixed 2026-07-28 ~05:25 UTC) — the four `SSH_*` secrets
(`SSH_HOST`/`SSH_USER`/`SSH_PORT`/`SSH_KEY`) are set on the repo, so every green push to `main`
auto-deploys to Hetzner via the `Deploy` workflow (chains on CI success → SSH `git reset --hard`
+ `docker compose build && up -d` + Caddy restart). Verified: all deploys since 05:25 succeed;
commit `5679df9` deployed clean, all 4 domains 200. No more manual SSH deploys needed.

---

## 🟡 Landing page (nice-to-have trust signals)
- [ ] `src/components/landing/pricing.tsx` — social proof bar: "Trusted by X brands" +
  3 short testimonial placeholders. Every competitor has this; absence looks suspicious.
- [ ] `hero-v3.tsx` — A/B test benefit-first headline "Stop counterfeits from killing your
  brand revenue" vs "Detect infringements before they spread".

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

## 🟡 PRIORITY 3 — Resend Email (remaining)

> Tier 1 transactional, weekly digest, welcome + first-detection, and day-0 dunning are all DONE.

- [ ] **USER ACTION:** verify `hakkiu.com` domain in Resend (SPF+DKIM DNS), replace
  `RESEND_API_KEY` placeholder in `.env` with the real key.
- [ ] **USER ACTION:** wire Supabase Auth → Resend SMTP relay (host `smtp.resend.com`, port 465,
  user `resend`, pass = API key).
- [ ] Admin portal parity: `GET /admin/email-logs` endpoint + `EmailLogs.tsx` page.
- [ ] Onboarding: "First takedown nudge" (48h scheduler) + "Day-14 nudge" (14-day scheduler).
- [ ] Dunning follow-ups: "Payment failed — day 3 + day 7" scheduler.

---

## 🟡 PRIORITY 4 — Production (remaining post-deploy)

> Live on Hetzner CCX13 (116.202.8.87); all 5 domains on HTTPS via Caddy + Let's Encrypt.

- [x] **Supabase Auth URLs** — Site URL `https://hakkiu.com`; Redirect URLs `https://hakkiu.com/**`,
  `https://admin.hakkiu.com/**`; enable Confirm email.
- [ ] Functional test: sign in on customer app → run a scan (API + Supabase + scraping E2E).
- [ ] Backups: `apt install postgresql-client`, set `DATABASE_URL` in .env, cron
  `15 3 * * * /opt/hakkiu/scripts/backup.sh`.
- [ ] Optional: set `GOOGLE_SERP_API` / `SEARCHCANS_API` in .env (blank → those scraper sources inactive).
---

## 🟡 PRIORITY 6 — Scraper Health (remaining)

> Reachability probe, failure log, admin dashboard + per-platform drill-down all DONE.

- [ ] Manual audit: test all 12 platforms locally and confirm parsers still work (manual QA).
- [ ] Optional: Slack/SMTP push alerting for degraded platforms (currently in-page warnings only).

---

## 🟡 PRIORITY 7 — Phishing Site Detection + Domain Takedown Pipeline
- [ ] Extend WHOIS domain surveillance with newly-registered lookalike domain detection
- [ ] Add MX record detection for phishing-capable domains
- [ ] Automated ICANN/registrar abuse report submission
- [ ] Surface phishing cases in the customer dashboard (separate from marketplace counterfeits)
- [ ] Admin portal parity: phishing cases view + management

---

## PRIORITY 8 — Multi-Model AI Routing
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

## PRIORITY 12 — SEO & Web Analytics (remaining)

> GA4 tag, robots.txt, sitemap.xml, llms.txt all DONE (session 17).

- [ ] Google Search Console: DNS verification, monitor organic keyword queries, impressions, CTR
- [x] Conversion tracking: GA4 `generate_lead` event on demo/lead submit (session 25) —
  `src/lib/analytics.ts` (consent-aware `trackEvent`/`trackLead`), wired into `request-demo.tsx`.
  TODO in GA4 UI: mark `generate_lead` as a key event (conversion).

---

## PRIORITY 13 — UI Case / Alert Decoupling (Patrick's Review)
- [ ] Customer FE: decouple scan results into individual UI cases — each infringement as an
  independent card with per-item actions (takedown, escalate, whitelist, dismiss)
- [ ] Patrick's frontend review: UI cleanups and adjustments as advised
- [ ] Patrick's backend review: route cleanup, refactoring, test stabilization

---

## PRIORITY 14 — Advanced Logo & Image Similarity
- [ ] `embedder.py` — CLIP embeddings replacing pHash for robust visual matching; evaluate
  DeepSeek-VL / Qwen-VL vs OpenAI/Gemini for price-performance
- [ ] `gemini_check.py` — wire `generate_evidence_analysis` into Tier 2 pipeline for Gemini
  Vision adjudication (1 call per copycat screenshot, after Tier 0/1 filters)
- [ ] CV-based logo cropping — Gemini-based or OpenCV/YOLO logo region extraction before embedding

---

## Backlog / future
- [ ] MFA + domain-restricted logins for admin staff
- [ ] Consumption-based pricing tier (pay-per-takedown via Stripe metered billing)
- [ ] China domestic platform coverage (Pinduoduo, Goofish, WeChat, Douyin)

---

## Recently completed (reference — full detail in git log)

- **Session 28** — Public-site frontend polish: page-wide animated grid backdrop; rainbow "Book a demo"
  CTAs (21st/magicui) across nav/hero/workflow/final-cta/footer; Coverage → scrolling logo Marquee
  (21st/magicui) with real platform logos; ProductProof duplicate cards → compact process ribbon;
  `legal-layout` upgrade (auto TOC + scrollspy, responsive/zebra tables, heading hierarchy, `<code>`,
  back-to-top) lifting all 10 legal pages; About + Contact rebuilt off the legal template as marketing
  pages; nav reorder. Coverage made light (was dark) with masked marquee edges (no seam). ALL
  user-facing errors made friendly — error boundary ("Signal lost") no longer prints error.message,
  lead modals show "Connection lost…" on network fail, every app-route toast dropped raw err.message.
  Planned/executed via 6 subagents. Remaining: landing de-dup (Workflow/Features),
  Features mobile diagram, re-run with 21st MCP loaded live.
- **Session 18** — Admin Portal: create company + owner + users end-to-end (`POST /organizations`,
  CreateOrgDialog, CreateUserDialog); verified live against Supabase with full cleanup.
- **Session 17** — GA4 tag site-wide; SEO/crawler files (robots.txt, sitemap.xml, llms.txt); CSP updated.
- **Session 16** — Enriched book-a-demo wizard (4→6 steps, 8 new lead fields) + admin `/leads` parity + nav cleanup.
- **Book-a-demo pivot** — removed all pricing/Stripe/plan-gating (customer FE, main API, admin);
  staff create logins via admin; access = having a login. Stripe leftovers purged (CSP, env, deps, docs).
- **Per-copycat cases** — one case row per copycat in customer FE; multi-region scan fix (regions
  now forwarded to scraper; per-item `detection_region`).
- **Security hardening (2026-07-22 audit)** — all Phase 0–3 code fixes done (service-role key rotated,
  IDOR/SSRF fixes, rate limiting, security headers, password policy, internal-route IP allowlist, etc.).
- **Architecture refactor** — debug script removed, pytest in CI, `conftest.py`, `get_current_profile`
  migration, async/sync cleanup, Zustand↔Supabase `serverId` sync.
- **Admin Portal (PRIORITY 5)** — Brands page, Integrations, sortable/filterable/error-state lists,
  CopyableId, audit links, Delete Customer, Add Member, Dashboard MRR + takedown KPIs, bulk case actions.
- **Resend email** — Tier 1 transactional, weekly digest, welcome + first-detection, day-0 dunning.
- **Scraper health** — reachability probe, failure log, admin dashboard + per-platform drill-down.
- **Production deploy** — 4 Dockerfiles, docker-compose + Caddy, DNS, server hardening; live on Hetzner.
- Core features §1–§9 (scrapers, AI, takedowns, geo scanning, law firm mode); org multi-member schema.
