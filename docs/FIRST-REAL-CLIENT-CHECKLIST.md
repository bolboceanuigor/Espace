# First Real A.P.C. Client Checklist

Use this checklist before entering the first real A.P.C. data in production.

## Safety Rules

- Do not run `prisma migrate reset`.
- Do not run `prisma db push` against production without explicit approval.
- Do not delete Supabase data automatically.
- Do not print or commit real secrets.
- Do not commit `.env`.
- Use real API and Supabase data as the primary source.
- Use demo/fallback data only when the API is unavailable, and show `Date temporare — API indisponibil.`

## 1. Environment Verification

### Vercel

- [ ] `NEXT_PUBLIC_API_URL` points to the production backend.
- [ ] `NEXT_PUBLIC_APP_URL` points to `https://espace.md`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set only if the browser Supabase client is used.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set only if the browser Supabase client is used.
- [ ] No Supabase service role key is exposed in frontend env.

### Render

- [ ] `DATABASE_URL` is set.
- [ ] `DIRECT_URL` is set.
- [ ] `JWT_SECRET` is set and strong.
- [ ] `JWT_EXPIRES_IN` is set.
- [ ] `CORS_ORIGIN` includes `https://espace.md` and `https://www.espace.md`.
- [ ] `FRONTEND_URL` is set to `https://espace.md`.
- [ ] `API_URL` is set to the production backend URL.
- [ ] `APP_URL` is set to `https://espace.md`.
- [ ] `NODE_ENV=production`.
- [ ] `PORT` is set.
- [ ] `EMAIL_PROVIDER`, `RESEND_API_KEY`, and `EMAIL_FROM` are set only if email delivery is configured.

## 2. Health Verification

- [ ] `GET /health` returns `status: ok`.
- [ ] `GET /health/db` returns `database: connected`.
- [ ] Health responses do not expose database URLs, JWT secrets, API keys, or stack traces.

## 3. Production Superadmin

- [ ] Configure `PRODUCTION_SUPERADMIN_EMAIL` in Render only when running the bootstrap helper.
- [ ] Configure `PRODUCTION_SUPERADMIN_PASSWORD` in Render only when running the bootstrap helper.
- [ ] Optional: configure `PRODUCTION_SUPERADMIN_FIRST_NAME`, `PRODUCTION_SUPERADMIN_LAST_NAME`, `PRODUCTION_SUPERADMIN_PHONE`.
- [ ] Optional: configure `PRODUCTION_SUPERADMIN_ORGANIZATION_ID` if the superadmin must be attached to an existing platform organization.
- [ ] Run only when needed:

```bash
cd backend
npm run seed:production-superadmin
```

Expected behavior:

- Creates the SUPERADMIN only if the email does not already exist.
- Does not modify existing users.
- Does not print the password.
- Exits safely if required env vars are missing.

## 4. Demo/Test Data Separation

- [ ] Run the dry-run report only:

```bash
cd backend
npm run db:demo-cleanup
```

- [ ] Confirm any demo/test data is clearly identified.
- [ ] Do not run `--confirm-delete-demo` unless explicitly approved.
- [ ] Confirm real A.P.C. records are not marked as demo/test.
- [ ] Confirm primary beta flows and emergency fallback screens do not show `APC Alba Iulia 75`, `Apt. 45`, or `Popescu Ion`.

## 5. Create First Real A.P.C.

Route: `/ro/superadmin/organizations`

- [ ] Login as Superadmin.
- [ ] Create A.P.C. with a real code, for example `A0123-0940`.
- [ ] Confirm generated values:
  - `legalName`: `Asociația de Proprietari din Condominiu A0123-0940`
  - `shortName`: `A.P.C. A0123-0940`
  - `associationNumber`: `0940`
- [ ] Confirm country is `Republica Moldova`.
- [ ] Confirm currency is `MDL`.
- [ ] Confirm success message: `Asociația a fost creată.`
- [ ] Confirm the A.P.C. appears in the Superadmin CRM list and detail page.

## 6. Create First Real Administrator

Routes:

- `/ro/superadmin/organizations/[id]`
- `/ro/superadmin/admins`

- [ ] Prefer invitation link if available.
- [ ] If temporary password flow is used, share it outside the app securely and rotate later.
- [ ] Create admin with real name, email, and phone.
- [ ] Confirm the admin is linked to the correct A.P.C.
- [ ] Confirm `passwordHash` is never visible in API responses or UI.
- [ ] Login as Admin and confirm redirect to `/ro/admin`.

## 7. Admin First Setup

Routes:

- `/ro/admin`
- `/ro/admin/settings/organization`
- `/ro/admin/buildings`
- `/ro/admin/staircases`
- `/ro/admin/apartments`
- `/ro/admin/residents`
- `/ro/admin/tariffs`

Checklist:

- [ ] Date A.P.C. are complete.
- [ ] Bloc is created.
- [ ] Scări are created.
- [ ] Apartamente are created or imported.
- [ ] Locatari are created.
- [ ] Locatari are linked to apartments.
- [ ] Contoare are created.
- [ ] Tarife are configured.
- [ ] Facturi are generated.

The onboarding checklist must use real API counts. Do not mark steps complete from mock data.

## 8. First Real Data Empty States

Verify empty states before data entry:

- [ ] `Nu există A.P.C.-uri încă. Creează prima asociație.`
- [ ] `Nu există blocuri încă. Adaugă primul bloc.`
- [ ] `Nu există scări încă.`
- [ ] `Nu există apartamente încă. Adaugă primul apartament.`
- [ ] `Nu există locatari încă.`
- [ ] `Nu există tarife încă.`
- [ ] `Nu există facturi încă.`

If the API returns an empty array successfully, the app must show the real empty state, not fallback/demo records.

## 9. Resident Test

- [ ] Create or invite one resident.
- [ ] Link the resident to the correct apartment.
- [ ] Login as Resident.
- [ ] Confirm only the resident's own apartment is visible.
- [ ] Confirm invoices/debt, meters, announcements, public documents, and account page are scoped to the same A.P.C.
- [ ] Submit one issue/request and confirm Admin can see it.

## 10. Final Go/No-Go

- [ ] Backend build passes.
- [ ] Frontend build passes.
- [ ] Health checks pass.
- [ ] Superadmin can create/manage the first A.P.C.
- [ ] Admin can configure the first A.P.C.
- [ ] Resident can use the self-service portal.
- [ ] No primary flow shows demo/test data.
- [ ] No hotel/PMS wording appears in visible beta navigation or first-client flows.
