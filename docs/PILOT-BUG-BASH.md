# ES-090 Pilot Bug Bash

Data: 2026-05-09  
Scop: verificare blocker-only pentru primul pilot real A.P.C. din Republica Moldova.

## Flows verificate

### Login / roluri

- Login real folosește API-ul din `NEXT_PUBLIC_API_URL`.
- Tokenul este salvat în `espace_access_token` și cookie-ul `accessToken`.
- API client atașează `Authorization: Bearer <token>`.
- 401 curăță sesiunea și redirecționează spre login.
- Rutele protejate sunt separate pe rol:
  - SUPERADMIN → `/ro/superadmin`
  - ADMIN → `/ro/admin`
  - RESIDENT → `/ro/resident`
- Demo-preview nu mai poate activa o sesiune protejată dacă demo mode nu este activat explicit.

### Superadmin

- Navigație vizibilă: Platformă, Asociații, Administratori, Abonamente, Follow-up, Status sistem.
- Formele de A.P.C. folosesc terminologie A.P.C. și date reale.
- Endpointurile active superadmin sunt protejate cu rol SUPERADMIN.
- Răspunsurile selectează câmpuri sigure pentru utilizatori, fără `passwordHash`.

### Admin first-use

- Navigație vizibilă: Acasă, Apartamente, Locatari, Contoare, Facturi, Plăți, Cereri, Avizier, Documente, Import date, Rapoarte, Setări.
- Endpointurile admin derivă organizația din utilizatorul autentificat.
- Importul apartamente/locatari returnează sumar cu apartamente create/omise, locatari creați/conectați și erori pe rând.
- Billing folosește tarife active, previne duplicatele lunare și actualizează soldurile prin plăți confirmate.

### Resident

- Portalul locatarului rămâne self-service: Acasă, Facturi, Contoare, Cereri, Avizier, Documente, Cont.
- Facturi, plăți, contoare, citiri și cereri sunt filtrate după apartamentele legate de cont și `organizationId`.
- Documentele pentru locatar sunt filtrate la documente vizibile locatarilor.
- Notele interne și sarcinile CRM nu sunt afișate locatarului.

### Comunicare

- Locatarul poate crea cerere pentru propriul apartament.
- Admin vede cererile organizației proprii.
- Anunțurile active sunt vizibile locatarilor din organizația proprie.

### Documente / rapoarte / print

- Documentele admin sunt organizație-scoped.
- Documentele locatarului sunt doar publice pentru locatari.
- Rapoartele admin sunt organizație-scoped și exporturile CSV folosesc coloane românești.
- Paginile print folosesc documente print-friendly, fără procesator online de plată.

## Blockere găsite

- Sesiunea demo-preview putea fi interpretată de frontend ca sesiune protejată fără token real.
- Flagurile pentru demo din login și middleware nu erau aliniate.

## Fixuri aplicate

- Frontend auth și middleware acceptă demo-preview doar dacă este activat explicit prin:
  - `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`
  - sau `NEXT_PUBLIC_ENABLE_DEMO=true`
  - sau `NEXT_PUBLIC_DEMO_MODE=true`
- În modul pilot normal, rutele protejate cer token real.
- Query-urile resident pentru facturi, plăți, contoare, citiri și cereri includ și `organizationId`.
- Erorile Prisma cunoscute sunt mapate la mesaje sigure, fără detalii brute.
- Guardurile legacy returnează mesaje 401/403 clare în română.

## Securitate rapidă

- `passwordHash` este folosit doar intern pentru autentificare/creare cont și nu este selectat în răspunsurile active.
- `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`, chei email și chei Supabase private nu sunt expuse în răspunsuri.
- `/health` și `/health/db` nu expun secrete.
- Admin nu trebuie să poată schimba organizația prin `organizationId` sau `x-org-id`; doar SUPERADMIN poate folosi scop explicit unde este suportat.
- RESIDENT nu poate accesa endpointuri admin/superadmin prin rol.

## Navigație

- Navigația vizibilă rămâne APC-focused.
- Rutele vechi PMS/hotel pot exista în build pentru compatibilitate, dar nu sunt în navigația principală.
- Middleware redirecționează rutele vechi majore către zonele APC corespunzătoare.

## Mobile

- Navigația mobilă folosește maximum patru acțiuni principale plus `Mai mult`.
- Conținutul principal are padding inferior pentru bottom nav.
- Resident portal și Admin flow folosesc carduri și acțiuni mari în paginile principale.

## Safe for pilot

- Login real, roluri, organizație-scope, import CSV, billing manual, documente publice, rapoarte și portal locatar sunt pregătite pentru test cu date reale.
- Demo mode trebuie lăsat dezactivat în Vercel pentru pilot, cu excepția prezentărilor controlate.

## Limitări cunoscute

- Plățile online nu sunt implementate.
- BPay este amânat.
- E-signature nu este implementat.
- Integrările automate cu furnizori de utilități nu sunt implementate.
- Emailul funcționează doar dacă providerul este configurat.
- Render free poate avea cold start dacă serviciul este pe plan gratuit.
- Testul final cross-organization trebuie făcut cu conturi reale SUPERADMIN, ADMIN și RESIDENT în producție.
