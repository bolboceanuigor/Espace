# Beta Launch Guide

This guide describes the final steps to onboard the first real A.P.C. from Republica Moldova safely.

## Warning

**Beta version: verify real A.P.C. data before official use.**

## 1) Create first real organization

1. Login as `SUPERADMIN`.
2. Go to `/ro/superadmin/organizations`.
3. Create a new A.P.C. with real Moldova data.
4. Use the standard code format, for example `A0123-0940`.
5. Ensure demo/test labels are not used for real A.P.C. records.

## 2) Invite organization admin

1. Open A.P.C. details.
2. Create or invite an `ADMIN` user.
3. Validate admin login and redirect to `/ro/admin`.

## 3) Import buildings/apartments

1. Login as `ADMIN`.
2. Complete building and staircase setup.
3. Go to `/ro/admin/imports/apartments` or `/ro/admin/apartments/bulk-create`.
4. Validate created apartments, residents, and apartment-resident links.

## 4) Configure tariffs

1. Open `/ro/admin/tariffs`.
2. Add/update tariffs in MDL.
3. Validate expected invoice values on a sample apartment.

## 5) Generate first invoices

1. Use monthly generation from `/ro/admin/invoices`.
2. Verify duplicate generation does not duplicate invoices.
3. Check totals on sample apartments.

## 6) Invite residents

1. Use resident creation/invitation flow.
2. Validate the resident can login and only sees their own apartment data.

## 7) Collect feedback

1. Ask the administrator and residents to report problems through `Cereri` or direct support.
2. Track backend health and errors from Superadmin system status where available.
3. Record known beta fixes in the issue tracker or release notes.

## 8) Demo/Test vs Real A.P.C. Separation

- Demo/test organizations must stay clearly marked as non-production.
- Real A.P.C. records must not use demo labels or sample addresses.
- Cleanup operations must never delete real A.P.C. data automatically.
- Always verify the current A.P.C. context before imports, billing generation, or cleanup actions.

## Known Limitations (Beta)

- No real online payment processor yet.
- Email invitations require provider env configuration; otherwise links are copied manually.
- Browser print pages are the MVP document export path.
- Render may cold-start depending on the service plan.
- See `docs/BETA-RELEASE-CHECKLIST.md` for the full beta gate.

## Recommended Pre-Go-Live Steps

1. Complete `docs/BETA-RELEASE-CHECKLIST.md`.
2. Run backend and frontend build checks.
3. Verify `/health` and `/health/db`.
4. Perform backup and health verification before onboarding the first real A.P.C.
