# ESPACE_UPLOAD_SECURITY_AUDIT

Status: partial hardening completed. Sensitive files are better isolated, but a few legacy/manual URL flows still need follow-up.

## 1. Upload-uri verificate

- logo societate: public asset flow accepted, no private-route change needed
- avatar user: not changed in this patch; no new public exposure found in audited routes
- documente facturi / receipts plăți: verified through `invoice-publishing` + `FileAsset`
- atașamente mentenanță: verified through `maintenance`
- atașamente tickets / cereri locatar: verified through `community-read` + `issues`
- documente assets / documente asociație: verified through `documents-mvp`
- dovezi citiri utilități / contoare: verified through `meters`
- fișiere forum/comments: no dedicated forum attachment pipeline found in active Espace runtime
- module custom / ZIP: no custom ZIP module upload flow found in Espace runtime

## 2. Riscuri găsite

### Critice / mari

- `FilesService` valida doar extensia și MIME-ul declarat; nu verifica semnătura reală a fișierului.
- Mai multe servicii acceptau `fileUrl` intern fără să confirme că URL-ul aparține unui `FileAsset` din aceeași societate.
- Unele pagini deschideau încă URL-ul brut `/uploads/...` în locul rutei securizate de download.

### Medii

- Unele formulare încă cer utilizatorului să insereze manual un URL intern (`/uploads/...`) în loc să lege explicit uploader-ul.
- Espace Connect și câteva fluxuri secundare încă lucrează cu `attachmentUrl` raw și nu sunt migrate complet pe `FileAsset + secure download`.

## 3. Patch-uri aplicate

### Backend

- [`/Users/bolboceanu/espace/backend/src/files/files.service.ts`](/Users/bolboceanu/espace/backend/src/files/files.service.ts)
  - allowlist per `FileAssetEntityType`
  - limite pe dimensiune per tip de fișier
  - verificare semnătură reală pentru `pdf`, `jpg/jpeg`, `png`, `doc`, `docx`
  - cale salvată randomizată; numele original nu este folosit ca path final
  - rezolvare sigură de path și blocare path traversal
  - download autorizat per rol și per societate

- [`/Users/bolboceanu/espace/backend/src/common/file-asset-reference.ts`](/Users/bolboceanu/espace/backend/src/common/file-asset-reference.ts)
  - helper nou pentru a cere explicit un `FileAsset` din aceeași organizație
  - helper nou pentru a lega fișierul încărcat de entitatea creată după persistare

- [`/Users/bolboceanu/espace/backend/src/documents-mvp/documents-mvp.service.ts`](/Users/bolboceanu/espace/backend/src/documents-mvp/documents-mvp.service.ts)
  - documentele admin nu mai acceptă URL arbitrar; cer `FileAsset` valid din aceeași organizație

- [`/Users/bolboceanu/espace/backend/src/issues/issues.service.ts`](/Users/bolboceanu/espace/backend/src/issues/issues.service.ts)
  - atașamentele issue sunt legate de `FileAsset` și expun `fileAssetId` pentru download securizat

- [`/Users/bolboceanu/espace/backend/src/community-read/community-read.service.ts`](/Users/bolboceanu/espace/backend/src/community-read/community-read.service.ts)
  - atașamentele cererilor locatar sunt validate contra `FileAsset` din aceeași societate
  - răspunsurile resident/admin pentru requests expun acum `attachmentFileAssetId`

- [`/Users/bolboceanu/espace/backend/src/maintenance/maintenance.service.ts`](/Users/bolboceanu/espace/backend/src/maintenance/maintenance.service.ts)
  - atașamentele de cheltuieli/mentenanță cer `FileAsset` valid și sunt legate de entitate

- [`/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.ts`](/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.ts)
  - dovezile de plată cer `FileAsset` valid din aceeași organizație
  - răspunsurile resident/admin expun `proofFileAssetId`

- [`/Users/bolboceanu/espace/backend/src/meters/meters.service.ts`](/Users/bolboceanu/espace/backend/src/meters/meters.service.ts)
  - dovada pentru citiri rezident cere `FileAsset` valid din aceeași organizație
  - dovada este legată la citirea creată
  - răspunsul admin detail expune `proofFileAssetId`

### Frontend

- [`/Users/bolboceanu/espace/frontend/app/(app)/resident/documents/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/documents/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/admin/documents/page.tsx`](/Users/bolboceanu/espace/frontend/app/admin/documents/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/admin/payment-proofs/page.tsx`](/Users/bolboceanu/espace/frontend/app/admin/payment-proofs/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/admin/invoices/[id]/page.tsx`](/Users/bolboceanu/espace/frontend/app/admin/invoices/%5Bid%5D/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/resident/invoices/[id]/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/invoices/%5Bid%5D/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/admin/requests/[id]/page.tsx`](/Users/bolboceanu/espace/frontend/app/admin/requests/%5Bid%5D/page.tsx)
- [`/Users/bolboceanu/espace/frontend/app/(app)/resident/requests/[id]/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/requests/%5Bid%5D/page.tsx)
- [`/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx`](/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx)

Aceste pagini preferă acum `filesApi.secureDownloadUrl(fileAssetId)` când există, în locul linkului brut către fișier.

## 4. Fișiere mutate în private storage

- Nu am mutat fizic fișiere istorice într-un alt bucket/director în această rundă.
- Fluxul privat existent rămâne sub `backend/uploads` și este servit prin aplicație, nu printr-un public static server dedicat.
- Pentru fișierele sensibile, patch-ul a forțat legarea la `FileAsset` și consumul prin ruta autorizată de download.

## 5. Rute download create

- Nu a fost necesară o rută nouă.
- Ruta securizată reutilizată este:
  - `GET /files/:id/download`
  - implementare: [`/Users/bolboceanu/espace/backend/src/files/files.controller.ts`](/Users/bolboceanu/espace/backend/src/files/files.controller.ts)

## 6. Teste create

- [`/Users/bolboceanu/espace/backend/src/files/files.service.spec.ts`](/Users/bolboceanu/espace/backend/src/files/files.service.spec.ts)
  - upload permis
  - extensie nepermisă respinsă
  - MIME/semnătură greșită respinsă
  - fișier prea mare respins
  - download cross-tenant respins
  - admin same-tenant poate descărca
  - superadmin doar cu context permis
  - path traversal blocat

- [`/Users/bolboceanu/espace/backend/src/community-read/community-read.service.spec.ts`](/Users/bolboceanu/espace/backend/src/community-read/community-read.service.spec.ts)
  - request attachment mapping către `attachmentFileAssetId`

- [`/Users/bolboceanu/espace/backend/src/meters/meters.service.spec.ts`](/Users/bolboceanu/espace/backend/src/meters/meters.service.spec.ts)
  - meter proof mapping către `proofFileAssetId`

- [`/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.spec.ts`](/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.spec.ts)
  - proof `SUBMITTED`
  - aprobare admin creează plata corect

Rezultate rulate:

- `npm --prefix backend run test -- --runInBand src/files/files.service.spec.ts src/community-read/community-read.service.spec.ts src/invoice-publishing/invoice-publishing.service.spec.ts src/meters/meters.service.spec.ts` ✅
- `npm run test` ✅ `15` suite, `42` teste trecute
- `npm --prefix backend run build` ✅
- `npm --prefix frontend run build` ✅

## 7. Riscuri rămase

- [`/Users/bolboceanu/espace/frontend/components/connect/ConnectWorkspace.tsx`](/Users/bolboceanu/espace/frontend/components/connect/ConnectWorkspace.tsx) și [`/Users/bolboceanu/espace/backend/src/connect/connect.service.ts`](/Users/bolboceanu/espace/backend/src/connect/connect.service.ts) încă tratează `attachmentUrl` în stil raw și merită migrate pe `FileAsset + secure download`.
- Formularele care cer încă manual un URL intern rămân fragile ca UX și ușor de folosit greșit:
  - [`/Users/bolboceanu/espace/frontend/app/(app)/resident/requests/new/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/requests/new/page.tsx)
  - [`/Users/bolboceanu/espace/frontend/app/(app)/resident/invoices/[id]/page.tsx`](/Users/bolboceanu/espace/frontend/app/%28app%29/resident/invoices/%5Bid%5D/page.tsx)
  - [`/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx`](/Users/bolboceanu/espace/frontend/components/meters/ResidentReadingSubmissionPages.tsx)
- Nu a fost necesară migrare de DB, dar nici nu am făcut backfill istoric pentru a înlocui toate URL-urile raw stocate anterior cu `fileAssetId` explicit.
