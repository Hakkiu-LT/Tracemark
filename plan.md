# HAKKIU — Active Plan

> Update this file after every session or planning conversation.
> Keep it SHORT: what we are building right now, why, and how. History lives in git + `todo.md`.
> Last updated: 2026-07-28 (session 20 — Book-a-demo/auth hardening + demo-form E2E)

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
