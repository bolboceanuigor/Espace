# espace.md

Platformă SaaS pentru administrarea apartamentelor în chirie pe termen scurt (Moldova).
Construită pornind de la aplicația internă Rentwill, ca proiect complet separat: alt repo, altă bază de date, alt proiect Cloudflare.

## Ce face

- **Companii separate:** fiecare companie sau persoană fizică își are contul ei. Datele companiilor sunt izolate în baza de date (`org_id` pe fiecare tabel), deci o companie nu poate vedea și nu poate modifica datele alteia.
- **Module:** calendar de rezervări (MDL/EUR/USD + alte valute), cheltuieli, пересменки (casa pe ture), menajere cu salariu și cicluri, curățenii și sarcini, checklist, ghid pentru oaspeți cu link public, verificarea plăților, închiderea lunii, remindere, to-do, notificări push, export Excel.
- **Roluri în companie:** Владелец (owner) · Менеджер · Проверка оплат · Только просмотр.
- **Menajerele** intră cu *codul companiei* + PIN-ul lor și văd doar curățeniile lor, fără bani.
- **Abonament lunar** în trepte după numărul de apartamente, cu 14 zile de probă gratuită. Când abonamentul expiră, datele rămân vizibile, dar nu se mai poate modifica nimic.
- **Panou de administrator** pentru proprietarul platformei: `/admin.html`. Arată toate companiile, MRR-ul și treptele de preț, și permite înregistrarea plăților, setarea perioadei de probă, blocarea și notele interne.

| Apartamente | Lei / lună |
|---|---|
| 1–4 | 199 |
| 5–7 | 299 |
| 8–11 | 399 |
| 12–15 | 499 |
| 16–20 | 599 |
| 21–30 | 799 |
| 31–70 | 1.199 |
| 71+ | individual |

Treptele de preț sunt definite în `lib/core.ts` (`TIERS`).

## Adrese

| Adresa | Ce e acolo |
|---|---|
| `espace.md` | site-ul de prezentare: funcții, prețuri, înregistrare, formular „sunați-mă” |
| `admin.espace.md` | panoul proprietarului platformei: companii, plăți, MRR, cereri de pe site |
| `<companie>.espace.md` | aplicația fiecărei companii (ex. `rentwill.espace.md`); managerii intră cu email, menajerele doar cu PIN |

Cloudflare Pages nu acceptă domenii wildcard, așa că `router/` e un Worker mic pus pe rutele `espace.md/*` și `*.espace.md/*`. El trimite cererea la Pages cu host-ul real în `x-espace-host`, iar `functions/_middleware.ts` alege pagina. Pe `*.pages.dev` și `localhost` toate paginile se deschid după cale: `/` (site), `/admin`, `/app?c=<companie>`.

## Structură

```
public/site.html           site-ul de prezentare (RO/RU)
public/app.html            aplicația companiei (manager + menajeră), PWA — sursa, în rusă
public/app-ro.html         aceeași aplicație în română, GENERATĂ: python3 tools/build_ro.py
tools/ro/*.json            traducerile RU→RO (build-ul se oprește dacă lipsește vreuna)
public/termeni.html, confidentialitate.html   texte juridice RO+RU (de verificat cu un jurist)
lib/mail.ts                emailuri prin Resend (fără RESEND_API_KEY doar se înregistrează în jurnal)
public/admin.html          panoul administratorului platformei
functions/_middleware.ts   ce pagină primește fiecare adresă
functions/api/[[path]].ts  API (Cloudflare Pages Functions)
functions/g/[[path]].ts    ghidul public pentru oaspeți /g/<token>
lib/core.ts, lib/host.ts   sesiuni, roluri, abonamente; adrese și subdomenii
router/                    Worker pentru espace.md și *.espace.md
schema.sql                 schema D1 (idempotentă)
```

## Lansare (o singură dată)

1. În GitHub → Settings → Secrets and variables → Actions adaugă următoarele secrete:
   - `CLOUDFLARE_API_TOKEN`: token Cloudflare cu drepturi *Pages: Edit* și *D1: Edit*
   - `CLOUDFLARE_ACCOUNT_ID` (opțional)
   - `SUPERADMIN_EMAIL`: emailul tău; cu el intri în `/admin.html`
   - `CRON_KEY`: un șir lung, aleator, folosit pentru remindere
2. Fă push în `main`. Workflow-ul creează baza `espace` (separată de `rentwill`), aplică schema și publică pe `https://espace-3hh.pages.dev`.
3. Înregistrează-te în aplicație cu emailul din `SUPERADMIN_EMAIL`, apoi deschide `/admin.html`.
4. Domeniul: zona `espace.md` trebuie să fie în Cloudflare (nameservere Cloudflare). În DNS adaugi două înregistrări proxied (portocaliu): `espace.md` și `*`, ambele CNAME → `espace-3hh.pages.dev`. Tokenul are nevoie în plus de *Workers Scripts: Edit* și *Workers Routes: Edit* (zona espace.md), iar următorul deploy publică routerul.

## Limba aplicației

Pe `<slug>.espace.md` se deschide româna sau rusa după cookie-ul `es_lang` (comutatorul RO/RU din aplicație
și de pe site), altfel după limba browserului. După orice schimbare în `public/app.html` rulează
`python3 tools/build_ro.py` (deploy-ul îl rulează oricum) și adaugă textele noi în `tools/ro/`.

## Dezvoltare locală

```
npm install
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev        # http://localhost:8788
```
