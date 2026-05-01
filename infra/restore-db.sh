#!/usr/bin/env sh
set -eu

if [ $# -lt 1 ]; then
  echo "Usage: ./infra/restore-db.sh <backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

gzip -dc "$BACKUP_FILE" | docker compose -f docker-compose.prod.yml exec -T db sh -lc \
  "PGPASSWORD='$POSTGRES_PASSWORD' psql -U espace -d espace_db"

echo "Restore complete from: $BACKUP_FILE"
