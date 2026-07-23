# HAKKIU — Trademark Monitoring SaaS

HAKKIU helps brand owners automatically detect and remove counterfeit listings, lookalike domains, and IP infringements across marketplaces, social media, and ad networks. It scrapes platforms (Amazon, eBay, AliExpress, Meta, Google, etc.), runs AI-powered image and text analysis to score each hit, and generates takedown reports — all from a self-serve dashboard without enterprise sales calls.

**Key capabilities:**
- Multi-platform scraping: marketplaces, social ads, domain WHOIS, Google SERP
- Gemini Vision AI for logo/product similarity scoring
- Automated takedown document generation and delivery
- Geo-targeted scanning (country-specific results)
- Stripe subscription billing with a law-firm white-label mode
- Admin portal for staff operations at `admin.tracemark.ai`

---

## Repository Layout

```
Tracemark/
├── src/                    # Customer web app (TanStack Start + Cloudflare Workers, :8080)
├── apps/
│   ├── api/                # Main Python/FastAPI backend — scraping, AI, customer endpoints (:8000)
│   ├── admin/              # Admin portal frontend (Vite + React SPA, admin.tracemark.ai, :8082)
│   └── admin-api/          # Admin portal backend (FastAPI, :8001)
├── supabase/
│   └── migrations/         # Ordered SQL migrations — apply with: supabase db push
├── packages/
│   └── shared/             # Shared TypeScript types and schemas
├── docs/                   # Architecture docs, billing guide, roadmap
├── .github/
│   ├── workflows/ci.yml    # GitHub Actions: dependency audits + TypeScript checks
│   └── dependabot.yml      # Automated dependency update PRs
├── docker-compose.yml      # Production container orchestration
├── plan.md                 # Active plan — what we are building right now
├── todo.md                 # Task checklist with progress tracking
└── .env                    # ONE shared env file for the entire monorepo
```

---

## Getting Started from Scratch

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | Customer + admin frontends |
| npm | bundled with Node 22 | Package manager |
| Python | 3.11+ | Both FastAPI backends |
| [uv](https://github.com/astral-sh/uv) | 0.10.10+ | Python package manager (replaces pip/venv) |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | latest | DB migrations |
| Playwright browsers | — | Screenshot scraping |

### 1. Clone and install

```bash
git clone https://github.com/your-org/Tracemark.git
cd Tracemark

# Customer frontend dependencies
npm install

# Admin frontend dependencies
cd apps/admin && npm install && cd ../..

# Main API Python environment
cd apps/api
uv venv && uv sync
uv run playwright install chromium   # needed for JS-rendered scrapers
cd ../..

# Admin API Python environment
cd apps/admin-api
uv venv && uv sync
cd ../..
```

### 2. Configure environment variables

Copy the example and fill in real values:

```bash
cp .env.example .env   # edit with your keys
```

Key variables to set:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...

# AI / Scraping
GEMINI_API_KEY=AIza...
FIRECRAWL_API_KEY=fc-...
GOOGLE_SERP_API=...

# Stripe billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Internal security (shared between api and admin-api)
INTERNAL_API_SECRET=some-long-random-secret

# Meta Ads (optional)
META_ADS_ACCESS_TOKEN=...
META_APP_ID=...
META_APP_SECRET=...

# Admin frontend URL seen by admin-api CORS
VITE_ADMIN_API_URL=http://localhost:8001/api/v1
ADMIN_ALLOWED_ORIGINS=http://localhost:8082
```

> **Rule:** Never create per-app `.env` files. All apps read from the single root `.env`.
> Only `VITE_*` variables are exposed to browsers.

### 3. Apply database migrations

```bash
supabase db push   # CLI is linked to the real HAKKIU project
```

### 4. Run all services locally

Open four terminal tabs:

```bash
# Tab 1 — Customer frontend  → http://localhost:8080
npm run dev

# Tab 2 — Admin frontend     → http://localhost:8082
cd apps/admin && npm run dev

# Tab 3 — Main API           → http://localhost:8000
cd apps/api && PYTHONPATH=src .venv/bin/python -m uvicorn tracemark_api.main:app --port 8000

# Tab 4 — Admin API          → http://localhost:8001
cd apps/admin-api && PYTHONPATH=src .venv/bin/python -m uvicorn tracemark_admin_api.main:app --port 8001
```

> After changing Python code in `apps/api` or `apps/admin-api`, **restart the uvicorn process** manually. There is no `--reload` in production mode.

---

## Running with Docker (Production)

```bash
# Build and start all four services
docker compose up --build

# Individual services
docker compose up api          # main API  → 127.0.0.1:8000
docker compose up admin-api    # admin API → 127.0.0.1:8001
docker compose up frontend     # customer  → 127.0.0.1:8080
docker compose up admin        # admin FE  → 127.0.0.1:8082
```

Services bind to `127.0.0.1` only — a reverse proxy (Caddy) handles public traffic.

---

## Testing

### Python tests (main API)

```bash
cd apps/api
PYTHONPATH=src .venv/bin/python -m pytest tests/ -v
```

Test files live in `apps/api/tests/`. They cover auth, billing, scrapers, infringements, entitlements, persistence, and more.

### TypeScript type-check

```bash
# Customer frontend
npx tsc --noEmit

# Admin frontend
cd apps/admin && npx tsc --noEmit
```

### Lint and format (TypeScript / React)

```bash
# Check lint
npm run lint

# Auto-format with Prettier
npm run format
```

### Dependency security audit

```bash
# Python (main API)
cd apps/api && uv run pip-audit

# Python (admin API)
cd apps/admin-api && uv run pip-audit

# npm (customer frontend)
npm audit --audit-level=high

# npm (admin frontend)
cd apps/admin && npm audit --audit-level=high
```

CI runs all of these automatically on every push and PR (see `.github/workflows/ci.yml`).

---

## Code Style Rules

### TypeScript / React

- **Formatter:** [Prettier](https://prettier.io/) — config in `.prettierrc`
  - `printWidth: 100`, `semi: true`, `singleQuote: false`, `trailingComma: "all"`
- **Linter:** ESLint with `typescript-eslint` + `eslint-plugin-react-hooks`
- Run before committing: `npm run lint && npm run format`
- Server-only modules must use the `.server.ts` suffix — never import `server-only` (TanStack Start convention)

### Python

- **Python version:** 3.11+ (typed hints used throughout)
- **Package manager:** `uv` only — never `pip install` directly in a project venv
- FastAPI route files live in `src/tracemark_api/routes/` and `src/tracemark_admin_api/routes/`
- Every admin-api mutation **must** call `write_audit_log` — no exceptions
- New dependencies: add to `pyproject.toml`, then run `uv lock` and commit the lockfile

---

## Git Workflow

### When to create a branch

| Situation | Branch prefix |
|-----------|--------------|
| New feature | `feature/short-name` |
| Bug fix | `fix/short-name` |
| Security fix | `fix/security-short-name` |
| Experiment | `experiment/short-name` |
| Quick single-file fix (<15 min) | Directly on `main` |

### Branch name examples

```
feature/automation-rules-builder
feature/admin-scraper-health-page
fix/infringement-idor
fix/security-ssrf-guard
experiment/clip-embeddings
```

### Step-by-step workflow

```bash
# 1. Start from up-to-date main
git switch main
git pull

# 2. Create your branch
git switch -c feature/my-feature

# 3. Work and make atomic commits
git add apps/api/routes/rules.py
git commit -m "Add GET/POST /api/v1/rules endpoint"

git add src/routes/settings/automation.tsx
git commit -m "Add /settings/automation rules builder page"

# 4. Push to GitHub
git push -u origin feature/my-feature

# 5. Open a Pull Request on GitHub → review → merge into main
```

### Commit message format

Every commit must follow this structure:

```
Short imperative summary (max 72 characters)

Backend:
- routes/rules.py: add PATCH /rules/bulk endpoint
- services/rules_engine.py: evaluate conditions against new infringement

Frontend:
- AutomationRules.tsx: rules list with enable/disable toggles
- RuleDialog.tsx: condition + action selectors
```

**Rules:**
- Title: imperative mood — "Add login form", not "Added" or "Adding"
- Body: group changes by area (Backend / Frontend / Config / DB)
- Reference the file and what changed, plus the motivation when non-obvious
- Omit the body only for truly trivial one-liner fixes

### Pull Request rules

1. PR title mirrors the commit title format (imperative, ≤72 chars).
2. Description lists what changed and why — reviewers should not need to read every diff line to understand the intent.
3. Every feature PR must satisfy the **Admin Portal parity rule** (see below) before it can be merged.
4. CI must pass: TypeScript checks + dependency audits.

---

## Admin Portal Parity Rule

Any feature that creates, stores, or changes customer data **must** be wired into the Admin Portal as part of the same task. A feature is **not done** until staff can see and manage it from `apps/admin`.

Checklist for every new feature:

- [ ] `apps/admin-api` route reading the new data across all orgs via `customer_sb()`, gated by `require_permission`
- [ ] PATCH/DELETE routes in `apps/admin-api` writing the same Supabase tables (with `write_audit_log` on every mutation)
- [ ] New permission key added to **both** `apps/admin-api/.../permissions.py` AND `apps/admin/src/lib/permissions.ts`
- [ ] UI surfaced in `apps/admin` under the relevant Company / Case / User view, gated with `<Can permission="...">`
- [ ] Operations that must stay in the main API (SMTP, entitlements, metrics) go through `/internal/*` endpoints — never duplicated in admin-api

---

## Tracking Files

Keep these three files accurate after every session:

| File | Purpose |
|------|---------|
| `plan.md` | Active plan — what we are building now and why |
| `todo.md` | Task checklist with done/pending status |
| `docs/.roadmap/roadmap.md` | Full roadmap; mark ✅ only when both customer app and admin portal are wired |

---

## Troubleshooting

### "Module not found" when running Python backend

The Python packages use `src/` layout. Always include `PYTHONPATH=src`:

```bash
cd apps/api && PYTHONPATH=src .venv/bin/python -m uvicorn tracemark_api.main:app --port 8000
```

### Changes to Python code not reflected after restart

There is no hot-reload. Kill the uvicorn process (`Ctrl+C`) and start it again.

### Supabase migration fails with "already exists"

Check which migrations are already applied:

```bash
supabase migration list
```

If a migration is missing from the remote but exists locally, use `supabase db push` — it only applies unapplied migrations.

### Admin frontend shows blank page / auth loop

Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set in the root `.env` and that the admin Vite config reads `envDir` from the repo root.

### Internal API calls return 403 "IP not allowed"

The `/internal/*` endpoints are restricted to loopback + Docker bridge IPs. When calling from a new network or machine, add the IP to `INTERNAL_API_ALLOWED_IPS` in `.env`.

### Stripe webhook events not received locally

Use the Stripe CLI to forward events:

```bash
stripe listen --forward-to localhost:8000/api/v1/billing/webhook
```

Copy the printed webhook secret into `STRIPE_WEBHOOK_SECRET` in `.env`.

### `playwright install` required for screenshot scraper

If the screenshot scraper throws a "browser not found" error:

```bash
cd apps/api && .venv/bin/python -m playwright install chromium
```

---

## Key Documentation

| Document | Location |
|----------|---------|
| Active plan | `plan.md` |
| Task checklist | `todo.md` |
| Full feature roadmap | `docs/.roadmap/roadmap.md` |
| Stripe billing setup | `docs/BILLING.md` |
| Security audit findings | `security-audit.md` |
| Monorepo architecture | `docs/monorepo-structure.md` |
| Main API details | `apps/api/README.md` |
