# First Pilot Checklist

Checklist pentru primul pilot real cu o A.P.C. din Republica Moldova. Nu include parole, chei API sau date personale reale în acest fișier.

## A. Infrastructură

- [ ] Vercel are `NEXT_PUBLIC_API_URL` setat către backend-ul production.
- [ ] Vercel are `NEXT_PUBLIC_APP_URL=https://espace.md`.
- [ ] `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` pentru pilotul real.
- [ ] Render are `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `FRONTEND_URL`, `APP_URL`, `API_URL`, `NODE_ENV` și `PORT`.
- [ ] Supabase este conectat.
- [ ] `GET /health` returnează `status=ok`.
- [ ] `GET /health/db` returnează `database=connected`.
- [ ] Nu există secrete reale în repo.
- [ ] `.env` nu este comis.
- [ ] `passwordHash`, `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL` și cheile Supabase private nu apar în răspunsuri API.

## B. Superadmin

- [ ] Login Superadmin funcționează.
- [ ] `/ro/superadmin` se încarcă fără pagină goală.
- [ ] `/ro/superadmin/organizations` afișează CRM-ul A.P.C.
- [ ] Creează A.P.C. cu format Moldova:
  - `associationCode`: `A0123-0940`
  - `legalName`: `Asociația de Proprietari din Condominiu A0123-0940`
  - `shortName`: `A.P.C. A0123-0940`
  - `associationNumber`: `0940`
- [ ] Organizația apare în lista CRM și în pagina de detalii.
- [ ] Superadmin creează sau invită administrator pentru A.P.C.
- [ ] Administratorul apare în `/ro/superadmin/admins`.
- [ ] Nu apare succes fals dacă API-ul eșuează.
- [ ] Nu apar date hardcodate ca flux principal (`APC Alba Iulia 75`, `Apt. 45`, `Popescu Ion`).

## C. Admin

- [ ] Login Admin funcționează.
- [ ] Admin vede doar A.P.C.-ul propriu.
- [ ] `/ro/admin` afișează checklist/workbench bazat pe date reale.
- [ ] `/ro/admin/settings/organization` salvează profilul A.P.C.
- [ ] Admin creează bloc.
- [ ] Admin creează scară.
- [ ] Admin creează apartament manual.
- [ ] Admin importă sau creează apartamente în masă, dacă importul este stabil.
- [ ] Admin creează locatar.
- [ ] Admin leagă locatarul la apartament.
- [ ] Admin creează contor.
- [ ] Admin adaugă citire de contor.
- [ ] Admin configurează tarife active.
- [ ] Admin generează facturi lunare doar când există apartamente și tarife.
- [ ] Admin înregistrează plată.
- [ ] Admin publică anunț pe avizier.
- [ ] Listele se reîncarcă după salvare.
- [ ] Butoanele vizibile duc către pagini funcționale sau sunt ascunse/dezactivate.

## D. Resident

- [ ] Login Resident funcționează.
- [ ] Resident vede doar apartamentul propriu.
- [ ] `/ro/resident` este simplu, fără CRM intern.
- [ ] Resident vede soldul curent și facturile.
- [ ] Resident vede contoarele și poate transmite citire dacă endpointul este stabil.
- [ ] Resident creează cerere.
- [ ] Resident vede statusul cererii.
- [ ] Resident vede anunțuri active.
- [ ] Resident vede doar documente publice.
- [ ] Resident vede contul/profilul și poate face logout.
- [ ] Nu sunt vizibile note interne, sarcini, follow-up-uri sau controale de administrator.

## E. Empty States

- [ ] `Nu există blocuri încă.`
- [ ] `Nu există scări încă.`
- [ ] `Nu există apartamente încă.`
- [ ] `Nu există locatari încă.`
- [ ] `Nu există contoare încă.`
- [ ] `Nu există tarife încă.`
- [ ] `Nu există facturi încă.`
- [ ] `Nu există anunțuri active.`
- [ ] `Nu există documente publice încă.`
- [ ] Dacă API-ul returnează listă goală, nu se afișează date temporare.
- [ ] Datele temporare apar doar când API-ul nu este disponibil și sunt marcate clar.

## F. Navigație Vizibilă

Superadmin:
- [ ] Platformă
- [ ] Asociații
- [ ] Administratori
- [ ] Planuri / Abonamente, doar dacă este utilizabil
- [ ] Sarcini / Follow-up, doar dacă este utilizabil
- [ ] Status sistem, doar dacă este util
- [ ] Setări, doar dacă este util

Admin:
- [ ] Acasă
- [ ] Apartamente
- [ ] Locatari
- [ ] Contoare
- [ ] Facturi
- [ ] Plăți
- [ ] Cereri
- [ ] Avizier
- [ ] Documente
- [ ] Rapoarte, dacă sunt utilizabile
- [ ] Setări

Resident:
- [ ] Acasă
- [ ] Facturi
- [ ] Contoare
- [ ] Cereri
- [ ] Avizier
- [ ] Documente
- [ ] Cont

Ascunse din navigație:
- [ ] demo/debug/QA/smoke-test/roadmap/release notes
- [ ] rezervări, calendar hotelier, proprietăți ca unități de închiriere
- [ ] clienți hotelieri, cleaning, bookings, guests, check-in/check-out

## G. Mobile

- [ ] `/ro/login` nu afișează acces demo în pilot.
- [ ] `/ro/superadmin` este utilizabil pe telefon.
- [ ] `/ro/admin` este utilizabil pe telefon.
- [ ] `/ro/admin/apartments` folosește carduri pe mobil.
- [ ] `/ro/admin/residents` folosește carduri pe mobil.
- [ ] `/ro/admin/invoices` nu are tabel dens pe mobil.
- [ ] `/ro/resident` afișează informațiile principale imediat.
- [ ] `/ro/resident/invoices`, `/ro/resident/meters`, `/ro/resident/issues` au butoane ușor de apăsat.
- [ ] Nu există scroll orizontal pe paginile principale.
- [ ] Conținutul nu este ascuns sub navigația de jos.

## H. Hidden / Not Ready For Pilot

- Plăți online reale.
- BPay.
- Semnătură electronică.
- Integrări automate cu furnizori utilități.
- Module vechi de cazare/turism.
- Pagini demo/debug/QA expuse utilizatorilor reali.

## Final Gate

```bash
cd backend
npx prisma generate
npx prisma validate
npm run build

cd ../frontend
npm run build
```
