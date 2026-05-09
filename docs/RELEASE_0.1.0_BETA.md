# Release 0.1.0-beta

Release date: 2026-04-28  
Status: **BETA PREPARATION**

This release is prepared for first real-user beta validation with an A.P.C. administrator from Republica Moldova. Avoid new feature scope until beta feedback is collected and triaged.

## 1) Completed Modules

- Authentication and role-based access (`SUPERADMIN`, `ADMIN`, `RESIDENT`)
- Mobile-first role navigation for Superadmin, Admin, and Resident portals
- Superadmin A.P.C. CRM: associations, administrators, status, plans, platform health
- Admin core operations: blocuri, scări, apartamente, locatari, contoare, tarife, facturi, plăți
- Admin communication: cereri, avizier, public documents
- Resident self-service: home, facturi, sold, contoare, cereri, avizier, documente, cont
- Account flows: language/preferences, logout, change password
- Shared UX states: loading, empty, error + retry in core flows
- Production health checks: `/health` and `/health/db`

## 2) Known Limitations (Beta)

- No real online payment processor yet.
- No e-signature.
- No automated utility provider integrations.
- Email sending works only when provider env vars are configured.
- Browser print pages are the MVP document export path.
- Chat and notifications should remain hidden or marked `Funcție în lucru` unless verified in the beta environment.
- Direct legacy routes may still exist in the codebase but should not appear in beta navigation.

## 3) Beta Credentials

- Do not commit real passwords or temporary passwords.
- Store beta credentials in the team's password manager or secure deployment notes.
- Prefer invitation activation links for new administrators and residents.
- Validate each beta account belongs to the expected A.P.C. before testing.

## 4) Setup Steps

1. Install dependencies in root, `frontend`, and `backend` workspaces.
2. Configure environment variables (`NEXT_PUBLIC_API_URL`, backend DB/auth settings).
3. Do not run migrations, `prisma db push`, reset, or seed commands against production without explicit approval.
4. Start backend service.
5. Start frontend service.
6. Verify login page loads and role redirects work.

## 5) Real Beta Flow

1. Superadmin creates a real A.P.C. with Moldova format.
2. Superadmin creates or invites the administrator.
3. Admin logs in and creates bloc, scară, apartamente, locatari, contoare.
4. Admin configures tariffs, generates invoices, and records a manual payment.
5. Admin publishes an Avizier announcement.
6. Resident logs in and validates apartment, invoices/debt, meters, announcements, documents, and issue creation.

## 6) Final Smoke Test (Release Gate)

- Backend Prisma generate: required before release.
- Backend Prisma validate: required before release.
- Backend build: required before release.
- Frontend build: required before release.
- `/health`: required before release.
- `/health/db`: required before release.
- Login all roles: required before release.
- Real A.P.C. onboarding flow: required before release.
- Resident self-service flow: required before release.
- See `docs/BETA-RELEASE-CHECKLIST.md` for the full gate.

## 7) Critical Warnings

- Do not introduce new features before beta feedback cycle closes.
- Fix only critical production-impacting bugs during beta lock.
- Preserve API/DB compatibility; avoid risky schema changes without migration plan.
- Keep backups before any production data operations/imports.
