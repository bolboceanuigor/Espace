#!/usr/bin/env sh
set -eu

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting backend..."
exec npm run start:prod
