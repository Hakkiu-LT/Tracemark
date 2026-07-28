# HAKKIU — TODO

> Tick items as they are completed. Add new items as they are discovered.
> Last updated: 2026-07-28 (session 19 — closed session-18 admin onboarding follow-ups)

---

## 🔴 OPEN — Follow-ups from recent sessions

### Book-a-demo / auth
- [ ] Supabase → Auth → **disable public sign-ups** (staff-created logins only; otherwise
  anyone can self-register and get full access — the old plan gate is gone).
- [ ] Optional: drop unused billing tables + `profiles.plan` protection trigger via a forward
  migration (SQL FILES kept as DB history; tables are unused, not referenced).
- [ ] Optional: E2E test one demo-form submission (verify row in admin `/leads` + staff email).

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
- [ ] Conversion tracking: custom GA4 events (demo requested, lead submitted)

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
