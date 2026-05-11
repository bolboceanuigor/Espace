#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/bolboceanu/espace"
cd "$PROJECT_DIR"

echo "==> Espace deploy all"

if [ -f ".deploy.env" ]; then
  set -a
  source ".deploy.env"
  set +a
else
  echo "⚠️  .deploy.env nu există. Continui doar cu GitHub push."
fi

BRANCH="$(git branch --show-current)"
if [ -z "$BRANCH" ]; then
  echo "❌ Nu pot detecta branch-ul curent."
  exit 1
fi

echo "==> Branch curent: $BRANCH"

echo "==> Verific status Git"
git status

echo "==> Rulez build local"
npm run build

echo "==> Adaug modificările"
git add .

if git diff --cached --quiet; then
  echo "ℹ️  Nu există modificări noi pentru commit."
else
  COMMIT_MESSAGE="${1:-deploy refresh all services}"
  echo "==> Commit: $COMMIT_MESSAGE"
  git commit -m "$COMMIT_MESSAGE"
fi

echo "==> Push pe GitHub"
git push origin "$BRANCH"

echo "==> Trigger Vercel deploy hook"
if [ -n "${VERCEL_DEPLOY_HOOK_URL:-}" ] && [ "$VERCEL_DEPLOY_HOOK_URL" != "PALOY_HOOK_URL_HERE" ]; then
  curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL" >/dev/null
  echo "✅ Vercel redeploy pornit"
else
  echo "⚠️  VERCEL_DEPLOY_HOOK_URL nu este setat. Sar peste Vercel hook."
fi

echo "==> Trigger Render backend deploy hook"
if [ -n "${RENDER_BACKEND_DEPLOY_HOOK_URL:-}" ] && [ "$RENDER_BACKEND_DEPLOY_HOOK_URL" != "PASTE_RENDER_BACKEND_DEPLOY_HOOK_URL_HERE" ]; then
  curl -fsS -X POST "$RENDER_BACKEND_DEPLOY_HOOK_URL" >/dev/null
  echo "✅ Render backend redeploy pornit"
else
  echo "⚠️  RENDER_BACKEND_DEPLOY_HOOK_URL nu este setat. Sar peste Render backend hook."
fi

if [ -n "${RENDER_WORKER_DEPLOY_HOOK_URL:-}" ]; then
  echo "==> Trigger Render worker deploy hook"
  curl -fsS -X POST "$RENDER_WORKER_DEPLOY_HOOK_URL" >/dev/null
  echo "✅ Render worker redeploy pornit"
fi

if [ -n "${RENDER_CRON_DEPLOY_HOOK_URL:-}" ]; then
  echo "==> Trigger Render cron deploy hook"
  curl -fsS -X POST "$RENDER_CRON_DEPLOY_HOOK_URL" >/dev/null
  echo "✅ Render cron redeploy pornit"
fi

echo "✅ GitHub push făcut"
echo "✅ Deploy hooks trimise unde au fost configurate"
echo "Verifică Vercel Dashboard și Render Dashboard pentru statusul build-urilor."
