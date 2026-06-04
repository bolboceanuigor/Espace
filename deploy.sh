#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-staging}"

if [[ "$TARGET" != "staging" && "$TARGET" != "production" ]]; then
  echo "Usage: ./deploy.sh [staging|production]"
  exit 1
fi

ENV_FILE=".env.${TARGET}.local"
COMPOSE_FILE="docker-compose.prod.yml"

step() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

step "Checking prerequisites"
require_cmd git
require_cmd npm
require_cmd docker
docker compose version >/dev/null 2>&1 || fail "docker compose plugin is required"

[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"
[[ -f "package.json" ]] || fail "Run this script from the repository root"
[[ -f "backend/package.json" ]] || fail "Missing backend/package.json"
[[ -f "frontend/package.json" ]] || fail "Missing frontend/package.json"

step "Checking git state"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Repository is not a git worktree"
CURRENT_BRANCH="$(git branch --show-current || true)"
if [[ -n "$(git status --porcelain)" ]]; then
  fail "Worktree is dirty. Commit or stash changes before deploy."
fi
echo "Branch: ${CURRENT_BRANCH:-unknown}"

step "Checking local env and safety flags"
APP_ENV_VALUE="$(grep -E '^APP_ENV=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' || true)"
APP_DEBUG_VALUE="$(grep -E '^APP_DEBUG=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' || true)"
NODE_ENV_VALUE="$(grep -E '^NODE_ENV=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' || true)"

echo "ENV file: $ENV_FILE"
echo "APP_ENV: ${APP_ENV_VALUE:-unset}"
echo "APP_DEBUG: ${APP_DEBUG_VALUE:-unset}"
echo "NODE_ENV: ${NODE_ENV_VALUE:-unset}"

if [[ "$TARGET" == "production" ]]; then
  [[ "${APP_ENV_VALUE:-}" == "production" ]] || fail "APP_ENV must be production in $ENV_FILE"
  [[ "${APP_DEBUG_VALUE:-}" == "false" ]] || fail "APP_DEBUG must be false in $ENV_FILE"
fi

step "Checking writable paths"
mkdir -p backend/uploads backups
[[ -w backend/uploads ]] || fail "backend/uploads is not writable"
[[ -w backups ]] || fail "backups directory is not writable"

step "Refreshing repository"
git pull --ff-only

step "Installing dependencies"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

step "Running application build"
npm run build

step "Reminder: create backups before migrations"
echo "Recommended before continue:"
echo "  - backup database"
echo "  - backup uploads"
echo "  - confirm current release/tag"

if [[ "$TARGET" == "production" ]]; then
  read -r -p "Type DEPLOY_PRODUCTION to continue with production migration and rollout: " CONFIRM
  [[ "$CONFIRM" == "DEPLOY_PRODUCTION" ]] || fail "Production deploy cancelled"
else
  read -r -p "Continue with staging migration and rollout? [y/N] " CONFIRM
  [[ "$CONFIRM" =~ ^[Yy]$ ]] || fail "Staging deploy cancelled"
fi

step "Building and starting containers"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres

step "Running safe Prisma migration deploy"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend npx prisma migrate deploy
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm backend npx prisma generate

step "Starting application services"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

step "Health checks"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

APP_URL_VALUE="$(grep -E '^APP_URL=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"' || true)"
if [[ -n "${APP_URL_VALUE:-}" ]]; then
  echo "Testing health endpoint on ${APP_URL_VALUE%/}/api/health"
  curl -fsS "${APP_URL_VALUE%/}/api/health" || fail "Health check failed"
fi

step "Deploy completed"
echo "Target: $TARGET"
echo "Env file: $ENV_FILE"
echo "Next steps:"
echo "  - run browser smoke tests"
echo "  - verify auth"
echo "  - verify uploads"
echo "  - verify notifications"
echo "  - keep online payments disabled unless live provider verification is complete"

# Rollback notes:
# 1. Redeploy the previous git commit/tag with the same script.
# 2. Restore DB only if a migration caused irreversible business regression.
# 3. Never run destructive reset commands on production.
