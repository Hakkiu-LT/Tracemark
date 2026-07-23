# HAKKIU — project instructions

Trademark monitoring SaaS. Monorepo:
- `src/` — customer web app (TanStack Start, Cloudflare Workers).
- `apps/api/` — main Python/FastAPI backend (scraping, AI, customer endpoints).
- `apps/admin/` — **Admin Portal** frontend (Vite + React SPA, `admin.tracemark.ai`).
- `apps/admin-api/` — Admin Portal backend (FastAPI). Reads/writes the SAME Supabase
  project as customers via the service-role key; staff auth via `staff_accounts`.
- Supabase migrations live in `supabase/migrations/` (apply with `supabase db push` —
  CLI is linked to the real HAKKIU project; the MCP points at a different DB).
- **ONE shared `.env` at the repo root** for the whole monorepo. Backends load it via
  `load_dotenv(find_dotenv())`; the admin frontend reads it via Vite `envDir`; the
  customer app (repo root) reads it natively. Only `VITE_*` vars are exposed to browsers.
  Do NOT create per-app `.env` files.

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

## ⚠️ MANDATORY RULE — Update tracking files after every session

**After every coding session and after every planning conversation, you MUST update these three files to reflect the current state of the project:**

1. **`plan.md`** (repo root) — Current active plan: what we are building right now, why, and how. Update it when the approach changes or a new feature is being planned.
2. **`todo.md`** (repo root) — Task checklist: tick off completed items, add new ones discovered during work. Always keep it accurate to what is actually done vs. still needed.
3. **`docs/.roadmap/roadmap.md`** — Mark items ✅ Done when fully complete (customer app + admin portal both wired). Keep ⚠️ Partial when only one side is done.

**When to update:**
- End of every session: mark completed tasks in `todo.md`, update `plan.md` if direction changed.
- After planning a new feature: write the plan into `plan.md` and add tasks to `todo.md`.
- After a feature is 100% done (both sides): mark ✅ in `roadmap.md`.

Why: these files are the single source of truth for where the project stands. Without them, each new session starts from scratch trying to re-derive what was done.

## ⚠️ MANDATORY RULE — Commit and push format

**When the user says "commit and push" (or "commit", "push"), you MUST:**

1. **Commit title** — one concise line (max 72 chars) describing WHAT changed. Use imperative mood: "Add bulk case actions and takedown stats", not "Added" or "Adding".
2. **Commit body** — bullet list describing every meaningful change: which files, what was added/changed/fixed, and why (the motivation). Group by area (Backend / Frontend / Config). Skip obvious boilerplate.
3. **Push** to the current branch immediately after committing.

Example body format:
```
Backend:
- routes/cases.py: add PATCH /cases/bulk endpoint (Mark Reviewed / Dismiss / Escalate)
- routes/stats.py: new GET /stats/takedowns aggregate endpoint

Frontend:
- Cases.tsx: checkbox column + sticky bulk action bar, keyed by case ID
- Dashboard.tsx: 3 takedown KPI cards (pending / sent / acknowledged)
```

Why: descriptive commits make it easy to understand what happened in each session when reviewing git log later.
