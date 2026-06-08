# Phase 2 — Week 4: Authentication & Payments

> **Goal:** Implement user authentication (Google/Gmail OAuth + email/password sign-up) and lay the foundation for Stripe subscription billing. Authentication is the priority deliverable this week — Stripe is low priority and should not block auth from shipping.

---

## Domantas (Frontend)

**Focus:** Build all authentication UI flows and the Stripe billing settings page, wired to Supabase Auth and the backend payment endpoints.

---

### 🔴 High Priority — Authentication UI

- [ ] **Sign-in page** (`/auth/sign-in`): build `<SignInPage />` with two options:
  - **"Continue with Google"** button — calls `supabase.auth.signInWithOAuth({ provider: 'google' })`. No redirect config needed beyond what Supabase handles.
  - **Email + Password** form — calls `supabase.auth.signInWithPassword({ email, password })`. Include inline validation (non-empty, valid email format).
- [ ] **Sign-up page** (`/auth/sign-up`): build `<SignUpPage />` with:
  - Full Name, Email, Password, Confirm Password fields.
  - Calls `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`.
  - On success: show "Check your email to confirm your account" banner.
  - "Or continue with Google" button (same OAuth flow as sign-in).
- [ ] **Auth callback route** (`/auth/callback`): handles the OAuth redirect from Google — call `supabase.auth.exchangeCodeForSession()` then redirect to `/dashboard`.
- [ ] **Protected route guard**: wrap all routes except `/auth/*` and `/` in a `<RequireAuth />` component — reads session from `supabase.auth.getSession()`, redirects to `/auth/sign-in` if null.
- [ ] **User menu** (top-right of navbar): shows avatar (from Google profile photo or initials fallback), full name, email, and a "Sign Out" button that calls `supabase.auth.signOut()` and redirects to `/auth/sign-in`.
- [ ] **Session persistence**: use `supabase.auth.onAuthStateChange()` in a top-level provider so session is reactive across tabs.

### Test Command
```bash
bun run dev  # sign in with Google, sign up with email, verify redirect to /dashboard
```

### Deliverable
`src/pages/auth/sign-in.tsx` + `src/pages/auth/sign-up.tsx` + `src/pages/auth/callback.tsx` + `src/components/auth/RequireAuth.tsx` + `src/components/layout/UserMenu.tsx`.

---

### 🟢 Low Priority — Stripe Billing UI

> ⚠️ Only start this after authentication is fully working. Do not block auth delivery on Stripe work.

- [ ] **Billing settings page** (`/settings/billing`): build `<BillingSettingsPage />` showing:
  - Current plan badge (Free / Pro — read from `org_settings.plan` in Supabase).
  - "Upgrade to Pro" button — calls `POST /api/billing/create-checkout-session` and redirects to the returned Stripe Checkout URL.
  - If already on Pro: show next billing date and a "Manage Subscription" button → calls `POST /api/billing/create-portal-session` → redirect to Stripe Customer Portal.
- [ ] **Post-payment success page** (`/billing/success`): simple confirmation banner "You're now on Pro 🎉" with a link back to the dashboard.
- [ ] **Post-payment cancel page** (`/billing/cancel`): "No changes made" notice with a back link.
- [ ] Wire billing page into the sidebar under Settings (visible to both personas).

### Deliverable
`src/pages/settings/billing.tsx` + `src/pages/billing/success.tsx` + `src/pages/billing/cancel.tsx`.

---

## Martynas (Backend & Database)

**Focus:** Configure Supabase Auth providers, set up RLS policies scoped to authenticated users, and build the Stripe backend endpoints.

---

### 🔴 High Priority — Auth Backend & RLS

- [ ] **Enable Google OAuth in Supabase:**
  - Go to Supabase Dashboard → Authentication → Providers → Google.
  - Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (from Google Cloud Console → OAuth 2.0 Credentials).
  - Set authorised redirect URI to `{SUPABASE_URL}/auth/v1/callback`.
  - Add env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` to `.env.example`.
- [ ] **Enable Email Auth** in Supabase → Authentication → Providers → Email. Enable "Confirm email" so new accounts require email verification before first login.
- [ ] **`profiles` table migration** — store extra user metadata that Supabase Auth doesn't natively hold:
  ```sql
  CREATE TABLE profiles (
      id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name     TEXT,
      avatar_url    TEXT,
      organization_id UUID REFERENCES organizations(id),
      plan          TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
      created_at    TIMESTAMPTZ DEFAULT now()
  );
  -- Auto-create profile row on new user sign-up
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER AS $$
  BEGIN
      INSERT INTO profiles (id, full_name, avatar_url)
      VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  ```
- [ ] **RLS policies** — lock all existing tables to authenticated users only. Apply to `cases`, `evidence`, `decisions`, `infringements`, `documents`, `webhook_deliveries`:
  ```sql
  -- Example for `cases` — repeat pattern for all tables
  ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can only access their own org cases"
      ON cases FOR ALL
      USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  ```
- [ ] **`GET /api/v1/me`** endpoint — returns the authenticated user's profile: `{ id, email, full_name, avatar_url, plan, organization_id }`. Reads from `profiles` joined with `auth.users`. Returns 401 if no valid session token in the `Authorization: Bearer` header.
- [ ] Write integration test: unauthenticated request to `GET /api/v1/cases` returns 401; authenticated request returns 200 with correct data.

### Test Command
```bash
bun test apps/api/src/tests/auth.test.ts
```

### Deliverable
`supabase/migrations/YYYYMMDD_profiles_rls.sql` + `apps/api/src/tracemark_api/routes/me.py` + Google OAuth configured in Supabase dashboard.

---

### 🟢 Low Priority — Stripe Backend

> ⚠️ Only start this after auth + RLS is fully working and merged.

- [ ] Install `stripe` Python SDK. Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` to `.env.example`.
- [ ] **`POST /api/billing/create-checkout-session`** — creates a Stripe Checkout session for the Pro plan:
  ```python
  @router.post("/billing/create-checkout-session")
  def create_checkout_session(user=Depends(get_current_user)):
      session = stripe.checkout.Session.create(
          customer_email=user.email,
          mode="subscription",
          line_items=[{"price": os.environ["STRIPE_PRO_PRICE_ID"], "quantity": 1}],
          success_url=f"{FRONTEND_URL}/billing/success",
          cancel_url=f"{FRONTEND_URL}/billing/cancel",
          metadata={"user_id": user.id},
      )
      return {"checkout_url": session.url}
  ```
- [ ] **`POST /api/billing/create-portal-session`** — creates a Stripe Customer Portal session so users can manage/cancel their subscription.
- [ ] **`POST /api/billing/webhook`** — handles Stripe webhook events:
  - `checkout.session.completed` → update `profiles.plan = 'pro'` for the user.
  - `customer.subscription.deleted` → update `profiles.plan = 'free'`.
  - Verify webhook signature using `STRIPE_WEBHOOK_SECRET` before processing.
- [ ] Create a Stripe Product + Price in the Stripe Dashboard (test mode): name "MarkGuard Pro", price $29/month recurring. Copy the Price ID into `STRIPE_PRO_PRICE_ID`.

### Deliverable
`apps/api/src/tracemark_api/routes/billing.py` + Stripe test mode product created + webhook registered in Stripe Dashboard pointing to `POST /api/billing/webhook`.

---

## Gabriel (Backend & Infrastructure)

**Focus:** Build a shared, persistent Gemini API usage tracker backed by Supabase so that all developers and all server instances share one quota counter — preventing any accidental charges on the free tier.

---

### 🔴 High Priority — Gemini Usage Tracker

- [ ] **`gemini_usage` table migration** — run once in the Supabase SQL editor:
  ```sql
  CREATE TABLE gemini_usage (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      model          TEXT NOT NULL,
      call_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      calls_count    INT  NOT NULL DEFAULT 0,
      errors_count   INT  NOT NULL DEFAULT 0,
      last_called_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (model, call_date)   -- one row per model per day
  );
  ```

- [ ] **`increment_gemini_usage` Postgres function** — atomic upsert so concurrent calls from multiple developers never double-count:
  ```sql
  CREATE OR REPLACE FUNCTION increment_gemini_usage(
      p_model     TEXT,
      p_call_date DATE,
      p_is_error  BOOLEAN DEFAULT FALSE
  )
  RETURNS VOID AS $$
  BEGIN
      INSERT INTO gemini_usage (model, call_date, calls_count, errors_count, last_called_at)
      VALUES (
          p_model, p_call_date,
          CASE WHEN NOT p_is_error THEN 1 ELSE 0 END,
          CASE WHEN p_is_error     THEN 1 ELSE 0 END,
          now()
      )
      ON CONFLICT (model, call_date) DO UPDATE SET
          calls_count    = gemini_usage.calls_count    + CASE WHEN NOT p_is_error THEN 1 ELSE 0 END,
          errors_count   = gemini_usage.errors_count   + CASE WHEN p_is_error     THEN 1 ELSE 0 END,
          last_called_at = now();
  END;
  $$ LANGUAGE plpgsql;
  ```
  > The `ON CONFLICT ... DO UPDATE` pattern is atomic at the Postgres level — safe under concurrent load from multiple devs or server instances.

- [ ] **`services/gemini_tracker.py`** — create this new service file. It must:
  - Expose a `gemini_tracker` singleton (module-level instance).
  - Implement a `call(model: str)` context manager that:
    1. **Before** the call: reads `calls_count` for today from Supabase (shared across all processes).
    2. Raises `GeminiDailyLimitExceeded` if `calls_count >= daily_limit` — hard stop, no call fires.
    3. Checks an **in-memory RPM sliding window** (last 60s) — raises `GeminiRPMLimitExceeded` if at cap.
    4. Logs a `WARNING` at 75% daily usage and a `CRITICAL` warning at 90%.
    5. **After** the call: calls `increment_gemini_usage` via `supabase.rpc()` to persist the count.
  - Limits (with safety buffer below real free-tier caps, overridable via env vars):
    - Flash: `GEMINI_DAILY_LIMIT_FLASH=1400` (real cap: 1,500), `GEMINI_RPM_LIMIT_FLASH=14` (real cap: 15)
    - Pro:   `GEMINI_DAILY_LIMIT_PRO=40`    (real cap: 50),    `GEMINI_RPM_LIMIT_PRO=4`    (real cap: 5)
  - Implement `get_stats() -> dict` returning usage snapshot for all tracked models.

- [ ] **Wrap all 4 Gemini call points in `services/ai.py`** with the tracker context manager:
  ```python
  # Add import at top of ai.py
  from tracemark_api.services.gemini_tracker import (
      gemini_tracker, GeminiDailyLimitExceeded, GeminiRPMLimitExceeded
  )

  # Wrap each model.invoke() — example:
  with gemini_tracker.call("gemini-2.5-flash"):
      return {"evidence": model.invoke(prompt)}
  ```
  The 4 call points to wrap are:
  - `gather_evidence` node → `gemini-2.5-flash`
  - `make_decision_node` → `gemini-2.5-pro`
  - `_analyze_evidence_node` → `gemini-2.5-flash`
  - `_make_decision_node` → `gemini-2.5-pro`

- [ ] **Graceful fallback in `ai.py`**: catch `GeminiDailyLimitExceeded` and `GeminiRPMLimitExceeded` at each call site and return the existing mock response instead of crashing:
  ```python
  try:
      with gemini_tracker.call("gemini-2.5-flash"):
          return {"evidence": model.invoke(prompt)}
  except (GeminiDailyLimitExceeded, GeminiRPMLimitExceeded) as e:
      logger.warning("Gemini blocked, returning mock: %s", e)
      return {"evidence": mock_evidence}   # existing mock already in the file
  ```

- [ ] **`routes/usage.py`** — new endpoint `GET /api/v1/usage`:
  ```python
  from fastapi import APIRouter
  from tracemark_api.services.gemini_tracker import gemini_tracker

  router = APIRouter()

  @router.get("/usage")
  def get_usage():
      """Real-time Gemini quota snapshot — shared across all developers."""
      return gemini_tracker.get_stats()
  ```
  Register this router in `main.py` alongside the existing routers.

- [ ] **Add env vars** to `.env.example`:
  ```
  GEMINI_DAILY_LIMIT_FLASH=1400
  GEMINI_DAILY_LIMIT_PRO=40
  GEMINI_RPM_LIMIT_FLASH=14
  GEMINI_RPM_LIMIT_PRO=4
  ```

- [ ] **Verify end-to-end**: call `GET /api/v1/usage` before and after triggering a `/check-brand` scan — confirm `calls_count` increments correctly in both the API response and directly in the Supabase `gemini_usage` table.

### Test Command
```bash
# 1. Hit the usage endpoint before any calls
curl http://localhost:8000/api/v1/usage

# 2. Trigger a real Gemini call
curl -X POST http://localhost:8000/api/v1/check-brand -d '{...}'

# 3. Hit usage again — calls_count should be +1 (or +2 for Flash + Pro)
curl http://localhost:8000/api/v1/usage

# 4. Confirm the row exists in Supabase
# Dashboard → Table Editor → gemini_usage
```

### Deliverable
`supabase/migrations/YYYYMMDD_gemini_usage.sql` + `apps/api/src/tracemark_api/services/gemini_tracker.py` + `apps/api/src/tracemark_api/routes/usage.py` + updated `services/ai.py` with tracker wrapping all 4 call points.

---

## Integration Point (End of Week 4)
- A new user lands on `/` → clicks "Sign in with Google" → redirected to `/dashboard` with their Google avatar visible in the navbar.
- All API calls from the frontend include the Supabase session token in the `Authorization` header — unauthenticated requests return 401.
- `GET /api/v1/usage` returns a live shared counter visible to all developers — any dev can check how much Gemini quota the team has consumed today.
- (Low priority) Clicking "Upgrade to Pro" redirects to Stripe Checkout in test mode → completing payment updates `profiles.plan` to `'pro'` via webhook.

---

## Definition of Done

### 🔴 Auth (Must be complete)
- [ ] Google OAuth sign-in works end-to-end (Google → callback → `/dashboard`).
- [ ] Email/password sign-up sends confirmation email and blocks login until verified.
- [ ] Unauthenticated users are redirected to `/auth/sign-in` from any protected route.
- [ ] `profiles` table row auto-created on first sign-up via database trigger.
- [ ] All existing API endpoints return 401 for requests without a valid session token.
- [ ] RLS policies confirmed: user A cannot read user B's cases in Supabase.

### 🔴 Gemini Tracker (Must be complete)
- [ ] `gemini_usage` table exists in Supabase with `UNIQUE (model, call_date)` constraint.
- [ ] `increment_gemini_usage` Postgres function deployed and callable via `supabase.rpc()`.
- [ ] `GET /api/v1/usage` returns correct counts that increment on each Gemini call.
- [ ] Calling `/check-brand` with a real API key updates the `gemini_usage` table row in Supabase.
- [ ] When `calls_count >= daily_limit`, the next call returns a mock response instead of hitting Gemini.
- [ ] Logs show `⚠️ WARNING` at 75% and `⚠️ CRITICAL` at 90% daily usage.

### 🟢 Stripe (Nice to have)
- [ ] Checkout session created successfully and redirects to Stripe (test mode).
- [ ] Webhook receives `checkout.session.completed` and sets `profiles.plan = 'pro'`.
- [ ] Billing settings page shows correct plan status after payment.
