# Beta Launch Guide

This guide describes the final steps to onboard the first real client organizations safely.

## Warning

**Beta version — verify data before official use.**

## 1) Create first real organization

1. Login as `SUPER_ADMIN`.
2. Go to `superadmin/organizations`.
3. Create a new organization with real data.
4. Ensure `isDemo` is disabled for real customers.

## 2) Invite organization admin

1. Open organization details.
2. Create/invite an `ADMIN` user.
3. Validate admin login and role redirect.

## 3) Import buildings/apartments

1. Login as `ADMIN`.
2. Complete onboarding steps.
3. Go to `admin/imports` and upload apartments file.
4. Validate preview, mapping, and confirmation.

## 4) Configure tariffs

1. Open billing/settings related admin flow used for monthly charges.
2. Add/update tariff values.
3. Validate expected charge values on a sample apartment.

## 5) Generate first invoices

1. Use monthly generation from `admin/invoices`.
2. Verify draft/issued statuses.
3. Check totals on random sample apartments.

## 6) Invite residents

1. Use admin invite or resident creation flow.
2. Validate resident can login and only sees own apartment scope.

## 7) Collect feedback

1. Ask admins/residents to report issues via built-in feedback/issues/chat.
2. Track errors from superadmin monitoring pages.
3. Update roadmap/release notes for known beta fixes.

## 8) Demo vs Real Organization Separation

- Demo organizations must stay flagged with `isDemo=true`.
- Real client organizations must use `isDemo=false`.
- Demo reset operations apply only to demo organizations.
- Always verify current org context before admin/superadmin destructive actions.

## Known Limitations (Beta)

- Some admin flows are grouped under existing modules instead of dedicated pages (example: tariffs/balances).
- Some UI screens still have non-blocking hook dependency lint warnings.
- Push notifications are infrastructure-ready but still placeholder-level for full production delivery.

## Recommended Pre-Go-Live Steps

1. Complete `/superadmin/beta-readiness`.
2. Ensure all critical checks are `PASSED`.
3. Set launch status to `READY_FOR_BETA`.
4. Perform backup and health verification before onboarding clients.
