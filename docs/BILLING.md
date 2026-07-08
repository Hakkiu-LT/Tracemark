# Billing & Payments — Implementation Notes

Stripe-based subscription billing for Tracemark. Built with **Stripe Elements**
(embedded card form), a **FastAPI** backend, and **Supabase** as the source of
truth (synced via Stripe webhooks).

---

## 1. What was built today

- **5 pricing tiers** (canonical lowercase keys): `starter` ($99), `growth`
  ($249), `pro` ($599), `agency` ($1,499), `enterprise` (custom / contact sales).
- **Monthly + yearly** billing (yearly = ~2 months free; `monthly * 10`).
- **Add-ons** (recurring, quantity-based): additional regions ($49), domain
  tracking ($29 / 50 domains), advanced reports ($79 flat), extra brands ($19).
- **Usage add-on (Phase F):** managed takedown — a one-off $500 invoice item per
  successful takedown, with idempotency.
- **Full subscription lifecycle:** create (new subscriber, Elements payment),
  update (plan/interval/add-on change on the card on file, prorated), cancel
  (at period end) / resume, Stripe billing portal, invoice history.
- **Webhooks** as the single source of truth: `invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.created/updated/deleted`.
- **Security & robustness:** per-user RLS ownership column, webhook idempotency
  (dedupe by Stripe event id), Stripe-error → clean HTTP error mapping.

---

## 2. Architecture

```
Plans page ──► Checkout ──► Stripe Elements (card) ──► confirmPayment
                  │                                          │
                  │ create-subscription (client_secret)      │ payment succeeds
                  ▼                                          ▼
            FastAPI /billing  ◄──────── Stripe webhook ──────┘
                  │                     (invoice.paid, subscription.updated)
                  ▼
            Supabase (subscriptions / subscription_addons / invoices)
                  │  mirrors plan onto profiles.plan
                  ▼
            UI reads via GET /billing/subscription, /billing/invoices
```

Key rule: **the browser never writes the plan.** It confirms payment; the
webhook writes DB state. `/billing/success` polls `GET /billing/subscription`
until the subscription is `active`.

### Why `confirmation_secret`
The Stripe API version in use (Basil, 2026) **removed `invoice.payment_intent`**.
The PaymentIntent client_secret now comes from
`subscription.latest_invoice.confirmation_secret.client_secret`
(expanded via `expand=["latest_invoice.confirmation_secret"]`). Similarly,
`InvoiceItem.create` takes `pricing={"price": ...}`, not `price=...`.

### Stripe objects are not dicts
In this SDK version, Stripe objects have **no `.get()`** and are not `dict`
subclasses. All webhook/response handling normalizes them through `_as_dict()`
(which calls `.to_dict()`), then uses `.get()`/`[]`. Event ids use `event["id"]`.

---

## 3. Files

**Backend (`apps/api/`)**
- `src/tracemark_api/routes/billing.py` — all endpoints + webhook + DB sync.
- `src/tracemark_api/services/billing_config.py` — plan/add-on → Stripe Price ID
  maps (from env) + reverse lookups.
- `scripts/seed_stripe.py` — one-time helper: creates all Products/Prices and
  prints the `.env` lines. Re-runnable (matches by name/amount).
- `tests/test_billing.py` — unit tests (config, webhook sig, validation).
- registered in `src/tracemark_api/main.py`.

**Frontend (`src/`)**
- `lib/billing.ts` — plan/add-on display metadata (single source for the UI).
- `lib/stripe.ts` — shared `loadStripe` instance.
- `lib/api.ts` — billing fetchers (`createSubscription`, `updateSubscription`,
  `cancelSubscription`, `getSubscription`, `getInvoices`, `createPortalSession`,
  `chargeManagedTakedown`) + `detail`-parsing error handling.
- `routes/plans.tsx` — plan cards, monthly/yearly toggle, upgrade/downgrade labels.
- `routes/checkout.tsx` — Elements checkout + plan-change (update) path.
- `routes/billing.success.tsx` — polls until active.
- `routes/settings.tsx` — billing tab: current plan, invoices, add-on mgmt,
  cancel, portal.
- `components/landing/pricing.tsx` — public pricing (all 5 tiers).

**Database (`supabase/migrations/`)**
- `20260707000001_billing.sql` — `subscriptions`, `subscription_addons`,
  `invoices`, `org_settings.stripe_customer_id`, RLS.
- `20260707000002_billing_hardening.sql` — `user_id` ownership column +
  tightened RLS, and `stripe_events` (webhook idempotency).

---

## 4. Setup / what's needed

### Environment (`.env`)
```
STRIPE_SECRET_KEY=sk_test_...          # backend only
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... # frontend
STRIPE_WEBHOOK_SECRET=whsec_...         # from `stripe listen`
BILLING_RETURN_URL=http://localhost:8080/settings/billing
ALLOWED_ORIGINS=http://localhost:8081   # any extra frontend origin (CORS)
# + 13 STRIPE_PRICE_* ids (produced by scripts/seed_stripe.py)
```

### First-time setup
1. Create a Stripe **test-mode / sandbox** account; grab the **publishable**
   (`pk_test_`) and **secret** (`sk_test_`) keys (both must be the *same*
   account — publishable lives at the account level, not org level).
2. `cd apps/api && STRIPE_SECRET_KEY=sk_test_... uv run python scripts/seed_stripe.py`
   → paste the printed `STRIPE_PRICE_*` lines into `.env`.
3. Apply DB migrations (`20260707000001` + `20260707000002`). Note: this project
   has migration-history drift, so `supabase db push` may fail on older
   migrations — applying the new billing SQL directly via the Supabase **SQL
   Editor** is the reliable path.
4. `stripe listen --forward-to localhost:8000/api/v1/billing/webhook` → copy the
   `whsec_...` into `.env`.

### Run (local)
```
# backend — MUST load the root .env explicitly and put src on the path
cd apps/api
PYTHONPATH=src uv run uvicorn tracemark_api.main:app --port 8000 \
  --app-dir src --env-file ../../.env --reload

# frontend
npm run dev            # serves on :8080 (or next free port)

# webhooks (keep open)
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

---

## 5. What to test (manual checklist)

Use Stripe test cards: success `4242 4242 4242 4242`, decline
`4000 0000 0000 0002`, requires-auth `4000 0025 0000 3155`. Any future expiry,
any CVC/ZIP.

- [ ] **New subscription:** Plans → pick plan + interval + add-ons → Checkout →
      pay → redirected to "You're all set!" → Settings/Billing shows the plan,
      next invoice date, and a paid invoice.
- [ ] **Yearly:** toggle Yearly on Plans; confirm the order summary total is the
      yearly amount and the effective monthly is shown.
- [ ] **Add-ons at checkout:** quantities and order-summary math are correct.
- [ ] **Plan change (existing subscriber):** Plans → another plan → Checkout →
      "Confirm plan change" (no card re-entry) → plan updates, proration applies.
- [ ] **Upgrade vs downgrade label:** cheaper plan says "Downgrade", pricier says
      "Upgrade"; Enterprise = "Contact sales".
- [ ] **Add-on management** in Settings/Billing: add/remove, "Save add-ons" only
      enabled when changed.
- [ ] **Cancel:** stays active until period end, shows the cancel notice; picking
      a plan again resumes it.
- [ ] **Invoice history:** shows real invoices with working PDF links.
- [ ] **Billing portal:** "Manage payment method" opens Stripe portal and returns.
- [ ] **Failed payment:** decline card → error surfaced clearly, no plan granted.
- [ ] **Webhook:** while `stripe listen` runs, DB + `profiles.plan` update within
      a few seconds of payment.

Automated: `apps/api` unit tests (`pytest tests/test_billing.py`) and there's a
full live E2E script pattern (create → confirm → webhook → update → cancel →
invoices → managed takedown) that exercised 26 assertions end-to-end.

---

## 6. What to watch out for (gotchas)

- **Ad blockers / Brave Shields** block `js.stripe.com` → the card form won't
  render (empty box, `ERR_BLOCKED_BY_CLIENT` in console). Test in a normal
  window with blockers off, or whitelist the site.
- **Stale Vite env:** Vite inlines `VITE_*` at dev-server **start**. If you edit
  the publishable key, **restart** `npm run dev` (HMR won't pick it up) — a stale
  key causes a `401` from `api.stripe.com` and an empty PaymentElement.
- **Backend env loading:** run uvicorn with `--env-file ../../.env`. Running from
  `apps/api` without it means `load_dotenv()` won't find the root `.env`, so
  Stripe keys/CORS silently don't load.
- **CORS masking 500s:** unhandled exceptions return 500 *without* CORS headers,
  so the browser reports a misleading "CORS" error. Stripe calls are wrapped to
  return proper 4xx/5xx with a `detail` message — check the backend log for the
  real cause of any billing failure.
- **One active subscription per org** is the intended model. `get_subscription`
  prefers the active row; `create` returns **409** if one exists (use update).
- **Cancel is at period end** (not immediate) — the sub stays `active` with
  `cancel_at_period_end=true` until the period closes.
- **Test-mode key hygiene:** never paste `sk_...` secret keys into chats/PRs; roll
  keys before going live.

---

## 7. Known limitations / TODO

- **Going live:** switch to live keys, create live Products/Prices (re-run the
  seed script with the live key), register a real webhook endpoint in the Stripe
  dashboard (not just `stripe listen`), and set `BILLING_RETURN_URL` /
  `ALLOWED_ORIGINS` to production URLs.
