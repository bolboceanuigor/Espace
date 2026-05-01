# REAL PROJECT AUDIT

Date: 2026-04-28

Scope: factual codebase inspection only (no redesign, no new modules).

## 1) Frontend framework used

- Framework: **Next.js 14.1.0** (`frontend/package.json`)
- UI: React 18 + App Router (`frontend/app/**/page.tsx`)

## 2) Backend framework used

- Framework: **NestJS 10** (`backend/package.json`)
- ORM/DB: Prisma Client + PostgreSQL (`backend/prisma/schema.prisma`)

## 3) Existing frontend routes (real files)

Source: filesystem scan of `frontend/app/**/page.tsx`.

- Total pages found: **288**
- Route families present:
  - Public/auth: `/[locale]/login`, `/[locale]/register`, `/[locale]/forgot-password`, `/[locale]/reset-password`, `/[locale]/verify-email`, `/[locale]/pricing`, `/[locale]/features`, `/[locale]/contact`, `/[locale]/demo-request`
  - Admin: `/[locale]/admin`, `/[locale]/admin/announcements`, `/[locale]/admin/payments`, `/[locale]/admin/chat`, `/[locale]/admin/account`, `/[locale]/admin/issues`, `/[locale]/admin/buildings`, `/[locale]/admin/staircases`, `/[locale]/admin/apartments`, `/[locale]/admin/residents`, `/[locale]/admin/invoices`, `/[locale]/admin/reports`, `/[locale]/admin/settings/*`, etc.
  - Resident: `/[locale]/resident`, `/[locale]/resident/announcements`, `/[locale]/resident/payments`, `/[locale]/resident/chat`, `/[locale]/resident/account`, `/[locale]/resident/issues`, `/[locale]/resident/invoices`, etc.
  - Superadmin: `/[locale]/superadmin/*` including organizations, subscriptions, trials, billing, tasks, feedback, roadmap, release notes, system status/errors.

## 4) Existing backend endpoints (real controllers)

Source: controller scan in `backend/src/**/*.controller.ts` (60 controllers).

- Core endpoint groups found:
  - Auth: `/auth/*`, `/api/auth/*`
  - Me/navigation: `/api/me`, `/api/me/preferences`, `/api/me/navigation`
  - Admin structure: `/api/admin/buildings`, `/api/admin/staircases`, `/api/admin/apartments`, `/api/admin/residents`
  - Announcements/documents: `/api/admin/announcements`, `/api/resident/announcements`, `/api/admin/documents`, `/api/resident/documents`
  - Payments/invoices/reports/reconciliation/reminders: present under `/api/admin/*`, `/api/resident/*`, `/api/superadmin/*`
  - Chat/issues/maintenance/votes/notifications: present
  - Superadmin orgs/support/tasks/checklists/beta readiness: present

## 5) Existing Prisma models

Source: `backend/prisma/schema.prisma`.

- Data source: PostgreSQL (`provider = "postgresql"`)
- Major models present (non-exhaustive): `Organization`, `User`, `OrganizationMember`, `Building`, `Staircase`, `Apartment`, `ResidentProfile`, `Payment`, `ResidentInvoice`, `Announcement`, `AnnouncementComment`, `Document`, `Issue`, `ChatConversation`, `ChatMessage`, `Notification`, `SupportSession`, `FeatureRequest`, `ReleaseNote`, `Lead`, `DemoRequest`, `ClientNote`, `SuperAdminTask`, `OrganizationSubscription`, `OrganizationInvoice`, `OrganizationPayment`, and many others.

## 6) Menu items pointing to real pages

Source: `frontend/lib/navigation-config.ts` cross-checked against `frontend/app/**/page.tsx`.

- Main bottom menu (Admin/Resident) routes exist:
  - Admin: `/admin/announcements`, `/admin/payments`, `/admin`, `/admin/chat`, `/admin/account`
  - Resident: `/resident/announcements`, `/resident/payments`, `/resident`, `/resident/chat`, `/resident/account`
- Side menu families for Admin, Resident, Superadmin also have matching route files.

## 7) Broken menu links

From code inspection of `navigation-config.ts` against route files:

- **No missing route file was found** for configured menu links.
- Previously broken behavior identified in auth redirect flow (not missing file): users could be redirected to wrong role-home path due to mismatch between middleware role mapping and frontend role mapping.

## 8) Missing API connections (frontend calls without matching backend endpoint namespace)

Observed in `frontend/lib/api.ts` and backend controllers:

- Some legacy API namespaces still exist in frontend and are not in current `api/*` domain model, e.g. mixed use of:
  - `/admin/*`, `/organizations/*`, `/dashboard/*`, `/subscription/*`, `/usage/*`, `/sales/*` (non-`/api` style)
  - while most current modules use `/api/*`.
- This mixed API style is a risk for runtime inconsistencies depending on deployment proxy/rewrite rules.

## 9) Modules only visual / partial

Code-level factual findings:

- Google auth is intentionally disabled unless `ENABLE_GOOGLE_AUTH=true`:
  - Backend endpoints return `GOOGLE_AUTH_DISABLED` (`backend/src/auth/auth.controller.ts`).
  - Login page renders disabled fallback button when feature flag is off.
- Several pages are present and render UI, but functional depth varies by module (some are list-only or limited actions).

## 10) Modules functional (connected frontend+backend)

Verified by matching frontend API clients + backend controllers + successful frontend/backend builds:

- Auth (email/password, verify/reset/change password)
- Admin structure (buildings/staircases/apartments/residents)
- Payments/invoices/reports/reconciliation
- Announcements/documents/comments
- Chat (support + community)
- Issues + maintenance
- Superadmin org management, tasks, trials/subscriptions/billing, feedback, roadmap, release notes

## 11) Buttons with no action (factual)

- No widespread `onClick={() => {}}` empty handlers were found.
- Concrete no-action/disabled case found:
  - Google button is disabled when flag is off in login page (`frontend/app/[locale]/(auth)/login/page.tsx`), by design.

## 12) Is frontend connected to backend?

- **Yes, partially and actively connected.**
- Evidence:
  - Frontend uses `apiRequest()` to call backend (`frontend/lib/api.ts`).
  - Backend exposes matching controllers for most active modules.
  - `npm run build` passes for both frontend and backend.
- Risk:
  - Mixed endpoint styles (`/api/*` and non-`/api/*`) can break in some environments.

## 13) Is authentication working?

- Backend auth endpoints exist and compile.
- Frontend login flow exists and compiles.
- A real redirect bug was found and fixed (see section 15).

## 14) Is database/Prisma connected?

- Prisma schema is valid (`npm run prisma:validate` passed).
- Backend builds successfully with Prisma client.
- Runtime DB availability was not fully validated by live API call in this audit (build/schema-level validation passed).

## 15) Exact files that must be fixed first

Priority based on broken login/redirect behavior:

1. `frontend/middleware.ts`  (fixed in this pass)
   - Reason: role-home redirect mismatch was causing wrong navigation after auth.
2. `frontend/lib/role-routing.ts`  (currently consistent with desired role homes; keep as source of truth)
3. `frontend/app/[locale]/(auth)/login/page.tsx` and `frontend/context/AuthContext.tsx`
   - Keep aligned with middleware role mapping and cookie/token role handling.

## 16) Change applied in this audit (only login+role redirect)

- Fixed role redirect mismatch in `frontend/middleware.ts`:
  - Removed legacy redirects:
    - `MANAGER -> /dashboard`
    - `TENANT -> /owner`
  - Middleware now uses shared `roleHomePath()` mapping.

