#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/espace_${TIMESTAMP}.sql.gz"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

mkdir -p "$BACKUP_DIR"

docker compose -f docker-compose.prod.yml exec -T db sh -lc \
  "PGPASSWORD='$POSTGRES_PASSWORD' pg_dump -U espace -d espace_db" | gzip > "$FILE"

find "$BACKUP_DIR" -type f -name "espace_*.sql.gz" -mtime +7 -delete
echo "Backup complete: $FILE"
