# ESPACE_PRODUCTION_AUDIT

Data auditului: 2026-06-03  
Repo auditat: `/Users/bolboceanu/espace`

## 1. Status general

**NOT READY**

Espace este aproape de o bază producție solidă pe auth, tenancy și branding, dar încă are blocante reale pentru go-live:

- webhooks/plăți online nu sunt implementate sigur pentru provideri reali;
- mai există fluxuri de fișiere și dovezi care acceptă URL-uri externe în loc de storage privat controlat;
- auditul automat acoperă doar parțial izolarea tenant și nu înlocuiește verificarea manuală finală pentru roluri reale A/B;
- în această rundă am găsit și reparat două blocante operaționale: `demo-login` public și scheduler neconectat în aplicație.

## 2. Probleme critice

### C1. Online payments/webhooks nu sunt pregătite pentru producție reală

Fișiere:

- [backend/src/online-payments/payment-provider.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts:247)
- [backend/src/online-payments/online-payments.controller.ts](/Users/bolboceanu/espace/backend/src/online-payments/online-payments.controller.ts:187)
- [backend/src/payments/payments.service.ts](/Users/bolboceanu/espace/backend/src/payments/payments.service.ts:423)
- [backend/src/payments/providers/payment-provider.factory.ts](/Users/bolboceanu/espace/backend/src/payments/providers/payment-provider.factory.ts:16)
- [backend/src/payments/providers/mock.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/mock.provider.ts:24)
- [backend/src/payments/providers/maib.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/maib.provider.ts:4)
- [backend/src/payments/providers/oplata.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/oplata.provider.ts:4)
- [backend/src/payments/providers/paynet.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/paynet.provider.ts:4)

De ce e risc:

- `parseWebhook()` salvează evenimentul ca `IGNORED` și răspunde explicit că webhook-ul este MVP.
- adaptoarele MAIB/Oplata/Paynet sunt doar derivate din `MockPaymentProvider`.
- nu există implementări pentru Stripe, PayPal, Razorpay, Paystack, Flutterwave sau Payfast în repo.

Impact:

- plățile online nu trebuie considerate producție-ready;
- orice activare a UI-ului de online payments ar crea așteptări false;
- cerințele tale pentru semnătură, idempotency și fake-success protection nu sunt satisfăcute pentru provideri reali.

Verdict:

- înainte de deploy: ține online payments dezactivate pentru utilizatori finali sau implementează provideri reali cu verificare oficială de semnătură și idempotency end-to-end.

### C2. Fluxurile de documente/dovezi încă acceptă URL-uri externe și nu forțează storage privat

Fișiere:

- [backend/src/documents-mvp/documents-mvp.service.ts](/Users/bolboceanu/espace/backend/src/documents-mvp/documents-mvp.service.ts:246)
- [frontend/app/admin/documents/page.tsx](/Users/bolboceanu/espace/frontend/app/admin/documents/page.tsx:167)
- [frontend/app/(app)/resident/documents/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/documents/page.tsx:103)
- [backend/src/invoice-publishing/invoice-publishing.service.ts](/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.ts:722)
- [frontend/app/(app)/resident/invoices/[id]/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/invoices/%5Bid%5D/page.tsx:519)
- [frontend/app/admin/payment-proofs/page.tsx](/Users/bolboceanu/espace/frontend/app/admin/payment-proofs/page.tsx:382)
- [frontend/components/meters/ResidentReadingSubmissionPages.tsx](/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx:266)
- [frontend/app/(app)/resident/requests/new/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/requests/new/page.tsx:255)

De ce e risc:

- documentele MVP acceptă orice `https://...` sau path absolut, nu doar fișiere urcate prin serviciul securizat;
- dovezile de plată, citirile și unele request-uri rezident folosesc încă linkuri introduse manual;
- download-ul trece uneori direct prin `href={row.fileUrl}` în loc de ruta securizată cu autorizare.

Impact:

- nu ai control real pe MIME, dimensiune, retention și availability;
- utilizatorii pot introduce linkuri externe malițioase sau volatile;
- fișierele sensibile nu sunt uniform guvernate de auth + audit.

Verdict:

- înainte de deploy: mută documente, proof-uri și attachments pe un singur flux privat bazat pe `FileAsset` + download autorizat.

### C3. Verificarea finală de tenant isolation rămâne parțial automată, nu completă

Fișiere/evidență:

- [backend/src/association-context/association-context.service.ts](/Users/bolboceanu/espace/backend/src/association-context/association-context.service.ts:272)
- [backend/src/files/files.service.spec.ts](/Users/bolboceanu/espace/backend/src/files/files.service.spec.ts:1)
- [backend/src/billing-read/billing-read.service.spec.ts](/Users/bolboceanu/espace/backend/src/billing-read/billing-read.service.spec.ts:1)
- [backend/src/issues/issues.service.spec.ts](/Users/bolboceanu/espace/backend/src/issues/issues.service.spec.ts:1)
- [backend/src/maintenance/maintenance.service.spec.ts](/Users/bolboceanu/espace/backend/src/maintenance/maintenance.service.spec.ts:1)

De ce e risc:

- există acoperire automată bună pentru fișiere, issues și facturi simple;
- nu există în această rundă dovadă automată completă pentru toate combinațiile cerute: Admin A/B, Owner A/B, Tenant A/B, Staff assignat/neassignat, Super Admin support read-only vs write.

Impact:

- fără smoke test manual cu două asociații reale, nu putem declara readiness completă pentru pilot/producție.

Verdict:

- obligatoriu înainte de deploy: rulează manual scenariile A/B pentru apartamente, facturi, mentenanță, owners, tenant portal și support session.

## 3. Probleme mari

### H1. Fallback-ul legacy din `PermissionGuard` acordă acces adminilor fără membership activ

Fișier:

- [backend/src/auth/permission.guard.ts](/Users/bolboceanu/espace/backend/src/auth/permission.guard.ts:56)

Risc:

- `if (!member && role === Role.ADMIN) return true;`

Impact:

- slăbește modelul nou de RBAC și permite bypass dacă datele de membership sunt incomplete.

Recomandare:

- scoate fallback-ul după migrarea completă a `OrganizationMember`.

### H2. Demo subsystems există încă în repo și trebuie controlate strict la deploy

Fișiere:

- [backend/src/auth/auth.controller.ts](/Users/bolboceanu/espace/backend/src/auth/auth.controller.ts:106)
- [backend/src/auth/auth.service.ts](/Users/bolboceanu/espace/backend/src/auth/auth.service.ts:865)
- [frontend/lib/auth.ts](/Users/bolboceanu/espace/frontend/lib/auth.ts:10)
- [frontend/middleware.ts](/Users/bolboceanu/espace/frontend/middleware.ts:44)
- [backend/prisma/seed.ts](/Users/bolboceanu/espace/backend/prisma/seed.ts:31)
- [backend/prisma/seed.demo.ts](/Users/bolboceanu/espace/backend/prisma/seed.demo.ts:1)
- [backend/prisma/cleanup-demo.ts](/Users/bolboceanu/espace/backend/prisma/cleanup-demo.ts:1)

Risc:

- backend și frontend au în continuare utilitare demo/presentation;
- seed-urile conțin conturi și parole demo pentru dezvoltare;
- endpoint-ul `demo-login` a fost blocat în producție în această rundă, dar restul subsistemului rămâne în cod.

Impact:

- dacă env-urile de demo sunt activate din greșeală, poți expune fluxuri neintenționate.

Recomandare:

- păstrează codul doar pentru development intern, cu flags false by default și runbook clar de deploy.

### H3. CSRF clasic Laravel nu se aplică, dar aplicația se bazează pe cookie + CORS + SameSite, fără token anti-CSRF explicit

Fișiere:

- [backend/src/auth/auth.controller.ts](/Users/bolboceanu/espace/backend/src/auth/auth.controller.ts:33)
- [backend/src/main.ts](/Users/bolboceanu/espace/backend/src/main.ts:88)
- [backend/src/common/cors/origin.ts](/Users/bolboceanu/espace/backend/src/common/cors/origin.ts:28)

Observație:

- nu există `bootstrap/app.php` sau `VerifyCsrfToken`; Espace nu este Laravel;
- cookie-ul `accessToken` este `httpOnly` și `SameSite=lax`, iar CORS wildcard este blocat în production.

Risc:

- modelul actual este rezonabil pentru topologia curentă;
- dacă în viitor treci pe domenii cross-site și `SameSite=None`, vei avea nevoie de anti-CSRF token real.

### H4. Notification/scheduler rulează în procesul web, nu într-un worker separat

Fișiere:

- [backend/src/scheduler/scheduler.service.ts](/Users/bolboceanu/espace/backend/src/scheduler/scheduler.service.ts:702)
- [backend/src/app.module.ts](/Users/bolboceanu/espace/backend/src/app.module.ts:59)
- [render.yaml](/Users/bolboceanu/espace/render.yaml:1)

Risc:

- nu există infrastructură dedicată de queue/worker;
- cronurile rulează din aplicația backend.

Impact:

- la scalare pe multiple instanțe poți avea execuții duplicate dacă nu introduci locking operațional;
- pentru MVP poate fi acceptabil, pentru SaaS matur trebuie clarificat.

## 4. Probleme medii

### M1. Guard stack-ul este mixt între vechi și nou

Exemple:

- [backend/src/exports/exports.controller.ts](/Users/bolboceanu/espace/backend/src/exports/exports.controller.ts:12)
- [backend/src/setup/setup.controller.ts](/Users/bolboceanu/espace/backend/src/setup/setup.controller.ts:9)
- [backend/src/payments/payments.controller.ts](/Users/bolboceanu/espace/backend/src/payments/payments.controller.ts:17)

Observație:

- o parte din API folosește `MvpAuthGuard + MvpRolesGuard + PermissionGuard`;
- altă parte folosește `JwtAuthGuard + RolesGuard`;
- o parte din controllere legacy folosesc doar `RolesGuard`.

Impact:

- suprafața de securitate e mai greu de auditat și mai ușor de regresa.

### M2. Nu există `route:list` sau `migrate --pretend` echivalent direct în stack-ul actual

Observație:

- repo-ul țintă este `NestJS + Prisma + Next.js`, nu Laravel;
- verificarea de rute s-a făcut prin build frontend și audit static al controllerelor;
- verificarea de migrații s-a făcut prin audit static al folderului Prisma și căutare pentru migrații rulate din request.

### M3. Warning-uri React rămase în build

Fișiere:

- [frontend/components/superadmin/SaasBillingPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/SaasBillingPages.tsx:622)
- [frontend/components/superadmin/backup/BackupRecoveryPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/backup/BackupRecoveryPages.tsx:203)
- [frontend/components/superadmin/launch/LaunchControlPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/launch/LaunchControlPages.tsx:125)
- [frontend/components/superadmin/legal/LegalManagementPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/legal/LegalManagementPages.tsx:189)

Impact:

- nu blochează build-ul, dar indică zone sensibile de efecte/reactivitate.

## 5. Probleme mici

- branding public SocietyPro nu mai apare; referințele rămase sunt doar în documente interne de analiză.
- fișierele `.env`, `.env.local`, `.env.production` există local, dar sunt ignorate de Git și nu apar tracked.

## 6. Fișiere afectate în această rundă

Patch-uri aplicate:

- [backend/src/auth/auth.controller.ts](/Users/bolboceanu/espace/backend/src/auth/auth.controller.ts:40)
- [backend/.env.example](/Users/bolboceanu/espace/backend/.env.example:64)
- [backend/src/app.module.ts](/Users/bolboceanu/espace/backend/src/app.module.ts:1)
- [backend/src/scheduler/scheduler.controller.ts](/Users/bolboceanu/espace/backend/src/scheduler/scheduler.controller.ts:1)
- [ESPACE_PRODUCTION_AUDIT.md](/Users/bolboceanu/espace/ESPACE_PRODUCTION_AUDIT.md)

Fișiere importante auditate:

- [backend/src/security/mvp-auth.guard.ts](/Users/bolboceanu/espace/backend/src/security/mvp-auth.guard.ts:57)
- [backend/src/association-context/association-context.service.ts](/Users/bolboceanu/espace/backend/src/association-context/association-context.service.ts:68)
- [backend/src/auth/permission.guard.ts](/Users/bolboceanu/espace/backend/src/auth/permission.guard.ts:23)
- [backend/src/files/files.service.ts](/Users/bolboceanu/espace/backend/src/files/files.service.ts:120)
- [backend/src/issues/issues.controller.ts](/Users/bolboceanu/espace/backend/src/issues/issues.controller.ts:18)
- [backend/src/maintenance/maintenance.controller.ts](/Users/bolboceanu/espace/backend/src/maintenance/maintenance.controller.ts:28)
- [backend/src/reminders/reminders.controller.ts](/Users/bolboceanu/espace/backend/src/reminders/reminders.controller.ts:13)
- [backend/src/main.ts](/Users/bolboceanu/espace/backend/src/main.ts:11)
- [backend/prisma/schema.prisma](/Users/bolboceanu/espace/backend/prisma/schema.prisma:6956)
- [render.yaml](/Users/bolboceanu/espace/render.yaml:1)

## 7. Patch-uri aplicate

### P1. `demo-login` blocat în producție

Ce s-a schimbat:

- endpoint-ul public `/auth/demo-login` răspunde acum `404` dacă `ENABLE_DEMO_LOGIN` nu este `true` sau dacă `NODE_ENV=production`.

Fișiere:

- [backend/src/auth/auth.controller.ts](/Users/bolboceanu/espace/backend/src/auth/auth.controller.ts:44)
- [backend/.env.example](/Users/bolboceanu/espace/backend/.env.example:64)

### P2. Scheduler conectat explicit în aplicație

Ce s-a schimbat:

- `ScheduleModule.forRoot()` este importat;
- `SchedulerModule` este inclus în `AppModule`;
- endpoint-urile de joburi superadmin cer acum și `JwtAuthGuard`, nu doar rol.

Fișiere:

- [backend/src/app.module.ts](/Users/bolboceanu/espace/backend/src/app.module.ts:1)
- [backend/src/scheduler/scheduler.controller.ts](/Users/bolboceanu/espace/backend/src/scheduler/scheduler.controller.ts:1)

## 8. Patch-uri recomandate, dar neaplicate

1. Închide fallback-ul legacy din [backend/src/auth/permission.guard.ts](/Users/bolboceanu/espace/backend/src/auth/permission.guard.ts:56) după migrarea completă a membership-urilor.
2. Mută documente, proof-uri și attachments pe storage privat unificat prin [backend/src/files/files.service.ts](/Users/bolboceanu/espace/backend/src/files/files.service.ts:14).
3. Elimină formularele cu `fileUrl`/`proofFileUrl` manual din UI:
   - [frontend/app/admin/documents/page.tsx](/Users/bolboceanu/espace/frontend/app/admin/documents/page.tsx:167)
   - [frontend/app/(app)/resident/invoices/[id]/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/invoices/%5Bid%5D/page.tsx:639)
   - [frontend/components/meters/ResidentReadingSubmissionPages.tsx](/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx:266)
4. Dezactivează complet online payments până există implementări reale și semnate:
   - [backend/src/online-payments/payment-provider.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts:247)
   - [backend/src/payments/providers](/Users/bolboceanu/espace/backend/src/payments/providers)
5. Convergează controllerele legacy pe un singur stack de auth/tenant guards.
6. Adaugă teste E2E reale pentru A/B tenancy, owner/tenant/staff/superadmin support session.

## 9. Teste rulate

Au trecut:

- `npm run build`
- `npm --prefix backend run test -- --runInBand src/files/files.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/billing-read/billing-read.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/maintenance/maintenance.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/issues/issues.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/residents/owners.util.spec.ts`

Au confirmat:

- upload allowlist și authorized download;
- blocare cross-tenant pe files/issues/simple invoices;
- notificare de mentenanță pentru task creat din issue;
- logică owner helper corectă.

## 10. Teste/comenzi eșuate

Au eșuat din cauza stack-ului local sau pentru că repo-ul nu este Laravel:

- `composer validate` -> `zsh:1: command not found: composer`
- `php artisan config:clear` -> `zsh:1: command not found: php`
- `php artisan cache:clear` -> `zsh:1: command not found: php`
- `php artisan route:clear` -> `zsh:1: command not found: php`
- `php artisan view:clear` -> `zsh:1: command not found: php`
- `php artisan route:list` -> `zsh:1: command not found: php`
- `php artisan migrate --pretend` -> `zsh:1: command not found: php`
- `php artisan test` -> `zsh:1: command not found: php`

Explicație:

- Espace nu este Laravel/PHP; este `NestJS + Prisma + Next.js`. Comenzile de mai sus nu se aplică acestui repo.

## 11. Pași obligatorii înainte de deploy

1. Ține online payments dezactivate pentru asociații până există provideri reali cu verificare de semnătură.
2. Înlocuiește toate fluxurile bazate pe `fileUrl`/`proofFileUrl` cu upload privat autorizat.
3. Rulează smoke test manual cu două asociații reale:
   - Admin A/B
   - Owner A/B
   - Tenant A/B
   - Staff assignat vs neassignat
   - Superadmin support read-only vs write
4. Decide dacă `PermissionGuard` legacy fallback rămâne temporar sau este eliminat înainte de go-live.
5. Confirmă env-urile de producție:
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`
   - `CORS_ORIGIN` fără wildcard
   - `ENABLE_DEMO_LOGIN=false`
   - `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`
6. Confirmă providerul real de email și livrarea din producție.
7. Confirmă strategia operațională pentru cronuri și notificări pe Render.

## 12. Checklist deploy

- `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`, `API_URL` setate în platforma de deploy.
- `.env`, `.env.local`, `.env.production` nu sunt comise în Git.
- `ENABLE_DEMO_LOGIN=false` și `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`.
- `NOTIFICATIONS_EXTERNAL_ENABLED=true` doar dacă providerul de email/SMS este configurat real.
- online payments rămân ascunse/dezactivate dacă nu există implementări reale.
- build final trecut cu `npm run build`.
- smoke test manual pe `/ro/login`, `/ro/admin`, `/ro/admin/apartments`, `/ro/admin/invoices`, `/ro/admin/maintenance`, `/ro/resident`, `/ro/resident/invoices`, `/ro/resident/balance`.
- smoke test download privat fișiere și proof-uri.
- audit rapid pe seed scripts: nu se rulează `seed.demo` în producție.
- verificare cron după deploy: reminder-ele și joburile scheduler apar în runtime.

## Concluzie

Espace este **aproape ready pe nucleul SaaS și pe branding**, dar **nu este încă ready pentru deploy producție complet** cât timp:

- online payments nu sunt implementate real;
- fișierele și proof-urile nu sunt unificate pe storage privat;
- lipsesc verificările manuale finale A/B pe tenancy și roluri.

Patch-urile aplicate în această rundă reduc două riscuri reale, dar nu schimbă verdictul general: **NOT READY**.
