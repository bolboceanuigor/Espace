# Harta aplicației Espace (espace.md)

Ce trebuie să aibă fiecare modul ca aplicația să fie completă și funcțională. Cursor (sau orice agent AI) citește întâi `AGENTS.md` (regulile), apoi lucrează după harta asta, **în ordinea priorităților** de la final.

**Legendă:**
- ✅ există și merge: nu se reface și nu se schimbă fără să întrebi;
- 🟡 există parțial: se completează doar ce lipsește;
- ❌ lipsește: se construiește.

**Fiecare punct ❌ sau 🟡 e gata doar când îndeplinește „Gata când”.**

**Cine folosește aplicația:**
- **Proprietarul platformei**, adică Igor: admin.espace.md.
- **Compania**, cu mai multe roluri:
  - owner (proprietarul companiei);
  - manager;
  - checker (verificare plăți);
  - viewer (doar vizualizare);
  - prop (proprietarul de apartamente);
  - menajere (intră cu PIN);
  - meșteri (lista de reparații).
- **Oaspetele**: pagina publică de rezervare, contractul, ghidul, iar în viitor check-in-ul online și plata.

---

## 0. Platforma (fundația)

| Ce | Stare | Unde |
|---|---|---|
| Multi-companie: fiecare tabel are `org_id`, fiecare interogare filtrează pe compania din sesiune | ✅ | `lib/core.ts`, `functions/api` |
| Subdomeniu pentru fiecare companie (`firma.espace.md`) | ✅ | `lib/host.ts` |
| Roluri (`roleAllows`, `READ_FNS`), sesiune de suport doar pentru citire | ✅ | `lib/core.ts` |
| Limbi: RU (sursa), RO și EN generate | ✅ | `tools/build_i18n.py` |
| Temă deschisă și închisă, PWA, notificări push | ✅ | `app.html` |
| Backup zilnic al bazei de date | ✅ | `.github/workflows/backup.yml` |
| Job la fiecare 5 minute (`/api/cron`) | 🟡 | Worker-ul `workers/cron` e scris, dar trebuie dat dreptul **Workers Scripts: Edit** cheii Cloudflare. Gata când: pagina admin → Sănătate arată „ultima rulare” sub 10 minute. |
| Jurnal de erori pe server | ✅ | Tabel `errors` + `logApiError` pe ≥500; admin → Sănătate arată ultimele 50 / 24 h; buton „Provoacă eroare de test” (`sa_error_probe`). Cron șterge după ~30 zile. |

## 1. Cont, intrare și securitate

| Ce | Stare | Gata când |
|---|---|---|
| Înregistrare pe site, email cu link de parolă, intrare, resetarea parolei | ✅ | |
| Mai multe companii pe același cont, cu comutare între ele | ✅ | |
| **Intrare cu Google** (vezi modulul 15) | ❌ | Butonul „Continuă cu Google” pe pagina de intrare și pe cea de înregistrare. Un cont nou primește compania în probă, la fel ca la înregistrarea cu email. |
| Autentificare în 2 pași (TOTP) pentru owner și manager | ✅ | Se activează din Setări, cu cod QR și 8 coduri de rezervă. La intrare se cere codul de 6 cifre. Adminul o poate reseta din panou. |
| Conturi suspendate de admin (`users.disabled`) | ✅ | |
| Sesiuni active: lista și „ieși de pe toate dispozitivele” | ❌ | În Setări → Securitate: lista de dispozitive (data, browser) și butonul de ieșire de pe toate. |

## 2. Ghidul de pornire (prima intrare)

| Ce | Stare | Gata când |
|---|---|---|
| Asistentul de primă configurare (`wizNeeded`): unități | ✅ | |
| Lista „Primii pași” după asistent | ✅ | Card pe «Сегодня»: 5 bife auto (unități, preț, iCal, echipă, credite); se ascunde cu ✕; dispare când toate sunt bifate. `wizNeeded` neatins. |
| Date demo | ❌ | Butonul „Încarcă exemplu” creează 3 unități și 5 rezervări marcate TEST. Butonul „Șterge exemplul” le scoate pe toate. |

## 3. Unități (apartamente)

| Ce | Stare | Gata când |
|---|---|---|
| Listă, adresă, poze, camere, paturi, capacitate, orele de check-in și check-out, curățenie, garanție | ✅ | |
| Prețuri: preț de bază, pe zi a săptămânii, sezoane, weekend, oaspete în plus, copil, reducere pentru durată, zile blocate înainte și după, preaviz, maxim de nopți, zile permise de sosire | ✅ | `public/price.js` |
| Arhivarea unei unități (ascunsă, istoricul rămâne) | 🟡 | Butonul „Arhivează”: unitatea dispare din calendar și din rapoarte noi, iar rezervările vechi rămân. |
| Etichete și grupuri de unități (zonă, proprietar, tip) | 🟡 | Se filtrează calendarul și rapoartele după grup. |
| Descriere RO/RU/EN + „cum ajungi” + hartă | ❌ | Apar pe pagina publică și în ghidul oaspetelui. Harta e un link Google Maps făcut din adresă (vezi modulul 15). |

## 4. Calendarul

| Ce | Stare | Gata când |
|---|---|---|
| Grilă unități × zile, culori pe canal, rezervare nouă din calendar | ✅ | |
| Modul prețuri: prețul zilei în celulă, editare pe interval, minim de nopți, fără sosire sau plecare, zi închisă | ✅ | `day_rates` |
| Filtrul unităților vizibile | ✅ | |
| Filtrul pe stare: rezervare, cerere, anulată | 🟡 | Butoane rapide deasupra grilei. Anulatele se văd tăiate. |
| Mutarea unei rezervări prin tragere (drag & drop), pe desktop | ❌ | Tragi bara pe altă unitate sau dată, confirmi și se verifică suprapunerea. |
| Ofertă cu link pentru oaspete | ❌ | Selectezi unitățile libere pe niște date și primești un link public cu pozele, prețul calculat și butonul „Rezervă”. |

## 5. Rezervarea

| Ce | Stare | Gata când |
|---|---|---|
| Unitate, date, oaspete, telefon, email, număr de oaspeți, sursă, notă | ✅ | |
| Preț, valută, încasări în MDL/EUR/USD/altă valută, rest de plată, suplimente | ✅ | |
| Copii, limbă, ore proprii, notă pentru echipă, garanție, comision pe canal (`bookings.extra`) | ✅ | |
| Verificarea plăților (checker) și închiderea lunii | ✅ | |
| Contract online cu semnătură | ✅ | |
| **Anulare** (nu ștergere): starea „anulată”, motivul, suma reținută | ✅ | `tag=cancel` + `extra.cx` / `cx_keep`; `kv_cancel`; calendar tăiat; ocupare / iCal / curățenii ignoră anulările. |
| Fișiere pe rezervare (poza actului, chitanțe) | ❌ | Se încarcă prin R2. Dacă R2 nu e configurat, Igor primește instrucțiuni exacte. Maxim 10 fișiere, câte 10 MB. |
| Nota pentru echipă vizibilă menajerei | ❌ | Apare în ecranul menajerei, la curățenia dinainte de sosire. |
| Istoricul modificărilor pe rezervare | 🟡 | `audit` există. Lipsește tabul „Istoric” în fișa rezervării. |

## 6. Oaspeți (contacte, CRM)

| Ce | Stare | Gata când |
|---|---|---|
| Baza de contacte | ❌ | Se adună automat din rezervări (după telefon sau email). Lista are căutare, iar fișa conține numărul de rezervări, totalul plătit, notițe și eticheta VIP / „nu mai primim”. |
| Unirea duplicatelor | ❌ | Se propun duplicatele cu același telefon sau email. Unirea mută rezervările pe un singur contact. |
| Export CSV | ❌ | |
| „Rezervare nouă” din fișa contactului | ❌ | Formularul se deschide cu datele contactului completate. |

## 7. Mesaje către oaspeți

| Ce | Stare | Gata când |
|---|---|---|
| Șabloane automate | ❌ | Declanșator: rezervare nouă / X zile înainte de sosire / ziua sosirii / plecare / după plecare / anulare. Se alege ora, filtrul pe unități și canale, textul în RO, RU și EN (după limba oaspetelui). |
| Etichete în text | ❌ | `{nume} {unitate} {adresa} {sosire} {plecare} {ora_sosire} {nopti} {oaspeti} {total} {rest} {link_ghid} {link_contract} {link_checkin} {link_plata} {cod_usa} {telefon_firma}` |
| Șabloane gata făcute | ❌ | Confirmare, cu o zi înainte (adresa și ora), a doua zi după sosire, informații de plecare, cerere de recenzie. |
| Trimitere pe email (Resend) | ❌ | Pleacă din cron, o singură dată pe mesaj (`key`), apare în istoricul rezervării și în admin → Emailuri. |
| Trimitere manuală dintr-o rezervare | ❌ | Butonul „Trimite mesaj”: alegi șablonul, îl editezi și îl trimiți. |
| WhatsApp / Viber / Telegram | ❌ | Prima variantă: butonul deschide aplicația cu textul completat (link `wa.me`, `viber://`). Variantă automată doar după decizia lui Igor. |

## 8. Check-in online

| Ce | Stare | Gata când |
|---|---|---|
| Linkul de check-in pentru oaspete | ❌ | Câmpuri: nume, data nașterii, cetățenie, tip și număr act, emis de, expiră, adresă, însoțitori, poza actului, semnătură. Fiecare câmp poate fi obligatoriu, opțional sau ascuns, din Setări. |
| Starea în rezervare | ❌ | „Check-in completat” cu datele văzute de manager. Mesajul automat poate trimite linkul. |
| Datele personale | ❌ | Se șterg automat după X luni (setare), ca să respecte legea protecției datelor. |

## 9. Ghidul oaspetelui

| Ce | Stare | Gata când |
|---|---|---|
| Ghid pe unitate (text, poze, video) cu link public | ✅ | |
| Servicii suplimentare plătite (transfer, check-in devreme, pătuț) | ❌ | Lista e definită în Setări și apare în ghid. Comanda ajunge ca notificare la manager. |
| Wi-Fi, cod ușă, reguli, hartă | 🟡 | Secțiuni standard pentru care completezi doar textul. Codul ușii se vede doar în zilele șederii. |

## 10. Curățenii și echipa de teren

| Ce | Stare | Gata când |
|---|---|---|
| Menajere cu PIN, curățenii generate din plecări, poze, gata cu sumă | ✅ | |
| Ture (пересменки), salarii, plăți către menajere | ✅ | |
| Meșteri: lista de reparații, cheltuiala intră automat | ✅ | |
| Lista de verificare (checklist) a curățeniei pe unitate | 🟡 | Bife obligatorii înainte de „Gata”, plus poza finală. |
| Consumabile (stocuri pe unitate) | ❌ | Menajera marchează „se termină”, iar managerul primește lista de cumpărat. |

## 11. Bani: cheltuieli, rapoarte, proprietari

| Ce | Stare | Gata când |
|---|---|---|
| Cheltuieli pe categorii și unități, mai multe valute | ✅ | |
| Raport lunar: venit, cheltuieli, profit, ADR, ocupare | ✅ | |
| Rapoarte pentru proprietari (link public) și plăți către proprietari | ✅ | |
| Export Excel | ✅ | |
| Rapoarte pe canal: venit, nopți, rezervări, anulări, comision | ❌ | Tabel și grafic pe Airbnb, Booking, Direct și altele, pentru orice perioadă. |
| Perioade rapide | ❌ | Luna aceasta, luna viitoare, +3 luni, anul acesta, anul trecut, interval ales. |
| Pick-up și fereastra de rezervare | ❌ | Rezervările noi pe zile și cu câte zile înainte se rezervă. |
| Raport zilnic sau săptămânal pe email pentru owner | ❌ | Opțional din Setări: sosiri, plecări, încasări, ce nu e plătit. |

## 12. Facturi și plăți de la oaspeți

| Ce | Stare | Gata când |
|---|---|---|
| Factură către oaspete pe rezervare | ❌ | În Setări se completează furnizorul, TVA, valuta și limba. Factura are link public și PDF, se atașează la mesaj și are numerotare separată pe fiecare companie. |
| Avans online prin maib pe pagina de rezervare | ❌ | **Întrebi pe Igor înainte de cod.** Banii trebuie să ajungă la companie, nu la platformă, deci fiecare companie are propriul cont maib. |
| Link de plată pentru restul sumei | ❌ | Aceeași condiție ca la avans. |
| Coduri de reducere | ❌ | Procent sau sumă, cu perioadă, număr maxim de folosiri și unități. Se aplică pe pagina publică. |

## 13. Pagina publică de rezervare și site-ul companiei

| Ce | Stare | Gata când |
|---|---|---|
| Pagina de rezervare: căutare, toate regulile de preț, adulți și copii, cerere către companie | ✅ | `book.html` |
| Acceptarea sau refuzul cererii cu email către oaspete | ✅ | |
| Widget pentru site-ul proprietarului (iframe) | ❌ | Calendar de ocupare și buton „Rezervă” pentru o unitate sau pentru toate. Codul se copiază din Setări. |
| Domeniu propriu (`rezervari.firma.md`) | ❌ | **Doar propunere.** Nu se modifică DNS-ul. |

## 14. Canale (Airbnb, Booking)

| Ce | Stare | Gata când |
|---|---|---|
| Import iCal pe unitate și export iCal | ✅ | |
| Starea fiecărui calendar (ultima sincronizare, eroare) | 🟡 | Se vede în aplicația companiei (acum doar în admin), cu butonul „Sincronizează acum”. |
| Conectare directă prin API cu Airbnb sau Booking | ⛔ | Cere certificare de partener. Rămânem pe iCal. |

## 15. Conectarea cu Google

**Secretele `GOOGLE_CLIENT_ID` și `GOOGLE_CLIENT_SECRET` le pune Igor.** Tu îi scrii pas cu pas cum creează clientul OAuth în Google Cloud Console:
- adresele de redirect sunt `https://espace.md/api/google/callback` și `https://admin.espace.md/api/google/callback`;
- ecranul de consimțământ (consent screen) conține linkurile spre `termeni` și `confidentialitate`.

| Ce | Stare | Gata când |
|---|---|---|
| **Intrare cu Google** (OpenID Connect) | ❌ | Butonul pe pagina de intrare și de înregistrare. Dacă emailul Google există deja, intră în acel cont. Dacă nu, se creează contul și compania în probă. Se cere doar `openid email profile`. Fără biblioteci grele: fetch spre endpoint-urile Google, verificarea `id_token` (semnătură, `aud`, `iss`, `exp`) și `state` contra CSRF. |
| Legarea Google de un cont existent | ❌ | Setări → Securitate → „Leagă contul Google”. Coloana `users.google_sub`. |
| Google Calendar: rezervările în calendarul personal | 🟡 | Linkul iCal de export există deja. Lipsesc butonul „Adaugă în Google Calendar” cu instrucțiuni și un link pe fiecare companie cu toate unitățile. |
| Google Maps | ❌ | Linkul „Deschide în Maps” făcut din adresa unității, în ghid, pe pagina publică și în mesaje (`{link_harta}`). Fără cheie API. |
| Google Drive (exportul lunar al rapoartelor) | ⛔ | Mai târziu, doar dacă se cere. |

## 16. Notificări și echipă

| Ce | Stare | Gata când |
|---|---|---|
| Notificări în aplicație, push și Telegram pentru manageri | ✅ | |
| Memento-uri și to-do | ✅ | |
| Echipa: invitație, roluri, scoatere | ✅ | |
| Drepturi pe unități și pe secțiuni pentru fiecare membru | ✅ | Owner-ul bifează ce unități vede omul și ce secțiuni poate deschide (bani, rapoarte, setări). Serverul respectă bifele, nu doar ecranul. |

## 17. Facturarea platformei (credite)

| Ce | Stare | Gata când |
|---|---|---|
| 1 credit = 1 leu pe unitate pe zi, sold, probă, blocare la sold 0 | ✅ | |
| Suplinire cu cardul (maib) și cu factură | ✅ | |
| Avertizare la sold mic, pe email și în aplicație | ✅ | |
| Plata automată lunară cu cardul salvat | ❌ | Opțională, doar dacă maib permite plăți recurente. **Întrebi întâi.** |

## 18. Panoul platformei (admin.espace.md)

| Ce | Stare |
|---|---|
| Prezentare (MRR, conversie, churn), companii, utilizatori, cereri, facturi, plăți, plăți card | ✅ |
| Activitate, emailuri, mesaj către clienți, anunțuri, sănătate, setări | ✅ |
| Pe companie: suport doar pentru citire, corecție de credite, roluri, export JSON, ștergere | ✅ |
| Jurnal de erori (vezi modulul 0) | ✅ |

## 19. Legal și conformitate

| Ce | Stare | Gata când |
|---|---|---|
| Termeni și politică de confidențialitate | ✅ | |
| Banner de cookie-uri pe site | ❌ | Doar dacă se adaugă analytics. Fără analytics nu e nevoie. |
| Exportul și ștergerea datelor unui oaspete la cerere | ❌ | Din fișa contactului (modulul 6). |

---

## Ordinea de lucru (prioritățile)

**A. Înainte de lansare:**
1. Job-ul la 5 minute (modulul 0). Doar Igor dă dreptul cheii Cloudflare, apoi se verifică.
2. Jurnalul de erori (modulul 0).
3. Anularea rezervării (modulul 5).
4. Lista „Primii pași” (modulul 2).
5. Intrarea cu Google (modulul 15).
6. Mesajele automate pe email (modulul 7).

**B. Prima lună după lansare:**
1. Contactele (modulul 6).
2. Check-in-ul online (modulul 8).
3. Rapoartele pe canal și perioadele rapide (modulul 11).
4. Nota pentru echipă la menajeră și fișierele pe rezervare (modulul 5).
5. Starea calendarelor în aplicația companiei (modulul 14).
6. Google Maps și Google Calendar (modulul 15).

**C. După aceea:**
1. Facturile către oaspeți și codurile de reducere (modulul 12).
2. Drepturile pe unități (modulul 16).
3. Autentificarea în 2 pași (modulul 1).
4. Widget-ul (modulul 13) și oferta cu link (modulul 4).
5. Serviciile suplimentare (modulul 9) și consumabilele (modulul 10).
6. Plata online a oaspeților (modulul 12), doar după decizia lui Igor.

**Pentru fiecare punct:**
1. Arăți planul: tabele, endpoint-uri, ecrane.
2. Aștepți „da”.
3. Construiești.
4. Verifici: `tsc`, `build_i18n`, test local pe telefon (390 px) și desktop, fără erori în consolă.
5. Faci commit, push și verifici deploy-ul.
6. Bifezi aici ✅ în rândul respectiv.
7. Trimiți un raport scurt în română.
