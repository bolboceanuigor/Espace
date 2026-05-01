# Release 0.1.0-beta

Release date: 2026-04-28  
Status: **BETA LOCKED**

This release is frozen for beta validation. No new functionality should be added until real-user beta feedback is collected and triaged.

## 1) Completed Modules

- Authentication and role-based access (`SUPER_ADMIN`, `ADMIN`, `RESIDENT`)
- Mobile-first 5-tab navigation flow (`Avizier`, `Plăți`, `Acasă`, `Mesaje`, `Cont`)
- Admin core operations: buildings, staircases, apartments, residents, charges/invoices, payments
- Resident core operations: dashboard, invoices/payments, announcements/comments, chat, issues, account actions
- Account flows: language/preferences, logout, change password
- Shared UX states: loading, empty, error + retry in core flows
- Cross-navigation shortcuts between major modules

## 2) Known Limitations (Beta)

- Real payment providers may be partially configured or unavailable in some environments
- Infocom API integration is not connected
- Email/Telegram/SMS integrations may include placeholders depending on deployment config
- PWA push notifications may be placeholder/incomplete in some environments
- Camera module is not included in this beta
- Some pages still have developer-oriented copy and require final content polishing after beta feedback
- Existing non-blocking React hook lint warnings are present in the repository

## 3) Test Accounts

- SUPERADMIN: `bolboceanuigor@gmail.com` / `SuperAdmin123!`
- MANAGER: `manager.test@example.com` / `Manager123!`
- TENANT (resident-like): `tenant.test@example.com` / `Tenant123!`

Notes:
- Exact available organizations/data can differ by environment seed.
- If role/account mapping differs in staging, use environment-provided credentials.

## 4) Setup Steps

1. Install dependencies in root, `frontend`, and `backend` workspaces.
2. Configure environment variables (`NEXT_PUBLIC_API_URL`, backend DB/auth settings).
3. Run backend migrations and seed data if needed.
4. Start backend service.
5. Start frontend service.
6. Verify login page loads and role redirects work.

## 5) Demo Flow (Recommended)

1. Login as ADMIN.
2. From `Cont`, open structure shortcuts and create building/staircase/apartment/resident.
3. Generate monthly charges and invoices.
4. Record a manual payment.
5. Publish an Avizier announcement.
6. Send a message in Mesaje.
7. Confirm payment visibility in Plăți and data updates in Acasă.
8. Login as RESIDENT and validate invoice/payment visibility, Avizier read/comment, Mesaje send, issue creation.

## 6) Final Smoke Test (Release Gate)

- Login all roles: **PASSED**
- Navigate 5 bottom menu items: **PASSED**
- Create building/apartment/resident: **PASSED**
- Generate charge/invoice: **PASSED**
- Record payment: **PASSED**
- Resident views invoice/payment: **PASSED**
- Chat works (support/community): **PASSED**
- Avizier works (feed/details/comments): **PASSED**

## 7) Critical Warnings

- Do not introduce new features before beta feedback cycle closes.
- Fix only critical production-impacting bugs during beta lock.
- Preserve API/DB compatibility; avoid risky schema changes without migration plan.
- Keep backups before any production data operations/imports.
