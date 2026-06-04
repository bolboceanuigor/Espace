# ESPACE_DEPLOY_SCRIPT_GUIDE

## Ce face scriptul

Fisierul [`/Users/bolboceanu/espace/deploy.sh`](/Users/bolboceanu/espace/deploy.sh) pregateste un deploy controlat pentru stack-ul real Espace:

- verifica repo-ul
- verifica env file-ul
- face `git pull --ff-only`
- instaleaza dependentele
- ruleaza build-ul
- cere confirmare inainte de migrare
- ruleaza `prisma migrate deploy`
- pornește / reimprospateaza containerele
- verifica health endpoint-ul

## Cum se ruleaza pe staging

```bash
chmod +x deploy.sh
./deploy.sh staging
```

Preconditii:

- exista `.env.staging.local`
- Docker este instalat
- DNS/SSL pentru staging sunt deja configurate daca vrei health check public

## Cum se ruleaza pe production

```bash
chmod +x deploy.sh
./deploy.sh production
```

Scriptul cere confirmare explicita inainte de migrari in production.

## Ce trebuie verificat inainte

- backup DB
- backup uploads
- release/tag anterior cunoscut
- `.env.production.local` completat
- `APP_ENV=production`
- `APP_DEBUG=false`
- platile live inca dezactivate daca providerul nu este gata

## Ce backup trebuie facut

- DB dump
- backup uploads / file storage
- backup `.env.production.local`
- backup config proxy / SSL

## Ce faci daca pica deploy-ul

1. opreste rollout-ul
2. identifica pasul care a picat
3. redeploy release-ul anterior
4. restaureaza DB doar daca regresia vine din migratie si nu poate fi reparata altfel

## Comenzi manuale utile dupa deploy

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml ps
curl -fsS https://www.espace.md/api/health
npm run test
```

## Observatie importanta

Scriptul nu foloseste `composer` sau `php artisan`, pentru ca Espace nu este o aplicatie Laravel/PHP. Este monorepo `NestJS + Prisma + Next.js`.
