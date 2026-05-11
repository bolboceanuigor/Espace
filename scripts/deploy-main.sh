#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git checkout main

rm -f pnpm-lock.yaml
rm -f frontend/pnpm-lock.yaml
rm -f backend/pnpm-lock.yaml
rm -f yarn.lock
rm -f frontend/yarn.lock
rm -f backend/yarn.lock
rm -f bun.lock
rm -f frontend/bun.lock
rm -f backend/bun.lock

npm install
npm run build

git add .

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "${1:-Update Espace main deployment}"
fi

git push origin main

echo "Done. Code pushed to GitHub main."
echo "Now make sure Vercel and Render are both configured to deploy main."
