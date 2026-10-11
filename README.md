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

## Structură

```
public/index.html          aplicația (manager + menajeră), PWA
public/admin.html          panoul administratorului platformei
functions/api/[[path]].ts  API (Cloudflare Pages Functions)
functions/g/[[path]].ts    ghidul public pentru oaspeți /g/<token>
lib/core.ts                sesiuni, parole, roluri, abonamente
lib/excel.ts, lib/push.ts  export Excel, Web Push
schema.sql                 schema D1 (idempotentă)
```

## Lansare (o singură dată)

1. În GitHub → Settings → Secrets and variables → Actions adaugă următoarele secrete:
   - `CLOUDFLARE_API_TOKEN`: token Cloudflare cu drepturi *Pages: Edit* și *D1: Edit*
   - `CLOUDFLARE_ACCOUNT_ID` (opțional)
   - `SUPERADMIN_EMAIL`: emailul tău; cu el intri în `/admin.html`
   - `CRON_KEY`: un șir lung, aleator, folosit pentru remindere
2. Fă push în `main`. Workflow-ul creează baza `espace` (separată de `rentwill`), aplică schema și publică pe `https://espace.pages.dev`.
3. Înregistrează-te în aplicație cu emailul din `SUPERADMIN_EMAIL`, apoi deschide `/admin.html`.
4. Domeniul `espace.md`: Cloudflare → Pages → espace → Custom domains. Dacă domeniul diferă de `espace.pages.dev`, setează variabila de repo `APP_URL` pentru remindere.

## Dezvoltare locală

```
npm install
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev        # http://localhost:8788
```
