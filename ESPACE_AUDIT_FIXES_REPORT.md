# ESPACE_AUDIT_FIXES_REPORT

Data: 2026-06-03  
Repo: `/Users/bolboceanu/espace`

## 1. Status general

**Deploy status: NOT READY**

Au fost rezolvate două grupuri importante din auditul final:

- plățile online placeholder nu mai pot fi activate accidental în producție doar din UI/config;
- fallback-ul periculos din `PermissionGuard` nu mai este activ implicit;
- URL-urile externe noi pentru dovezi și atașamente rezident sunt blocate la scriere.

Proiectul rămâne `NOT READY` pentru producție până se rezolvă blocantele rămase de payments/webhooks reale, unificarea tuturor fișierelor private și verificarea manuală finală A/B pentru multi-tenancy.

## 2. Probleme rezolvate

### R1. Fallback legacy admin în `PermissionGuard` nu mai este implicit

Cauză:

- [backend/src/auth/permission.guard.ts](/Users/bolboceanu/espace/backend/src/auth/permission.guard.ts) permitea acces pentru `ADMIN` fără membership activ în `OrganizationMember`.

Patch:

- fallback-ul este acum permis doar dacă `ALLOW_LEGACY_ADMIN_PERMISSION_FALLBACK=true` și mediul nu este `production`;
- în `backend/.env.example` fallback-ul este `false` by default.

Fișiere:

- [backend/src/auth/permission.guard.ts](/Users/bolboceanu/espace/backend/src/auth/permission.guard.ts)
- [backend/src/common/runtime-flags.ts](/Users/bolboceanu/espace/backend/src/common/runtime-flags.ts)
- [backend/.env.example](/Users/bolboceanu/espace/backend/.env.example)

Impact:

- reduce riscul de bypass pe permisiuni;
- poate expune lipsuri de date vechi pentru adminii care nu au membership migrat corect.

### R2. Online payments placeholder nu mai pot fi activate accidental

Cauză:

- configurarea pentru online payments era încă skeleton/MVP, dar putea fi activată din setări/config în anumite fluxuri.

Patch:

- `PAYMENTS_EXTERNAL_ENABLED=false` documentat explicit în env example;
- providerii externi nu mai pot fi activați când flag-ul este oprit;
- webhook-urile externe din modulul nou sunt indisponibile când flag-ul este oprit;
- intent-urile online reale sunt blocate când mediul nu permite external payments;
- lista de provideri pentru rezident nu mai expune MAIB/Paynet/Oplata dacă external payments sunt oprite.

Fișiere:

- [backend/src/online-payments/payment-provider.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts)
- [backend/src/online-payments/payment-intent.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-intent.service.ts)
- [backend/src/payments/payments.service.ts](/Users/bolboceanu/espace/backend/src/payments/payments.service.ts)
- [backend/src/common/runtime-flags.ts](/Users/bolboceanu/espace/backend/src/common/runtime-flags.ts)
- [backend/.env.example](/Users/bolboceanu/espace/backend/.env.example)

Impact:

- previne pornirea accidentală a unui flux de plată neready;
- nu implementează încă provideri reali sau semnături reale.

### R3. URL-urile externe noi pentru dovezi/atașamente rezident sunt blocate

Cauză:

- cererile rezidenților, dovada de plată și dovezile pentru citiri acceptau linkuri externe arbitrare.

Patch:

- create/update pentru aceste fluxuri acceptă doar URL-uri interne Espace (`/uploads/...` sau `/files/...`);
- UI-ul rezident nu mai sugerează `https://...`, ci explică explicit că linkurile externe sunt blocate.

Fișiere:

- [backend/src/common/file-url-policy.ts](/Users/bolboceanu/espace/backend/src/common/file-url-policy.ts)
- [backend/src/community-read/community-read.service.ts](/Users/bolboceanu/espace/backend/src/community-read/community-read.service.ts)
- [backend/src/invoice-publishing/invoice-publishing.service.ts](/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.ts)
- [backend/src/meters/meters.service.ts](/Users/bolboceanu/espace/backend/src/meters/meters.service.ts)
- [frontend/app/(app)/resident/requests/new/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/requests/new/page.tsx)
- [frontend/app/(app)/resident/invoices/[id]/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/invoices/%5Bid%5D/page.tsx)
- [frontend/components/meters/ResidentReadingSubmissionPages.tsx](/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx)

Impact:

- reduce riscul de storage necontrolat și linkuri externe malițioase;
- nu rezolvă încă toate suprafețele admin/document/expense care folosesc `fileUrl`.

## 3. Probleme nerezolvate

### U1. Providerele reale și webhooks reale nu există încă

Rămâne blocant:

- nu există implementări reale pentru Stripe, PayPal, Razorpay, Paystack, Flutterwave, Payfast;
- adaptoarele actuale locale pentru MAIB/Paynet/Oplata sunt încă mock/skeleton.

Fișiere cheie:

- [backend/src/online-payments/payment-provider.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts)
- [backend/src/payments/providers/mock.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/mock.provider.ts)
- [backend/src/payments/providers/maib.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/maib.provider.ts)
- [backend/src/payments/providers/paynet.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/paynet.provider.ts)
- [backend/src/payments/providers/oplata.provider.ts](/Users/bolboceanu/espace/backend/src/payments/providers/oplata.provider.ts)

### U2. Nu toate fluxurile de fișiere sunt încă mutate pe storage privat uniform

Rămâne blocant:

- documentele admin și unele atașamente/expense-uri încă depind de `fileUrl` și nu exclusiv de `FileAsset + secure download`.

Fișiere cheie:

- [backend/src/documents-mvp/documents-mvp.service.ts](/Users/bolboceanu/espace/backend/src/documents-mvp/documents-mvp.service.ts)
- [backend/src/communications/communications.service.ts](/Users/bolboceanu/espace/backend/src/communications/communications.service.ts)
- [backend/src/maintenance/maintenance.service.ts](/Users/bolboceanu/espace/backend/src/maintenance/maintenance.service.ts)
- [frontend/app/admin/documents/page.tsx](/Users/bolboceanu/espace/frontend/app/admin/documents/page.tsx)
- [frontend/app/(app)/resident/documents/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/documents/page.tsx)
- [frontend/app/admin/payment-proofs/page.tsx](/Users/bolboceanu/espace/frontend/app/admin/payment-proofs/page.tsx)

### U3. Verificarea manuală A/B pentru tenant isolation încă lipsește

Rămâne blocant:

- trebuie demonstrat manual că Admin A/B, Owner A/B, Tenant A/B și Staff limitat nu văd datele altui tenant.

### U4. Warning-urile React din superadmin rămân

Nu blochează build-ul, dar rămân deschise:

- [frontend/components/superadmin/SaasBillingPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/SaasBillingPages.tsx)
- [frontend/components/superadmin/backup/BackupRecoveryPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/backup/BackupRecoveryPages.tsx)
- [frontend/components/superadmin/launch/LaunchControlPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/launch/LaunchControlPages.tsx)
- [frontend/components/superadmin/legal/LegalManagementPages.tsx](/Users/bolboceanu/espace/frontend/components/superadmin/legal/LegalManagementPages.tsx)

## 4. Fișiere modificate

- [backend/.env.example](/Users/bolboceanu/espace/backend/.env.example)
- [backend/src/auth/permission.guard.ts](/Users/bolboceanu/espace/backend/src/auth/permission.guard.ts)
- [backend/src/common/runtime-flags.ts](/Users/bolboceanu/espace/backend/src/common/runtime-flags.ts)
- [backend/src/common/runtime-flags.spec.ts](/Users/bolboceanu/espace/backend/src/common/runtime-flags.spec.ts)
- [backend/src/common/file-url-policy.ts](/Users/bolboceanu/espace/backend/src/common/file-url-policy.ts)
- [backend/src/common/file-url-policy.spec.ts](/Users/bolboceanu/espace/backend/src/common/file-url-policy.spec.ts)
- [backend/src/online-payments/payment-provider.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts)
- [backend/src/online-payments/payment-intent.service.ts](/Users/bolboceanu/espace/backend/src/online-payments/payment-intent.service.ts)
- [backend/src/payments/payments.service.ts](/Users/bolboceanu/espace/backend/src/payments/payments.service.ts)
- [backend/src/community-read/community-read.service.ts](/Users/bolboceanu/espace/backend/src/community-read/community-read.service.ts)
- [backend/src/invoice-publishing/invoice-publishing.service.ts](/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.ts)
- [backend/src/meters/meters.service.ts](/Users/bolboceanu/espace/backend/src/meters/meters.service.ts)
- [frontend/app/(app)/resident/requests/new/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/requests/new/page.tsx)
- [frontend/app/(app)/resident/invoices/[id]/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/invoices/%5Bid%5D/page.tsx)
- [frontend/components/meters/ResidentReadingSubmissionPages.tsx](/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx)

## 5. Teste rulate

### Trecute

- `NODE_OPTIONS=--max-old-space-size=4096 npm --prefix backend run test -- --runInBand src/common/runtime-flags.spec.ts`
- `NODE_OPTIONS=--max-old-space-size=4096 npm --prefix backend run test -- --runInBand src/common/runtime-flags.spec.ts src/common/file-url-policy.spec.ts`
- `npm run build`

### Eșuate / neaplicabile

- `php artisan test` -> `zsh:1: command not found: php`
- `php artisan route:list` -> `zsh:1: command not found: php`

Motiv:

- repo-ul țintă Espace este `NestJS + Prisma + Next.js`, nu Laravel/PHP;
- nu există runtime `php` și nici `artisan` în acest proiect.

## 6. Risc rămas

- online payments reale sunt încă dezactivate, nu implementate;
- documentele și unele fișiere admin nu sunt încă uniform private;
- verificarea tenant isolation rămâne incompletă fără test manual A/B;
- fallback-ul legacy admin încă poate fi reactivat în development prin env, deci runbook-ul de deploy trebuie să păstreze flag-ul `false`.

## 7. Ce trebuie verificat manual

- Admin A nu vede apartamentele, facturile și mentenanța asociației B.
- Owner A nu vede apartamentele/documentele/ facturile ownerului B.
- Tenant A nu vede datele tenantului B.
- Staff vede doar task-urile și cererile permise.
- Superadmin poate vedea global doar unde fluxul este intenționat global.
- Submit dovadă de plată fără fișier încă funcționează și mesajele de eroare sunt clare dacă se trimite un URL extern.
- Submit cerere rezident și submit citire contor fără link extern funcționează corect.

## 8. Pasul recomandat următor

Următorul slice potrivit este:

1. mutarea documentelor/admin attachments rămase pe `FileAsset + secure download`;
2. blocarea sau ascunderea completă a ecranelor online payments pentru tenant/admin până la integrarea providerilor reali;
3. smoke test manual A/B pentru RBAC și tenant isolation pe rutele pilot.
