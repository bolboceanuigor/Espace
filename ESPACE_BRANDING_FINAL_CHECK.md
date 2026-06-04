# ESPACE_BRANDING_FINAL_CHECK

Data: 2026-06-03

## Status

Brandingul public verificat în această rundă este `Espace SaaS`.

Nu au mai rămas referințe `SocietyPro`, `SocietyPro SaaS`, `Society Management Software`, `Froiden`, `Envato` sau `CodeCanyon` în suprafețele publice verificate din Espace. Referințele rămase sunt interne, de analiză, test sau suport operațional.

## 1. Referințe găsite

### A. Referințe vechi de produs găsite după search final

Acestea apar doar în documente interne și nu sunt expuse utilizatorului final:

- [`/Users/bolboceanu/espace/ESPACE_REBRANDING_REPORT.md`](/Users/bolboceanu/espace/ESPACE_REBRANDING_REPORT.md)
- [`/Users/bolboceanu/espace/ESPACE_SOCIETYPRO_ADAPTATION_PLAN.md`](/Users/bolboceanu/espace/ESPACE_SOCIETYPRO_ADAPTATION_PLAN.md)
- [`/Users/bolboceanu/espace/SECURITY_AUDIT.md`](/Users/bolboceanu/espace/SECURITY_AUDIT.md)
- [`/Users/bolboceanu/espace/ESPACE_PRODUCTION_AUDIT.md`](/Users/bolboceanu/espace/ESPACE_PRODUCTION_AUDIT.md)
- [`/Users/bolboceanu/espace/PRODUCT_BLUEPRINT.md`](/Users/bolboceanu/espace/PRODUCT_BLUEPRINT.md)

### B. Referințe demo / sample / placeholder rămase

Acestea nu sunt branding SocietyPro, dar merită urmărite separat ca cleanup intern:

- fallback/sample frontend:
  - [`/Users/bolboceanu/espace/frontend/lib/condo-admin-fallback.ts`](/Users/bolboceanu/espace/frontend/lib/condo-admin-fallback.ts)
- sample notification tokens:
  - [`/Users/bolboceanu/espace/backend/src/notifications/transactional-notifications.service.ts`](/Users/bolboceanu/espace/backend/src/notifications/transactional-notifications.service.ts)
- sample import content:
  - [`/Users/bolboceanu/espace/backend/src/imports/imports.service.ts`](/Users/bolboceanu/espace/backend/src/imports/imports.service.ts)
- mock payment redirect intern:
  - [`/Users/bolboceanu/espace/backend/src/payments/providers/mock.provider.ts`](/Users/bolboceanu/espace/backend/src/payments/providers/mock.provider.ts)

## 2. Ce a fost înlocuit în această rundă

### Public / auth / legal pages

- [`/Users/bolboceanu/espace/frontend/app/[locale]/terms/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/terms/page.tsx)
  - a fost înlocuit textul placeholder cu conținut legal neutru Espace
- [`/Users/bolboceanu/espace/frontend/app/[locale]/privacy/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/privacy/page.tsx)
  - a fost înlocuit textul placeholder cu copy de confidențialitate Espace

### Layout / dashboard fallback copy

- [`/Users/bolboceanu/espace/frontend/app/(app)/resident/layout-new.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/layout-new.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/ResidentLayout.tsx`](/Users/bolboceanu/espace/frontend/components/layout/ResidentLayout.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/AppShell.tsx`](/Users/bolboceanu/espace/frontend/components/layout/AppShell.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/AdminLayout.tsx`](/Users/bolboceanu/espace/frontend/components/layout/AdminLayout.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/AdminSidebar.tsx`](/Users/bolboceanu/espace/frontend/components/layout/AdminSidebar.tsx)

În aceste fișiere am înlocuit nume și organizații demo de tip `Ion Popescu`, `A.P.C. Centru`, `A.P.C. Demo`, `Ap. 24` cu fallback-uri neutre Espace.

### Billing / payments / settings copy

- [`/Users/bolboceanu/espace/frontend/app/(app)/settings/billing/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/settings/billing/page.tsx)
  - a fost eliminat textul `Internal Placeholder`
- [`/Users/bolboceanu/espace/frontend/components/payments/OnlinePaymentsPages.tsx`](/Users/bolboceanu/espace/frontend/components/payments/OnlinePaymentsPages.tsx)
  - a fost curățat wording-ul intern de tip `placeholder`, `BPay placeholders`, `ES-139`
- [`/Users/bolboceanu/espace/frontend/components/settings/ChannelsSettingsClient.tsx`](/Users/bolboceanu/espace/frontend/components/settings/ChannelsSettingsClient.tsx)
  - a fost eliminat wording-ul `placeholder` vizibil
- [`/Users/bolboceanu/espace/frontend/components/feedback/FeedbackModal.tsx`](/Users/bolboceanu/espace/frontend/components/feedback/FeedbackModal.tsx)
  - a fost curățat textul placeholder din UI
- [`/Users/bolboceanu/espace/frontend/components/owners/AdminOwnersPage.tsx`](/Users/bolboceanu/espace/frontend/components/owners/AdminOwnersPage.tsx)
  - placeholder-ul de căutare a fost făcut neutru

### Mesaje și fallback backend vizibile în UI/email

- [`/Users/bolboceanu/espace/backend/src/email/email.service.ts`](/Users/bolboceanu/espace/backend/src/email/email.service.ts)
  - fallback sender schimbat la `no-reply@espace.md`
- [`/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts`](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts)
  - provider copy intern vizibil în panou schimbat la wording Espace
- [`/Users/bolboceanu/espace/frontend/messages/ru.json`](/Users/bolboceanu/espace/frontend/messages/ru.json)
  - wording demo curățat în zona de structură exemplu

## 3. Ce a rămas

### A rămas intenționat

- documentația internă de analiză și audit menționată mai sus
- sample data internă pentru imports/notificări/fallback/mock provider

### De ce a rămas

- nu este expusă în UI public sau în dashboard-urile verificate
- unele fișiere sunt documente de trasabilitate internă
- unele fișiere sunt utilitare de mock/test/sample care cer audit separat, nu o înlocuire superficială

## 4. Fișiere modificate în această rundă

- [`/Users/bolboceanu/espace/frontend/app/[locale]/terms/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/terms/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/[locale]/privacy/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/privacy/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/resident/layout-new.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/layout-new.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/ResidentLayout.tsx`](/Users/bolboceanu/espace/frontend/components/layout/ResidentLayout.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/AppShell.tsx`](/Users/bolboceanu/espace/frontend/components/layout/AppShell.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/AdminLayout.tsx`](/Users/bolboceanu/espace/frontend/components/layout/AdminLayout.tsx)
- [`/Users/bolboceanu/espace/frontend/components/layout/AdminSidebar.tsx`](/Users/bolboceanu/espace/frontend/components/layout/AdminSidebar.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/settings/billing/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/settings/billing/page.tsx)
- [`/Users/bolboceanu/espace/frontend/components/payments/OnlinePaymentsPages.tsx`](/Users/bolboceanu/espace/frontend/components/payments/OnlinePaymentsPages.tsx)
- [`/Users/bolboceanu/espace/frontend/components/settings/ChannelsSettingsClient.tsx`](/Users/bolboceanu/espace/frontend/components/settings/ChannelsSettingsClient.tsx)
- [`/Users/bolboceanu/espace/frontend/components/feedback/FeedbackModal.tsx`](/Users/bolboceanu/espace/frontend/components/feedback/FeedbackModal.tsx)
- [`/Users/bolboceanu/espace/frontend/components/owners/AdminOwnersPage.tsx`](/Users/bolboceanu/espace/frontend/components/owners/AdminOwnersPage.tsx)
- [`/Users/bolboceanu/espace/frontend/messages/ru.json`](/Users/bolboceanu/espace/frontend/messages/ru.json)
- [`/Users/bolboceanu/espace/backend/src/email/email.service.ts`](/Users/bolboceanu/espace/backend/src/email/email.service.ts)
- [`/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts`](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts)

## 5. Zone verificate și relevanța lor în stack-ul Espace

### Verificate direct

- pagini auth și publice Next.js
- layout-uri și dashboard fallback copy
- metadata / PWA / manifest / assets publice
- copy vizibil în superadmin și plăți online
- fallback sender email

### Nu se aplică direct acestui stack

Espace nu este Laravel clasic, deci aceste zone nu există sau nu sunt sursa reală de UI:

- `resources/views`
- `resources/lang`
- `app/Notifications`
- `app/Mail`
- `php artisan route:list`
- `php artisan view:clear`
- `php artisan cache:clear`

Echivalentele reale în Espace sunt în `frontend/app`, `frontend/components`, `frontend/messages`, respectiv `backend/src/*`.

## 6. Ce trebuie verificat manual în browser

- `/ro`
- `/ro/login`
- `/ro/register`
- `/ro/forgot-password`
- `/ro/verify-email`
- `/ro/terms`
- `/ro/privacy`
- `/ro/admin`
- `/ro/admin/owners`
- `/ro/admin/settings/billing`
- `/ro/superadmin/organizations`
- `/ro/superadmin/leads/[id]`
- zonele de plăți online din superadmin/admin
- email-urile tranzacționale trimise din staging
- PDF-urile și invoice-urile generate în staging
- favicon, manifest și PWA install prompt după hard refresh

## 7. Risc rămas

Risc de branding public: `scăzut`.

Risc rămas intern:

- există încă fișiere demo/mock/sample care nu sunt branding SocietyPro, dar care merită cleanup separat înainte de pilot/deploy complet
- există și documente interne de analiză care menționează SocietyPro; acestea nu trebuie expuse public

## 8. Build și comenzi rulate

- `rg` search final pentru branding/demo terms: rulat
- `npm run build`: trecut
- `php artisan view:clear`: eșuat cu `php: command not found`
- `php artisan cache:clear`: eșuat cu `php: command not found`
- `php artisan route:list`: eșuat cu `php: command not found`

Motivul pentru comenzile `php artisan`: proiectul țintă Espace este `NestJS + Prisma + Next.js`, nu un repo Laravel/PHP.
