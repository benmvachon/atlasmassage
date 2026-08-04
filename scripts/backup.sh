#!/usr/bin/env bash
set -euo pipefail

# Encrypted Postgres backup.
#
# Dumps are encrypted with age (https://age-encryption.org) using a PUBLIC
# recipient key. The server can therefore create backups but cannot read them:
# the matching private key lives off-box, so compromising this host does not
# expose the clinical data in past dumps.
#
# Setup (once, on a machine that is NOT this server):
#   age-keygen -o atlas-backup-key.txt      # keep this file safe and offline
#   # copy the "Public key: age1..." line
# Then on the server, add to apps/api/.env:
#   BACKUP_AGE_RECIPIENT=age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
#
# Restore:
#   age -d -i atlas-backup-key.txt atlas_2026-08-03_020000.dump.age > restored.dump
#   pg_restore -d atlasmassage restored.dump
#
# Losing the private key means losing every backup. Store it somewhere durable
# and separate from this server (password manager, offline media, or both).

ENV_FILE="/var/www/atlasmassage/apps/api/.env"

# Load DB credentials and optional overrides from app .env
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/atlasmassage}"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
KEEP_DAILY=7
KEEP_WEEKLY=4

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-atlasmassage}"

# Fail closed. A backup job that stops loudly gets fixed; one that silently
# writes plaintext clinical records to disk does not.
if ! command -v age >/dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: 'age' is not installed. Install it (apt install age) — refusing to write an unencrypted backup." >&2
  exit 1
fi

if [ -z "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: BACKUP_AGE_RECIPIENT is not set in $ENV_FILE — refusing to write an unencrypted backup." >&2
  exit 1
fi

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DOW=$(date +%u)   # 1=Monday … 7=Sunday
DUMP_FILE="$DAILY_DIR/atlas_${TIMESTAMP}.dump.age"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"
# Backups are readable only by the owning user even before encryption is considered.
chmod 700 "$BACKUP_DIR" "$DAILY_DIR" "$WEEKLY_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of $DB_NAME"

# A partial dump left behind by a mid-pipe failure is worse than none: it looks
# like a valid backup until the day you try to restore it.
cleanup_partial() {
  if [ -n "${DUMP_FILE:-}" ] && [ -f "$DUMP_FILE" ]; then
    rm -f "$DUMP_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removed partial dump: $DUMP_FILE" >&2
  fi
}
trap cleanup_partial ERR

# Streamed straight into age — the plaintext dump never touches the filesystem,
# so there is nothing to shred afterwards. `set -o pipefail` (above) makes a
# pg_dump failure fail the whole pipeline rather than yielding a truncated file.
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -Fc \
  "$DB_NAME" \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$DUMP_FILE"

chmod 600 "$DUMP_FILE"
trap - ERR

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daily backup written: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# Prune: remove oldest daily backups beyond KEEP_DAILY
find "$DAILY_DIR" -maxdepth 1 -name '*.dump.age' -printf '%T@ %p\n' \
  | sort -rn \
  | awk -v keep="$KEEP_DAILY" 'NR > keep {print $2}' \
  | xargs -r rm -f

# On Sunday, promote today's backup to weekly and prune old weeklies
if [ "$DOW" -eq 7 ]; then
  WEEKLY_FILE="$WEEKLY_DIR/atlas_weekly_${TIMESTAMP}.dump.age"
  cp "$DUMP_FILE" "$WEEKLY_FILE"
  chmod 600 "$WEEKLY_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly backup written: $WEEKLY_FILE"

  find "$WEEKLY_DIR" -maxdepth 1 -name '*.dump.age' -printf '%T@ %p\n' \
    | sort -rn \
    | awk -v keep="$KEEP_WEEKLY" 'NR > keep {print $2}' \
    | xargs -r rm -f
fi

# Pre-encryption dumps from the old plaintext version of this script, if any are
# still sitting in the backup directory, are a standing exposure. Flag them.
LEGACY=$(find "$BACKUP_DIR" -maxdepth 2 -name '*.dump' -not -name '*.dump.age' | head -5)
if [ -n "$LEGACY" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: unencrypted legacy dumps found — delete these once you have verified an encrypted restore:" >&2
  echo "$LEGACY" >&2
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete"
