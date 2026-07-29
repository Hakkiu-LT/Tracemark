# HAKKIU — Active Plan

> Update this file after every session or planning conversation.
> Keep it SHORT: what we are building right now, why, and how. History lives in git + `todo.md`.
> Last updated: 2026-07-29 (session 28 — landing + info/legal page polish: animated grid backdrop, rainbow CTAs, 21st Marquee coverage, legal-layout TOC/tables, About+Contact rebuilt as marketing pages)

---

## 🎨 Latest — Landing + info-page polish (session 28)

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
