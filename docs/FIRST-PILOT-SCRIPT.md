# First Pilot Script

Script practic pentru primul test pilot Espace cu un administrator real de A.P.C. din Republica Moldova.

Nu include parole, tokenuri, chei API, linkuri private sau date personale reale în acest document.

## 1. Obiectiv Pilot

Scopul primului pilot este să verificăm dacă un administrator real de A.P.C. poate folosi Espace pentru lucrul de bază, cu date reale sau date pilot controlate:

- creează și gestionează apartamente;
- creează și gestionează locatari/proprietari;
- adaugă contoare;
- configurează tarife;
- generează facturi lunare;
- înregistrează plăți manuale;
- publică anunțuri pe avizier;
- gestionează cereri de la locatari;
- oferă locatarilor acces la portalul lor.

Nu promitem în acest pilot:

- plăți online;
- BPay;
- semnătură electronică/MSign;
- integrări automate cu furnizori de utilități;
- contabilitate complet automatizată.

## 2. Conturi Necesare

Pregătește conturile înainte de sesiunea pilot.

### Superadmin

Scop:

- creează A.P.C.;
- creează administratorul A.P.C.;
- verifică starea platformei.

Placeholder:

```text
SUPERADMIN_EMAIL=
```

### Admin

Scop:

- gestionează o singură A.P.C.;
- adaugă blocuri, scări, apartamente, locatari;
- configurează facturi, plăți, contoare, cereri și avizier.

Placeholder:

```text
ADMIN_EMAIL=
```

### Resident

Scop:

- vede apartamentul propriu;
- vede facturi și plăți;
- transmite citiri;
- trimite cereri;
- vede avizierul și documentele publice.

Placeholder:

```text
RESIDENT_EMAIL=
```

## 3. Date Pilot Necesare

### A.P.C.

```text
associationCode: A0123-0940
legalName: Asociația de Proprietari din Condominiu A0123-0940
shortName: A.P.C. A0123-0940
associationNumber: 0940
address:
city: Chișinău
country: Republica Moldova
currency: MDL
```

### Bloc

```text
name:
address:
staircasesCount:
apartmentsCount:
```

### Scări

- Scara 1
- Scara 2
- Scara 3
- Scara 4

### Apartamente Pilot

| Apartament | Scară | Etaj | Suprafață m² | Camere |
| --- | --- | ---: | ---: | ---: |
| 12 | Scara 1 | 3 | 48.2 | 2 |
| 18 | Scara 1 | 5 | 62.0 | 3 |
| 24 | Scara 2 | 2 | 41.5 | 1 |
| 31 | Scara 2 | 4 | 70.3 | 3 |
| 45 | Scara 2 | 6 | 72.4 | 3 |
| 52 | Scara 3 | 1 | 55.0 | 2 |
| 67 | Scara 3 | 7 | 81.6 | 4 |
| 74 | Scara 4 | 2 | 46.8 | 2 |

### Locatari / Proprietari Pilot

| Prenume | Nume | Telefon | Email | Apartament | Rol |
| --- | --- | --- | --- | --- | --- |
| Ion | Popescu | +37360000000 | ion@example.com | 45 | Proprietar |
| Elena | Rusu | +37361111111 | elena@example.com | 12 | Proprietar |
| Mihai | Ceban | +37362222222 | mihai@example.com | 31 | Locatar |
| Ana | Moraru | +37363333333 | ana@example.com | 67 | Proprietar |
| Victor | Lupu | +37364444444 | victor@example.com | 24 | Reprezentant |

### Contoare

- Apă rece pentru fiecare apartament pilot.
- Apă caldă pentru fiecare apartament pilot, dacă blocul are apă caldă contorizată.
- Gaz sau electricitate doar dacă administratorul le gestionează în A.P.C.

### Tarife

- Deservire bloc — `2.85 MDL/m²`
- Fond reparație — `0.50 MDL/m²`
- Fond dezvoltare — `60 MDL per apartament`

## 4. Flow Superadmin

1. Login ca Superadmin.
2. Deschide `/ro/superadmin`.
3. Deschide `Asociații`.
4. Creează A.P.C. nouă folosind formatul `A0123-0940`.
5. Deschide pagina de detalii a A.P.C.
6. Creează administrator pentru acea A.P.C.
7. Deschide `Administratori`.
8. Verifică dacă administratorul apare în listă.
9. Revino la lista de A.P.C.-uri și verifică formatul afișat.

Rezultat așteptat:

- A.P.C. este creată cu succes.
- Administratorul este creat sau invitat cu succes.
- Formatul Moldova A.P.C. este corect:
  - `A.P.C. A0123-0940`
  - `Asociația de Proprietari din Condominiu A0123-0940`
  - `0940`
- Nu apare `passwordHash`.
- Nu apare succes fals dacă API-ul eșuează.
- Nu apar date demo ca flux principal.

Dacă apare eșec:

- notează pasul exact;
- salvează screenshot;
- notează mesajul afișat;
- notează ora aproximativă;
- verifică dacă `/health` și `/health/db` răspund.

## 5. Flow Admin

1. Login ca Admin.
2. Confirmă că Admin vede propria A.P.C.
3. Deschide `/ro/admin`.
4. Verifică dacă dashboard-ul afișează starea reală a A.P.C.
5. Creează bloc.
6. Creează scări.
7. Creează apartamente manual sau prin import CSV.
8. Creează locatari/proprietari.
9. Leagă locatarii la apartamente.
10. Creează contoare.
11. Adaugă citiri de contor.
12. Configurează tarife.
13. Generează facturi lunare.
14. Înregistrează o plată manuală.
15. Publică un anunț pe avizier.
16. Creează sau revizuiește o cerere.
17. Verifică rapoartele disponibile, în special raportul de datorii.

Rezultat așteptat:

- datele create apar după salvare;
- listele se reîncarcă corect;
- mesajele de eroare sunt clare și în română;
- câmpurile obligatorii sunt validate;
- duplicatele sunt tratate prietenos;
- nu apar erori brute de API;
- nu apar termeni PMS/hotel;
- sumele sunt afișate în MDL;
- facturile nu se dublează pentru aceeași lună.

Verificări după pași:

- După bloc: blocul apare în listă.
- După scări: scările apar în listă și pot fi folosite la apartamente.
- După import: sumarul include apartamente create/omise, locatari creați/conectați și erori.
- După locatari: locatarul apare în listă și pe apartament.
- După contoare: contorul apare la apartament.
- După citire: ultima citire se actualizează.
- După tarife: tarifele active apar în lista de tarife.
- După facturi: apar facturi pentru apartamentele active.
- După plată: soldul apartamentului se actualizează.

Dacă apare eșec:

- notează pagina și acțiunea;
- salvează screenshot;
- notează datele introduse;
- verifică dacă eroarea se repetă după refresh;
- nu încerca să ștergi date direct din Supabase.

## 6. Flow Resident

1. Login ca Resident.
2. Confirmă că Resident vede doar apartamentul propriu.
3. Deschide `Facturi`.
4. Deschide `Plăți`.
5. Deschide `Contoare`.
6. Transmite o citire.
7. Deschide `Cereri`.
8. Creează o cerere nouă.
9. Deschide `Avizier`.
10. Deschide `Documente`.
11. Deschide `Cont`.
12. Logout.

Rezultat așteptat:

- portalul este simplu și ușor de înțeles;
- nu apar termeni CRM, follow-up, sarcini sau note interne;
- Resident vede doar datele proprii;
- facturile sunt clare;
- citirea se salvează sau afișează eroare clară;
- cererea se salvează și apare în listă;
- anunțurile active sunt vizibile;
- documentele sunt doar cele publice pentru locatari.

Verificări după pași:

- Facturi: apare luna, suma, statusul, scadența.
- Plăți: apare istoricul plăților dacă există.
- Contoare: apare seria contorului și ultima citire.
- Cereri: apare cererea nouă cu status inițial.
- Avizier: apar anunțuri active.
- Documente: nu apar documente admin-only.

## 7. Întrebări De Feedback

### General

- Înțelegeți rapid ce face aplicația?
- Ce nu este clar din prima?
- Care pagină vi se pare cea mai utilă?
- Ce lipsește pentru utilizare zilnică?
- Ce pas v-a luat cel mai mult timp?

### Apartamente / Locatari

- Este ușor să adăugați apartamente?
- Este ușor să adăugați locatari?
- Importul CSV este clar?
- Ce date mai trebuie la apartament?
- Ce date mai trebuie la locatar/proprietar?
- Cum gestionați în practică proprietarii care nu locuiesc în apartament?

### Financiar

- Tarifele sunt configurate clar?
- Facturile sunt generate corect?
- Datoriile sunt afișate clar?
- Cum doriți să înregistrați plățile în practică?
- Aveți nevoie de câmpuri suplimentare pentru note la plată?
- Raportul de datorii este suficient pentru lucru zilnic?

### Portal Locatar

- Ce ar trebui să vadă locatarul?
- Ce nu ar trebui să vadă locatarul?
- Sunt facturile suficient de clare?
- Instrucțiunile de plată sunt suficient de vizibile?
- Cererile sunt ușor de trimis?

### Cereri / Comunicare

- Categoriile cererilor sunt potrivite?
- Statusurile sunt suficiente?
- Aveți nevoie de mesaje/chat sau doar cereri?
- Ce notificări ar trebui să primească administratorul?
- Ce notificări ar trebui să primească locatarul?

## 8. Limitări Cunoscute

Explică aceste limitări înainte de pilot:

- Plățile online nu sunt implementate încă.
- BPay este amânat.
- Semnătura electronică/MSign nu este implementată încă.
- Integrările automate cu furnizori de utilități nu sunt implementate încă.
- Trimiterea emailurilor funcționează doar dacă providerul email este configurat.
- Dacă backend-ul Render este pe plan gratuit, poate exista cold start.
- Unele rapoarte avansate pot fi limitate.
- PDF-urile sunt în principal pagini print-ready, dacă generarea backend PDF nu este activă.

## 9. Go / No-Go Checklist

### Infrastructură

- [ ] `/health` funcționează.
- [ ] `/health/db` funcționează.
- [ ] Deploy Vercel este verde.
- [ ] Deploy Render este verde.
- [ ] Supabase este accesibil.
- [ ] Nu există secrete în repo.
- [ ] Demo login este dezactivat pentru pilot real, dacă nu este necesar explicit.

### Auth

- [ ] Login Superadmin funcționează.
- [ ] Login Admin funcționează.
- [ ] Login Resident funcționează.
- [ ] Logout funcționează.
- [ ] Refresh după login păstrează sesiunea.
- [ ] Rol greșit redirecționează la dashboard-ul corect.

### Core Flows

- [ ] Creează A.P.C.
- [ ] Creează Admin.
- [ ] Creează bloc.
- [ ] Creează scară.
- [ ] Creează apartament.
- [ ] Importă apartamente din CSV, dacă se testează importul.
- [ ] Creează locatar.
- [ ] Leagă locatar la apartament.
- [ ] Creează contor.
- [ ] Adaugă citire.
- [ ] Creează tarif.
- [ ] Generează factură.
- [ ] Înregistrează plată.
- [ ] Resident vede factura.
- [ ] Resident creează cerere.
- [ ] Admin vede cererea.
- [ ] Admin publică anunț.
- [ ] Resident vede anunțul.

### Siguranță

- [ ] Nu apare `passwordHash` în răspunsuri.
- [ ] Nu apar `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL` sau chei private.
- [ ] Nu apar date demo ca date reale.
- [ ] Nu apare terminologie PMS/hotel.
- [ ] Admin vede doar propria A.P.C.
- [ ] Resident vede doar propriul apartament.
- [ ] Resident nu vede documente admin-only.

## 10. Decizie Pilot

### Go

Pilotul poate începe dacă:

- loginurile funcționează;
- A.P.C. și Admin pot fi create;
- Admin poate crea/importa apartamente și locatari;
- tarifele și facturile funcționează;
- plata manuală actualizează soldul;
- Resident vede datele proprii;
- nu există scurgeri de date între roluri sau A.P.C.-uri.

### No-Go

Amână pilotul dacă:

- loginul e instabil;
- Admin vede date din altă A.P.C.;
- Resident vede datele altui apartament;
- facturile se dublează fără control;
- plățile nu actualizează soldurile;
- importul produce date duplicate fără sumar clar;
- apar secrete sau `passwordHash` în UI/API.

## 11. Ce Se Colectează La Final

- Screenshoturi cu probleme.
- Lista pașilor care au mers fără ajutor.
- Lista pașilor unde administratorul a avut nevoie de explicații.
- Câmpuri lipsă pentru apartamente, locatari, contoare sau facturi.
- Rapoarte necesare pentru lucru real.
- Decizie: continuăm pilotul, repetăm cu ajustări sau amânăm.
