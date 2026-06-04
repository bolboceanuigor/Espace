# ESPACE_TENANT_ISOLATION_AUDIT

Data: 2026-06-03
Status: partial hardening done, no critical cross-tenant leak left in the patched services

## 1. Modele verificate

Auditul a fost facut pe stack-ul real Espace (`NestJS + Prisma + Next.js`), nu pe Laravel.

### Modele organization-scoped verificate in schema si/sau servicii active

- `Organization`
- `OrganizationMember`
- `Building`
- `Staircase`
- `Apartment`
- `ResidentProfile`
- `Meter`
- `MeterReading`
- `BillingPeriod`
- `Invoice`
- `Payment`
- `PaymentProof`
- `PaymentProviderConfig`
- `Issue`
- `Supplier`
- `MaintenanceTask`
- `MaintenanceEvent`
- `Expense`
- `MonthlyCharge`
- `ResidentInvoice`
- `PaymentReminder`
- `Announcement`
- `Notification`
- `FileAsset`
- `PrivacySettings`
- `ClientNote`
- `Subscription`
- `OrganizationSubscription`

### Verificari facute

Pentru modelele tenant-specific de mai sus am verificat combinat:

- existenta `organizationId` sau `associationId` in schema Prisma
- indexuri pentru tenant field
- relatii Prisma catre `Organization`
- filtrare explicita in serviciile backend active
- endpointuri admin/resident care citesc sau scriu date tenant-specific
- dashboard counts pentru overview admin
- exporturi/PDF unde exista acces prin serviciile active

### Zone verificate mai atent in cod

- `backend/src/admin-structure/admin-structure.service.ts`
- `backend/src/residents/residents.service.ts`
- `backend/src/community-read/community-read.service.ts`
- `backend/src/invoices/invoices.service.ts`
- `backend/src/payments/payments.service.ts`
- `backend/src/maintenance/maintenance.service.ts`
- `backend/src/files/files.service.ts`
- `backend/src/rbac/rbac-dashboard.service.ts`
- `backend/src/association-context/admin-association.guard.ts`
- `backend/src/common/org-scope.ts`
- `backend/src/security/mvp-auth.guard.ts`

## 2. Probleme gasite

### Critic

1. `ResidentsService` permitea query global implicit pentru `SUPERADMIN` pe rute tenant-specific.
   - Fisier: `backend/src/residents/residents.service.ts`
   - Cauza: `organizationWhere(user)` returna `{}` pentru superadmin.
   - Impact: un superadmin fara organizatie activa putea citi liste/detalii din toate organizatiile pe endpointuri care ar fi trebuit sa ramana tenant-scoped.

2. `CommunityReadService` permitea query global implicit pentru `SUPERADMIN` pe rute tenant-specific.
   - Fisier: `backend/src/community-read/community-read.service.ts`
   - Cauza: acelasi pattern, `organizationWhere(user)` returna `{}` pentru superadmin.
   - Impact: risc de listare globala pe issues, requests, announcements sau lookup direct cu ID pe rute tenant-specific.

### Mari

1. Acoperirea automata pentru tenant isolation era insuficienta.
   - Nu existau teste dedicate pentru:
     - apartamente cross-tenant
     - factura resident cross-tenant
     - dashboard counts pe organizatie
     - superadmin fara scope pe servicii tenant-specific

### Medii

1. Exista multe modele suplimentare cu `associationId` in schema, dar nu toate sunt inca acoperite de teste dedicate la nivel de serviciu in aceasta runda.
2. Nu exista in Nest concept de route model binding clasic Laravel; izolarea depinde de `findFirst({ id, organizationId })` si de guard-urile de context. Asta este corect, dar cere disciplina constanta la fiecare endpoint nou.

## 3. Patch-uri aplicate

### Patch 1: inchidere fallback global pentru `ResidentsService`

Fisier:

- `backend/src/residents/residents.service.ts`

Schimbare:

- `organizationWhere(user)` nu mai returneaza `{}` pentru `SUPERADMIN`
- serviciul cere acum `organizationId` concret si pentru superadmin pe rutele tenant-specific

Efect:

- `SUPERADMIN` fara scope nu mai poate folosi aceste endpointuri ca listari globale accidentale
- `SUPERADMIN` cu `organizationId` activ continua sa poata inspecta tenantul respectiv

### Patch 2: inchidere fallback global pentru `CommunityReadService`

Fisier:

- `backend/src/community-read/community-read.service.ts`

Schimbare:

- acelasi fix: `organizationWhere(user)` cere `organizationId` explicit

Efect:

- `issues`, `requests`, `announcements` si lookup-urile tenant-specific nu mai pot degenera in query global pentru superadmin

### Patch 3: acoperire automata pentru izolarea tenantului

Fisiere noi/adaptate:

- `backend/src/residents/residents.service.spec.ts`
- `backend/src/community-read/community-read.service.spec.ts`
- `backend/src/admin-structure/admin-structure.service.spec.ts`
- `backend/src/invoices/invoices.service.spec.ts`
- `backend/src/rbac/rbac-dashboard.service.spec.ts`
- `backend/src/maintenance/maintenance.service.spec.ts`

Nu au fost necesare migratii.

## 4. Teste create

### Teste noi

1. `ResidentsService tenant isolation`
   - superadmin fara scope nu poate lista rezidenti tenant-specific
   - superadmin cu scope listeaza doar organizatia selectata
   - acces direct la rezident din alt tenant => `NotFound`

2. `CommunityReadService tenant isolation`
   - superadmin fara scope nu poate lista issues tenant-specific
   - superadmin cu scope listeaza doar organizatia selectata
   - acces direct la issue din alt tenant => `NotFound`

3. `AdminStructureService tenant isolation`
   - lista de apartamente este filtrata pe `organizationId`
   - admin A nu poate edita apartament din B
   - admin A nu poate sterge apartament din B

4. `InvoicesService tenant isolation`
   - resident/tenant A nu poate vedea factura tenantului B

5. `MaintenanceService`
   - evenimentele de mentenanta vazute de resident sunt filtrate pe `organizationId` si pe vizibilitatea apartament/scara/cladire

6. `RbacDashboardService tenant isolation`
   - dashboard counts admin sunt calculate doar in `organizationId` activ

## 5. Teste trecute / esuate

### Trecute

- `npm --prefix backend run test -- --runInBand src/residents/residents.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/community-read/community-read.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/admin-structure/admin-structure.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/invoices/invoices.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/rbac/rbac-dashboard.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/maintenance/maintenance.service.spec.ts`
- `npm run test`
- `npm run check`

Rezultat final:

- `12` suite trecute
- `29` teste trecute
- `0` teste esuate

### Esuate in timpul fixului, apoi rezolvate

- `src/rbac/rbac-dashboard.service.spec.ts`
  - cauza: mock incomplet pentru `payment.findMany`
  - status final: rezolvat, testul trece

## 6. Riscuri ramase

1. Nu toate modelele cu `associationId` din schema au teste dedicate de serviciu in aceasta runda.
   - Exemple: unele zone de suport/superadmin, saved views, retention, billing SaaS, knowledge, launch management.
   - Acestea au fost verificate static in schema si partial in cod, dar nu toate au primit test executabil acum.

2. `SUPERADMIN` are in continuare acces global doar pe zonele care sunt gandite explicit global.
   - Asta este corect functional, dar orice endpoint nou pentru superadmin trebuie verificat separat sa nu devina accidental tenant-scoped fara context.

3. Testele A/B sunt la nivel de serviciu, nu E2E browser.
   - Inca merita smoke test manual pe:
     - `/ro/admin/apartments`
     - `/ro/admin/residents`
     - `/ro/admin/requests`
     - `/ro/resident/invoices`
     - `/ro/resident/maintenance`
     - `/ro/admin`

4. Modulele mentionate de analiza comparativa SocietyPro dar neintegrate complet in Espace (`parking`, `amenities`, `bookings`, `visitors`, `forum`, unele `assets/events`) nu au primit patch tenant-specific in aceasta runda, pentru ca nu am gasit suprafete runtime noi adaugate in acest pas care sa necesite schimbare.

## Concluzie

Patch-ul aplicat este mic, localizat si orientat strict pe tenant isolation:

- am inchis cele doua locuri unde exista fallback global real
- am adaugat teste executabile pentru apartamente, facturi, mentenanta, dashboard si acces direct cross-tenant
- nu am schimbat schema
- nu am schimbat UI
- nu am introdus branding SocietyPro

Urmatorul pas recomandat:

- smoke test manual A/B in browser pentru `M1.8` din pilot, pe conturi reale sau de staging separate
- apoi extindere similara, tot in patch-uri mici, doar daca gasim rute tenant-specific suplimentare fara acoperire automata
