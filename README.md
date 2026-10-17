# espace.md

Platformă SaaS pentru administrarea apartamentelor în chirie pe termen scurt (Moldova).
Construită pornind de la aplicația internă Rentwill, ca proiect complet separat: alt repo, altă bază de date, alt proiect Cloudflare.

## Ce face

- **Companii separate:** fiecare companie sau persoană fizică își are contul ei. Datele companiilor sunt izolate în baza de date (`org_id` pe fiecare tabel), deci o companie nu poate vedea și nu poate modifica datele alteia.
- **Module:** calendar de rezervări (MDL/EUR/USD + alte valute), cheltuieli, пересменки (casa pe ture), menajere cu salariu și cicluri, curățenii și sarcini, checklist, ghid pentru oaspeți cu link public, verificarea plăților, închiderea lunii, remindere, to-do, notificări push, export Excel.
- **Roluri în companie:** Владелец (owner) · Менеджер · Проверка оплат · Только просмотр.
- **Menajerele** intră cu *codul companiei* + PIN-ul lor și văd doar curățeniile lor, fără bani.
- **Credite preplătite:** 1 credit = 1 leu; în fiecare zi se scade ~1 credit × numărul de apartamente (`RATE_DEFAULT`, `TOPUPS`, `TRIAL_DAYS` în `lib/core.ts`). 14 zile de probă. Fără credite: datele rămân vizibile (read-only) până la suplimentare.
- **Panou de administrator** pentru proprietarul platformei: `/admin.html`. Companii, lead-uri, facturi, plăți card, sănătate sistem, ajustare credite.

## Adrese

| Adresa | Ce e acolo |
|---|---|
| `espace.md` | site-ul de prezentare: funcții, prețuri, înregistrare, formular „sunați-mă” |
| `admin.espace.md` | panoul proprietarului platformei: companii, plăți, MRR, cereri de pe site |
| `<companie>.espace.md` | aplicația fiecărei companii (ex. `rentwill.espace.md`); managerii intră cu email, menajerele doar cu PIN |

**Domenii live (calea principală):** DNS proxied `espace.md` + `*` → `espace-3hh.pages.dev`, iar workflow-ul `domains.yml` adaugă fiecare `<slug>.espace.md` ca domeniu custom pe proiectul Pages. Middleware-ul citește Host-ul real și alege pagina.

**Router Worker (`router/`):** opțional / backup când cota de domenii Pages e plină sau vrei wildcard fără sync. Deploy-ul încearcă `wrangler deploy --config router/wrangler.toml` (`continue-on-error`). Pe `*.pages.dev` și `localhost` paginile se deschid după cale: `/` (site), `/admin`, `/app?c=<companie>`.

## Structură

```
public/site.html           site-ul de prezentare (RO/RU)
public/app.html            aplicația companiei (manager + menajeră), PWA — sursa, în rusă
public/app-ro.html, app-en.html   aceeași aplicație în română și engleză, GENERATE: python3 tools/build_i18n.py
tools/ro/*.json, tools/en/*.json  traducerile RU→RO și RU→EN (build-ul se oprește dacă lipsește vreuna)
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
4. Domeniul: zona `espace.md` pe Cloudflare; DNS proxied: `espace.md` și `*` CNAME → `espace-3hh.pages.dev`. `domains.yml` înregistrează slug-urile pe Pages. Pentru Worker-ul router (opțional): token cu *Workers Scripts: Edit* + *Workers Routes: Edit*.

## Limba aplicației

Pe `<slug>.espace.md` se deschide româna, rusa sau engleza după cookie-ul `es_lang` (comutatorul RO/RU/EN din aplicație
și de pe site), altfel după limba browserului (implicit română). După orice schimbare în `public/app.html` rulează
`python3 tools/build_i18n.py` (deploy-ul îl rulează oricum) și adaugă textele noi în `tools/ro/` și `tools/en/`.

## Dezvoltare locală

```
npm install
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev        # http://localhost:8788
```
