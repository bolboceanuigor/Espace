# Pilot Data Pack

Pachet practic de date pentru primul test pilot Espace cu o A.P.C. din Republica Moldova.

Acest pachet este pentru testare reală controlată, nu pentru demo public. Nu include parole, secrete, chei API sau date personale reale.

## 1. Date A.P.C.

Exemplu A.P.C. pentru pilot:

```text
associationCode: A0123-0940
legalName: Asociația de Proprietari din Condominiu A0123-0940
shortName: A.P.C. A0123-0940
associationNumber: 0940
address: str. Exemplu 1
city: Chișinău
country: Republica Moldova
currency: MDL
status: ACTIVE
```

Reguli:

- Codul A.P.C. trebuie să fie în format recomandat `A0000-0000`.
- Ultimele 4 cifre sunt folosite ca număr intern al asociației.
- Pentru `A0123-0940`, numărul intern este `0940`.
- Denumirea lungă recomandată este `Asociația de Proprietari din Condominiu A0123-0940`.
- Denumirea scurtă recomandată este `A.P.C. A0123-0940`.

## 2. Bloc Și Scări

Bloc pilot:

```text
Nume: Bloc principal
Adresă: str. Exemplu 1
Scări: 4
Apartamente estimat: 142
```

Scări:

| Scară | Etaje |
| --- | ---: |
| Scara 1 | 9 |
| Scara 2 | 9 |
| Scara 3 | 9 |
| Scara 4 | 9 |

## 3. Fișiere CSV Incluse

Fișierele sunt în UTF-8 și pot fi folosite ca punct de pornire pentru import/test:

- [apartments-residents-sample.csv](samples/apartments-residents-sample.csv)
- [tariffs-sample.csv](samples/tariffs-sample.csv)
- [meters-sample.csv](samples/meters-sample.csv)

Dacă apar probleme la import cu diacritice, notează rândul afectat, sistemul de operare, aplicația cu care a fost salvat CSV-ul și mesajul primit în Espace.

## 4. Apartamente Și Locatari

Fișier:

```text
docs/samples/apartments-residents-sample.csv
```

Coloane:

```text
scara,apartament,etaj,suprafata_m2,camere,proprietar_prenume,proprietar_nume,telefon,email,rol,observatii
```

Ce ar trebui să se întâmple după import:

- 10 apartamente vizibile în lista de apartamente.
- 10 locatari/proprietari vizibili în lista de locatari.
- Fiecare locatar este conectat la apartamentul indicat.
- Rândurile duplicate sunt omise sau raportate clar.
- Erorile pe rând apar în sumar, fără să oprească tot importul.

Roluri acceptate în fișier:

- `OWNER` = Proprietar
- `RESIDENT` = Locatar
- `TENANT` = Chiriaș
- `FAMILY_MEMBER` = Membru familie
- `REPRESENTATIVE` = Reprezentant

## 5. Tarife

Fișier:

```text
docs/samples/tariffs-sample.csv
```

Coloane:

```text
nume,tip_calcul,suma,moneda,activ
```

Tarife incluse:

- Deservire bloc — `PER_M2` — `2.85 MDL`
- Fond reparație — `PER_M2` — `0.50 MDL`
- Fond dezvoltare — `FIXED_PER_APARTMENT` — `60 MDL`

Exemplu calcul pentru apartament de `72.4 m²`:

- Deservire bloc: `72.4 * 2.85 = 206.34 MDL`
- Fond reparație: `72.4 * 0.50 = 36.20 MDL`
- Fond dezvoltare: `60.00 MDL`
- Total: `302.54 MDL`

După configurarea tarifelor:

- 3 tarife active trebuie să fie vizibile.
- Moneda trebuie să fie `MDL`.
- Tipurile de calcul trebuie să fie clare pentru administrator.

## 6. Contoare

Fișier:

```text
docs/samples/meters-sample.csv
```

Coloane:

```text
apartament,scara,tip_contor,serie_contor,citire_initiala,data_citirii
```

Tipuri de contoare:

| Cod | Etichetă |
| --- | --- |
| COLD_WATER | Apă rece |
| HOT_WATER | Apă caldă |
| GAS | Gaz |
| ELECTRICITY | Electricitate |
| HEATING | Încălzire |

După adăugarea/importul contoarelor:

- contoarele apar pe apartamentele corecte;
- seriile sunt unice;
- citirea inițială apare ca ultimă citire;
- data citirii este `2026-05-01`.

## 7. Scenariu Facturare

Lună pilot:

```text
month: 5
year: 2026
dueDate: 2026-05-25
```

Pași:

1. Confirmă că există apartamente importate.
2. Confirmă că există tarife active.
3. Deschide `/ro/admin/invoices`.
4. Selectează luna `Mai`, anul `2026`, scadența `2026-05-25`.
5. Generează facturile.
6. Verifică dacă facturile au fost create pentru apartamentele importate.
7. Rulează din nou generarea pentru aceeași lună și confirmă că duplicatele sunt omise.

Rezultat așteptat:

- facturi generate pentru apartamentele importate;
- facturile duplicate sunt omise;
- totalul pentru apartamentul de `72.4 m²` este aproximativ `302.54 MDL`;
- facturile sunt vizibile în Admin;
- facturile sunt vizibile pentru Resident dacă locatarul are cont conectat.

## 8. Scenariu Plată Manuală

Exemplu:

```text
apartament: 45
sumă: 150 MDL
metodă: CASH
paidAt: 2026-05-06
```

Pași:

1. Deschide `/ro/admin/payments`.
2. Selectează apartamentul `45`.
3. Selectează factura lunii Mai 2026, dacă lista o oferă.
4. Introdu suma `150`.
5. Alege metoda `Numerar`.
6. Salvează plata.
7. Verifică soldul apartamentului.
8. Verifică vizibilitatea în portalul locatarului.

Rezultat așteptat:

- plata apare în Admin → Plăți;
- datoria apartamentului scade;
- Resident vede plata/istoricul, dacă are cont conectat;
- factura rămâne neachitată dacă plata este parțială și statusul parțial nu este suportat.

## 9. Scenariu Cont Resident

Resident pilot recomandat:

```text
apartament: 45
email: elena.rotaru@example.com
rol: Proprietar
```

Pași:

1. Creează sau invită contul pentru locatarul apartamentului `45`.
2. Activează contul sau setează parola conform fluxului disponibil.
3. Login ca Resident.
4. Verifică pagina Acasă.
5. Verifică Facturi.
6. Verifică Contoare.
7. Transmite o citire nouă.
8. Creează o cerere.
9. Verifică Avizier.
10. Verifică Documente.

Rezultat așteptat:

- Resident vede doar apartamentul `45`.
- Resident vede factura lunii Mai 2026.
- Resident vede contoarele apartamentului `45`.
- Resident nu vede documente admin-only.
- Resident nu vede note interne, sarcini sau follow-up.

## 10. Pași Execuție Pilot

1. Login ca Superadmin.
2. Creează A.P.C. folosind datele pilot A.P.C.
3. Creează Admin pentru A.P.C.
4. Login ca Admin.
5. Creează blocul `Bloc principal`.
6. Creează scările `Scara 1` - `Scara 4`.
7. Importă `apartments-residents-sample.csv`.
8. Verifică lista de apartamente.
9. Verifică lista de locatari.
10. Adaugă sau importă contoarele din `meters-sample.csv`.
11. Creează tarifele din `tariffs-sample.csv`.
12. Generează facturi pentru Mai 2026.
13. Înregistrează o plată pentru apartamentul `45`.
14. Creează sau invită contul Resident pentru apartamentul `45`.
15. Login ca Resident.
16. Verifică facturi, contoare, cereri, avizier și documente.

## 11. Rezultate Așteptate

După import apartamente:

- 10 apartamente vizibile;
- 10 locatari vizibili;
- locatarii sunt conectați la apartamente.

După tarife:

- 3 tarife active vizibile;
- toate sumele sunt în MDL.

După generare facturi:

- facturi generate pentru apartamentele importate;
- duplicatele pentru aceeași lună sunt omise;
- totalurile respectă calculul pe m² și suma fixă.

După plată:

- plata apare în lista Admin;
- soldul apartamentului este redus;
- Resident vede plata/factura, dacă are cont conectat.

După login Resident:

- Resident vede doar apartamentul propriu;
- facturile, contoarele și cererile sunt scoped corect;
- nu apar elemente CRM/admin.

## 12. Întrebări Feedback

### Pentru Administrator

- Cât de clar este procesul de adăugare A.P.C.?
- Cât de ușor este importul apartamentelor?
- Ce câmpuri lipsesc la apartamente?
- Ce câmpuri lipsesc la locatari?
- Calculul facturilor este clar?
- Datoriile sunt afișate clar?
- Ce raport v-ar trebui primul?
- Ce ar trebui să vadă locatarul?
- Ce nu ar trebui să vadă locatarul?
- Ce parte ar bloca folosirea zilnică?

### Pentru Resident

- Înțelegeți ce aveți de achitat?
- Găsiți ușor facturile?
- Găsiți ușor contoarele?
- Este ușor să transmiteți o citire?
- Este ușor să trimiteți o cerere?
- Ce lipsește în aplicația locatarului?

## 13. No Secrets

Nu include în acest pachet:

- parole reale;
- `JWT_SECRET`;
- `DATABASE_URL`;
- `DIRECT_URL`;
- parola Supabase;
- Supabase service role key;
- Resend key;
- BPay credentials;
- date personale reale fără acord.

Folosește doar date pilot sau placeholders.

## 14. Note Pentru Facilitator

- Confirmă înainte de test că `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` pentru pilot real.
- Nu șterge date din Supabase în timpul pilotului.
- Nu rula migrații sau resetări.
- Dacă importul eșuează, păstrează fișierul CSV și mesajul de eroare.
- Dacă o pagină pare goală, testează refresh și notează URL-ul exact.
- Dacă backend-ul doarme, așteaptă câteva secunde și reîncarcă după verificarea `/health`.

