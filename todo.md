# HAKKIU — TODO

> Live checklist of **OPEN work only**. The full completed session-by-session history was archived
> to `docs/.roadmap/todo-archive.md` (and lives in git log) when this file was trimmed.
> Last cleaned: 2026-07-30 (session 42). Feature-by-feature status: `docs/.roadmap/roadmap.md`.
>
> **How to keep this tidy:** tick items when done; when a whole batch/feature completes, move its
> detail to the archive and leave a one-liner under "Recently completed" below.

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
- [ ] **Manual (user):** replicate the 4 alias webhooks (+ SLACK_WEBHOOK_EMAIL + IMAP_*) into the
  **prod** `/opt/hakkiu/.env` on Hetzner and `docker compose restart api`.

## 🎫 Per-copycat status workflow — Jira-like case control (2026-07-29, session 40) — ✅ DONE

> User ask: change each case's status (analyzing, complete, …) inside the case AND have it
> reflected when leaving/returning to the /cases tab — per-copycat control like Jira tickets.
> ROOT CAUSE found: prod DB still had the ORIGINAL `CHECK (status IN ('flagged','reviewed',
> 'dismissed'))` (migration 20260706000001 dropped it, but a later schema sync re-created it).
> The API's fallback map then stored `reviewed`/`dismissed` while returning the requested status
> in the PATCH response — detail page looked right, list (DB truth) never matched.
- [x] Migration `20260729000001_infringements_status_workflow.sql`: drop stale CHECK + re-add with
  the full canonical set (pending/flagged/analyzing/active/reviewed/escalated/takedown_sent/
  complete/completed/resolved/declined/safe/dismissed/error). **Pushed to prod** (`supabase db push`);
  verified: analyzing/complete persist, bogus values rejected (23514), test row reverted.
- [x] `apps/api/.../routes/infringements.py` PATCH status: validates against
  `ALLOWED_INFRINGEMENT_STATUSES` (422 on unknown), removed STATUS_FALLBACK_MAP + the
  `flat["status"] = payload.status` response override — response is now the row as stored.
  Kept only the decline_reason-missing-column retry.
- [x] New shared `src/components/cases/CaseStatus.tsx`: alias normalization (reviewed→analyzing,
  dismissed→safe, …), `CaseStatusBadge`, and `CaseStatusSelect` — Jira-like colored pill dropdown
  (Pending / In Analysis / Escalated / Completed / Safe / Rejected) that PATCHes the API, spins
  while saving, toasts, and merges the result into list state instantly.
- [x] `src/routes/cases.tsx`: status column now uses `CaseStatusSelect` per row (both Pending
  Review + Triage History tables); status filter options, status sort and the pending/other split
  all use the same normalized keys (legacy aliases group correctly).
- [x] Admin parity: `apps/admin/src/pages/CaseDetail.tsx` `INFR_STATUS` → same workflow set
  (was flag/reviewed/dismissed only); admin-api PATCH already existed with audit log.
- [x] Verified: customer `tsc` 0 + `vite build` 0; admin `tsc` 0; backend `py_compile` OK; eslint
  on touched files = only pre-existing repo-wide CRLF/prettier noise + 1 pre-existing `any`.
- [x] FOLLOW-UP (same session) — `/cases/$caseId/takedown` "Case not found" bug FIXED: the page
  still read the legacy zustand mock store (`useStore.infringements`, only populated by the old
  monitoring flow with local `i<timestamp>` IDs), so EVERY real DB-backed case rendered
  "Case not found.". Rewrote the page on real data: loads via `getInfringementById` (same
  react-query key as the detail page → instant from there), letters drafted from real
  brand/platform/URL, evidence sidebar shows the real signed screenshot (or the designed
  empty-state) + real metadata (no more hardcoded googleusercontent image / fake seller/IP/price /
  Alibaba-AliExpress copy); removed inert toolbar buttons + dead "attach files" button; "Send via
  Webhook" now actually POSTs the notice JSON (was mock that never fetched); Download-PDF and
  webhook success persist `takedown_sent` via `updateInfringementStatus` (was local-store-only)
  with the same query invalidations as the detail page; loading skeleton + `<ErrorState>` replace
  the fake not-found. Admin parity: no new admin work — status flows through the same endpoint
  already editable/audited in admin; documents land in the same `documents` table admin lists.
  Verified: `tsc` 0, `vite build` 0.
- [x] FOLLOW-UP 2 (same session) — platform reporting link restored + dashboard Active fixed:
  - [x] New `src/lib/platform-reporting.ts` — frontend mirror of the backend `PLATFORM_REGISTRY`
    (takedown.py): per-platform official reporting URL / abuse email / method (web_form | email |
    udrp), with alias normalization ("Meta Ads"→meta_ads, "Facebook Marketplace"→facebook,
    "web_domain"/"domains"→ICANN UDRP). Resolver smoke-tested against 12 platform variants via tsx.
  - [x] `/cases/$id/takedown`: new "Submit to the platform" card in the sidebar — "Go to reporting
    page" deep-link (or mailto abuse contact / UDRP guidance) + "Mark as Submitted" button that
    persists `takedown_sent` (disabled when already sent).
  - [x] Dashboard "Active infringements" metric: was only `flagged`/`active` → now counts every
    copycat NOT closed (anything except safe/complete/rejected, aliases normalized via
    `normalizeStatusKey`); sub-label → "not yet closed".
  - [x] Dashboard live feed aligned: status filter offers the 6 canonical workflow statuses with
    real badges (was stale flagged/reviewed/dismissed), filtering uses normalized keys, rows show
    `CaseStatusBadge` instead of raw status text.
  - [x] Verified: `tsc` 0, `vite build` 0.
- [ ] USER: restart the main API (uvicorn has no --reload) to pick up the backend change, then
  click-test: set a status in the list / detail → visit another tab → back to /cases → persists;
  and open Generate Takedown Notice from any case.

---

## ♻ Cross-scan scrape cache + copycat dedup (2026-07-30, session 41) — ✅ DONE (committed: `6ac1a88`, merged via PR #97)

> User ask: keep a local cache so we don't re-scrape the same URLs across scans and waste
> resources; re-scans shouldn't re-add copycats that already have an open case until that case is
> marked Complete/Rejected; a case marked Safe should never be scraped/detected again for that brand.
> ✅ **Prod migration drift RESOLVED** (2026-07-30): cleaned up via `supabase migration repair`.
> (Was: `supabase migration list` showed remote-only `20260730000002..000005` + a collision on
> `20260730000001`, blocking `db push`; scrape_cache table had been created directly via
> `supabase db query --linked` as a stopgap.) The migration file
> `20260730000006_scrape_cache.sql` is idempotent (`CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF
> EXISTS`) and now committed.
- [x] `services/scrape_cache.py`: in-mem LRU (512) → `scrape_cache` table → live; 24h TTL via
  `SCRAPE_CACHE_TTL_HOURS`; stores markdown+title+scraper (not raw HTML — keeps rows small); URL
  normalizer (lowercase host, drop `www `, default port, fragment, sort query) so equivalent pages
  share one cache key even across token rotation.
- [x] `unified_scraper.py`: `get_cached` at the top of `scrape()` (the single chokepoint every
  per-platform scraper uses — Amazon/Ebay/Alibaba/Etsy/AliExpress/Shopify/Facebook/TikTok/
  Instagram/Google Shopping/Meta Ads/Google SERP all call it); `put_cached` at the success return
  of `_scrape_static` and `_scrape_js`; added `from_cache: bool` to `UnifiedScrapeResult`. The
  existing 24h in-mem `_js_cache` kept as a hot negative-cache layer.
- [x] `persistence.py`: `_find_open_infringement` checks across ALL the org+brand's cases for an
  existing infringement at the same `source_url` whose status is NOT in
  `(complete, completed, resolved, declined)`. If found → return the existing infringement id and
  skip the upsert + skip the "new infringement" notification. Safe/dismissed are not terminal →
  block forever (until the user changes status, e.g. via Re-analyze → Complete). Verified on prod
  against the live `analyzing` row `005b5eb0…`.
- [x] Verified: full 203-test pytest suite + frontend build pass; `py_compile` on all three
  modules; prod DB round-trip (cache write/read) + skip-query sanity check (returns the open
  infringement). Admin parity not needed: scrape_cache is infra (RLS deny-all, service-role only);
  the skip reuses the existing `infringements.status` column already editable/audited in admin from
  session 40.
- [x] Deployed: committed `6ac1a88`, merged via PR #97; Hetzner Deploy pipeline run `30579642682`
  succeeded 2026-07-30 20:32 → API container rebuilt/restarted with the new cache module (no manual
  uvicorn restart needed).
- [ ] USER (smoke test): re-scan a brand whose previous scan already produced infringements —
  confirm duplicates aren't re-added and a re-scan of a Safe URL never re-creates it.

---

## Brand + domain sweep: Tracemark → HAKKIU / hakkiu.com (2026-07-29, session 39)

> Scope confirmed with Martynas: change USER-FACING brand text + domains only. Internal Python
> package names (`tracemark_api`, `tracemark_admin_api`) and infra identifiers KEPT (renaming them
> is a separate risky refactor). Customer app (`src/`) + main API were already ~95% HAKKIU.
- [x] Runtime CSP fixed: `public/_headers` (`api.tracemark.ai`→`api.hakkiu.com`) and
  `apps/admin/public/_headers` (`admin-api.tracemark.ai`→`admin-api.hakkiu.com`).
- [x] Admin CORS/reset origins: removed legacy `admin.tracemark.ai` from `admin-api/.../main.py`
  and `routes/auth.py` (canonical `admin.hakkiu.com` already present).
- [x] `apps/admin/wrangler.jsonc`: route pattern + zone comment → `admin.hakkiu.com` / `hakkiu.com`.
- [x] Brand text: `main_api.py` docstring, `pyproject.toml` description, admin `styles.css` comment,
  `supabase.ts` comment → HAKKIU / hakkiu.com.
- [x] Test fixtures `@tracemark.io` → `@hakkiu.com` (conftest, usage-tracker, takedown-reports).
- [x] Docs/domains updated: README, CLAUDE.md, plan.md, todo.md, roadmap.md, apps/admin/README, Caddyfile.
- [x] SEO `sameAs` in `__root.tsx` Organization schema now includes Facebook (LinkedIn + Instagram
  + Facebook), all sourced from `src/lib/company.ts`.
- [x] Verified: 0 remaining `tracemark.(ai|io|com)` domains; edited Python files py_compile OK.
- [ ] KEPT ON PURPOSE (rename later if desired): python pkgs `tracemark_api`/`tracemark_admin_api`,
  docker image/network names, `tracemark-admin` npm/worker name, localStorage/auth storageKeys,
  `supabase/config.toml` project_id, repo folder + git-backup name.

---

## ⚠️ REMOVED all competitor comparison pages (2026-07-29, session 38) — legal-risk call

> Decision by Martynas: delete every "vs competitor" comparison page and any content that names
> other companies, to avoid any trademark/defamation/legal exposure. Better safe than sorry. This
> UNDOES the A-group + B-group comparison work below (the /solutions/* pages stay — they name no
> competitors). Keeping the A/B sections below as history; current state is: NO compare pages exist.
- [x] Deleted route files: `compare.red-points.tsx`, `compare.brandshield.tsx`, `compare.corsearch.tsx`,
  and the shared `compare-page.tsx` component (its only callers were those three).
- [x] Removed 3 compare paths from `PUBLIC_PATHS` in `__root.tsx`; `routeTree.gen.ts` regenerated
  by build (0 compare refs).
- [x] Removed the 3 "vs …" links from `footer.tsx` SOLUTIONS_LINKS (column now: brand owners + law firms).
- [x] Reworded homepage FAQ (`faq.tsx` "How does HAKKIU compare…") to NOT name Red Points /
  BrandShield / Corsearch — generic "enterprise suites down to point tools" instead.
- [x] `solutions.brand-owners.tsx` + `solutions.law-firms.tsx`: removed the `/compare/*` interlinks
  and reworded the surrounding copy (they now cross-link only to each other).
- [x] `sitemap.xml`: removed 3 compare `<url>` entries. `robots.txt`: removed `Allow: /compare/`.
  `llms.txt` v1.3 → v1.4: removed the 3 compare entries + reworded law-firms line (dropped
  "trademark monitoring" → "marketplace and domain monitoring").
- [x] Verified: `build` 0, `tsc` 0, `routeTree.gen.ts` has 0 compare refs, and a repo-wide grep of
  `src`+`public` finds NO "Red Points / BrandShield / Corsearch / /compare/" anywhere. Local SSR:
  compare URLs no longer render the comparison page; both solutions pages render clean; homepage clean.

---

## SEO B-group — content depth + humanized copy (2026-07-29, session 38) — ✅ DONE (compare parts later REMOVED — see top)

> The deeper follow-up to A-group: the SXO/GEO/content subagents all pointed at one gap —
> the compare/solution pages were too thin (~400–620 words) with no question-headings, no FAQ,
> no "who should choose the competitor" section. B-group fixes that. User's hard requirement:
> copy must read HUMAN, not AI slop. There is no dedicated "humanize" skill in the system, so I
> wrote the prose myself and ran TWO adversarial reviewer subagents — one hunting AI tells
> (em-dashes, template symmetry, rule-of-three, cliché transitions), one fact-checking every new
> claim against the truthfulness rules — then revised on their findings. Marketing-site content
> only → no Admin Portal parity needed.
- [x] `compare-page.tsx`: extended `ComparePageData` with `verdict` + `faqs` (new `CompareFaq`
  type); added three sections — "So which one should you pick?" (Stay-with-X / Look-at-HAKKIU),
  a shared "Questions to ask on any demo" list (`BUYER_QUESTIONS`), and a visible FAQ.
- [x] All 3 compare pages rewritten: real FAQ (4 Q&A each) + FAQPage JSON-LD, honest "pick this
  one if…" verdict, table rows reordered to lead with HAKKIU strengths and end on the honest
  gaps (early-stage / scale). Word count ~410 → ~1120–1160.
- [x] Both solutions pages expanded: law-firms gained a "how a client matter moves" 4-step
  walkthrough + a "what legal-review-ready actually means" evidence section + FAQ; brand-owners
  gained a "what that looks like on each channel" section (marketplaces/domains/social) + FAQ.
  Both got FAQPage JSON-LD. Word count ~500 → ~850–980.
- [x] Humanization pass (adversarial AI-tell reviewer, rated copy 6–8/10 "genuinely good, not
  slop"): rewrote corsearch fairAssessment to break the 3-page template symmetry (lead with the
  buyer, not the vendor); cut the "not X, it's Y" antithesis fragment; removed "It is worth
  asking" hedge; killed the generic "reactive scramble into a…process" and "evidence and workflow
  a legal team needs to act" tails; fixed a broken rule-of-three; de-duplicated a repeated triple;
  trimmed em-dash density and one extra "AI-native".
- [x] Truthfulness pass (adversarial fact-checker): law-firms hero + meta no longer say "monitor
  trademarks" (implied trademark *watching*, a competitor strength) → "monitor marketplaces and
  domains"; softened two "around the clock" claims to "continuously" (no unbacked 24/7 guarantee).
  No invented social proof, no published prices, flat-fee framed as parity with Red Points — all clean.
- [x] Verified: `tsc` 0, `build` 0, local SSR — all 5 pages 1 H1, WebPage+BreadcrumbList+FAQPage
  JSON-LD valid (4 Q each), breadcrumb still 2-level, law-firms meta desc trimmed to ≤152.
  Post-deploy: re-run SXO + content subagents on prod to quantify the jump.

---

## SEO A-group — quick truthful wins on the new pages (2026-07-29, session 38) — ✅ DONE

> Re-ran 5 SEO subagents (technical 74, schema 78, GEO 52, SXO 41) against the live compare/solution
> pages. "A group" = the fast, no-fabrication fixes they surfaced. Marketing-site meta/static only →
> **no Admin Portal parity needed**. Bigger "B group" (content depth, question-headings, FAQPage schema,
> 900+ word expansions) deferred to a later session.
- [x] **og:description + twitter:title + twitter:description** added per page on all 5 new routes
  (were inheriting the generic sitewide fallback). `compare.{red-points,brandshield,corsearch}.tsx`,
  `solutions.{law-firms,brand-owners}.tsx`.
- [x] **og:title** on both solutions pages fixed: was short "HAKKIU for Law Firms / Brand Owners"
  (lost the keyword) → now the full keyword-rich `TITLE`.
- [x] **Meta descriptions trimmed to ≤155 chars** (were 167–203, truncating in SERPs). Verified:
  red-points 151, brandshield 146, corsearch 142, law-firms 149, brand-owners 150.
- [x] **BreadcrumbList fix** — position 2 & 3 both pointed at the leaf URL (invalid, could suppress
  rich result). Collapsed to a valid 2-level crumb: Home → page. All 5 pages.
- [x] **WebPage JSON-LD** — added `datePublished` / `dateModified` / `author` (@id → #organization)
  on all 5 pages (freshness + authorship signals for AI/search).
- [x] **robots.txt** — added explicit `Allow: /solutions/` + `Allow: /compare/` to the `*` block
  (were only implicitly allowed).
- [x] **llms.txt v1.2 → v1.3** — added all 5 new pages to the Public-pages index (AI systems use it
  to discover content; the highest-value comparison pages were missing).
- [x] **Caddyfile** — trailing-slash redirect forced from TanStack's temporary **307 → permanent 301**
  (`@trailingSlash path_regexp ^(.+)/$` → `redir … permanent`; root `/` excluded). Prod-only; Caddy
  reload is atomic so a bad config can't cause downtime.
- [x] Verified: `tsc --noEmit` 0, `npm run build` 0, local SSR curl on all 5 pages — unique
  og/twitter, ≤155 desc, 1 H1, 2-item breadcrumb (no dup URL), WebPage dates+author all present;
  robots.txt + llms.txt serve the updates. Post-deploy: subagents re-verify on prod.

---

## Site edits — Facebook link + HQ city (2026-07-29, session 37) — ✅ DONE

- [x] Footer: added Facebook social icon (`COMPANY.facebook` → profile 61592029420493), same style as LinkedIn/Instagram (`src/lib/company.ts` + `src/components/landing/footer.tsx`).
- [x] HQ city Vilnius → **Kaunas** everywhere in customer-facing copy (8 refs): `footer.tsx`, `about.tsx`, `compare.{red-points,corsearch,brandshield}.tsx`. Audited with subagent. Left unchanged (correctly): VDAI supervisory authority + "Republic of Lithuania" governing law/jurisdiction (neither names Vilnius). `company.ts` address block still blank. Internal docs (plan/todo history) left as-is.
- [x] Verified: no "Vilnius" left in `src/`; `tsc --noEmit` exit 0.

---

## Admin — Delete Sales Leads (2026-07-29, session 37) — ✅ DONE

> Staff can now delete sales leads from `admin.hakkiu.com` → Sales Leads. Full portal parity.
- [x] Backend perm `leads.delete` added to `apps/admin-api/.../permissions.py` (+ `sales` role preset; `admin` inherits via ALL).
- [x] Backend `DELETE /leads/{lead_id}` in `routes/leads.py`: `require_permission("leads.delete")`, 404 if missing, hard-delete `sales_leads`, `write_audit_log("leads.delete", ...)`.
- [x] Frontend perm mirror `leads.delete` in `apps/admin/src/lib/permissions.ts` (+ `sales` preset — kept in sync).
- [x] `Leads.tsx`: trash button in Actions column gated by `leads.delete`, `useConfirm` destructive dialog, toast, cache invalidation. Actions column now shows when `canEdit || canDelete`.
- [x] Verified: admin-api imports OK, admin FE `tsc --noEmit` clean.

---

## PRIORITY 13 — SEO audit fixes (2026-07-29, session 33)

> Source: `/seo audit https://hakkiu.com/` → Health Score **58/100**. These are marketing-site /
> meta / static-content changes only → **no Admin Portal parity needed** (no customer data touched).
> Do Sprint 1 first (all code, no external deps). Sprints in `plan.md`.

### Sprint 1 — code fixes (no external deps) — ✅ DONE (session 33)
- [x] **C1** Removed the whole SocialProof section (per user: "remove this section"). Deleted
  `src/components/landing/social-proof.tsx` + `src/components/landing/count-up.tsx` (dead — was
  its only caller), removed import + render from `index.tsx`, renumbered section comments.
  Verified: 0 refs remain; fabricated 1,842 / 99.4% / testimonial gone from rendered SSR.
- [x] **C2** JSON-LD via TanStack built-in `{"script:ld+json": {...}}` meta (renders in `<head>`,
  SSR-safe, auto-escaped — confirmed by subagent investigation):
  - [x] `__root.tsx` — Organization + WebSite `@graph`, facts imported from `src/lib/company.ts`
  - [x] `index.tsx` — SoftwareApplication (NO offers/price — contact-only pricing)
  - [x] `about.tsx` — AboutPage + BreadcrumbList · `contact.tsx` — ContactPage + BreadcrumbList
  - (`request-demo.tsx` skipped — it's a redirect to `/`, renders no head)
- [x] **~~C3~~** OBSOLETE — CountUp's only caller was SocialProof; deleted the file instead of
  making it SSR-safe. No "0" stats problem remains because the stats are gone.
- [x] **H1** `index.tsx` title/og:title/twitter:title → "HAKKIU — Trademark Monitoring & Brand Protection Software"
- [x] **H2** `{ rel: "canonical", href }` added to index, about, contact + all 8 legal pages
  (absolute `${COMPANY.baseUrl}/...`). request-demo skipped (redirect).
- [x] **M4** OG image → `public/og-image.png` (1920×1080, 162KB, re-hosted from the old r2.dev URL);
  `__root.tsx` og:image + twitter:image now `${COMPANY.baseUrl}/og-image.png`.
- [x] Verified: `tsc --noEmit` exit 0 · dev HTTP 200 · SSR HTML confirmed (JSON-LD valid, canonical,
  new title, self-hosted OG). ⏳ Still TODO externally: Google Rich Results Test on live deploy.
- [ ] **Follow-up (user decision):** the same illustrative numbers "99.4%" / "1,842" remain in TWO
  decorative `aria-hidden` product mockups — `product-window.tsx:21` badge and `workflow.tsx:95/108`
  diagram. Lower risk than the social-proof block, but decide whether to neutralize them for consistency.

### Sprint 2 — content + on-page (session 34) — mostly DONE
- [x] **H4/H6** Question-format `<h3>` + expanded truthful copy added to Coverage, Workflow,
  Features (mirrored the `Reveal` delay ladder; no layout/animation regressions). Only
  defensible facts used (12+ channels, named platforms, AI vision+text, forensic dossier, DMCA).
- [x] **M3** New FAQ section `src/components/landing/faq.tsx` (6 Q&A). Collapsible via native
  `<details>`/`<summary>` (question shown, click to expand) — chosen over a JS accordion because
  `<details>` keeps the answer text in SSR HTML while collapsed, so AI/crawlers still read every
  answer. Question is an `<h3>` inside `<summary>` (passage anchor). Wired into index.tsx before
  FinalCTA. **Schema: FAQPage** built from the same exported `FAQ_ITEMS` (single source).
  > NOTE: used **FAQPage** (correct type for multi-Q&A), not QAPage (QAPage = single community
  > question). Neither yields a Google rich result post-May-2026; value is AI/Bing comprehension.
- [x] **H5** Middle-intent path = "FAQ" hash link added to `landing-nav.tsx` (frontend-only, no
  backend/asset). Pricing question answered truthfully in the FAQ ("quote-based, never charged
  per detection/takedown"). A dedicated pricing section / sample-dossier download deferred (needs
  a real asset).
- [x] **M2** `public/llms.txt` — added /about, /contact, /legal/security + version/last-updated
  header (v1.1); Home entry now mentions the FAQ.
- [x] **L1** `public/sitemap.xml` — homepage `<lastmod>` already 2026-07-29 (today); no change needed.
- [ ] **H3** Named + attributed testimonial *(BLOCKED — need a real client name/quote+metric)*
- [x] **M1** `/about` — added "The team" section (5 members, initials-avatar + LinkedIn link each)
  + "Founded in 2026". `foundedYear` + `TEAM` live in `src/lib/company.ts` (single source).
  Organization schema now carries `foundingDate: "2026"` + 5 `employee` Person entries with
  LinkedIn `sameAs` (entity-graph signal). No job titles (roles TBD — omitted, not guessed).
  Photos: real headshots added to `public/team/*.jpeg` (resized 256×256, PNG→JPEG, ~106KB total
  for all 5) and wired via `photo:` in TEAM; `<img loading="lazy" width/height>`. Domantas's full
  name (Janušauskas) confirmed. Personal emails deliberately NOT shown (spam) — LinkedIn only.
- [x] Verified: `tsc --noEmit`=0 · all public routes 200 · SSR HTML carries FAQ answers + new
  question headings · 4 JSON-LD types (Organization/WebSite/SoftwareApplication/FAQPage) valid.

---

## 🔁 RE-AUDIT BACKLOG (2026-07-29, session 35) — everything still open

> Full `/seo audit` re-run on LIVE prod after Sprint 1+2+M1. **Health Score 58 → ~70/100.**
> Measured mobile CWV (Google API key now configured in `~/.config/claude-seo/google-api.json`):
> Lighthouse **SEO 100 · Best-Practices 100 · A11y 97 · Performance 72**. CWV: **LCP 4.4s 🔴,
> FCP 4.4s 🔴, CLS 0 🟢, TBT 0ms 🟢**. CrUX field data = none (site traffic too low yet).
> Below = the consolidated, de-duped remaining work across technical/content/schema/GEO agents.

### BATCH 1 — quick safe code wins — ✅ DONE (session 36, 2026-07-29)
- [x] **B1-1** Organization `logo` → `ImageObject` {url,width:512,height:421} in `__root.tsx`. Verified
  real file `public/hakkiu-mark.png` IS 512×421 so schema is truthful. Google Knowledge-Panel eligible.
- [x] **B1-2** `og:url` added to every public route head, mirroring the existing canonical:
  index (`https://hakkiu.com/`), about, contact + all 8 legal pages (`${COMPANY.baseUrl}/...`).
- [x] **B1-3** `/request-demo` — was ALREADY absent from `sitemap.xml` (removed session 31). Completed
  the intent by also dropping `Allow: /request-demo` from `robots.txt` (it 307-redirects → no point
  advertising a redirect to crawlers; the robots block has no blanket `Disallow: /` so nothing new is blocked).
- [x] **B1-4** `WebPage` JSON-LD on `/` with `datePublished:"2026-07-01"` + `dateModified:"2026-07-29"`
  (isPartOf website, about organization). Comment tells maintainers to bump dateModified w/ sitemap lastmod.
- [x] **B1-5** `/about` `<title>` → "About HAKKIU — EU Brand Protection for IP Teams" (keyword-rich).
- [x] **B1-6** `og:image:width` 1920 + `og:image:height` 1080 (match real og-image.png) +
  `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">` in `__root.tsx`.
- [x] **B1-7** ContactPoint gained `areaServed:"Worldwide"` + `availableLanguage:"English"` in `__root.tsx`.
- [x] Verified: `tsc --noEmit`=0 · dev `/`,`/about`,`/legal/privacy` all HTTP 200 · SSR HTML confirmed
  (Python substring checks — grep unreliable on long lines) carries every new tag · all **4 homepage
  JSON-LD blocks parse as valid JSON** (Organization+WebSite / SoftwareApplication / FAQPage / WebPage).
  ⏳ Not yet committed/deployed; re-run Google Rich Results + PageSpeed after Batch 2 lands.

### BATCH 2 — Performance / CWV — ✅ DONE (session 36, except B2-5) — verify LCP after deploy
- [x] **B2-1** Fonts SELF-HOSTED (was render-blocking Google Fonts ~820ms). 14 woff2 in
  `public/fonts/` (MERGED latin+latin-ext — latin-ext needed for Lithuanian š/č/ž in team names),
  `@font-face` (font-display:swap) in `styles.css`, Google Fonts preconnect+stylesheet removed from
  `__root.tsx`, `<link rel=preload>` for the 2 above-the-fold faces (Sora 800 = hero H1, Inter 400 =
  body). Verified: no googleapis in HTML, fonts 200 `font/woff2`, 14 @font-face in CSS, build emits
  `dist/client/fonts/*`. NOTE: real prod CSP (Caddyfile, NOT the dead `public/_headers`) already
  allowed Google Fonts, so this is a pure perf win + drops a 3rd-party dependency.
- [x] **B2-2** Caddy `/assets/*` + `/fonts/*` → `Cache-Control: public, max-age=31536000, immutable`.
  Turned out to be a REPO change (Caddyfile is bind-mounted `./Caddyfile:/etc/caddy/Caddyfile:ro`),
  so it auto-deploys via CI — NOT a manual Martynas task. `@immutable path` matcher; HTML deliberately
  not matched. `caddy validate` = "Valid configuration"; `caddy fmt` applied. (Confirmed prod was
  serving hashed `/assets/*.css` with `max-age=0, must-revalidate`.)
- [x] **B2-3** Lazy-loaded the 2 lead modals (`lead-modals.tsx` → `React.lazy` + per-modal `Suspense`,
  mounted via a `loaded` latch on first open → preserves open/close anim, zero SSR risk). Build now
  splits `book-demo-modal-*.js` + `talk-to-sales-modal-*.js` out of the initial `index` chunk
  (verified the form code is NOT in index/dashboard chunks).
- [x] **B2-4** Hero above-the-fold `<Reveal>`s (eyebrow/H1/subhead/CTAs/trust) now use a new `eager`
  prop = pure-CSS entrance (`.hakkiu-reveal-up` keyframe in `styles.css`) that paints at FIRST render
  instead of the JS+IntersectionObserver-gated `opacity-0` (an opacity:0 element is not an LCP
  candidate → was delaying LCP until hydration). Verified SSR H1 now carries `hakkiu-reveal-up`, not
  `opacity-0`. **This is likely the single biggest LCP win.** Below-the-fold reveals unchanged.
- [ ] **B2-5** 1 a11y colour-contrast warning — DEFERRED: need the SPECIFIC failing element/selector
  from the Lighthouse report (guessing risks changing the design). Re-run PageSpeed → grab the node.
- [x] Verified: `tsc --noEmit`=0 · `npm run build` exit 0 · dev all routes 200 · no dev warnings.
  ⏳ NEXT (external): re-run PageSpeed after deploy to confirm LCP 4.4s→<2.5s AND that CLS stays 0
  (font swap + eager reveal are the two things to watch; both expected fine).

### BATCH 3 — content depth — ✅ DONE (session 36, except B3-2 roles/bios + B3-8 skipped)
> ⚠️ Origin: crawler flagged low text-HTML ratio (`/` 6.2%, `/about` 6.1%). After Batch 3:
> **/about 6.1%→8.2%, home 6.2%→8.8%** (measured locally). Weak signal but improved as a side effect.
> 🔑 TRUTHFULNESS: investigation found the FAQ + llms.txt + a mockup + a feature card carried
> **overclaims the code does NOT support** — "dispatches to legal portals / 1-click / Amazon Brand
> Registry / Direct API removal" (only email-method notices auto-send; web-form portals are prepared
> for manual submit), "cryptographic SHA-256 timestamps" (hashing yes, no RFC-3161), "0–100% threat
> score" (no such field), "page HTML archived" (unverified), "court-ready" (→ "for legal review").
> Expanding the copy was used to CORRECT these, not amplify them (consistent w/ Sprint 1's no-fabrication rule).
- [x] **B3-1** All FAQ answers expanded to ~130–160 words (`faq.tsx` FAQ_ITEMS; FAQPage schema auto-grew
  to 7 Q). Rewrote truthfully: tiered detection (keyword/typosquat → pHash → vision-LLM), "scored by
  risk" not "0–100% threat score", "SHA-256 hash + UTC timestamp" not "cryptographic timestamps",
  "prepares & routes notices (email/web-form/UDRP)" not "dispatches to portals", "for legal review"
  not "court-ready". Verified in SSR + valid JSON-LD.
- [~] **B3-2** `/about`: converted the 5 eyebrow `<p>` labels to real `<h2>` + added a new "How it works"
  `<h2>` section (6 section h2s now, was 0) + expanded every section's copy. Page text-ratio 6.1%→8.2%.
  **STILL DEFERRED:** per-member role titles / 1-line bios (BLOCKED — need them from Martynas). Team
  grid stays name+LinkedIn only (no invented titles).
- [x] **B3-3** `product-window.tsx`: added an "Example" pill in the titlebar (marks the mock as
  illustrative), changed the fake `sha256:e3b0c442…` (= hash of empty string, recognisably fake) to a
  neutral value, and softened "Files a formal takedown to the marketplace legal portal" → "Generates …
  for the marketplace's reporting channel, with hash-verified evidence."
- [x] **B3-4** `exposure-calculator.tsx`: methodology note made explicit — "a share of your monthly ad
  spend, scaled by brand reach and channel mix. Illustrative, not a measurement of actual losses."
- [x] **B3-5** FAQ answers now go DEEPER than the duplicate section H3s (coverage/features) instead of
  repeating them (tiered pipeline detail, 40-platform routing detail, consolidation rationale).
- [x] **B3-6** Internal links added from `/about`: → `/#coverage`, `/#how`, `/#features` (hash Links),
  `/legal/dpa` (new), keeping the existing security/privacy/imprint/contact links. Verified as real hrefs.
- [x] **B3-7** "Last reviewed: July 2026" line added to the FAQ section (freshness signal).
- [⏭️] **B3-8** HowTo schema — **SKIPPED ON PURPOSE**: HowTo is deprecated (Sept 2023) and Google
  dropped HowTo rich results; the claude-seo rule is "never recommend HowTo schema." Do not add.
- [x] **B3-9** Added a 7th FAQ: "How does HAKKIU compare to other brand protection tools?" — names the
  category + Red Points / BrandShield / Corsearch factually (no disparagement), positions HAKKIU's
  verifiable differences (quote-based/no-metering, brand-owner+law-firm, tiered detection). Captures
  "alternatives to X" AI queries.
- [x] **B3-10** `llms.txt` → v1.2: added a "## Preferred citation" block (canonical name/URL/one-liner);
  softened the same overclaims to match the FAQ; `/request-demo` entry already existed.
- [x] BONUS truthfulness fix: `features/index.tsx` "Direct API integrations remove infringing content"
  → "Each notice is routed to the right portal, registrar or abuse contact … every case is tracked."
- [x] Verified: `tsc`=0 · `build`=0 · `/` + `/about` 200 · 6 `<h2>` on /about · 7 FAQPage Questions ·
  overclaims gone from SSR · text-ratio up. ⏳ Re-run PageSpeed/GEO after deploy.

### BATCH 4 — off-site authority (Sprint 3; external, not code — biggest remaining lever)
- [ ] **B4-1** Claim **G2** + **Capterra** profiles (0 today) → later feeds `aggregateRating` schema
- [ ] **B4-2** **YouTube** channel + 1 product-walkthrough video (0.737 correlation w/ AI citation — strongest single off-site signal)
- [ ] **B4-3** **Wikidata** entity (no notability bar) + add its URI to Organization `sameAs`
- [ ] **B4-4** Blog/resources: 2–3 long-form guides (800–1200w) — "detect counterfeits on Amazon", "forensic dossier for IP enforcement", "marketplace DMCA takedown"
- [x] **B4-5** SERP-matching pages — DONE (code). Built 5 static routes (TanStack dot-notation):
  `/solutions/law-firms`, `/solutions/brand-owners`, `/compare/red-points`, `/compare/brandshield`,
  `/compare/corsearch`. Shared `components/landing/compare-page.tsx` (hero + fair "where competitor
  fits" note + factual side-by-side table + honest reasons + CTA + trademark/pricing disclaimer);
  solution pages self-contained like `about.tsx`. Wired: `__root.tsx` PUBLIC_PATHS (5 paths),
  `sitemap.xml` (5 urls, priority 0.7–0.8), footer "Solutions" column (new 5-col grid).
  **Truthfulness guardrails applied** (per competitor research): NO $ / "flat plans" claims (pricing
  not published — only "no per-detection/takedown charge" allowed); flat-fee/unlimited-takedowns shown
  as PARITY with Red Points (they market it too), NOT a HAKKIU advantage; competitors' own wins shown
  honestly (BrandShield phishing/exec, Corsearch clearance heritage & scale); only verifiable EU/Vilnius
  jurisdiction + documented AI pipeline + legal-review evidence used as differentiators; Corsearch
  "£5k/mo" & analyst-hour claims NOT published (3rd-party only); cells a vendor doesn't publish = "Not
  published". Verified: `tsc`=0 · `build`=0 · all 5 SSR 200 with correct title/canonical/og:url/WebPage
  +BreadcrumbList JSON-LD/1×h1. ⚠️ Note (from SXO agent): compare pages are a 3–12mo ranking play and
  weaker without G2/Capterra review signals (B4-1) — do B4-1 to strengthen E-E-A-T.
- [ ] **B4-6** ProductHunt listing; press/Crunchbase for eventual Wikipedia notability

### BLOCKED — need input from Martynas
- [ ] **H3** real customer testimonial (named client + quote + metric) — was the last Sprint-2 item
- [ ] **B3-2 roles/bios** — do we publish role titles? what are they?
- [ ] **Martynas LinkedIn URL** — current `sameAs` has Lithuanian chars (š,č); LinkedIn slugs are usually ASCII → may be a broken link. Need exact URL from his browser. (`src/lib/company.ts` TEAM[0])

### Deferred / needs credentials
- [x] Core Web Vitals — DONE, key configured; re-measure after B2 fixes to confirm LCP drop
- [ ] Backlink DA/PA — add Moz/Bing keys (currently Common Crawl tier only)
- [ ] Google Search Console — verify domain + submit sitemap + Request-Indexing homepage/about (favicon + new title will refresh after Google re-crawls; currently SERP shows OLD title = not re-crawled yet)

### NON-findings (do NOT "fix" — avoid re-flagging)
- "48 images missing alt" — marketplace logos use `alt=""` WITH adjacent text labels (correct for decorative); mock panels are `aria-hidden`; team photos have real alt. Fine as-is.
- FAQPage yields no Google SERP rich result (retired 2026-05) — value is AI/Bing only; keep it.
- `foundingDate 2026` "too new" — resolves naturally with age.
- CrUX field data absent — low traffic; appears automatically as traffic grows.

### Suggested sequencing
1. **Batch 1 + Batch 2 (code parts)** in one "Sprint 2.5" session → biggest measurable jump (Perf 72→~90, Schema/On-Page↑). Then re-run PageSpeed to confirm LCP.
2. **Caddy B2-2** — Martynas applies on server (hand him the snippet).
3. **Batch 3** — content session (needs roles/bios + FAQ-expansion approval).
4. **Batch 4** — Sprint 3, gradual, mostly non-code.

---

## 📱 Landing page mobile polish (2026-07-29, session 32)

- [x] Lead modals (`lead-modal-shell.tsx`): capped `DialogContent` to `max-h-[calc(100svh-1.5rem)]`
  with `overflow-y-auto` so the tall Book-a-demo / Talk-to-sales forms scroll INSIDE the dialog
  on phones instead of overflowing off-screen (top/bottom were being cut off, no way to reach the
  submit button). Only the landing shell touched — shared `ui/dialog.tsx` base left unchanged.
- [x] Nav (`landing-nav.tsx`): on <sm screens hide the "AI 2.0" badge and the secondary
  "Talk to sales" button so logo + primary "Book a demo" CTA no longer crowd/overflow the header
  on ~375px widths. Both reappear at `sm:`.
- [x] Verified: `tsc --noEmit` clean, dev server returns HTTP 200. All other sections
  (hero, social-proof, coverage, workflow, features bento, exposure calculator, final CTA, footer)
  already used responsive Tailwind breakpoints and collapse correctly on mobile — no changes needed.

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
## 🚧 USER ACTIONS (external — need Martynas / credentials / dashboards)

### Company / legal
- [ ] Fill company requisites in `src/lib/company.ts` once incorporation is final (legal entity name,
  legal form, reg code, registered address, VAT, phone). One edit updates all legal pages + Imprint.
- [ ] Lawyer review of all 10 legal pages before relying on them (templates, not advice).

### Production / ops
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
