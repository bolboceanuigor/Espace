# Espace First Beta Release Checklist

Release target: first beta test with a real A.P.C. administrator from Republica Moldova.  
Status: beta preparation checklist, not a feature roadmap.

## Release Rules

- Use real API and Supabase-backed data as the primary source.
- Do not seed, reset, truncate, or delete production data during beta preparation.
- Do not run `prisma db push`, migrations, or destructive cleanup without explicit approval.
- Do not commit `.env` files or real secrets.
- Do not expose Supabase service role keys, database URLs, JWT secrets, or email API keys to the frontend.
- Keep hotel/PMS modules hidden from beta navigation and direct users back to APC flows.

## Functional Now

- Real login and role-based redirects.
- Superadmin CRM workbench for A.P.C. associations.
- Superadmin organization creation with Moldova A.P.C. identity fields.
- Superadmin administrator creation/invitation flow.
- Admin workbench for daily A.P.C. operations.
- Admin building and staircase setup.
- Admin apartment management, including bulk/import flows where enabled.
- Admin resident management and apartment-resident links.
- Admin meter management and meter readings.
- Admin tariffs, invoices, payments, and balance visibility.
- Admin requests and announcements.
- Admin document registry metadata/public documents.
- Resident home portal.
- Resident invoices, debt, payment instructions, and payment history.
- Resident meters and reading submission where meters are linked.
- Resident requests.
- Resident announcements.
- Resident public documents and account page.
- Backend health endpoints: `/health` and `/health/db`.

## Partially Functional

- Email invitations: functional only when `EMAIL_PROVIDER`, `RESEND_API_KEY`, and `EMAIL_FROM` are configured in Render. Manual copy-link flow remains the safe fallback.
- Online payments: not connected; any online payment action must stay hidden or disabled with `Plățile online vor fi conectate ulterior.`
- PDF invoices/documents: browser print pages are MVP-ready; backend PDF generation is future work unless explicitly verified.
- Chat/messages: keep hidden or marked `Funcție în lucru` unless verified in the beta environment.
- Notifications: basic activity/notification areas may be partial; do not rely on real-time delivery for beta.
- CSV/XLSX import: CSV is the primary beta path; XLSX should be treated as future/optional unless verified.

## Hidden / Not For Beta

- Old PMS routes.
- Reservations.
- Availability/calendar scheduling.
- Properties as rental units.
- Clients as hotel/rental customers.
- Cleaning/cleanings.
- Guest, booking, check-in, check-out flows.
- Debug pages.
- Demo pages and demo-request flows.
- QA checklist pages.
- Smoke-test pages.
- Roadmap/dev pages.
- Sales pages unless explicitly repurposed for real A.P.C. CRM.

## Known Beta Limitations

- No real payment processor yet.
- No e-signature.
- No automated utility provider integrations.
- Email sending depends on Render env configuration.
- Render free/low-tier services may sleep or cold-start.
- Some direct legacy routes may still exist in the codebase but should not appear in navigation.
- Supabase RLS/API exposure should be audited before wider public rollout.

## First Beta User Flows

For the first real client onboarding runbook, use `docs/FIRST-REAL-CLIENT-CHECKLIST.md`.

### Superadmin

1. Login as Superadmin.
2. Create A.P.C. with `associationCode` in the `A0123-0940` format.
3. Confirm generated values:
   - `legalName`: `Asociația de Proprietari din Condominiu A0123-0940`
   - `shortName`: `A.P.C. A0123-0940`
   - `associationNumber`: `0940`
4. Create or invite the A.P.C. administrator.
5. Confirm the association appears in the CRM list.
6. Open association detail and verify profile, administrator/contact, onboarding, plan/status, and activity sections.
7. Change status only if the backend action is available and verified.

### Administrator

1. Login as Admin.
2. Confirm only the assigned A.P.C. is visible.
3. Add building.
4. Add staircase.
5. Add apartment.
6. Add resident.
7. Link resident to apartment.
8. Add meter.
9. Add meter reading.
10. Add tariff.
11. Generate invoice.
12. Register payment.
13. Publish announcement.
14. Review and update a resident request.

### Resident

1. Login as Resident.
2. Confirm only the linked apartment is visible.
3. See invoices, debt, and payment instructions.
4. See meters.
5. Submit reading if enabled for the linked meter.
6. Create issue/request.
7. See announcements.
8. See public A.P.C. documents.
9. Logout.

## Navigation Gate

Visible navigation for beta must be limited to:

- Superadmin: `Platformă`, `Asociații`, `Administratori`, `Planuri / Abonamente` if usable, `Status sistem` if useful, `Setări` if useful.
- Admin: `Acasă`, `Apartamente`, `Locatari`, `Contoare`, `Facturi`, `Plăți`, `Cereri`, `Avizier`, `Documente`, `Setări`.
- Resident: `Acasă`, `Facturi`, `Contoare`, `Cereri`, `Avizier`, `Documente`, `Cont`.

If an action is not implemented or verified, hide it or disable it with `Funcție în lucru`.

## Copy Gate

Use Moldova/APC terminology:

- `A.P.C.`
- `Asociația de Proprietari din Condominiu`
- `asociație`
- `condominiu`
- `bloc`
- `scară`
- `apartament`
- `proprietar`
- `locatar`
- `administrator`
- `contor`
- `factură`
- `datorie`
- `plată`
- `cerere`
- `avizier`
- `documente`

Do not show user-facing HOA, Romania-specific, PMS, hotel, booking, reservation, guest, check-in/check-out, or rental-property wording in beta flows.

## Empty States

Use real empty states, not fake demo data:

- `Nu există apartamente încă.`
- `Nu există locatari încă.`
- `Nu există contoare încă.`
- `Nu există facturi încă.`
- `Nu există plăți încă.`
- `Nu există cereri încă.`
- `Nu există anunțuri active.`
- `Nu există documente publice încă.`

## Auth And Access Gate

- Logged-out users must redirect to `/ro/login` for protected pages.
- Wrong role must redirect to the correct dashboard or show `Nu ai acces la această zonă.`
- Logout must clear real and temporary auth/demo keys.
- Refresh should keep a valid session.
- Expired/invalid token must redirect to login with `Sesiunea a expirat. Te rugăm să te autentifici din nou.`
- Login validation messages:
  - `Emailul și parola sunt obligatorii.`
  - `Parola nu este corectă.`
  - `Nu există cont cu acest email.`

## API And Security Gate

- `GET /health` returns safe service status.
- `GET /health/db` returns safe database status and counts.
- Frontend uses `NEXT_PUBLIC_API_URL`.
- Frontend does not expose backend secrets.
- Backend responses do not expose `passwordHash`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RESEND_API_KEY`, or raw Prisma stack traces.
- CORS allows `https://espace.md` and `https://www.espace.md`; wildcard CORS is not acceptable in production.

## Mobile Beta Routes

Check these routes on a phone viewport:

- `/ro/login`
- `/ro/superadmin`
- `/ro/admin`
- `/ro/admin/apartments`
- `/ro/admin/residents`
- `/ro/admin/invoices`
- `/ro/resident`
- `/ro/resident/invoices`
- `/ro/resident/meters`
- `/ro/resident/issues`

Reject beta if there is horizontal scrolling, unusable tables, hidden buttons, inaccessible forms, or content covered by bottom navigation.

## Deployment Env Checklist

### Vercel

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL` if browser Supabase client is used
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` if browser Supabase client is used

### Render

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `FRONTEND_URL`
- `API_URL`
- `APP_URL`
- `NODE_ENV`
- `PORT`
- `EMAIL_PROVIDER` optional
- `RESEND_API_KEY` optional
- `EMAIL_FROM` optional

## Required Build Checks

Backend:

```bash
cd backend
npx prisma generate
npx prisma validate
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```
