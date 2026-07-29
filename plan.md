# HAKKIU — Active Plan

> Update this file after every session or planning conversation.
> Keep it SHORT: what we are building right now, why, and how. History lives in git + `todo.md`.
> Last updated: 2026-07-29 (session 34 — **Sprint 2 IMPLEMENTED**: FAQ section + FAQPage JSON-LD, question-format headings + expanded copy on Coverage/Workflow/Features, FAQ nav link, llms.txt v1.1. tsc=0, routes 200, 4 JSON-LD types valid. H3 testimonial + M1 /about team BLOCKED on real facts. Sprint 1 done session 33.)

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
  `supabase migration list`; `tracemark.ai` reset/CORS/email stragglers aligned to the canonical
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
  linked to the real HAKKIU project; the MCP points at a DIFFERENT DB — do Tracemark DB work via CLI).
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
