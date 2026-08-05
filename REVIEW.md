# Review instructions (HAKKIU)

These override defaults for the Claude PR review action (`.github/workflows/pr-review.yml`).
Keep reviews short and high-signal.

## What counts as "Important"

Flag as Important ONLY:

- **Auth / tenant leaks** — an endpoint or query that can read or write another
  organization's data, or is missing a `require_permission` / owner check.
- **Secrets** — any real credential added to a tracked file. Credentials belong
  ONLY in the root `.env` (git-ignored). `.env.example` must hold placeholders.
- **SSRF / injection** — outbound fetches on user-supplied URLs without the
  existing SSRF guard; unparameterised query building.
- **Admin-parity rule broken** — a new/changed customer-data resource in
  `apps/api/.../routes/` or customer `src/` with NO matching admin surface in
  `apps/admin-api/.../routes/` (route + `write_audit_log`) and NO permission key
  in BOTH `apps/admin-api/.../permissions.py` and `apps/admin/src/lib/permissions.ts`.
- **Data loss** — destructive migrations or deletes without scoping.

Everything else (style, naming, micro-optimisation) is a Nit at most.

## Cap the noise

- Report at most **5 Nits** per review. If more exist, summarise as
  "plus N similar minor items".
- Do not repeat what the deterministic CI checks already cover (ruff, the secret
  scanner, the admin-parity script). Assume those run separately.

## Do not report

- Generated files, lockfiles (`package-lock.json`), `*.min.*`.
- The internal Python package names (`tracemark_api`, `tracemark_admin_api`) —
  these are intentionally NOT renamed to "hakkiu". Do not suggest renaming them.
- Missing tests for admin-api (known gap, tracked in todo.md) — mention once only.

## Always check

- New list endpoints are scoped to the caller's organization.
- Mutations in admin-api call `write_audit_log`.
- Log lines and error messages do not include full request bodies, emails, or keys.
