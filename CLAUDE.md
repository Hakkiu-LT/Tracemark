# Tracemark — project instructions

Trademark monitoring SaaS. Monorepo:
- `src/` — customer web app (TanStack Start, Cloudflare Workers).
- `apps/api/` — main Python/FastAPI backend (scraping, AI, customer endpoints).
- `apps/admin/` — **Admin Portal** frontend (Vite + React SPA, `admin.tracemark.ai`).
- `apps/admin-api/` — Admin Portal backend (FastAPI). Reads/writes the SAME Supabase
  project as customers via the service-role key; staff auth via `staff_accounts`.
- Supabase migrations live in `supabase/migrations/` (apply with `supabase db push` —
  CLI is linked to the real Tracemark project; the MCP points at a different DB).

## ⚠️ MANDATORY RULE — Admin Portal parity for every feature

**Any feature that creates, stores, or changes customer data MUST also be wired into the
Admin Portal (`apps/admin` + `apps/admin-api`) as part of the same task. A feature is not
"done" until staff can see AND manage it from the admin portal.**

When you add/extend functionality:
1. **View in admin** — add/extend an `apps/admin-api` route that reads the new data across
   ALL organizations via `customer_sb()`, gated by a staff permission (`require_permission`).
2. **Edit in admin** — provide PATCH/DELETE that write the SAME Supabase tables the customer
   app uses (so changes reflect on both sides), and call `write_audit_log` on every mutation.
3. **Permission** — if it's a new resource, add a key to the catalog in
   `apps/admin-api/.../permissions.py` AND `apps/admin/src/lib/permissions.ts` (keep them in sync).
4. **UI** — surface it in `apps/admin` under the relevant Company / Case / User view, gated
   with `<Can permission="...">`.
5. **Operations that must run in the main API** (SMTP sends, entitlements, in-process metrics)
   go through main-API `/internal/*` endpoints (shared `INTERNAL_API_SECRET`), called from
   `apps/admin-api/.../main_api.py` — never duplicate that logic in admin-api.

Why: the admin portal is not a copy — it reads/writes the same tables, so parity is what lets
staff support, test, and control everything customers do. Full context: `docs/.roadmap/roadmap.md`.

## Running locally
- main API: `cd apps/api && PYTHONPATH=src .venv/bin/python -m uvicorn tracemark_api.main:app --port 8000`
- admin API: `cd apps/admin-api && PYTHONPATH=src .venv/bin/python -m uvicorn tracemark_admin_api.main:app --port 8001`
- admin FE: `cd apps/admin && npm run dev` (→ :8082)
- customer FE: `npm run dev` (root → :8080)
- After changing admin-api/main-api code, RESTART the uvicorn process (no --reload).
