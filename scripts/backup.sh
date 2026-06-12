#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/var/www/atlasmassage/apps/api/.env"
BACKUP_DIR="/var/backups/atlasmassage"
DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
KEEP_DAILY=7
KEEP_WEEKLY=4

# Load DB credentials from app .env
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-atlasmassage}"

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DOW=$(date +%u)   # 1=Monday … 7=Sunday
DUMP_FILE="$DAILY_DIR/atlas_${TIMESTAMP}.dump"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of $DB_NAME"

PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -Fc \
  "$DB_NAME" \
  -f "$DUMP_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daily backup written: $DUMP_FILE"

# Prune: remove oldest daily backups beyond KEEP_DAILY
find "$DAILY_DIR" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' \
  | sort -rn \
  | awk -v keep="$KEEP_DAILY" 'NR > keep {print $2}' \
  | xargs -r rm -f

# On Sunday, promote today's backup to weekly and prune old weeklies
if [ "$DOW" -eq 7 ]; then
  WEEKLY_FILE="$WEEKLY_DIR/atlas_weekly_${TIMESTAMP}.dump"
  cp "$DUMP_FILE" "$WEEKLY_FILE"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Weekly backup written: $WEEKLY_FILE"

  find "$WEEKLY_DIR" -maxdepth 1 -name '*.dump' -printf '%T@ %p\n' \
    | sort -rn \
    | awk -v keep="$KEEP_WEEKLY" 'NR > keep {print $2}' \
    | xargs -r rm -f
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete"
