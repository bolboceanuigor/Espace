#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "==> Starting database"
npm run db:up

echo "==> Resetting schema (DEV)"
npm --prefix backend exec prisma db push --force-reset --accept-data-loss
npm --prefix backend exec prisma generate
npm --prefix backend run prisma:seed

echo "==> Starting backend + frontend"
npm run dev
