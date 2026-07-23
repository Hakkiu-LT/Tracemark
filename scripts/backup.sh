#!/usr/bin/env bash
# HAKKIU — nightly Postgres backup → local + off-site (Hetzner Storage Box).
#
# Supabase already takes its own daily backups (on paid plans); this is a
# belt-and-suspenders off-site copy you fully control.
#
# Setup (on the server):
#   1) Install the Postgres client:   sudo apt-get install -y postgresql-client
#   2) In /opt/hakkiu/.env set:
#        DATABASE_URL=postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres
#        BACKUP_SSH_TARGET=uXXXXXX@uXXXXXX.your-storagebox.de   (optional; off-site copy)
#   3) Add to crontab (daily 03:15):
#        15 3 * * * /opt/hakkiu/scripts/backup.sh >> /var/log/hakkiu-backup.log 2>&1
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/hakkiu/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/hakkiu-db-${STAMP}.sql.gz"

# Load .env (DATABASE_URL, BACKUP_SSH_TARGET) if present.
if [[ -f /opt/hakkiu/.env ]]; then
  set -a; source /opt/hakkiu/.env; set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set (add it to /opt/hakkiu/.env)." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Is)] Dumping database → ${OUT}"
pg_dump "${DATABASE_URL}" --no-owner --no-privileges | gzip -9 > "${OUT}"
echo "[$(date -Is)] Dump size: $(du -h "${OUT}" | cut -f1)"

# Off-site copy to Hetzner Storage Box (optional).
if [[ -n "${BACKUP_SSH_TARGET:-}" ]]; then
  echo "[$(date -Is)] Copying off-site → ${BACKUP_SSH_TARGET}"
  # Storage Box supports SFTP; -p 23 is Hetzner's SSH/SFTP port.
  scp -P 23 "${OUT}" "${BACKUP_SSH_TARGET}:backups/" || \
    echo "WARN: off-site copy failed (check BACKUP_SSH_TARGET + SSH key)." >&2
fi

# Prune local backups older than RETENTION_DAYS.
echo "[$(date -Is)] Pruning local backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name 'hakkiu-db-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Is)] Backup complete."
