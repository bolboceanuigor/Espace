#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

mkdir -p backups
timestamp="$(date +%Y%m%d_%H%M%S)"
outfile="backups/espace_${timestamp}.dump"

pg_dump "$DATABASE_URL" --format=custom --file="$outfile"
echo "Backup created: $outfile"
