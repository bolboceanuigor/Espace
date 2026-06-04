# ESPACE_STAGING_DEPLOY_GUIDE

Data: 2026-06-03

## 0. Rezumat important

Espace SaaS nu este un proiect Laravel/PHP. Stack-ul real pentru staging este:

- `Backend`: NestJS + Prisma + PostgreSQL
- `Frontend`: Next.js 14 + React 18
- `Build/runtime`: Node.js
- `Scheduler`: `@nestjs/schedule` în backend
- `Uploads`: local disk în `backend/uploads` sau storage configurat ulterior

Prin urmare:

- `composer` și `php artisan` nu fac parte din flow-ul principal de deploy al Espace
- nu există `APP_KEY` Laravel
- echivalentul pentru migrații este `prisma migrate deploy`
- echivalentul pentru cache/view/route cache este build-ul Node + restart serviciu

Acest ghid pregătește stagingul pentru stack-ul real al Espace.

---

## 1. Cerințe server

### Cerințe reale pentru Espace

- OS: Ubuntu 22.04+ sau alt Linux modern
- CPU: minim `2 vCPU`, recomandat `4 vCPU`
- RAM: minim `4 GB`, recomandat `8 GB`
- Disk: minim `30 GB SSD`
- Node.js: `20.x`
- npm: `10.x` sau versiunea livrată cu Node 20
- PostgreSQL: `15+`
- SSL: obligatoriu pe staging public
- Reverse proxy: Caddy sau Nginx

### Cerințe opționale

- Redis: `nu este folosit în prezent`
- Queue worker separat: `nu există în prezent`
- Storage extern (S3/Supabase): opțional; build-ul curent funcționează și cu storage local

### Cerințe Docker baseline

Dacă folosești baseline-ul existent din repo:

- Docker Engine
- Docker Compose plugin

### Cerințe Laravel/PHP cerute în brief

Nu se aplică pentru repo-ul principal Espace:

- PHP version: `N/A`
- extensii PHP: `N/A`
- Composer: `N/A`
- `php artisan`: `N/A`

---

## 2. Alegerea modului de deploy

### Varianta recomandată pentru staging

Folosește `docker-compose.prod.yml` + `deploy/Caddyfile`.

Avantaje:

- reproduce stack-ul repo-ului
- include PostgreSQL, backend, frontend și proxy
- reduce diferențele dintre staging și producție

### Variante alternative

- `Frontend pe Vercel` + `Backend pe Render`
- `Frontend și backend cu systemd/pm2` pe același VPS

Pentru staging rapid și controlat, baseline-ul Docker Compose este cel mai simplu.

---

## 3. Fișiere de configurare folosite

### Root

- [`.env.example`](/Users/bolboceanu/espace/.env.example)
- [`.env.staging`](/Users/bolboceanu/espace/.env.staging)
- [`docker-compose.prod.yml`](/Users/bolboceanu/espace/docker-compose.prod.yml)
- [`deploy/Caddyfile`](/Users/bolboceanu/espace/deploy/Caddyfile)

### Backend

- [`backend/.env.example`](/Users/bolboceanu/espace/backend/.env.example)
- [`backend/prisma/schema.prisma`](/Users/bolboceanu/espace/backend/prisma/schema.prisma)
- [`backend/docker-entrypoint.sh`](/Users/bolboceanu/espace/backend/docker-entrypoint.sh)

### Frontend

- [`frontend/.env.example`](/Users/bolboceanu/espace/frontend/.env.example)

---

## 4. Pregătire server

### 4.1 Instalează Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

### 4.2 DNS + SSL

- configurează `staging.espace.md` sau domeniul tău de staging
- pointează domeniul către IP-ul serverului
- lasă Caddy sau Nginx să facă TLS

### 4.3 Firewall

Permite:

- `22` pentru SSH
- `80` pentru HTTP
- `443` pentru HTTPS

Nu expune public:

- `5432`
- porturile interne `3000` și `4000`

---

## 5. Clone repo și instalare

```bash
git clone <repo-url> espace
cd espace
npm install
```

### Build local înainte de deploy

```bash
npm run build
```

Acest pas verifică:

- build backend NestJS
- build frontend Next.js
- type safety pentru build-ul principal

---

## 6. Configurare `.env`

Pentru staging Docker, folosește trei fișiere separate:

### 6.1 Root env pentru `docker compose`

```bash
cp .env.staging .env.staging.local
```

Acest fișier este folosit pentru:

- substituție de variabile în `docker-compose.prod.yml`
- valori comune pentru backend și frontend

### 6.2 Backend env

```bash
cp backend/.env.example backend/.env
```

Acest fișier este util pentru:

- rulare locală a backendului
- build server-side
- debugging non-Docker

### 6.3 Frontend env pentru build

```bash
cp frontend/.env.example frontend/.env.production.local
```

Important:

- `NEXT_PUBLIC_*` sunt relevante la build time pentru Next.js
- dacă faci Docker build fără acest fișier sau fără env build-time echivalent, frontend-ul poate fi construit cu valori greșite

---

## 7. Variabile `.env` necesare

## 7.1 Variabile reale folosite de Espace

### Backend / runtime

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FRONTEND_URL`
- `APP_URL`
- `API_URL`
- `CORS_ORIGIN`
- `CORS_ALLOW_VERCEL_PREVIEWS`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `COOKIE_DOMAIN`
- `TRUST_PROXY`
- `LOG_HTTP`
- `APP_VERSION`
- `FILE_STORAGE_PROVIDER`

### Email / notifications

- `NOTIFICATIONS_EXTERNAL_ENABLED`
- `NOTIFICATIONS_DEV_MODE`
- `EMAIL_PROVIDER`
- `EMAIL_FROM_NAME`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_REPLY_TO`
- `EMAIL_FROM`
- `SUPPORT_EMAIL`
- `RESEND_API_KEY`
- `SENDGRID_API_KEY`
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAIL_ENABLED`
- `MAIL_FROM`
- `EMAIL_API_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_PASS`
- `SMS_PROVIDER`
- `SMS_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `CUSTOM_SMS_ENDPOINT`
- `CUSTOM_SMS_API_KEY`

### Auth / feature flags

- `ENABLE_GOOGLE_AUTH`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `ENABLE_DEMO_LOGIN`
- `ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK`
- `ENABLE_CHANNELS_UI`

### Payments

- `PAYMENTS_EXTERNAL_ENABLED`
- `PAYMENTS_TEST_MODE`
- `BPAY_ENABLED`
- `BPAY_MERCHANT_ID`
- `BPAY_API_KEY`
- `BPAY_SECRET`

### Optional bootstrap / seed

- `SEED`
- `SEED_DEMO`
- `SEED_SUPERADMIN_PASSWORD`
- `PRODUCTION_SUPERADMIN_EMAIL`
- `PRODUCTION_SUPERADMIN_PASSWORD`
- `PRODUCTION_SUPERADMIN_FIRST_NAME`
- `PRODUCTION_SUPERADMIN_LAST_NAME`
- `PRODUCTION_SUPERADMIN_PHONE`
- `PRODUCTION_SUPERADMIN_ORGANIZATION_ID`

### Web push

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### Frontend public vars

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `NEXT_PUBLIC_ENABLE_BILLING_UI`
- `NEXT_PUBLIC_ENABLE_SOFT_LIMITS`
- `NEXT_PUBLIC_ENABLE_CHANNELS_UI`
- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`
- `NEXT_PUBLIC_ENABLE_DEMO`
- `NEXT_PUBLIC_DEMO_MODE`
- `NEXT_PUBLIC_REQUIRE_BETA_ACCESS`
- `NEXT_PUBLIC_SHOW_DEV_RESET_LINK`
- `NEXT_PUBLIC_DEBUG_API`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 7.2 Variabile cerute în brief, dar nefolosite în codul Espace

Nu am adăugat variabile moarte pentru:

- `APP_NAME`
- `CACHE_DRIVER`
- `QUEUE_CONNECTION`
- `FILESYSTEM_DISK`
- `STRIPE_*`
- `PAYPAL_*`
- `RAZORPAY_*`
- `PAYSTACK_*`
- `FLUTTERWAVE_*`
- `PAYFAST_*`

Motiv:

- codul actual Espace nu le citește
- adăugarea lor în `.env.example` ar crea impresia falsă că sunt deja implementate

Dacă un provider devine real în cod, atunci adaugă variabilele lui explicit.

---

## 8. Exemplu minim de valori pentru staging

```env
DOMAIN=staging.espace.md
NODE_ENV=production

POSTGRES_PASSWORD=replace_me
DATABASE_URL=postgresql://espace:replace_me@postgres:5432/espace_db?schema=public
DIRECT_URL=postgresql://espace:replace_me@postgres:5432/espace_db?schema=public

JWT_SECRET=replace_me_with_a_long_random_secret
JWT_EXPIRES_IN=7d

FRONTEND_URL=https://staging.espace.md
APP_URL=https://staging.espace.md
API_URL=https://staging.espace.md/api
CORS_ORIGIN=https://staging.espace.md

COOKIE_SECURE=true
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=staging.espace.md
TRUST_PROXY=true
LOG_HTTP=false
FILE_STORAGE_PROVIDER=LOCAL

EMAIL_PROVIDER=RESEND
EMAIL_FROM_NAME=Espace
EMAIL_FROM_ADDRESS=no-reply@staging.espace.md
EMAIL_REPLY_TO=support@espace.md
EMAIL_FROM=Espace <no-reply@staging.espace.md>
SUPPORT_EMAIL=support@espace.md
RESEND_API_KEY=

PAYMENTS_EXTERNAL_ENABLED=false
PAYMENTS_TEST_MODE=true
BPAY_ENABLED=false

ENABLE_DEMO_LOGIN=false
ENABLE_CHANNELS_UI=false

NEXT_PUBLIC_APP_URL=https://staging.espace.md
NEXT_PUBLIC_API_URL=https://staging.espace.md/api
NEXT_PUBLIC_SOCKET_URL=https://staging.espace.md
NEXT_PUBLIC_DEFAULT_LOCALE=ro
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
NEXT_PUBLIC_ENABLE_DEMO=false
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_DEBUG_API=false
```

---

## 9. Deploy pe staging cu Docker Compose

### 9.1 Creează fișierele locale de configurare

```bash
cp .env.staging .env.staging.local
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.production.local
```

Completează manual:

- `.env.staging.local`
- `backend/.env`
- `frontend/.env.production.local`

### 9.2 Instalează dependențe

```bash
npm install
```

### 9.3 Build de verificare

```bash
npm run build
```

### 9.4 Migrații Prisma

Rulează înainte de startul final:

```bash
docker compose --env-file .env.staging.local -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
docker compose --env-file .env.staging.local -f docker-compose.prod.yml run --rm backend npx prisma generate
```

### 9.5 Seed minim, doar dacă ai nevoie de bază inițială

Nu rula demo seed.

Seed sigur pentru medii noi:

```bash
docker compose --env-file .env.staging.local -f docker-compose.prod.yml run --rm backend npm run seed:production-base
```

Dacă ai nevoie de bootstrap pentru superadmin:

```bash
docker compose --env-file .env.staging.local -f docker-compose.prod.yml run --rm backend npm run seed:production-superadmin
```

### 9.6 Start stack

```bash
docker compose --env-file .env.staging.local -f docker-compose.prod.yml up -d --build
```

### 9.7 Verifică serviciile

```bash
docker compose --env-file .env.staging.local -f docker-compose.prod.yml ps
docker compose --env-file .env.staging.local -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.staging.local -f docker-compose.prod.yml logs -f frontend
docker compose --env-file .env.staging.local -f docker-compose.prod.yml logs -f postgres
```

---

## 10. Varianta non-Docker

Dacă nu folosești Compose:

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod
```

### Frontend

```bash
cd frontend
npm install
npm run build
npm run start
```

### Reverse proxy

Pune:

- frontend pe `localhost:3000`
- backend pe `localhost:4000`
- proxy public către `/` și `/api`

---

## 11. Comenzi Laravel cerute în brief și echivalentele lor

### Nu se aplică acestui repo

- `composer install`
- `php artisan key:generate`
- `php artisan migrate`
- `php artisan db:seed`
- `php artisan storage:link`
- `php artisan config:cache`
- `php artisan route:cache`
- `php artisan view:cache`
- `php artisan queue:restart`

### Echivalentul în Espace

- `composer install` -> `npm install`
- `php artisan key:generate` -> generezi manual `JWT_SECRET`
- `php artisan migrate` -> `npx prisma migrate deploy`
- `php artisan db:seed` -> `npm run seed:production-base` sau alt seed explicit
- `php artisan storage:link` -> `N/A`, fișierele locale merg în `backend/uploads`
- `php artisan config:cache` -> `N/A`, rebuild + restart serviciu
- `php artisan route:cache` -> `N/A`
- `php artisan view:cache` -> `N/A`
- `php artisan queue:restart` -> restart backend container / service

---

## 12. Queue worker

În build-ul actual:

- nu există worker separat de tip Laravel queue sau BullMQ worker
- notificările și cron jobs rulează prin backend și schedulerul intern NestJS

### Recomandare practică

- rulează `o singură instanță backend` în staging
- nu scala backendul orizontal până nu ai locking distribuit pentru cron jobs

Motiv:

- job-urile din [`backend/src/scheduler/scheduler.service.ts`](/Users/bolboceanu/espace/backend/src/scheduler/scheduler.service.ts) folosesc cron in-process
- mai multe instanțe pot executa aceleași job-uri în paralel

### Dacă folosești systemd

Exemplu pentru backend:

```ini
[Unit]
Description=Espace Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/espace/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start:prod
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

### Comenzi utile

```bash
sudo systemctl restart espace-backend
sudo systemctl status espace-backend
journalctl -u espace-backend -f
```

---

## 13. Scheduler

### Starea actuală

Schedulerul este integrat în backend prin `@nestjs/schedule`.

Job-uri programate identificate:

- `MONTHLY_CHARGES_GENERATOR`
- `MONTHLY_INVOICE_GENERATOR`
- `PAYMENT_REMINDER_JOB`
- `TRIAL_EXPIRATION_JOB`
- `SUBSCRIPTION_BILLING_JOB`
- `OVERDUE_SUBSCRIPTION_JOB`
- `NOTIFICATION_DISPATCHER_JOB`
- `DEBT_REMINDER_JOB`
- `CLIENT_FOLLOW_UP_REMINDER_JOB`

### Cron actual în cod

- `5 0 1 * *` monthly charges
- `20 0 1 * *` monthly invoices
- `0 8 * * *` payment reminders
- `0 1 * * *` trial expiration
- `0 2 1 * *` subscription billing
- `30 2 * * *` overdue subscriptions
- `*/1 * * * *` notification dispatcher
- `15 8 * * *` debt reminders
- `30 8 * * *` client follow-up reminders

### Cron de sistem

Nu este necesar un `cron` extern pentru aceste job-uri, dacă backendul rulează stabil.

Totuși, dacă vrei un health ping extern, poți adăuga un cron care verifică:

```bash
*/5 * * * * curl -fsS https://staging.espace.md/api/health >/dev/null || echo "health failed"
```

### Atenție

- rulează o singură instanță backend cu scheduler activ
- altfel poți avea job-uri duplicate

---

## 14. Permisiuni foldere

### Docker baseline

Docker administrează volumele pentru PostgreSQL.

### Non-Docker

Asigură permisiuni de scriere pentru:

- `backend/uploads`
- directoarele de log dacă folosești loguri pe disc

Exemplu:

```bash
mkdir -p /opt/espace/backend/uploads
chown -R www-data:www-data /opt/espace/backend/uploads
chmod -R 775 /opt/espace/backend/uploads
```

Nu există `storage/` și `bootstrap/cache` ca în Laravel.

---

## 15. Nginx / Apache / Caddy

### Recomandat

Folosește `Caddy`, fiind deja configurat în [`deploy/Caddyfile`](/Users/bolboceanu/espace/deploy/Caddyfile).

### Alternativ Nginx

Forward:

- `/api/*` -> backend `:4000`
- restul -> frontend `:3000`

Asigură headerele:

- `Host`
- `X-Forwarded-For`
- `X-Forwarded-Proto`

### SSL

- obligatoriu pentru staging public
- `COOKIE_SECURE=true`
- `TRUST_PROXY=true`

---

## 16. Securitate staging

- `NODE_ENV=production`
- `LOG_HTTP=false` dacă nu ai nevoie de debug detaliat
- `ENABLE_DEMO_LOGIN=false`
- `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`
- `NEXT_PUBLIC_ENABLE_DEMO=false`
- `NEXT_PUBLIC_DEMO_MODE=false`
- `ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK=false`
- `PAYMENTS_EXTERNAL_ENABLED=false` până ai implementări reale și webhook verification completă
- folosește `EMAIL_PROVIDER=RESEND` sau sandbox; nu folosi inbox-uri reale de clienți
- folosește doar chei sandbox pentru plăți
- limitează accesul la staging prin VPN, allowlist IP sau basic auth
- blochează indexarea publică

### Robots / indexing

Recomandat:

- staging să nu fie indexat
- folosește `X-Robots-Tag: noindex, nofollow` la nivel de proxy dacă expui staging public

---

## 17. Backups

### Înainte de fiecare deploy cu migrații

```bash
docker compose --env-file .env.staging.local -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U espace -d espace_db | gzip > backup_$(date +%F_%H%M%S).sql.gz
```

### Restaurează

```bash
gunzip -c backup_YYYY-MM-DD_HHMMSS.sql.gz | \
docker compose --env-file .env.staging.local -f docker-compose.prod.yml exec -T postgres psql -U espace -d espace_db
```

### Fișiere

Dacă folosești uploads locale:

- include și backup pentru `backend/uploads`

---

## 18. Checklist după deploy

### Health

- `GET /api/health`
- `GET /api/health/db`
- `GET /api/health/readiness`

### Smoke test funcțional

- homepage `/ro`
- login `/ro/login`
- dashboard superadmin
- dashboard admin
- dashboard resident
- creare societate
- creare apartament
- creare factură
- încărcare dovadă plată offline
- email reset / invitație
- upload document permis
- download document autorizat
- notificări in-app
- PDF invoice / receipt

### Verificări operaționale

- `docker compose ... ps`
- loguri backend
- loguri frontend
- loguri postgres
- rularea job-urilor în `/ro/superadmin/jobs`
- `/ro/superadmin/monitoring/health`

### QA critic înainte de lansare

Rulează și checklist-ul manual complet:

- [ESPACE_QA_MANUAL_CHECKLIST.md](/Users/bolboceanu/espace/ESPACE_QA_MANUAL_CHECKLIST.md)

---

## 19. Riscuri cunoscute înainte de staging real

- plățile online externe nu sunt gata pentru producție; folosește `PAYMENTS_EXTERNAL_ENABLED=false`
- job-urile cron nu au locking distribuit; rulează o singură instanță backend
- fișierele locale necesită backup separat dacă nu folosești storage extern
- unele fluxuri de sample/mock interne există încă și trebuie evitate în staging public

---

## 20. Ce trebuie completat manual

- domeniul real de staging
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `RESEND_API_KEY` sau alt provider real
- setări DNS / SSL
- `EMAIL_FROM_*`
- `SUPPORT_EMAIL`
- chei VAPID dacă activezi push
- eventual `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- eventual configurație `BPAY_*`, doar când providerul devine real

---

## 21. Comenzi recomandate de deploy

```bash
git pull
npm install
npm run build

docker compose --env-file .env.staging.local -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
docker compose --env-file .env.staging.local -f docker-compose.prod.yml run --rm backend npx prisma generate

docker compose --env-file .env.staging.local -f docker-compose.prod.yml up -d --build

docker compose --env-file .env.staging.local -f docker-compose.prod.yml ps
docker compose --env-file .env.staging.local -f docker-compose.prod.yml logs -f backend
```
