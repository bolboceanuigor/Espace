# ESPACE_QA_MANUAL_CHECKLIST

Data: 2026-06-03

## Scop

Checklist manual complet pentru verificarea Espace SaaS în browser înainte de deploy sau lansare. Documentul este orientat pe roluri, fluxuri reale și riscuri de producție: auth, multi-tenancy, operațiuni per asociație, plăți, branding și securitate.

## Legendă

- `Status`: `Pass` / `Fail`
- `Observații`: completează bug-ul, captura, URL-ul și comportamentul real observat

## Precondiții recomandate

### Mediu

- Rulează build-ul curent validat
- Folosește un mediu `staging` cu date controlate, nu producția
- Activează email delivery spre inbox-uri de test
- Dacă există gateway-uri online, folosește doar chei sandbox
- Dacă există webhooks, configurează endpoint-urile sandbox și logarea aferentă

### Conturi de test

- `Super Admin`
- `Society Admin A`
- `Society Admin B`
- `Owner A`
- `Owner B`
- `Tenant A`
- `Tenant B`
- `Staff / Service Provider A`
- `Staff / Service Provider B`
- `User fără permisiuni speciale`

### Date minime

- `Societatea A`
- `Societatea B`
- câte 1 clădire / scară / etaj / apartament per societate
- câte 1 owner și 1 tenant per societate
- câte 1 factură și 1 cerere de mentenanță per societate
- câte 1 dovadă de plată offline
- câte 1 anunț publicat pentru societatea A și B

### Browsere / dispozitive

- Desktop: Chrome, Safari
- Mobil: Safari iPhone sau Chrome Android
- Testează cel puțin:
  - `Super Admin` pe desktop
  - `Society Admin` pe desktop
  - `Tenant` pe mobil

## Matrice conturi pentru multi-tenancy

- `Societatea A`
  - `Admin A`
  - `Owner A`
  - `Tenant A`
  - `Staff A`
- `Societatea B`
  - `Admin B`
  - `Owner B`
  - `Tenant B`
  - `Staff B`

Folosește aceste conturi în toate testele cross-tenant.

---

## 1. Auth și sesiune

### QA-AUTH-001
- `Rol`: Society Admin
- `Pași`:
  1. Deschide `/ro/login`.
  2. Introdu email și parolă valide.
  3. Trimite formularul.
- `Rezultat așteptat`: autentificarea reușește, utilizatorul ajunge în dashboard-ul corect, fără erori vizuale sau loop de redirect.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-002
- `Rol`: Society Admin
- `Pași`:
  1. Deschide `/ro/login`.
  2. Introdu parolă greșită.
  3. Trimite formularul.
- `Rezultat așteptat`: login-ul este respins cu mesaj clar și fără a divulga detalii sensibile.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-003
- `Rol`: User inactiv
- `Pași`:
  1. Încearcă login cu un user marcat inactiv.
- `Rezultat așteptat`: accesul este blocat; UI-ul nu permite intrarea în aplicație.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-004
- `Rol`: User din societate inactivă
- `Pași`:
  1. Dezactivează societatea din Super Admin.
  2. Încearcă login cu adminul sau locatarul acelei societăți.
- `Rezultat așteptat`: accesul este blocat sau sesiunea este limitată conform politicii aplicației.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-005
- `Rol`: Orice utilizator
- `Pași`:
  1. Din aplicație, folosește logout.
  2. Încearcă să revii cu Back pe o rută privată.
- `Rezultat așteptat`: sesiunea este închisă și rutele private cer reautentificare.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-006
- `Rol`: Orice utilizator
- `Pași`:
  1. Deschide `/ro/forgot-password`.
  2. Cere resetare pentru un cont valid.
  3. Verifică emailul primit.
- `Rezultat așteptat`: emailul de reset este trimis și conține branding Espace.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-007
- `Rol`: Orice utilizator
- `Pași`:
  1. Urmează linkul de resetare.
  2. Setează o parolă nouă.
  3. Autentifică-te cu parola nouă.
- `Rezultat așteptat`: resetarea funcționează end-to-end și parola veche nu mai merge.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-008
- `Rol`: User nou / invitat
- `Pași`:
  1. Deschide fluxul de verificare email sau invitație.
  2. Confirmă emailul din linkul primit.
- `Rezultat așteptat`: verificarea finalizează contul fără ecran blocat, branding vechi sau eroare.
- `Status`: Pass / Fail
- `Observații`:

### QA-AUTH-009
- `Rol`: Tenant
- `Pași`:
  1. Intră pe o rută admin direct, de ex. `/ro/admin`.
- `Rezultat așteptat`: utilizatorul este redirecționat sau primește `403`, fără expunere de date admin.
- `Status`: Pass / Fail
- `Observații`:

---

## 2. Super Admin

### QA-SUPER-001
- `Rol`: Super Admin
- `Pași`:
  1. Intră în `/ro/superadmin`.
  2. Verifică dashboard-ul principal.
- `Rezultat așteptat`: dashboard-ul se încarcă fără erori și afișează indicatori globali.
- `Status`: Pass / Fail
- `Observații`:

### QA-SUPER-002
- `Rol`: Super Admin
- `Pași`:
  1. Deschide `/ro/superadmin/organizations`.
  2. Creează `Societatea A`.
  3. Creează `Societatea B`.
- `Rezultat așteptat`: ambele societăți se creează cu date complete și apar în listă.
- `Status`: Pass / Fail
- `Observații`:

### QA-SUPER-003
- `Rol`: Super Admin
- `Pași`:
  1. Deschide fișa unei societăți.
  2. Dezactivează societatea.
  3. Reîncarcă lista.
  4. Reactivează societatea.
- `Rezultat așteptat`: statusul se schimbă corect și impactul asupra login-ului este coerent.
- `Status`: Pass / Fail
- `Observații`:

### QA-SUPER-004
- `Rol`: Super Admin
- `Pași`:
  1. Invită sau creează `Admin A` pentru `Societatea A`.
  2. Invită sau creează `Admin B` pentru `Societatea B`.
- `Rezultat așteptat`: fiecare admin este legat de societatea corectă și primește acces doar acolo.
- `Status`: Pass / Fail
- `Observații`:

### QA-SUPER-005
- `Rol`: Super Admin
- `Pași`:
  1. Verifică `/ro/superadmin/billing/plans`, `/ro/superadmin/subscriptions`, `/ro/superadmin/billing/saas-invoices`.
  2. Deschide detalii și filtre.
- `Rezultat așteptat`: zonele SaaS se încarcă corect; dacă unele funcții nu sunt încă active, UI-ul explică clar starea și nu simulează plăți false.
- `Status`: Pass / Fail
- `Observații`:

### QA-SUPER-006
- `Rol`: Super Admin
- `Pași`:
  1. Verifică `/ro/superadmin/payments/providers`.
  2. Deschide providerii configurați.
- `Rezultat așteptat`: copy-ul este Espace, nu apare branding SocietyPro; providerii inactive sunt marcate clar.
- `Status`: Pass / Fail
- `Observații`:

### QA-SUPER-007
- `Rol`: Super Admin
- `Pași`:
  1. Verifică `/ro/superadmin/audit-logs`.
  2. Caută acțiunile recente de creare/editare organizație.
- `Rezultat așteptat`: acțiunile importante apar în audit și pot fi filtrate.
- `Status`: Pass / Fail
- `Observații`:

---

## 3. Society Admin

### QA-ADMIN-001
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin`.
  2. Verifică dashboard-ul.
- `Rezultat așteptat`: dashboard-ul afișează date doar pentru societatea adminului.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-002
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/settings/organization`.
  2. Editează setări de bază ale societății.
- `Rezultat așteptat`: setările se salvează și se aplică doar societății curente.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-003
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/settings/roles`.
  2. Creează sau editează un rol.
  3. Alocă permisiuni limitate.
- `Rezultat așteptat`: rolul se salvează, permisiunile se aplică corect și nu oferă acces global.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-004
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/team` sau zona de membri.
  2. Invită un user cu rol limitat.
- `Rezultat așteptat`: invitația se creează și userul este legat strict de societatea curentă.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-005
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/buildings`.
  2. Creează o clădire / bloc.
- `Rezultat așteptat`: clădirea apare în listă și este vizibilă doar în societatea curentă.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-006
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/staircases`.
  2. Creează o scară / structură echivalentă pentru clădire.
- `Rezultat așteptat`: scara este salvată și legată de clădirea corectă.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-007
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/apartments`.
  2. Creează un apartament pe o clădire/scară existentă.
  3. Setează etajul dacă modulul folosește `floor` pe apartament.
- `Rezultat așteptat`: apartamentul se salvează complet și apare în listă/filtre.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-008
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/owners`.
  2. Verifică listarea ownerilor existenți.
  3. Din fișa apartamentului sau rezidentului, setează ownerul principal.
- `Rezultat așteptat`: ownerul este mapat corect la apartament și apare în suprafețele relevante.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-009
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/residents`.
  2. Creează sau editează un rezident/chiriaș.
  3. Leagă-l la apartamentul potrivit.
- `Rezultat așteptat`: rezidentul este salvat, apare în listă și este vizibil în fișa apartamentului.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-010
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/imports/apartments` și `/ro/admin/imports/residents`.
  2. Descarcă template-ul și încearcă un import valid mic.
- `Rezultat așteptat`: template-ul este Espace, importul validează corect și nu amestecă date din altă societate.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-011
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/maintenance` și `/ro/admin/issues`.
  2. Creează o cerere / task de mentenanță.
  3. Setează prioritate și status.
- `Rezultat așteptat`: cererea se salvează, apare în listă și dashboard count-urile se actualizează.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-012
- `Rol`: Society Admin
- `Pași`:
  1. Asignează cererea de mentenanță către `Staff A`.
  2. Adaugă comentariu sau update.
  3. Marchează `in progress`, apoi `resolved`.
- `Rezultat așteptat`: statusurile se schimbă corect, iar actorii relevanți primesc notificare.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-013
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/billing`, `/ro/admin/invoices`, `/ro/admin/charges`, `/ro/admin/tariffs`.
  2. Creează o factură simplă sau rulează fluxul real de facturare disponibil.
- `Rezultat așteptat`: factura este creată pentru apartamentul corect, cu status inițial coerent.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-014
- `Rol`: Society Admin
- `Pași`:
  1. Creează separat:
     - factură rent
     - factură utility
     - factură common charges
     - factură maintenance
     - factură custom
  2. Verifică lista și detaliul.
- `Rezultat așteptat`: tipul facturii este clar, suma și scadența sunt corecte, iar numărul facturii este unic în societate.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-015
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/payment-proofs` și `/ro/admin/payments`.
  2. Înregistrează sau aprobă o plată offline.
  3. Atașează dovadă și referință.
- `Rezultat așteptat`: plata apare în ledger, statusul facturii se actualizează și audit log-ul reflectă acțiunea.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-016
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/meters` și `/ro/admin/meter-readings`.
  2. Adaugă contoare și citiri.
  3. Verifică preview-ul pentru tarife utilități.
- `Rezultat așteptat`: citirile sunt calculate corect și se propagă în facturare fără erori vizibile.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-017
- `Rol`: Society Admin
- `Pași`:
  1. Verifică dacă există module active pentru parcare, amenities/rezervări, vizitatori, assets, events, forum.
  2. Dacă sunt active, creează câte o înregistrare de probă.
  3. Dacă nu sunt active, confirmă că nu apar în navigare publică sau admin fără context.
- `Rezultat așteptat`: modulele active funcționează; modulele inactive sunt ascunse sau clar indisponibile, fără erori.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-018
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/announcements`.
  2. Creează un anunț țintit.
  3. Publică-l.
- `Rezultat așteptat`: anunțul apare doar pentru publicul eligibil din societatea curentă.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-019
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/requests`.
  2. Deschide o cerere rezident.
  3. Răspunde și schimbă statusul.
- `Rezultat așteptat`: istoricul cererii este complet și notificările se trimit corect.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-020
- `Rol`: Society Admin
- `Pași`:
  1. Intră în `/ro/admin/suppliers` și modulele conexe de service providers.
  2. Creează sau editează un furnizor.
  3. Leagă furnizorul la o lucrare, dacă fluxul există.
- `Rezultat așteptat`: datele furnizorului se salvează și rămân în societatea curentă.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-021
- `Rol`: Society Admin
- `Pași`:
  1. Verifică `/ro/admin/documents`.
  2. Urcă un fișier permis.
  3. Descarcă fișierul.
- `Rezultat așteptat`: upload-ul reușește, download-ul necesită sesiune validă, iar fișierul nu este expus public direct.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-022
- `Rol`: Society Admin
- `Pași`:
  1. Verifică `/ro/admin/notifications`, `/ro/admin/reminders`.
  2. Creează sau editează o regulă de reminder pentru factură.
- `Rezultat așteptat`: regula este salvată și apare în lista corectă pentru societate.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-023
- `Rol`: Society Admin
- `Pași`:
  1. Verifică `/ro/admin/reports/*`.
  2. Deschide raportul de apartamente, rezidenți, plăți și datorii.
- `Rezultat așteptat`: rapoartele se încarcă și folosesc numai date din societatea curentă.
- `Status`: Pass / Fail
- `Observații`:

### QA-ADMIN-024
- `Rol`: Society Admin
- `Pași`:
  1. Deschide o factură admin și generează PDF/print, dacă opțiunea există.
  2. Verifică brandingul în document.
- `Rezultat așteptat`: PDF-ul sau print view afișează Espace și datele corecte ale societății/facturii.
- `Status`: Pass / Fail
- `Observații`:

---

## 4. Owner / Proprietar

### QA-OWNER-001
- `Rol`: Owner
- `Pași`:
  1. Autentifică-te.
  2. Intră în dashboard-ul owner/resident disponibil.
- `Rezultat așteptat`: vezi doar apartamentele și datele legate de ownerul curent.
- `Status`: Pass / Fail
- `Observații`:

### QA-OWNER-002
- `Rol`: Owner
- `Pași`:
  1. Verifică `/ro/resident/apartments`.
  2. Deschide apartamentul propriu.
- `Rezultat așteptat`: informațiile despre apartament sunt corecte și nu apar apartamente străine.
- `Status`: Pass / Fail
- `Observații`:

### QA-OWNER-003
- `Rol`: Owner
- `Pași`:
  1. Verifică `/ro/resident/invoices`.
  2. Deschide o factură.
  3. Verifică soldul în `/ro/resident/balance`.
- `Rezultat așteptat`: ownerul vede doar facturile apartamentelor proprii, iar soldul este coerent cu adminul.
- `Status`: Pass / Fail
- `Observații`:

### QA-OWNER-004
- `Rol`: Owner
- `Pași`:
  1. Încearcă upload de dovadă de plată în `/ro/resident/payment-proofs`.
  2. Verifică istoricul plăților.
- `Rezultat așteptat`: dovada este trimisă corect și apare în istoricul propriu, nu în alte apartamente.
- `Status`: Pass / Fail
- `Observații`:

### QA-OWNER-005
- `Rol`: Owner
- `Pași`:
  1. Verifică anunțurile, cererile, documentele și notificările personale.
- `Rezultat așteptat`: ownerul vede doar informațiile eligibile pentru el și apartamentele lui.
- `Status`: Pass / Fail
- `Observații`:

---

## 5. Tenant / Chiriaș

### QA-TENANT-001
- `Rol`: Tenant
- `Pași`:
  1. Autentifică-te.
  2. Intră în `/ro/resident`.
- `Rezultat așteptat`: dashboard-ul se încarcă pe mobil și desktop fără a expune funcții admin.
- `Status`: Pass / Fail
- `Observații`:

### QA-TENANT-002
- `Rol`: Tenant
- `Pași`:
  1. Verifică `/ro/resident/invoices` și `/ro/resident/balance`.
  2. Compară cu adminul societății pentru aceeași factură.
- `Rezultat așteptat`: tenantul vede doar facturile lui și soldul corespunde cu cel din admin.
- `Status`: Pass / Fail
- `Observații`:

### QA-TENANT-003
- `Rol`: Tenant
- `Pași`:
  1. Trimite o dovadă de plată offline din `/ro/resident/payment-proofs` sau din factura deschisă.
- `Rezultat așteptat`: cererea este acceptată de UI, fișierul urcat este salvat corect, iar tenantul primește feedback clar.
- `Status`: Pass / Fail
- `Observații`:

### QA-TENANT-004
- `Rol`: Tenant
- `Pași`:
  1. Creează o cerere nouă în `/ro/resident/requests/new` sau `/ro/resident/issues/new`.
  2. Atașează un fișier permis.
- `Rezultat așteptat`: cererea este creată în societatea corectă și apare în istoricul personal.
- `Status`: Pass / Fail
- `Observații`:

### QA-TENANT-005
- `Rol`: Tenant
- `Pași`:
  1. Verifică `/ro/resident/announcements`, `/ro/resident/notifications`, `/ro/resident/documents`.
- `Rezultat așteptat`: tenantul vede doar documentele, notificările și anunțurile eligibile.
- `Status`: Pass / Fail
- `Observații`:

### QA-TENANT-006
- `Rol`: Tenant
- `Pași`:
  1. Dacă există contoare, intră în `/ro/resident/meters` și `/ro/resident/meter-readings`.
  2. Trimite o citire nouă.
- `Rezultat așteptat`: citirea este validată și legată doar apartamentului tenantului.
- `Status`: Pass / Fail
- `Observații`:

### QA-TENANT-007
- `Rol`: Tenant
- `Pași`:
  1. Încearcă acces pe rute admin: `/ro/admin`, `/ro/admin/invoices`, `/ro/admin/settings/roles`.
- `Rezultat așteptat`: accesul este blocat prin `403`, redirect sau ecran de interdicție, fără scurgeri de date.
- `Status`: Pass / Fail
- `Observații`:

---

## 6. Staff / Service Provider

### QA-STAFF-001
- `Rol`: Staff / Service Provider
- `Pași`:
  1. Autentifică-te cu `Staff A`.
  2. Accesează zona de task-uri sau mentenanță disponibilă.
- `Rezultat așteptat`: staff-ul vede doar lucrările sau cererile asignate lui ori permise explicit.
- `Status`: Pass / Fail
- `Observații`:

### QA-STAFF-002
- `Rol`: Staff / Service Provider
- `Pași`:
  1. Deschide un task asignat.
  2. Schimbă statusul și adaugă update.
- `Rezultat așteptat`: acțiunea se salvează, iar actorii relevanți sunt notificați.
- `Status`: Pass / Fail
- `Observații`:

### QA-STAFF-003
- `Rol`: Staff / Service Provider
- `Pași`:
  1. Încearcă să deschizi direct URL-ul unui task din `Societatea B`.
- `Rezultat așteptat`: accesul este refuzat sau resursa nu există pentru acest utilizator.
- `Status`: Pass / Fail
- `Observații`:

---

## 7. Module opționale / condiționale

Folosește testele de mai jos doar dacă modulul este activ în build-ul testat. Dacă nu este activ, rezultatul corect este: modulul nu apare în meniu sau este blocat clar fără erori.

### QA-OPT-001 Parking
- `Rol`: Society Admin
- `Pași`:
  1. Deschide modulul de parcare, dacă există.
  2. Creează un loc de parcare și atribuie-l unui apartament.
- `Rezultat așteptat`: datele se salvează corect și rămân în societatea curentă.
- `Status`: Pass / Fail
- `Observații`:

### QA-OPT-002 Amenities / Rezervări
- `Rol`: Society Admin și Tenant
- `Pași`:
  1. Creează o facilitate.
  2. Fă o rezervare din contul tenantului.
- `Rezultat așteptat`: rezervarea respectă disponibilitatea și apare doar actorilor relevanți.
- `Status`: Pass / Fail
- `Observații`:

### QA-OPT-003 Vizitatori
- `Rol`: Society Admin sau Tenant
- `Pași`:
  1. Creează o înregistrare de vizitator.
  2. Verifică listarea și validarea.
- `Rezultat așteptat`: vizitatorul este salvat în societatea corectă.
- `Status`: Pass / Fail
- `Observații`:

### QA-OPT-004 Assets
- `Rol`: Society Admin
- `Pași`:
  1. Creează un asset / bun.
  2. Leagă-l la o clădire sau lucrare.
- `Rezultat așteptat`: asset-ul apare în listă și nu este vizibil cross-tenant.
- `Status`: Pass / Fail
- `Observații`:

### QA-OPT-005 Events
- `Rol`: Society Admin și Tenant
- `Pași`:
  1. Creează un eveniment.
  2. Verifică vizibilitatea în portalul rezidentului.
- `Rezultat așteptat`: evenimentul este afișat doar în societatea corectă.
- `Status`: Pass / Fail
- `Observații`:

### QA-OPT-006 Forum
- `Rol`: Society Admin și Tenant
- `Pași`:
  1. Dacă forumul este activ, creează un topic și un răspuns.
  2. Verifică escaping-ul conținutului.
- `Rezultat așteptat`: postările funcționează fără HTML/script executat și fără branding vechi.
- `Status`: Pass / Fail
- `Observații`:

---

## 8. Multi-tenancy explicit

### QA-MT-001
- `Rol`: Super Admin
- `Pași`:
  1. Creează `Societatea A` și `Societatea B`.
  2. Creează `Admin A` și `Admin B`.
  3. Creează apartamente separate în fiecare societate.
- `Rezultat așteptat`: datele sunt separate și fiecare entitate este legată de societatea corectă.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-002
- `Rol`: Society Admin A
- `Pași`:
  1. Intră în `/ro/admin/apartments`.
  2. Caută apartamentele din `Societatea B`.
- `Rezultat așteptat`: apartamentele din `Societatea B` nu apar în listă, căutare sau filtre.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-003
- `Rol`: Society Admin A
- `Pași`:
  1. Copiază URL-ul unui apartament din `Societatea B`.
  2. Accesează direct acel URL.
- `Rezultat așteptat`: aplicația răspunde cu `403`, `404` sau redirect sigur; nu afișează datele.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-004
- `Rol`: Society Admin A
- `Pași`:
  1. Verifică `/ro/admin/invoices`.
  2. Caută sau accesează direct facturi din `Societatea B`.
- `Rezultat așteptat`: facturile din `Societatea B` nu sunt listate și nu pot fi deschise.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-005
- `Rol`: Society Admin A
- `Pași`:
  1. Verifică `/ro/admin/maintenance`, `/ro/admin/issues`, `/ro/admin/requests`.
  2. Încearcă acces direct la itemi din `Societatea B`.
- `Rezultat așteptat`: accesul este blocat și datele nu apar în dropdown-uri sau liste.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-006
- `Rol`: Owner A
- `Pași`:
  1. Deschide apartamentele și facturile proprii.
  2. Încearcă URL direct către datele lui `Owner B`.
- `Rezultat așteptat`: `Owner A` nu vede datele lui `Owner B`.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-007
- `Rol`: Tenant A
- `Pași`:
  1. Deschide facturile, documentele și cererile proprii.
  2. Încearcă URL direct către datele lui `Tenant B`.
- `Rezultat așteptat`: `Tenant A` nu vede datele lui `Tenant B`.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-008
- `Rol`: Staff A
- `Pași`:
  1. Încearcă acces la task-uri sau mentenanță din `Societatea B`.
- `Rezultat așteptat`: staff-ul este limitat la entitățile permise.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-009
- `Rol`: Society Admin A
- `Pași`:
  1. Deschide formulare cu dropdown-uri: apartamente, rezidenți, owneri, furnizori, facturi.
  2. Verifică dacă apar valori din `Societatea B`.
- `Rezultat așteptat`: dropdown-urile listează doar date din societatea curentă.
- `Status`: Pass / Fail
- `Observații`:

### QA-MT-010
- `Rol`: Super Admin
- `Pași`:
  1. Verifică zonele globale.
  2. Confirmă că doar Super Admin poate vedea cross-tenant unde este explicit permis.
- `Rezultat așteptat`: vizibilitatea globală există doar pentru superadmin și doar pe ecranele intenționate.
- `Status`: Pass / Fail
- `Observații`:

---

## 9. Securitate manuală

### QA-SEC-001
- `Rol`: User fără permisiune
- `Pași`:
  1. Încearcă să creezi apartament, rol, factură sau setare admin.
- `Rezultat așteptat`: operația este blocată cu `403` sau UI-ul nu expune acțiunea.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-002
- `Rol`: Tenant
- `Pași`:
  1. Trimite request direct către o rută admin prin browser sau client API.
- `Rezultat așteptat`: răspunsul este refuzat; nu există efect secundar în date.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-003
- `Rol`: Society Admin
- `Pași`:
  1. Încearcă upload de fișier nepermis: `.exe`, `.sh`, `.php`, `.zip`.
- `Rezultat așteptat`: upload-ul este respins clar și fișierul nu este stocat.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-004
- `Rol`: Society Admin
- `Pași`:
  1. Încearcă upload de fișier prea mare.
- `Rezultat așteptat`: aplicația blochează upload-ul cu mesaj clar și fără comportament instabil.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-005
- `Rol`: Society Admin sau Tenant
- `Pași`:
  1. Introdu `<script>alert(1)</script>` sau HTML în câmpuri text: anunț, cerere, comentariu, profil.
  2. Salvează și reafișează conținutul.
- `Rezultat așteptat`: scriptul nu rulează; conținutul este escape-uit sau sanitizat.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-006
- `Rol`: Tester tehnic
- `Pași`:
  1. Accesează URL manual de `payment success` sau `payment failed` fără flux real.
  2. Verifică starea plății.
- `Rezultat așteptat`: plata nu este marcată `paid/successful` doar prin accesarea URL-ului.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-007
- `Rol`: Tester tehnic
- `Pași`:
  1. Trimite webhook invalid în sandbox sau fără semnătură validă.
- `Rezultat așteptat`: webhook-ul este respins și nu creează sau modifică plăți valide.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-008
- `Rol`: Tester tehnic
- `Pași`:
  1. Deschide un formular admin.
  2. Încearcă submit fără token valid sau din sesiune expirată.
- `Rezultat așteptat`: requestul este refuzat conform protecției CSRF / auth a stack-ului curent.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-009
- `Rol`: Utilizator neautentificat
- `Pași`:
  1. Accesează URL direct către document privat sau download de fișier.
- `Rezultat așteptat`: fișierul nu este servit fără autentificare și autorizare.
- `Status`: Pass / Fail
- `Observații`:

### QA-SEC-010
- `Rol`: Society Admin A
- `Pași`:
  1. Modifică manual parametri, ID-uri și query string pentru resurse din `Societatea B`.
- `Rezultat așteptat`: aplicația nu returnează date cross-tenant și nu permite update/delete.
- `Status`: Pass / Fail
- `Observații`:

---

## 10. Notificări, emailuri, PDF și branding

### QA-COMMS-001
- `Rol`: Society Admin și Tenant
- `Pași`:
  1. Creează o factură nouă.
  2. Verifică notificarea în aplicație pentru userul țintă.
- `Rezultat așteptat`: notificarea apare o singură dată, cu text coerent și branding Espace.
- `Status`: Pass / Fail
- `Observații`:

### QA-COMMS-002
- `Rol`: Society Admin și Tenant
- `Pași`:
  1. Creează / actualizează / închide o cerere de mentenanță.
  2. Verifică notificările pentru admin și rezident.
- `Rezultat așteptat`: notificările reflectă statusul real și nu conțin texte demo.
- `Status`: Pass / Fail
- `Observații`:

### QA-COMMS-003
- `Rol`: Tester email
- `Pași`:
  1. Verifică emailurile pentru:
     - reset password
     - invitație
     - verificare email
     - factură / reminder, dacă există
  2. Deschide emailurile în inbox.
- `Rezultat așteptat`: expeditorul, reply-to, subiectul și conținutul folosesc Espace.
- `Status`: Pass / Fail
- `Observații`:

### QA-COMMS-004
- `Rol`: Society Admin și Tenant
- `Pași`:
  1. Generează PDF de factură, chitanță sau document.
  2. Deschide documentul.
- `Rezultat așteptat`: documentele afișează doar branding Espace și date reale ale entității curente.
- `Status`: Pass / Fail
- `Observații`:

### QA-BRAND-001
- `Rol`: Orice utilizator
- `Pași`:
  1. Verifică `/ro`, `/ro/login`, `/ro/pricing`, `/ro/contact`, dashboard-urile, emailurile și PDF-urile.
  2. Caută vizual: `SocietyPro`, `Froiden`, `Envato`, `CodeCanyon`, logo vechi, favicon vechi.
- `Rezultat așteptat`: brandingul public este exclusiv Espace.
- `Status`: Pass / Fail
- `Observații`:

### QA-BRAND-002
- `Rol`: Orice utilizator
- `Pași`:
  1. Verifică favicon, title, meta description și manifest/PWA.
- `Rezultat așteptat`: asset-urile și meta tags sunt Espace, fără vechi branding sau copy demo.
- `Status`: Pass / Fail
- `Observații`:

---

## 11. Public site, pricing, checkout și subscriptions

### QA-PUBLIC-001
- `Rol`: Public
- `Pași`:
  1. Deschide landing page-ul `/ro`.
  2. Verifică secțiunile principale și linkurile CTA.
- `Rezultat așteptat`: pagina se încarcă fără erori, are branding Espace și linkuri funcționale.
- `Status`: Pass / Fail
- `Observații`:

### QA-PUBLIC-002
- `Rol`: Public
- `Pași`:
  1. Deschide `/ro/pricing`.
  2. Verifică planurile și CTA-urile.
- `Rezultat așteptat`: pagina de pricing este coerentă și nu trimite spre fluxuri inexistente.
- `Status`: Pass / Fail
- `Observații`:

### QA-PUBLIC-003
- `Rol`: Public
- `Pași`:
  1. Testează `/ro/cere-acces`.
  2. Trimite formularul cu date valide.
- `Rezultat așteptat`: cererea este creată o singură dată și ajunge în CRM-ul superadmin.
- `Status`: Pass / Fail
- `Observații`:

### QA-PUBLIC-004
- `Rol`: Super Admin și Society Admin
- `Pași`:
  1. Verifică `/ro/admin/subscription` și zonele de upgrade, dacă sunt active.
  2. Parcurge un checkout sandbox până la pasul final permis.
- `Rezultat așteptat`: checkout-ul este clar; dacă plata online nu este activă, UI-ul nu pretinde succes real.
- `Status`: Pass / Fail
- `Observații`:

### QA-PUBLIC-005
- `Rol`: Tester tehnic
- `Pași`:
  1. Dacă există gateway-uri online active în staging, parcurge un flux complet sandbox.
  2. Verifică revenirea în aplicație, plata și invoice-ul SaaS.
- `Rezultat așteptat`: providerul cere semnătură validă/webhook valid și nu creează duplicate.
- `Status`: Pass / Fail
- `Observații`:

---

## 12. Criterii de acceptare pentru lansare

Lansarea poate merge mai departe doar dacă:

- toate testele blocante de auth, multi-tenancy și facturare trec
- `Admin A` nu vede nimic din `Societatea B`
- `Tenant A` și `Owner A` nu pot vedea datele altor utilizatori
- plățile offline actualizează corect factura și soldul
- PDF-urile și emailurile au branding Espace
- nu există branding SocietyPro în suprafețe publice
- upload-urile nepermise sunt respinse
- accesul la fișiere private este protejat
- fluxul minim de onboarding real funcționează fără demo data

## 13. Probleme care blochează lansarea

- acces cross-tenant confirmat sau suspect
- plăți marcate ca `successful` fără validare reală
- facturi sau solduri inconsistente între admin și resident
- login / reset / invitații care eșuează end-to-end
- fișiere private accesibile public
- branding public vechi sau copy demo în ecrane critice
- cereri/mentenanță/facturi care apar în societatea greșită

## 14. Probleme care pot fi amânate

- mici probleme de wording în zone necritice, fără impact legal sau de branding
- warning-uri UI fără impact funcțional
- module opționale neactivate, dacă sunt ascunse corect și nu apar în fluxul pilot
- optimizări vizuale minore în ecrane secundare

## 15. Recomandări pentru staging

- testează cu două societăți reale de probă, nu cu o singură organizație
- păstrează conturi separate pentru fiecare rol
- activează email sandbox și logare webhook
- validează pe desktop și mobil
- salvează capturi pentru toate ecranele critice:
  - login
  - dashboard superadmin
  - dashboard admin
  - dashboard tenant
  - factură admin
  - factură tenant
  - payment proof
  - maintenance request
  - branding public
- la finalul testului, notează toate `Fail`-urile cu URL, rol, pași și payload minim de reproducere
