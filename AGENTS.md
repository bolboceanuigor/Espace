# AGENTS.md — instrucțiuni pentru agenții AI (Cursor, Claude) care lucrează la Espace

Lucrezi la **espace.md**, un SaaS pentru administrarea apartamentelor în chirie pe termen scurt, în Moldova. Repo: `bolboceanuigor/Espace`. Citește tot textul înainte să modifici ceva. **Harta completă a modulelor, ce mai lipsește și ordinea de lucru: `docs/HARTA.md`** (ea are prioritate față de etapele de mai jos). Lucrează **o etapă odată**, iar după fiecare etapă oprește-te și raportează-mi.

## 1. Cum e făcută aplicația

- **Platforma:** Cloudflare Pages + Pages Functions + D1 (SQLite). Fără framework, doar JS simplu (vanilla).
- **Fișierele principale:**
  - `public/app.html` este aplicația companiei, un singur fișier cu HTML, CSS și JS. Textele sursă sunt în **rusă**.
  - `public/admin.html` este panoul meu de administrator al platformei (admin.espace.md), în română.
  - `public/book.html` este pagina publică de rezervare pentru oaspeți (RO/RU/EN).
  - `public/site.html` este site-ul de prezentare.
  - `public/price.js` este **motorul unic de prețuri**, folosit de app.html, book.html și server. Orice regulă de preț se schimbă doar aici.
  - `functions/api/[[path]].ts` este API-ul: `POST /api/<fn>` cu JSON.
  - `lib/core.ts` conține sesiuni, roluri (`roleAllows`, `READ_FNS`), facturarea în credite și `dayRules`.
  - `lib/admin.ts` are endpoint-urile `sa_*` ale panoului de admin. `lib/mail.ts` are emailurile (Resend). `lib/maib.ts` are plățile cu cardul.
  - `functions/ical/[[path]].ts` exportă calendarul iCal.
  - `schema.sql` creează tabelele cu `CREATE TABLE IF NOT EXISTS`. `migrations.sql` are câte un `ALTER` pe linie; la deploy erorile se ignoră, deci fiecare linie trebuie să poată rula de mai multe ori fără să strice ceva.
- **Traduceri:** `tools/build_i18n.py` generează `app-ro.html` și `app-en.html` din `app.html`, cu `tools/ro/*.json` și `tools/en/*.json` (cheia e textul rusesc, valoarea e traducerea).
  - Fiecare text rusesc nou din `app.html` are nevoie de traducere în **ambele** fișiere `p10.json`, altfel build-ul pică.
  - Traducerile nu au voie să conțină ghilimele sau apostrofuri.
  - Textul trebuie să fie identic cu cel din app.html.
  - Nu pune domeniul `espace.md` în mijlocul unui text de tradus.
- **Deploy:** push pe `main` pornește GitHub Actions (`deploy.yml`):
  1. `tsc --noEmit`;
  2. build i18n;
  3. `schema.sql` + `migrations.sql` pe D1;
  4. `wrangler pages deploy`.
  - Verifică rezultatul cu `gh run list -R bolboceanuigor/Espace -L 1`.
- **Local:** rulează `npx wrangler pages dev public --port 8788`. Pentru variabile folosește `.dev.vars`, cu `SUPERADMIN_EMAIL` și valori MAIB de test. **Nu-l pune niciodată în git.**
- **Git:** nu urca `tools/__pycache__`. Rulează `git checkout -- tools/__pycache__` înainte de commit.

## 2. Reguli stricte

0. **Orice tabel nou intră în `schema.sql`** (iar o coloană nouă, în `migrations.sql`). La unirea ramurilor verifică să nu se piardă. Deploy-ul rulează `tools/check_schema.py` și se oprește dacă codul folosește un tabel care nu există. Lucrează pe o singură ramură odată, nu pe 20 în paralel.

1. **Ce e deja făcut nu se modifică.** Dacă vezi o problemă într-o funcție existentă, nu o rescrie: scrie-mi întâi ce ai găsit. Excepție: un bug evident, reparat minim, pe care mi-l raportezi.
2. Nu schimba designul existent decât dacă ți-l cer.
3. **Fiecare tabel are `org_id`.** Fiecare interogare filtrează pe compania din sesiune, iar o companie nu vede niciodată datele alteia. Respectă rolurile din `roleAllows`: owner, manager, checker, viewer, prop. Sesiunea de suport e doar de citire.
4. **Fără date reale în repo.** Fără oaspeți reali, fără date din Rentwill, fără parole sau chei. Datele de test se marchează cu „TEST” și se șterg după test.
5. **Secretele** (MAIB_*, RESEND_API_KEY, CRON_KEY, TELEGRAM_BOT_TOKEN) le pun doar eu în GitHub sau Cloudflare. Nu le cere în chat și nu le scrie în cod.
6. **Nu modifica** DNS-ul, domeniile sau certificatele Cloudflare. Nu atinge aplicația și repo-ul Rentwill.
7. Nu copia cod din șabloane cu licență GPL. Pentru aspect inspiră-te, dar scrie codul de la zero.
8. **Fiecare etapă se încheie cu:**
   - `npx tsc --noEmit` fără erori;
   - `python3 tools/build_i18n.py` fără texte netraduse;
   - test local în browser: telefon 390px și desktop, fără scroll orizontal și fără erori în consolă;
   - commit cu mesaj clar, push și deploy verificat.
9. Răspunsurile către mine sunt **în română, scurte, cu cifre concrete**: ce ai făcut, ce ai testat, ce a rămas.

## 3. Ce există deja (nu reface)

- **Calendar:** unități × zile, rezervări colorate pe canal, aspect „Operațiuni contemporane” (tema deschisă, fontul Inter). Are mod de prețuri, cu prețul zilei în celulă și editare pe interval.
- **Prețuri pe zi:**
  - tabelul `day_rates` (preț, minim de nopți, închis la sosire, închis la plecare, zi închisă), cu endpoint-urile `rates_get` și `rates_set`;
  - pe unitate: preț pe zi a săptămânii, oaspete în plus de la al N-lea, copil, reducere pentru durată, zile blocate înainte/după, preaviz minim, maxim de nopți, zile permise de sosire.
- **Pagina publică de rezervare:** adulți + copii, preț defalcat, verificarea tuturor regulilor.
- **Facturarea platformei în credite:** 1 credit = 1 leu pe unitate pe zi. Suplinire cu cardul prin maib, facturi de suplinire.
- Contracte online, ghiduri pentru oaspeți, sincronizare iCal Airbnb/Booking, menajere cu PIN, curățenii, cheltuieli, rapoarte lunare și pentru proprietari, notificări Telegram.
- **Panoul de admin al platformei:**
  - companii, utilizatori, cereri, facturi, plăți, plăți card, activitate, emailuri;
  - mesaj către clienți, anunțuri, sănătate, setări;
  - corecție de credite, roluri, export JSON și ștergerea unei companii.

## 4. Ce trebuie făcut, în ordine

### Etapa 1: Rezervarea completă — FĂCUTĂ (17.10.2026)
Deja există: plăți în mai multe valute și rest de plată (payState, suplimente ca rânduri cu 0 nopți), preț propus după tarif (uQuote).
Adăugat: coloana `bookings.extra` (JSON: kids, lang, tin, tout, team, dep, dep_cur, dep_st, dep_kept, dep_note, com_pct, com), secțiunea „Подробнее” din formular, `cfg.com[sursă]` = % comision memorat pe canal.
Completat: fișiere pe rezervare (`booking_files` + `bk_file_*`, binding R2 opțional `FILES`), nota pentru echipă (`extra.team`) vizibilă menajerelor în `cl_load` / ecranul PIN.

### (plan inițial al Etapei 1)
- Pe rezervare:
  - adulți și copii separat, plus limba oaspetelui;
  - ora sosirii și ora plecării;
  - **notă pentru echipă**, văzută de menajeră și asistent, separată de nota internă.
- **Calculul prețului** cu `EsPrice.quote`: bază + oaspeți în plus + copii − reducerea pentru durată + curățenie − reducere manuală = total. Apoi avans și rest de plată.
- **Plăți pe rezervare:** listă de plăți și restituiri (suma, data, metoda), cu „rest de plată” calculat.
- **Garanție:** încasată / returnată / reținută (cu sumă și motiv).
- **Comision automat pe sursă:** % setat pe canal în setări (Airbnb, Booking…), aplicat la rezervările noi.
- **Fișiere pe rezervare**, de exemplu poza actului. Folosește R2 dacă e configurat; dacă nu, spune-mi ce trebuie configurat.

### Etapa 2: Mesaje automate către oaspeți
- **Șabloane** cu:
  - declanșator: rezervare nouă / sosire / plecare / anulare;
  - momentul: de la X zile înainte până la Y zile după, la ora aleasă;
  - filtru pe unități și pe canale;
  - text în RO, RU și EN.
- **Etichete în text:** `{nume}`, `{unitate}`, `{sosire}`, `{plecare}`, `{nopti}`, `{oaspeti}`, `{total}`, `{avans}`, `{rest}`, `{link_ghid}`, `{link_checkin}`, `{link_plata}`, `{cod_usa}`, `{nota_echipa}`.
- **Șabloane gata făcute:** confirmare, cu o zi înainte, a doua zi după sosire, informații de plecare, cerere de recenzie.
- **Trimitere:** pe email prin Resend, prin cron-ul existent. Fiecare mesaj pleacă o singură dată (folosește `key` în `sendMail`).
- **Istoric** al mesajelor trimise pe fiecare rezervare.

### Etapa 3: Check-in online + baza de contacte
- **Link de check-in pentru oaspete:**
  - câmpuri: nume, data nașterii, cetățenie, tip și număr act, emis de, expiră, adresă, însoțitori, poză act, semnătură;
  - fiecare câmp poate fi obligatoriu / opțional / ascuns, din setări.
- **Contacte (CRM):**
  - toți oaspeții, cu nr. de rezervări, telefon, email și notițe;
  - căutare, export CSV, **unirea duplicatelor**;
  - „rezervare nouă” direct din fișa contactului.

### Etapa 4: Bani de la oaspeți
- **Facturi către oaspeți** pe rezervare:
  - setări: furnizor, TVA, monedă, limbă;
  - link public și PDF, la fel ca facturile platformei.
- **Avans online prin maib** pe pagina de rezervare: suma sau % din setări. Folosește `lib/maib.ts`, dar banii trebuie să ajungă la compania respectivă, nu la platformă. **Întreabă-mă cum facem asta înainte să scrii codul.**
- **Coduri de reducere:** % sau sumă, cu perioadă și număr maxim de utilizări.
- **Servicii suplimentare** la rezervare și în ghid: transfer, check-in devreme, pătuț etc.

### Etapa 5: Rapoarte
- Venit, nopți, rezervări și anulări **pe canal**.
- Perioade rapide: luna aceasta, luna viitoare, +3 luni, anul acesta, anul trecut.
- Pick-up (rezervări noi pe zile), fereastra de rezervare.
- Raport zilnic pe email, opțional.

### Etapa 6: Echipă și siguranță
- **Drepturi pe angajat:** ce unități vede și ce secțiuni poate deschide.
- **Autentificare în 2 pași** (TOTP) pentru owner și manager.
- Istoricul modificărilor pe rezervare, arhivarea unităților, etichete și grupuri de unități.

### Etapa 7: Pentru site-ul proprietarului
- Widget / iframe: calendarul de ocupare și butonul de rezervare.
- **Ofertă cu link:** selectezi unități libere pe niște date, iar oaspetele primește un link cu prețurile.
- Încuietori inteligente (TTLock / Nuki): **doar propunere scrisă**, fără cod, până nu decid eu.

## 5. Primul pas acum

Fără să modifici nimic, citește `public/app.html` (rezervarea, calendarul), `public/price.js`, `functions/api/[[path]].ts`, `lib/core.ts` și `schema.sql`. Apoi scrie-mi pe scurt, în română:
1. cum e stocată acum o rezervare (tabelul `bookings` și câmpurile);
2. ce exact vei adăuga în Etapa 1: coloane noi, endpoint-uri noi, ce ecrane se schimbă;
3. ce riscuri vezi pentru datele existente.

Începi codul doar după ce îți spun „da”.
