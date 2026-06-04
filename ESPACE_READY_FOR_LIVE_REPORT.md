# ESPACE_READY_FOR_LIVE_REPORT

Data: 2026-06-03

## 1. Status general

**NOT READY FOR LIVE**

## 2. Motive

### Blocaje critice

1. **Platile live si webhook-urile providerilor reali nu sunt finalizate end-to-end**
   - Impact: o integrare live incompleta poate marca incorect plati sau poate lasa fluxul de reconciliere nevalidat
   - Fisiere relevante: [backend/src/online-payments/payment-provider.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts), [backend/src/payments/payments.service.ts](/Users/bolboceanu/espace/backend/src/payments/payments.service.ts), [backend/src/invoice-publishing/invoice-publishing.service.ts](/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.ts)
   - Fix obligatoriu: activare si testare sandbox/live pentru providerul ales, cu semnatura, idempotency si mapping complet invoice/subscription
   - Criticitate: `critica`

2. **Nu este inca incheiat smoke test-ul manual complet pe staging**
   - Impact: lipsesc confirmarile finale in browser pentru RBAC, tenant isolation, facturi, plati si emailuri
   - Fisiere/documente relevante: [ESPACE_QA_MANUAL_CHECKLIST.md](/Users/bolboceanu/espace/ESPACE_QA_MANUAL_CHECKLIST.md), [ESPACE_LIVE_SMOKE_TEST.md](/Users/bolboceanu/espace/ESPACE_LIVE_SMOKE_TEST.md)
   - Fix obligatoriu: rulare QA completa pe staging si semn-off explicit
   - Criticitate: `critica`

### Blocaje mari

3. **Mai exista formulare legacy care accepta inca referinte interne de fisiere si cer cleanup final**
   - Impact: riscul major pe Connect a fost inchis, dar mai exista fluxuri vechi unde utilizatorul poate introduce referinte interne care trebuie mutate complet pe uploader + `FileAsset + secure download`
   - Fisiere relevante: [frontend/app/(app)/resident/invoices/[id]/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/invoices/%5Bid%5D/page.tsx), [frontend/app/(app)/resident/requests/new/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/requests/new/page.tsx), [frontend/components/meters/ResidentReadingSubmissionPages.tsx](/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx), [backend/src/common/file-url-policy.ts](/Users/bolboceanu/espace/backend/src/common/file-url-policy.ts)
   - Fix obligatoriu: mutare completa pe `FileAsset + secure download` pentru fluxurile ramase si eliminarea inputurilor manuale de tip link fisier
   - Criticitate: `mare`

## 3. Verificari obligatorii

### Config si branding

- `APP_NAME = Espace SaaS`: **pregatit in fisierele example**, de completat pe server
- `APP_URL = https://www.espace.md`: **pregatit in fisierele example**, de completat pe server
- `APP_DEBUG = false`: **pregatit in fisierele example**, de confirmat pe server
- `.env` nu este in Git: **OK**, doar `.env.example` este versionat
- branding Espace in suprafetele publice: **OK**, conform rapoartelor de branding

### Build si verificari locale

- `composer install / composer validate`: **NU SE APLICA REPO-ULUI PRINCIPAL**, Espace nu este runtime Laravel/PHP
- `npm run build`: **OK**
- `php artisan route:list`: **NU SE APLICA**, comanda esueaza deoarece `php` nu exista si proiectul principal nu este Laravel
- `php artisan migrate --pretend`: **NU SE APLICA**, proiectul foloseste Prisma
- `php artisan test`: **NU SE APLICA**, testele reale sunt Node/Nest/Next
- teste existente relevante: **OK**, ultimele suite rulate pentru tenant isolation, payments/webhooks si upload security au trecut

### Functional

- login: **OK static si in build**, necesita smoke test staging/live
- dashboard: **OK static si in build**, necesita smoke test staging/live
- tenant isolation: **OK la nivel de audit + teste**, necesita validare manuala A/B in browser
- payments/webhooks: **partial OK**, guardrails exista, integrarea live provider nu este gata
- email config: **partial OK**, necesita configurare reala si verificare SMTP/provider
- queue/scheduler: **documentat**, necesita verificare operationala pe server
- uploads: **partial OK**, Connect este intarit, dar fluxurile legacy enumerate mai sus necesita inca cleanup final si smoke test
- backup plan: **OK**
- rollback plan: **OK**

## 4. Fisiere/documente existente

- [ESPACE_LIVE_DEPLOY_PLAN.md](/Users/bolboceanu/espace/ESPACE_LIVE_DEPLOY_PLAN.md): **exista**
- [ESPACE_ENV_PRODUCTION_GUIDE.md](/Users/bolboceanu/espace/ESPACE_ENV_PRODUCTION_GUIDE.md): **exista**
- [ESPACE_DOMAIN_SSL_GUIDE.md](/Users/bolboceanu/espace/ESPACE_DOMAIN_SSL_GUIDE.md): **exista**
- [ESPACE_DEPLOY_SCRIPT_GUIDE.md](/Users/bolboceanu/espace/ESPACE_DEPLOY_SCRIPT_GUIDE.md): **exista**
- [ESPACE_BACKUP_BEFORE_LIVE.md](/Users/bolboceanu/espace/ESPACE_BACKUP_BEFORE_LIVE.md): **exista**
- [ESPACE_LIVE_SMOKE_TEST.md](/Users/bolboceanu/espace/ESPACE_LIVE_SMOKE_TEST.md): **exista**
- [ESPACE_ROLLBACK_PLAN.md](/Users/bolboceanu/espace/ESPACE_ROLLBACK_PLAN.md): **exista**
- [ESPACE_PRODUCTION_LAUNCH_CHECKLIST.md](/Users/bolboceanu/espace/ESPACE_PRODUCTION_LAUNCH_CHECKLIST.md): **exista**

## 5. Comenzi finale de verificare

Rezultate din rularea ceruta:

- `composer validate`: **esuat** cu `command not found`
- `npm run build`: **trecut**
- `php artisan config:clear`: **esuat** cu `php: command not found`
- `php artisan route:list`: **esuat** cu `php: command not found`
- `php artisan migrate --pretend`: **esuat** cu `php: command not found`
- `php artisan test`: **esuat** cu `php: command not found`

Interpretare corecta:
- Espace nu este Laravel/PHP. Repo-ul principal foloseste `NestJS + Prisma + Next.js`.
- Verificarile relevante pentru acest proiect sunt `npm run build`, `npm run test`, `npm run check`, plus smoke test in browser si verificari de deploy Docker/Prisma.

## 6. Output final

- Pot face deploy pe staging: **da**
- Pot face deploy pe production: **nu**

### Ce trebuie facut manual pe server

- setarea variabilelor reale din `.env` pentru productie
- configurarea domeniului canonic `https://www.espace.md`
- configurarea SSL si redirecturilor `HTTP -> HTTPS` si non-canonical -> canonical
- backup DB si backup uploads inainte de orice deploy
- configurarea email providerului real
- configurarea cheilor live pentru providerul de plata ales, doar dupa validare sandbox
- verificarea serviciilor backend/frontend si a restartului corect dupa deploy

### Ce trebuie verificat imediat dupa deploy

- homepage si login
- dashboard superadmin si admin societate
- tenant isolation pentru societatea A versus B
- factura, plata offline si notificare email
- upload/download document autorizat
- health endpoint si logurile primei ore

### Comanda de deploy recomandata

Acum:

```bash
./deploy.sh staging
```

Pentru productie, doar dupa inchiderea blocajelor:

```bash
./deploy.sh production
```
