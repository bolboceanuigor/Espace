# ESPACE_REBRANDING_REPORT

Data: 2026-06-03

## 1. Fișiere unde brandingul sau textele publice au fost înlocuite

### Frontend public/auth/PWA
- [`/Users/bolboceanu/espace/frontend/app/layout.tsx`](/Users/bolboceanu/espace/frontend/app/layout.tsx)
- [`/Users/bolboceanu/espace/frontend/app/page.tsx`](/Users/bolboceanu/espace/frontend/app/page.tsx)
- [`/Users/bolboceanu/espace/frontend/public/manifest.webmanifest`](/Users/bolboceanu/espace/frontend/public/manifest.webmanifest)
- [`/Users/bolboceanu/espace/frontend/public/offline.html`](/Users/bolboceanu/espace/frontend/public/offline.html)
- [`/Users/bolboceanu/espace/frontend/public/brand/espace-logo.svg`](/Users/bolboceanu/espace/frontend/public/brand/espace-logo.svg)
- [`/Users/bolboceanu/espace/frontend/app/[locale]/(auth)/login/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/%28auth%29/login/page.tsx)
- [`/Users/bolboceanu/espace/frontend/components/auth/AccountRecoveryPages.tsx`](/Users/bolboceanu/espace/frontend/components/auth/AccountRecoveryPages.tsx)
- [`/Users/bolboceanu/espace/frontend/components/public-site/PublicWebsite.tsx`](/Users/bolboceanu/espace/frontend/components/public-site/PublicWebsite.tsx)
- [`/Users/bolboceanu/espace/frontend/messages/ro.json`](/Users/bolboceanu/espace/frontend/messages/ro.json)
- [`/Users/bolboceanu/espace/frontend/messages/en.json`](/Users/bolboceanu/espace/frontend/messages/en.json)
- [`/Users/bolboceanu/espace/frontend/messages/ru.json`](/Users/bolboceanu/espace/frontend/messages/ru.json)

### Frontend dashboard/admin copy
- [`/Users/bolboceanu/espace/frontend/app/(app)/superadmin/settings/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/superadmin/settings/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/superadmin/leads/[id]/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/superadmin/leads/%5Bid%5D/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/superadmin/organizations/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/superadmin/organizations/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/superadmin/organizations/[id]/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/superadmin/organizations/%5Bid%5D/page.tsx)
- [`/Users/bolboceanu/espace/frontend/components/superadmin/SuperadminNotificationsCenterPage.tsx`](/Users/bolboceanu/espace/frontend/components/superadmin/SuperadminNotificationsCenterPage.tsx)
- [`/Users/bolboceanu/espace/frontend/components/data-quality/DataQualityPages.tsx`](/Users/bolboceanu/espace/frontend/components/data-quality/DataQualityPages.tsx)
- [`/Users/bolboceanu/espace/frontend/components/InviteUserModal.tsx`](/Users/bolboceanu/espace/frontend/components/InviteUserModal.tsx)
- [`/Users/bolboceanu/espace/frontend/app/settings/organization/page.tsx`](/Users/bolboceanu/espace/frontend/app/settings/organization/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/resident/profile/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/profile/page.tsx)

### Backend PDF/email/config fallbacks
- [`/Users/bolboceanu/espace/backend/.env.example`](/Users/bolboceanu/espace/backend/.env.example)
- [`/Users/bolboceanu/espace/backend/src/auth/auth.service.ts`](/Users/bolboceanu/espace/backend/src/auth/auth.service.ts)
- [`/Users/bolboceanu/espace/backend/src/invitations/invitations.service.ts`](/Users/bolboceanu/espace/backend/src/invitations/invitations.service.ts)
- [`/Users/bolboceanu/espace/backend/src/invoices/invoices.service.ts`](/Users/bolboceanu/espace/backend/src/invoices/invoices.service.ts)
- [`/Users/bolboceanu/espace/backend/src/scheduler/scheduler.service.ts`](/Users/bolboceanu/espace/backend/src/scheduler/scheduler.service.ts)
- [`/Users/bolboceanu/espace/backend/src/team/team.service.ts`](/Users/bolboceanu/espace/backend/src/team/team.service.ts)
- [`/Users/bolboceanu/espace/backend/src/rbac/admin-rbac.service.ts`](/Users/bolboceanu/espace/backend/src/rbac/admin-rbac.service.ts)
- [`/Users/bolboceanu/espace/backend/src/resident-access/resident-access.service.ts`](/Users/bolboceanu/espace/backend/src/resident-access/resident-access.service.ts)
- [`/Users/bolboceanu/espace/backend/src/notifications/transactional-notifications.service.ts`](/Users/bolboceanu/espace/backend/src/notifications/transactional-notifications.service.ts)
- [`/Users/bolboceanu/espace/backend/src/document-render/document-render.service.ts`](/Users/bolboceanu/espace/backend/src/document-render/document-render.service.ts)

## 2. Referințe SocietyPro rămase

La scan-ul curent, referințele rămase la `SocietyPro`, `SocietyPro SaaS`, `Society Management Software` sau `Froiden` sunt doar în documente interne de analiză:

- [`/Users/bolboceanu/espace/ESPACE_SOCIETYPRO_ADAPTATION_PLAN.md`](/Users/bolboceanu/espace/ESPACE_SOCIETYPRO_ADAPTATION_PLAN.md)
- [`/Users/bolboceanu/espace/SECURITY_AUDIT.md`](/Users/bolboceanu/espace/SECURITY_AUDIT.md)
- [`/Users/bolboceanu/espace/PRODUCT_BLUEPRINT.md`](/Users/bolboceanu/espace/PRODUCT_BLUEPRINT.md)

Nu au mai rămas referințe SocietyPro în frontend-ul public, în dashboard-uri Espace, în PDF-uri generate sau în template-urile de email verificate în această rundă.

## 3. De ce au rămas aceste referințe

- Sunt documente interne de analiză și planificare, nu sunt expuse utilizatorilor finali.
- Sunt utile pentru trasabilitatea adaptării dintre proiectul sursă licențiat și produsul final Espace.
- Nu trebuie publicate în aplicație sau în materiale comerciale finale.

## 4. Unde trebuie pus logo-ul final

### Assete platformă deja folosite de aplicație
- favicon SVG: [`/Users/bolboceanu/espace/frontend/public/favicon.svg`](/Users/bolboceanu/espace/frontend/public/favicon.svg)
- icon App Router: [`/Users/bolboceanu/espace/frontend/app/icon.svg`](/Users/bolboceanu/espace/frontend/app/icon.svg)
- PWA any icons: [`/Users/bolboceanu/espace/frontend/public/icons/pwa-192.svg`](/Users/bolboceanu/espace/frontend/public/icons/pwa-192.svg), [`/Users/bolboceanu/espace/frontend/public/icons/pwa-512.svg`](/Users/bolboceanu/espace/frontend/public/icons/pwa-512.svg)
- PWA maskable icons: [`/Users/bolboceanu/espace/frontend/public/icons/maskable-192.svg`](/Users/bolboceanu/espace/frontend/public/icons/maskable-192.svg), [`/Users/bolboceanu/espace/frontend/public/icons/maskable-512.svg`](/Users/bolboceanu/espace/frontend/public/icons/maskable-512.svg)

### Placeholder nou pentru logo-ul de platformă
- wordmark placeholder: [`/Users/bolboceanu/espace/frontend/public/brand/espace-logo.svg`](/Users/bolboceanu/espace/frontend/public/brand/espace-logo.svg)

### Locuri unde UI-ul încă folosește monogramă inline și poate fi înlocuit ulterior cu assetul final
- navbar/footer public: [`/Users/bolboceanu/espace/frontend/components/public-site/PublicWebsite.tsx`](/Users/bolboceanu/espace/frontend/components/public-site/PublicWebsite.tsx)
- login: [`/Users/bolboceanu/espace/frontend/app/[locale]/(auth)/login/page.tsx`](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/%28auth%29/login/page.tsx)
- ecran offline: [`/Users/bolboceanu/espace/frontend/public/offline.html`](/Users/bolboceanu/espace/frontend/public/offline.html)

## 5. Asset-uri care trebuie generate sau înlocuite

Minim recomandat pentru branding final:

- `brand/espace-logo.svg` final
- `favicon.svg` final
- `app/icon.svg` final
- `icons/pwa-192.svg`
- `icons/pwa-512.svg`
- `icons/maskable-192.svg`
- `icons/maskable-512.svg`
- opțional: `apple-touch-icon` 180x180 PNG
- recomandat: imagine OG dedicată 1200x630 pentru share previews

## 6. Ce trebuie verificat manual în browser

- `/ro` pentru title, meta description, footer și CTA-uri
- `/ro/login`, `/ro/register`, `/ro/forgot-password`, `/ro/verify-email`
- `/ro/cere-acces` și `/ro/contact`
- `/ro/superadmin/leads/[id]` pentru textele curățate
- `/ro/superadmin/organizations` și `/ro/superadmin/organizations/[id]`
- documentele generate:
  - factură internă admin/resident
  - chitanță plată
  - factură SaaS
  - confirmare plată SaaS
- favicon/PWA install prompt pe mobil
- manifest și icon-uri după reload complet

## 7. Cache-uri care trebuie curățate

- cache-ul browserului după schimbarea favicon/PWA
- service worker cache pentru shell-ul PWA; dacă icon-urile se schimbă din nou, crește `CACHE_NAME` din [`/Users/bolboceanu/espace/frontend/public/sw.js`](/Users/bolboceanu/espace/frontend/public/sw.js)
- CDN / edge cache pentru asset-uri statice
- cache-ul Next.js de build la redeploy

## 8. Pași pentru build și deploy

1. Rulează `npm install` la root dacă dependențele nu sunt sincronizate.
2. Rulează `npm run build` la root.
3. Deploy frontend + backend cu variabilele corecte pentru `SUPPORT_EMAIL`, `EMAIL_REPLY_TO`, `EMAIL_FROM_ADDRESS`.
4. Dacă se schimbă asset-urile de icon/logo, invalidează cache-ul CDN și fă hard refresh în browser.
5. Verifică manual PDF-urile și email-urile tranzacționale într-un mediu staging sau preview.

## Observații despre referințele demo/test rămase

Au rămas referințe demo/test în fișiere interne sau de suport operațional și nu au fost eliminate în această rundă, deoarece schimbarea lor ar depăși curățarea de branding și ar atinge fluxuri de seed/cleanup sau fallback-uri care cer audit separat:

- seed/cleanup/scripts: [`/Users/bolboceanu/espace/backend/prisma/seed.ts`](/Users/bolboceanu/espace/backend/prisma/seed.ts), [`/Users/bolboceanu/espace/backend/prisma/seed.demo.ts`](/Users/bolboceanu/espace/backend/prisma/seed.demo.ts), [`/Users/bolboceanu/espace/backend/prisma/cleanup-demo.ts`](/Users/bolboceanu/espace/backend/prisma/cleanup-demo.ts)
- superadmin demo/reset flows: [`/Users/bolboceanu/espace/backend/src/superadmin/superadmin.service.ts`](/Users/bolboceanu/espace/backend/src/superadmin/superadmin.service.ts), [`/Users/bolboceanu/espace/backend/src/demo-auth-read/demo-auth-read.service.ts`](/Users/bolboceanu/espace/backend/src/demo-auth-read/demo-auth-read.service.ts)
- fallback/example datasets: [`/Users/bolboceanu/espace/frontend/lib/admin-mvp-data.ts`](/Users/bolboceanu/espace/frontend/lib/admin-mvp-data.ts), [`/Users/bolboceanu/espace/frontend/lib/resident-mvp-data.ts`](/Users/bolboceanu/espace/frontend/lib/resident-mvp-data.ts), [`/Users/bolboceanu/espace/frontend/lib/condo-admin-fallback.ts`](/Users/bolboceanu/espace/frontend/lib/condo-admin-fallback.ts), [`/Users/bolboceanu/espace/frontend/lib/apartment-import-template.ts`](/Users/bolboceanu/espace/frontend/lib/apartment-import-template.ts), [`/Users/bolboceanu/espace/backend/src/imports/imports.service.ts`](/Users/bolboceanu/espace/backend/src/imports/imports.service.ts)

Acestea trebuie tratate într-un pas separat de hardening/demo-cleanup, ca să nu fie schimbate superficial fără impact review pe pilot.
