# Production Deployment Guide

This guide prepares the platform for a real production server using Docker Compose with `postgres`, `backend`, and `frontend`.

## 1) Server Requirements

- Linux server (Ubuntu 22.04+ recommended)
- 2 vCPU minimum (4 vCPU recommended)
- 4 GB RAM minimum (8 GB recommended)
- 30+ GB SSD
- Open ports: `80`, `443` (and SSH)
- Docker Engine + Docker Compose plugin

## 2) Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 3) Clone Repository

```bash
git clone <your-repo-url> espace
cd espace
```

## 4) Configure Environment

Create real env files from examples and set strong secrets:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Required variables to configure:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `API_URL`
- `CORS_ORIGIN`
- `NODE_ENV=production`
- `PORT`
- `COOKIE_SECURE=true` (for HTTPS)
- `COOKIE_SAMESITE=lax` (or `none` if cross-site auth is required)
- `TRUST_PROXY=true` (when app runs behind reverse proxy)

For production Docker deploy, ensure these are set in the compose environment (or an env file passed with `--env-file`).

## 5) Build and TypeScript Verification

Run before deployment:

```bash
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..
```

This verifies Nest build, Next build, and TypeScript checks.

## 6) Database Migrations (Safe Production Flow)

Never use destructive commands like `prisma migrate reset` in production.

Use only:

```bash
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml run --rm backend npx prisma generate
```

### Seed Production Base Data

Only run base seed on first setup and only on empty/new environments:

```bash
docker compose -f docker-compose.prod.yml run --rm backend npm run seed:production-base
```

Do not run demo seed in production.

## 7) Start Production Stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Services:

- `postgres` (database)
- `backend` (NestJS API)
- `frontend` (Next.js app)

## 8) Health Checks

Configured in `docker-compose.prod.yml`:

- Postgres: `pg_isready`
- Backend: `GET /health`
- Frontend: `GET /health`

Manual verification:

```bash
docker compose -f docker-compose.prod.yml ps
curl -f http://localhost:4000/health
curl -f http://localhost:3000/health
```

## 8.1) Reverse Proxy + SSL Readiness (Nginx example)

Deploy backend/frontend behind a reverse proxy that terminates HTTPS and forwards trusted headers.

```nginx
server {
  listen 443 ssl http2;
  server_name app.example.com;
  ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

  location /api/ {
    proxy_pass http://backend:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://frontend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

With this setup use:
- `FRONTEND_URL=https://app.example.com`
- `API_URL=https://app.example.com`
- `CORS_ORIGIN=https://app.example.com`
- `COOKIE_SECURE=true`
- `TRUST_PROXY=true`

## 9) Production Logging Rules

- Keep `LOG_HTTP=false` in production to avoid debug spam.
- Never log secrets (`JWT_SECRET`, DB passwords, API keys).
- Use service-scoped logs:

```bash
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

## 10) Backup and Restore

### PostgreSQL Backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U espace -d espace_db | gzip > backup_$(date +%F_%H%M%S).sql.gz
```

### PostgreSQL Restore

```bash
gunzip -c backup_YYYY-MM-DD_HHMMSS.sql.gz | \
docker compose -f docker-compose.prod.yml exec -T postgres psql -U espace -d espace_db
```

### Storage Backup Notes

- Backup Docker volume holding Postgres data (`postgres_data`) regularly.
- Backup user-uploaded assets storage (if mounted volume/object storage is used).
- Keep at least daily backups with retention policy (7/14/30 days based on SLA).

## 11) Update Procedure

For each production release:

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d
```

## 12) Production Safety Checklist

- `SEED=false` and `SEED_DEMO=false` in production.
- Demo reset endpoint affects only organizations with `isDemo=true`.
- CORS wildcard (`*`) is forbidden in production.
- Backups are taken before every migration/deploy.

## 13) Final Verification Commands

```bash
# local build verification
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# production migration
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# production start
docker compose -f docker-compose.prod.yml up -d
```
