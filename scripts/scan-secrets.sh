#!/usr/bin/env bash
# scan-secrets.sh — deterministic committed-credential scanner.
#
# Scans ONLY git-tracked files (via `git ls-files`), so the root `.env`
# (git-ignored) and dependency dirs are never scanned. This is the cheap,
# 100%-reliable bottom layer of the "judge" — it catches obvious secrets that
# should never be committed. The AI PR review (pr-review.yml) is the smarter
# layer on top. Run locally with: bash scripts/scan-secrets.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# High-confidence secret patterns. Deliberately conservative to avoid false
# positives on public values (e.g. Supabase anon/publishable JWTs, which are
# `eyJ...` and intentionally client-side — they are NOT matched here).
# `\b` word boundaries stop prefixes like `re_` from matching inside ordinary
# identifiers (e.g. ensu`re_o`fficial_site_reference). Real keys sit after `=`,
# `:` or a quote, which IS a boundary, so genuine secrets still match.
PATTERNS=(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'   # any PEM private key block
  '\bAKIA[0-9A-Z]{16}\b'                 # AWS access key id
  '\bxox[baprs]-[0-9A-Za-z-]{10,}'       # Slack token
  '\bsk_live_[0-9A-Za-z]{16,}'           # Stripe live secret key
  '\brk_live_[0-9A-Za-z]{16,}'           # Stripe restricted live key
  '\bre_[0-9A-Za-z_]{20,}'               # Resend API key
  '\bAIza[0-9A-Za-z_-]{35}\b'            # Google API key
  '\bghp_[0-9A-Za-z]{36}\b'              # GitHub personal access token
  '\bsk-[A-Za-z0-9]{32,}'                # OpenAI / generic sk- key
)

# Tracked files to skip (this script itself lists the patterns; lockfiles are noise).
SKIP_REGEX='(^scripts/scan-secrets\.sh$|package-lock\.json$|\.lock$)'

# Lines that are obviously PLACEHOLDERS in templates/docs, not real secrets.
PLACEHOLDER_REGEX='your[-_]|your |example|placeholder|changeme|xxxx|<[a-z]|redacted|\.\.\.'

found=0
while IFS= read -r f; do
  [[ "$f" =~ $SKIP_REGEX ]] && continue
  [ -f "$f" ] || continue
  for pat in "${PATTERNS[@]}"; do
    # Drop placeholder lines (case-insensitive) before deciding it's a hit.
    hits="$(grep -nE "$pat" "$f" 2>/dev/null | grep -viE "$PLACEHOLDER_REGEX" || true)"
    if [ -n "$hits" ]; then
      echo "❌ Possible secret in $f:"
      echo "$hits" | sed 's/^/   /'
      found=1
    fi
  done
done < <(git ls-files)

if [ "$found" -ne 0 ]; then
  echo ""
  echo "Secret scan FAILED — move credentials into the root .env (git-ignored)."
  echo "If this is a false positive, tighten the pattern in scripts/scan-secrets.sh."
  exit 1
fi
echo "✅ Secret scan passed — no committed credentials found."
