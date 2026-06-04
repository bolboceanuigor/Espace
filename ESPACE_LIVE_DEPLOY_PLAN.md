# ESPACE_LIVE_DEPLOY_PLAN

## Verdict rapid

- **READY FOR STAGING:** Da
- **READY FOR PRODUCTION:** Nu

## Ce blocheaza live-ul

- platile online reale nu sunt finalizate pentru un provider live
- unele fluxuri de documente mai trebuie mutate complet pe storage privat autorizat
- smoke testul manual complet pe staging nu este inca bifat

## 1. Structura actuala a aplicatiei

### Landing page

- frontend public: [`/Users/bolboceanu/espace/frontend/app/[locale]/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/page.tsx)
- componente publice: [`/Users/bolboceanu/espace/frontend/components/public-site/PublicWebsite.tsx`](/Users/bolboceanu/espace/frontend/components/public-site/PublicWebsite.tsx)

### Login

- frontend login: [`/Users/bolboceanu/espace/frontend/app/[locale]/(auth)/login/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/%28auth%29/login/page.tsx)
- backend auth: [`/Users/bolboceanu/espace/backend/src/auth/auth.controller.ts`](/Users/bolboceanu/espace/backend/src/auth/auth.controller.ts)

### Rute publice

- `/{locale}`
- `/{locale}/login`
- `/{locale}/register`
- `/{locale}/forgot-password`
- `/{locale}/reset-password`
- `/{locale}/verify-email`
- `/{locale}/cere-acces`
- `/{locale}/pricing`, `/{locale}/preturi`
- `/{locale}/platforma`
- `/{locale}/pentru-administratori`
- `/{locale}/pentru-locatari`
- `/{locale}/contact`
- `/{locale}/terms`, `/{locale}/privacy`, `/{locale}/cookies`, `/{locale}/legal`

### Rute admin

- `/{locale}/admin/*`
- backend principal: `api/admin/*`
- auth/rbac: `MvpAuthGuard` sau `JwtAuthGuard`, `MvpRolesGuard` sau `RolesGuard`, plus `PermissionGuard` unde este cazul

### Rute locatar / tenant

- `/{locale}/resident/*`
- backend principal: `api/resident/*`
- auth/rbac: `MvpAuthGuard`/`JwtAuthGuard` + rol `RESIDENT`

### Rute superadmin

- `/{locale}/superadmin/*`
- backend principal: `api/superadmin/*`
- auth/rbac: `SUPERADMIN`

### Rute API

- health: `/health`, `/api/health`, `/api/health/liveness`, `/api/health/readiness`
- auth: `/auth/*` si `/api/auth/*`
- admin/resident/superadmin: sub `/api/...`

### Rute webhook

- plati noi: `POST /api/payments/webhooks/:providerType`
- webhook Telegram notificari: `POST /api/integrations/telegram/webhook`
- webhook legacy plati: `POST /api/payments/webhook/:provider` -> dezactivat cu `410`

### Middleware / protectie

- frontend: [`/Users/bolboceanu/espace/frontend/middleware.ts`](/Users/bolboceanu/espace/frontend/middleware.ts)
  - locale redirect
  - redirect spre login
  - protectie pe rol pentru `/admin`, `/resident`, `/superadmin`
- backend:
  - `MvpAuthGuard`
  - `MvpRolesGuard`
  - `PermissionGuard`
  - `JwtAuthGuard`
  - `RolesGuard`
  - `SubscriptionAccessGuard` pe unele module admin

## 2. Domenii si URL-uri

### Recomandare

- domeniu canonic: **`https://www.espace.md`**
- redirect 301 din `https://espace.md/*` spre `https://www.espace.md/*`
- redirect 301 din `http://...` spre `https://...`

### Impact

- `APP_URL`, `FRONTEND_URL`, `NEXT_PUBLIC_APP_URL`: `https://www.espace.md`
- `API_URL`, `NEXT_PUBLIC_API_URL`: `https://www.espace.md/api`
- `COOKIE_DOMAIN`: `.espace.md`
- `CORS_ORIGIN`: `https://www.espace.md,https://espace.md`
- linkuri email / reset password / invoice: generate cu `www`
- payment success/cancel links: tot cu `www`
- webhook URLs: publicate pe `https://www.espace.md/api/...`

## 3. Ce trebuie pastrat din site-ul actual

- landing page Espace
- butonul de login
- butonul de cere acces / contact
- brandingul Espace
- favicon-ul Espace
- meta title / description Espace
- continutul public deja valid

## 4. Ce trebuie inlocuit / adaptat

- modulele functionale noi/adaptate din analiza SocietyPro, dar doar in stilul Espace
- dashboard-urile interne
- portalul admin si resident
- template-urile de invoice / PDF / emails
- setarile de plata si notificari

## 5. Variabile .env necesare pentru productie

### Aplicatie

- `APP_NAME`
- `APP_ENV`
- `APP_DEBUG`
- `NODE_ENV`
- `APP_URL`
- `CANONICAL_URL`
- `FRONTEND_URL`
- `API_URL`

### Database

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `DIRECT_URL`

### Auth / session / domain

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `COOKIE_DOMAIN`
- `TRUST_PROXY`
- `CORS_ORIGIN`
- `CORS_ALLOW_VERCEL_PREVIEWS`

### Mail / notifications

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
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_PASS`

### Files / push

- `FILE_STORAGE_PROVIDER`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

### Payments

- `PAYMENTS_EXTERNAL_ENABLED`
- `PAYMENTS_TEST_MODE`
- `PAYMENTS_MANUAL_TEST_WEBHOOK_SECRET`
- `BPAY_ENABLED`
- `BPAY_MERCHANT_ID`
- `BPAY_API_KEY`
- `BPAY_SECRET`

### Frontend public vars

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

## 6. Database

- Espace foloseste Prisma migrations, nu Laravel migrations
- nu folosi `migrate:fresh`, `db:wipe`, `reset`, `rollback` destructive
- ruleaza doar:
  - `npx prisma migrate deploy`
  - `npx prisma generate`
- fa backup inainte de fiecare rulare pe staging sau productie
- ruleaza staging inainte de productie

## 7. Storage si fisiere

- public assets: frontend static assets + brand/PWA
- fisiere sensibile: prin `FileAsset` + download autorizat
- uploads: trebuie pastrate intre deploy-uri
- verifica permisiuni pentru directoarele de uploads/backups
- verifica favicon, logo, manifest PWA si offline page

## 8. Queue si scheduler

- Espace nu foloseste in acest moment un worker separat de tip Laravel queue
- schedulerul ruleaza in backend prin `@nestjs/schedule`
- joburi importante:
  - monthly charges generator
  - monthly invoice generator
  - payment reminders
  - trial expiration
  - subscription billing
  - overdue subscription
  - notification dispatcher
  - debt reminders
  - client follow-up reminders

## 9. Email

- provider recomandat: `RESEND`
- `From` trebuie sa fie Espace
- verifica:
  - reset password
  - invoice / notificari
  - support reply-to
- SPF / DKIM / DMARC raman task manual extern

## 10. Payments

- success/cancel redirect nu trebuie sa marcheze plata ca `paid`
- confirmarea reala trebuie sa vina din webhook/API verification
- ruta noua este `POST /api/payments/webhooks/:providerType`
- integrarea live reala este inca blocata pana la provider sandbox complet

## 11. Securitate

- `APP_DEBUG=false`
- HTTPS obligatoriu
- CORS strict
- webhook route exacta, fara wildcard-uri
- rate limiting activ pe auth
- tenant isolation verificat si harden-uit
- upload-uri mai bine securizate
- `.env` nu trebuie sa ajunga in Git

## 12. Checklist inainte de live

1. backup DB
2. backup uploads
3. staging test complet
4. `npm run build`
5. `npx prisma migrate deploy`
6. deploy controlat
7. health check
8. smoke test browser
9. payment sandbox/live test
10. rollback plan pregatit

## 13. Rollback plan

- pastreaza release-ul anterior in Git
- pastreaza backup DB si backup uploads
- daca deploy-ul pica:
  - opreste rollout-ul
  - redeploy release-ul anterior
  - restaureaza DB doar daca migrarea a produs regresie functionala reala
- nu rula rollback automat orb pe productie
