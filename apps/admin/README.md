# Tracemark Admin Portal

Isolated operations portal at **admin.tracemark.ai** (roadmap Sekcija 14).
Staff-only. Separate from the customer app; talks to `apps/admin-api`.

- **Frontend** (`apps/admin`): Vite + React + TanStack Router SPA (this package).
- **Backend** (`apps/admin-api`): FastAPI. Uses the same Supabase project as customers
  (staff are marked by a `staff_accounts` row). Coupled operations (resource/usage
  metrics, billing entitlements, Meta token) call the main API's `/internal/*`
  endpoints with a shared `INTERNAL_API_SECRET`.

## One-time setup

1. **Apply DB migrations** to the main Supabase project (staff tables):
   ```
   supabase db push
   ```
   Adds `staff_accounts`, `staff_permissions`, `admin_audit_log`.

2. **Set environment variables**
   - Main API (`apps/api`): add `INTERNAL_API_SECRET=<long-random-string>`.
   - Admin API (`apps/admin-api/.env`, see `.env.example`): `SUPABASE_URL`,
     `SUPABASE_SERVICE_ROLE_KEY` (same as main), `INTERNAL_API_SECRET` (same value),
     `MAIN_API_URL`.
   - Admin frontend (`apps/admin/.env`, see `.env.example`): `VITE_SUPABASE_URL`,
     `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ADMIN_API_URL`.

3. **Seed the first super-admin** (from `apps/admin-api`):
   ```
   SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD='strong-pass' \
   uv run python scripts/seed_super_admin.py
   ```

## Local development

```
# terminal 1 — main API (port 8000)
cd apps/api && uv run uvicorn tracemark_api.main:app --port 8000

# terminal 2 — admin API (port 8001)
cd apps/admin-api && uv run uvicorn tracemark_admin_api.main:app --port 8001

# terminal 3 — admin frontend (port 8082)
cd apps/admin && npm install && npm run dev
```

Open http://localhost:8082 and sign in with the seeded super-admin.

## Deploy (Cloudflare)

```
cd apps/admin && npm run deploy   # vite build && wrangler deploy
```

Serves the built SPA as a static-asset Worker bound to `admin.tracemark.ai`
(see `wrangler.jsonc`). The `tracemark.ai` zone must already exist in the Cloudflare
account. Deploy `apps/admin-api` separately (e.g. its Docker image) and point
`VITE_ADMIN_API_URL` at it.
