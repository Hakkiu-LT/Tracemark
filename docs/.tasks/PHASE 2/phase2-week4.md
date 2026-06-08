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

## Integration Point (End of Week 4)
- A new user lands on `/` → clicks "Sign in with Google" → redirected to `/dashboard` with their Google avatar visible in the navbar.
- All API calls from the frontend include the Supabase session token in the `Authorization` header — unauthenticated requests return 401.
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

### 🟢 Stripe (Nice to have)
- [ ] Checkout session created successfully and redirects to Stripe (test mode).
- [ ] Webhook receives `checkout.session.completed` and sets `profiles.plan = 'pro'`.
- [ ] Billing settings page shows correct plan status after payment.
