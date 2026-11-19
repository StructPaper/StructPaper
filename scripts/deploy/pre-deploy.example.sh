#!/bin/bash
# ==============================================================================
# Sample pre-deploy database backup hook.
# Copy this file to <env dir>/pre-deploy.sh (chmod 750, chown dev:dev)
# ==============================================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[pre-deploy] Backing up database to $BACKUP_FILE..."

# Read DATABASE_URL from .env
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_DIR/.env" | tail -n1 | cut -d= -f2- || true)"
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not found in $APP_DIR/.env" >&2
  exit 1
fi

# Run pg_dump via docker-compose postgres or local pg_dump
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
elif command -v docker >/dev/null 2>&1; then
  # Note: ensure client tools match or exceed the target PostgreSQL major version
  docker run --rm --network infra postgres:16-alpine pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
else
  echo "ERROR: neither pg_dump nor docker is available to perform backup" >&2
  exit 1
fi

echo "[pre-deploy] Database backup completed: $(ls -lh "$BACKUP_FILE")"

# Keep the newest 7 backup archives, remove older ones
find "$BACKUP_DIR" -name 'db_backup_*.sql.gz' -type f | sort -r | tail -n +8 | xargs -r rm -f 2>/dev/null || true
