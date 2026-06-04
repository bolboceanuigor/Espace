# ESPACE_PRODUCTION_LAUNCH_CHECKLIST

Data: 2026-06-03

## 0. Rezumat important

Espace SaaS nu este un proiect Laravel/PHP. Stack-ul real pentru launch este:

- `Backend`: NestJS + Prisma + PostgreSQL
- `Frontend`: Next.js 14 + React 18
- `Runtime`: Node.js 20
- `Scheduler`: `@nestjs/schedule` în procesul backend
- `Uploads`: storage local controlat de backend, cu migrare treptată spre flux privat unificat

Prin urmare:

- `composer` și `php artisan` nu fac parte din deploy-ul principal Espace
- nu există `APP_KEY` Laravel
- echivalentul pentru migrate este `npx prisma migrate deploy`
- echivalentul pentru route/config/view cache este build-ul Node și restartul serviciilor

Acest checklist este pentru launchul real al Espace, adaptat la stack-ul curent.

---

## A. Configurație producție

### Variabile obligatorii

- `NODE_ENV=production`
- `FRONTEND_URL=https://app.espace.md` sau domeniul real
- `APP_URL=https://app.espace.md`
- `API_URL=https://app.espace.md/api`
- `CORS_ORIGIN=https://app.espace.md`
- `JWT_SECRET=<secret lung și aleator>`
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=lax`
- `TRUST_PROXY=true`
- `LOG_HTTP=false`
- `FILE_STORAGE_PROVIDER=LOCAL` sau providerul final
- `EMAIL_PROVIDER=RESEND` sau alt provider real
- `SUPPORT_EMAIL=support@espace.md`
- `PAYMENTS_EXTERNAL_ENABLED=false` până când provideri reali și webhook-urile sunt production-safe

### HTTPS și cookies

- folosește doar HTTPS pe public
- cookie-urile auth trebuie să fie `httpOnly` și `secure`
- `COOKIE_DOMAIN` trebuie setat corect pentru domeniul final
- reverse proxy-ul trebuie să trimită corect `X-Forwarded-*`

### Queue / cache / filesystem / logging

- queue driver dedicat: `nu există încă`; schedulerul rulează în backend
- cache driver dedicat: `nu există încă`; cachingul este la nivel de Next/Nest unde e cazul
- filesystem: local disk sau storage extern, dar cu download autorizat pentru fișiere private
- logging: fără payloaduri sensibile, fără secrete și fără URL-uri interne expuse public

### Payment live keys

- nu pune chei live în repo
- configurează doar în env-ul serverului
- nu activa live payments până nu este închis blocajul de webhook verification

### Webhook live endpoints

- publică doar endpoint-urile reale necesare
- păstrează online payments dezactivate până la implementarea providerilor live cu verificare de semnătură și idempotency

---

## B. Securitate

### Config minim obligatoriu

- `.env`, `.env.local`, `.env.production.local`, `backend/.env` și `frontend/.env.production.local` nu sunt în Git
- nu există debugbar sau Telescope în stack-ul curent
- `LOG_HTTP=false` în producție
- CORS limitat la frontend-ul real
- cookie auth `secure` + `SameSite=lax`
- rate limiting activ pe auth
- `ENABLE_DEMO_LOGIN=false`
- `ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK=false`
- `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`
- `NEXT_PUBLIC_ENABLE_DEMO=false`
- `NEXT_PUBLIC_DEBUG_API=false`

### Auth și permisiuni

- login, reset password și verify email trebuie să meargă doar pe conturi active
- utilizatorii inactivi trebuie blocați
- organizațiile/asociațiile inactive trebuie blocate în fluxurile sensibile
- `PermissionGuard` nu trebuie să mai aibă fallback admin permisiv în producție
- rolurile trebuie validate prin guard stack consistent

### Tenant isolation

- toate datele tenant trebuie filtrate după `associationId` / `organizationId`
- testele manuale A/B sunt obligatorii înainte de launch
- fișierele private trebuie descărcate doar prin rute autorizate

### Upload restrictions

- allowlist pentru extensii: `pdf`, `jpg`, `jpeg`, `png`, `doc`, `docx`
- validează MIME și dimensiunea maximă
- blochează URL-uri externe noi în loc de upload controlat
- nu permite path arbitrar sau acces direct la fișiere private

---

## C. Database

### Înainte de migrate

- fă backup complet înainte de orice deploy cu migrații
- rulează doar `npx prisma migrate deploy`
- nu folosi `prisma db push` în producție
- nu rula scripturi destructive sau cleanup de demo pe producție

### Integritate

- verifică indexurile pe cheile de tenant și lookup-urile frecvente
- verifică foreign keys după migrațiile recente
- seederele de producție trebuie să fie doar pentru roluri, permisiuni și setări de bază
- fără demo data, fără conturi demo, fără parole demo

### Comenzi recomandate

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

---

## D. Payments

### Condiții minime înainte de live payments

- providerul real trebuie implementat, nu mock
- webhook-ul trebuie să verifice semnătura oficială a providerului
- trebuie să existe idempotency reală
- nu marca plăți `successful` doar din redirect sau request manual
- trebuie să existe logging sigur pentru webhook-uri
- trebuie să existe un test sandbox end-to-end
- dacă este permis operațional, fă un test live cu sumă mică după staging

### Status actual

- `NOT READY` pentru live online payments
- recomandare: `PAYMENTS_EXTERNAL_ENABLED=false` la launch până la implementarea providerilor reali
- offline/manual payments pot rămâne active dacă sunt parte din fluxul operațional verificat

---

## E. Email

### DNS și delivery

- configurează `SPF`
- configurează `DKIM`
- configurează `DMARC`
- folosește adresă `from` Espace
- folosește `support@espace.md` sau adresa reală finală

### Fluxuri obligatorii

- verify email
- reset password
- invoice / payment notifications
- maintenance / issue notifications

### Operațional

- sandbox mail pe staging
- provider real pe producție
- loghează doar metadata utilă, nu token-uri sau linkuri sensibile în exces
- bounce handling dacă providerul îl oferă

---

## F. Scheduler și queue

### Situația actuală

- nu există queue worker separat în stack-ul curent
- schedulerul rulează in-process în backend

### Cerințe

- rulează o singură instanță backend până există locking pentru cronuri
- monitorizează joburile programate
- la deploy, restartează backend-ul controlat

### Joburi de verificat

- trial expiry
- subscription expiry / billing reminders
- invoice reminders
- maintenance generation
- debt reminders
- client follow-up reminders

### Dacă introduci worker ulterior

- folosește `systemd`, `supervisor` sau orchestratorul containerelor
- definește retry policy și failed job monitoring

---

## G. Files

### Config minim

- logo, favicon și PWA trebuie să folosească asset-urile Espace
- uploadurile trebuie să aibă limită clară de dimensiune
- fișierele private trebuie servite prin backend autorizat
- backup-ul trebuie să includă și `backend/uploads`

### De verificat înainte de launch

- documente rezident
- dovezi de plată
- citiri contoare cu atașamente
- request-uri rezident cu atașamente

### Blocaj actual

- mai există fluxuri care lucrează cu URL-uri externe în loc de `FileAsset + secure download`
- acestea trebuie unificate înainte de launch dacă sunt expuse utilizatorilor finali

---

## H. Monitoring

### Minimul obligatoriu

- monitorizare uptime pentru:
  - `/api/health`
  - `/api/health/db`
  - `/api/health/readiness`
- monitorizare logs backend/frontend
- monitorizare disk space
- monitorizare backup DB și restore test
- monitorizare cron/scheduler
- monitorizare failed notifications
- monitorizare webhook/payment logs când live payments devin active

### Recomandat

- alertare la căderea DB
- alertare la eșec build/deploy
- verificare periodică a spațiului pentru uploaduri și backupuri

---

## I. Legal / public pages

### Verificări obligatorii

- Terms
- Privacy Policy
- Refund Policy dacă activezi plăți online
- Contact
- cookies / consent dacă devine necesar legal
- company details corecte
- support email Espace

### Branding public

- doar `Espace` și `Espace SaaS` în UI public
- fără SocietyPro, Envato, Froiden sau demo branding în suprafețele finale
- verifică meta title, meta description, OpenGraph, PWA manifest, footer, emailuri și PDF-uri

---

## J. Final browser QA

Rulează checklist-ul manual din [ESPACE_QA_MANUAL_CHECKLIST.md](/Users/bolboceanu/espace/ESPACE_QA_MANUAL_CHECKLIST.md) pe staging public.

### Smoke minim de launch

- login/logout
- register
- reset password
- dashboard superadmin
- creare societate
- creare apartament
- owner/tenant flow
- factură / sold / notificare
- payment flow offline
- maintenance flow
- role restrictions
- tenant isolation A/B
- responsive mobil
- branding Espace

### Smoke suplimentar obligatoriu

- acces cross-tenant prin URL direct trebuie să dea `403`, `404` sau redirect
- dropdown-urile nu trebuie să arate date din altă societate
- owner vede doar datele lui
- tenant vede doar datele lui
- staff vede doar taskurile permise

---

## Probleme care blochează lansarea acum

- live online payments nu sunt încă production-ready
- webhook verification pentru provideri reali nu este implementată end-to-end
- unele fluxuri de documente/proof-uri nu sunt încă mutate complet pe storage privat autorizat
- tenant isolation are nevoie de smoke test manual complet cu două societăți reale

## Probleme care pot fi amânate dacă launchul este controlat

- warning-urile React rămase din paginile superadmin
- worker/queue dedicat, dacă rămâi temporar pe o singură instanță backend
- extinderea monitoringului cu alerting avansat

## Comenzi finale de deploy recomandate

```bash
git pull
npm install
npm run build

docker compose --env-file .env.production.local -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
docker compose --env-file .env.production.local -f docker-compose.prod.yml run --rm backend npx prisma generate
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production.local -f docker-compose.prod.yml ps
curl -fsS https://app.espace.md/api/health
```

## Verdict

**NOT READY** pentru live production launch complet.

Poți pregăti mediul de producție și poți lansa un staging/prod intern controlat, dar launchul public complet ar trebui amânat până când:

1. live payment providers și webhook-urile sunt implementate sigur;
2. fluxurile de fișiere private sunt unificate;
3. smoke testul manual multi-tenant A/B este bifat complet.
