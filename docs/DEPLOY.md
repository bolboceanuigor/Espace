# Deploy Guide (First Customer)

Stable production baseline without payments/channels sync.

## 1) DNS + Domain

Use one domain and proxy API via `/api`.

1. Create DNS A record:
   - `domain.tld -> VPS_PUBLIC_IP`
2. Wait for DNS propagation.

## 2) Install Docker

On VPS:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 3) Production Env

1. Copy env template:

```bash
cp .env.production .env.production.local
```

2. Set required vars in `.env.production.local`:

Backend:
- `DATABASE_URL` (composed from `POSTGRES_PASSWORD` in compose)
- `JWT_SECRET`
- `FRONTEND_URL=https://domain.tld`
- `APP_URL=https://domain.tld`
- `NODE_ENV=production`
- `EMAIL_PROVIDER=console` (or `resend` later)
- `SEED=false`

Frontend:
- `NEXT_PUBLIC_API_URL=https://domain.tld/api`

## 4) Compose Up

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d --build
```

Services:
- `db` (internal network only, no public `5432`)
- `backend`
- `frontend`
- `caddy` (TLS + reverse proxy)

All services use `restart: unless-stopped`.

## 5) Migrations Flow (Production)

Never use `prisma db push` in production.

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose --env-file .env.production.local -f docker-compose.prod.yml exec backend npx prisma generate
```

Seed remains OFF unless explicitly needed.

## 6) Health + Monitoring

Health endpoint:
- `GET https://domain.tld/api/health`

Use uptime monitor (or Caddy upstream health checks) against `/api/health`.

## 7) Backups (Daily + 7-day Retention)

Manual backup:

```bash
POSTGRES_PASSWORD=... ./infra/backup-db.sh
```

Restore:

```bash
POSTGRES_PASSWORD=... ./infra/restore-db.sh ./backups/<backup>.sql.gz
```

Daily cron (example):

```bash
0 2 * * * cd /opt/espace && POSTGRES_PASSWORD=... ./infra/backup-db.sh >> /var/log/espace-backup.log 2>&1
```

`infra/backup-db.sh` rotates backups older than 7 days.

## 8) Security Minimum

- `helmet` enabled
- strict CORS in production (`FRONTEND_URL` / `CORS_ORIGIN`)
- auth cookies: `httpOnly`, `secure`, `sameSite=lax`
- auth throttling enabled (`login/register/...`)
- dev seed disabled in prod (`SEED=false`, `SEED_DEMO=false`)
- dev-only UI helpers hidden in production

## 9) Smoke Tests (Go-Live)

1. `GET /api/health` returns `ok=true`.
2. Open app and login.
3. Create property.
4. Create reservation from calendar.
5. Check cleaning auto-created.
6. Switch language RO/RU/EN.
7. Manager cannot access `/team`.
8. Export reservations CSV works.
