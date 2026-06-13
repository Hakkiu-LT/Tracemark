# Phase 2 — Week 4: Authentication & Payments

> **Goal:** Implement user authentication (Google/Gmail OAuth + email/password sign-up) and lay the foundation for Stripe subscription billing. Authentication is the priority deliverable this week — Stripe is low priority and should not block auth from shipping.

---

## Domantas (Frontend)

**Focus:** Build all authentication UI flows and the Stripe billing settings page, wired to Supabase Auth and the backend payment endpoints.

---

### 🔴 High Priority — Authentication UI

- [ ] **Sign-in page** (`/auth/sign-in`): build `<SignInPage />` with two options:
  - **"Continue with Google"** button — calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
  - **Email + Password** form — calls `supabase.auth.signInWithPassword({ email, password })` with inline validation.
- [ ] **Sign-up page** (`/auth/sign-up`): build `<SignUpPage />` with:
  - Full Name, Email, Password, Confirm Password fields.
  - Calls `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`.
  - On success: show "Check your email to confirm your account" banner.
- [ ] **Auth callback route** (`/auth/callback`): handles the OAuth redirect from Google — call `supabase.auth.exchangeCodeForSession()` then redirect to `/dashboard`.
- [ ] **Protected route guard**: wrap all routes except `/auth/*` and `/` in a `<RequireAuth />` component or TanStack Router beforeLoad hook — reads session, redirects to `/auth/sign-in` if null.
- [ ] **User menu** (top-right of navbar): shows avatar, full name, email, and a "Sign Out" button that calls `supabase.auth.signOut()` and redirects to `/auth/sign-in`.

### Test Command
```bash
npm run dev  # sign in with Google, sign up with email, verify redirect to /dashboard
```

### Deliverable
`src/routes/auth.sign-in.tsx` + `src/routes/auth.sign-up.tsx` + `src/routes/auth.callback.tsx` + auth middleware route guards.

---

### 🟢 Low Priority — Stripe Billing UI

> ⚠️ Only start this after authentication is fully working. Do not block auth delivery on Stripe work.

- [ ] **Billing settings page** (`/settings/billing`): build `<BillingSettingsPage />` showing:
  - Current plan badge (Free / Pro — read from `profiles.plan` in Supabase).
  - "Upgrade to Pro" button — calls `POST /api/v1/billing/create-checkout-session` and redirects to the returned Stripe Checkout URL.
  - If already on Pro: show next billing date and a "Manage Subscription" button → calls `POST /api/v1/billing/create-portal-session` → redirects to Stripe Customer Portal.
- [ ] **Post-payment success page** (`/billing/success`): simple confirmation banner.
- [ ] **Post-payment cancel page** (`/billing/cancel`): cancellation notice.

### Deliverable
`src/routes/settings.billing.tsx` + success/cancel redirect pages.

---

## Martynas (Backend & Database - Python & Supabase)

**Focus:** Configure Supabase Auth providers, set up RLS policies scoped to authenticated users, and build the Stripe backend endpoints in Python.

---

### 🔴 High Priority — Auth Backend & RLS

- [ ] **Enable Google OAuth in Supabase:**
  - Configure Providers → Google inside Supabase dashboard.
  - Set authorized redirect URI to `{SUPABASE_URL}/auth/v1/callback`.
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
- [ ] **RLS policies** — lock all tables in Supabase to authenticated users only. Scope row access:
  ```sql
  ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can only access their own org cases"
      ON cases FOR ALL
      USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
  ```
- [ ] **`GET /api/v1/me`** endpoint in `routes/auth.py` — decodes the JWT token from the `Authorization: Bearer` header, retrieves the user profile, and returns `{ id, email, full_name, avatar_url, plan, organization_id }`.

### Test Command
```bash
pytest tests/test_auth.py
```

### Deliverable
`supabase/migrations/YYYYMMDD_profiles_rls.sql` + FastAPI route `apps/api/src/tracemark_api/routes/auth.py`.

---

## Gabriel (Backend & Infrastructure - Python & Stripe)

**Focus:** Integrate Stripe Python SDK to create checkout/portal sessions and deploy the centralized API usage tracking wrapper.

---

### 🟢 Low Priority — Stripe Backend

- [ ] Install `stripe` package in Python backend. Add Stripe credentials to environment variables.
- [ ] **`POST /api/v1/billing/create-checkout-session`** — creates a Stripe Checkout session for the subscription:
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
- [ ] **`POST /api/v1/billing/create-portal-session`** — creates a Stripe Customer Portal session so users can cancel/update subscriptions.
- [ ] **`POST /api/v1/billing/webhook`** — handles Stripe webhook events:
  - `checkout.session.completed` → update `profiles.plan = 'pro'` for the user.
  - `customer.subscription.deleted` → update `profiles.plan = 'free'`.
  - Verify webhook signatures using `STRIPE_WEBHOOK_SECRET` before processing.

---

## Integration Point (End of Week 4)
- A new user lands on `/` → clicks sign in → redirected to `/dashboard` with their avatar visible in the navbar.
- All API calls from the React frontend include the Supabase session token in the `Authorization: Bearer` header.
- (Low priority) Upgrading redirects to Stripe Checkout in test mode, and completing payment upgrades user profiles.

---

## Definition of Done

### 🔴 Auth (Must be complete)
- [ ] Google OAuth sign-in works end-to-end.
- [ ] Email/password sign-up sends confirmation email and blocks login until verified.
- [ ] Unauthenticated users are redirected to `/auth/sign-in` from any protected route.
- [ ] `profiles` table row auto-created on first sign-up via database trigger.
- [ ] All existing API endpoints return 401 for requests without a valid session token.
- [ ] RLS policies confirmed: user A cannot read user B's cases.

### 🟢 Stripe (Nice to have)
- [ ] Checkout session created successfully and redirects to Stripe (test mode).
- [ ] Webhook receives `checkout.session.completed` and sets `profiles.plan = 'pro'`.
- [ ] Billing settings page shows correct plan status after payment.
