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
- [ ] Admin parity: `GET /admin/email-logs` endpoint + `EmailLogs.tsx` (the `notification_deliveries`
  table is already logged; just needs an admin-facing view).
- [ ] Onboarding nudges: "first takedown" (48h) + "day-14" schedulers.
- [ ] Dunning follow-ups: payment-failed day-3 + day-7 schedulers.

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
- [ ] Social-proof bar "Trusted by X brands" + testimonials (was removed as unverified — needs real data).
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
