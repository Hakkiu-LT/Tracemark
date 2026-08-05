#!/usr/bin/env bash
# check-admin-parity.sh — enforces the CLAUDE.md "Admin Portal parity" rule.
#
# Rule: any customer-facing resource in apps/api/.../routes/ that manages
# customer data MUST also be reachable from the admin portal — i.e. have a
# matching admin route file AND a permission key. This is a HEURISTIC (grep +
# file existence), not a proof, so it is tuned for LOW false positives:
#   * SKIP_ROUTES   — resources that legitimately need no admin surface.
#   * KNOWN_GAPS    — pre-existing violations we have consciously accepted
#                     (baseline). These WARN but do not fail the build, so CI
#                     stays green today while any NEW uncovered route fails.
# Run locally with: bash scripts/check-admin-parity.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

CUST_DIR="apps/api/src/tracemark_api/routes"
ADMIN_DIR="apps/admin-api/src/tracemark_admin_api/routes"
PERMS="apps/admin-api/src/tracemark_admin_api/permissions.py"

# Resources with no persistent customer data to manage, or internal-only.
SKIP_ROUTES="__init__ auth health internal slack_interactions support usage documents"

# Consciously-accepted pre-existing gaps (see todo.md). WARN, do not fail.
# Remove an entry here the moment its admin coverage lands.
KNOWN_GAPS="clients"

is_in() { local n="$1"; shift; for x in "$@"; do [ "$x" = "$n" ] && return 0; done; return 1; }

violations=0
warnings=0

for route in "$CUST_DIR"/*.py; do
  base="$(basename "$route" .py)"
  is_in "$base" $SKIP_ROUTES && continue

  # monitoring.py splits its admin surface across cases.py + takedowns_admin.py.
  if [ "$base" = "monitoring" ]; then
    if [ ! -f "$ADMIN_DIR/cases.py" ] && [ ! -f "$ADMIN_DIR/takedowns_admin.py" ]; then
      echo "❌ $base.py: no admin coverage (expected cases.py or takedowns_admin.py)"
      violations=$((violations + 1))
    fi
    continue
  fi

  has_admin=0
  { [ -f "$ADMIN_DIR/${base}_admin.py" ] || [ -f "$ADMIN_DIR/${base}.py" ]; } && has_admin=1

  has_perm=0
  grep -qE "\"${base}\." "$PERMS" && has_perm=1

  if [ "$has_admin" -eq 1 ] && [ "$has_perm" -eq 1 ]; then
    continue
  fi

  if is_in "$base" $KNOWN_GAPS; then
    echo "⚠️  $base.py: known admin-parity gap (admin_file=$has_admin perm=$has_perm) — tracked in todo.md"
    warnings=$((warnings + 1))
  else
    echo "❌ $base.py: missing admin parity (admin_file=$has_admin perm=$has_perm)"
    echo "     → add $ADMIN_DIR/${base}_admin.py + a \"${base}.*\" permission key"
    violations=$((violations + 1))
  fi
done

echo ""
echo "Admin-parity: $violations new violation(s), $warnings known gap(s)."
if [ "$violations" -gt 0 ]; then
  echo "See CLAUDE.md § 'MANDATORY RULE — Admin Portal parity for every feature'."
  exit 1
fi
echo "✅ Admin-parity check passed."
