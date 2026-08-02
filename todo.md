# HAKKIU — TODO

> Live checklist of **OPEN work only**. The full completed session-by-session history was archived
> to `docs/.roadmap/todo-archive.md` (and lives in git log) when this file was trimmed.
> Last cleaned: 2026-07-31 — removed the redundant session-by-session DONE detail (26→22) and a
> duplicate open-work structure; all of it survives in git log + the one-liners below. Feature-by-feature
> status: `docs/.roadmap/roadmap.md`.
>
> **How to keep this tidy:** tick items when done; when a whole batch/feature completes, move its
> detail to the archive and leave a one-liner under "Recently completed" below.

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
- [ ] api.slack.com/apps → your existing app → Basic Information → copy **Signing Secret**.
- [ ] OAuth & Permissions → add bot scope `chat:write` → Install → copy **Bot Token** (`xoxb-…`).
- [ ] Interactivity & Shortcuts → ON → Request URL: `https://<api-domain>/api/v1/slack/interactions`.
- [ ] Put `SLACK_SIGNING_SECRET` + `SLACK_BOT_TOKEN` in root `.env` (dev) AND Hetzner `.env` (prod),
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

**⏳ Optional follow-ups (not blocking, lower ROI):**
- [ ] Run a real Lighthouse-mobile before/after on prod to quantify LCP/TBT gain.
- [ ] Investigate workerd cold-start TTFB on Hetzner (only code-side fix left if server response is slow).
- [ ] Consider code-splitting below-the-fold landing sections (React.lazy) — minor, main chunk is now framework baseline.

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
