# HAKKIU — TODO

> Live checklist of **OPEN work only**. The full completed session-by-session history was archived
> to `docs/.roadmap/todo-archive.md` (and lives in git log) when this file was trimmed.
> Last cleaned: 2026-07-30 (session 42). Feature-by-feature status: `docs/.roadmap/roadmap.md`.
>
> **How to keep this tidy:** tick items when done; when a whole batch/feature completes, move its
> detail to the archive and leave a one-liner under "Recently completed" below.

---

## 🚧 USER ACTIONS (external — need Martynas / credentials / dashboards)

### Company / legal
- [ ] Fill company requisites in `src/lib/company.ts` once incorporation is final (legal entity name,
  legal form, reg code, registered address, VAT, phone). One edit updates all legal pages + Imprint.
- [ ] Lawyer review of all 10 legal pages before relying on them (templates, not advice).

### Production / ops
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
- [ ] **USER ACTION — create the 2 Slack webhooks & give me the URLs.** api.slack.com/apps → create
  app → Incoming Webhooks → add one webhook to `#leads-demo`, another to `#leads-call`. Then I set
  `SLACK_WEBHOOK_DEMO` / `SLACK_WEBHOOK_CALL` in root `.env` (dev) + you set them on the Hetzner
  server `.env`, restart the main API. Until set, the feature is a safe no-op.

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
