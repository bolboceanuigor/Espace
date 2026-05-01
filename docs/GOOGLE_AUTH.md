# Google Login Plan (Post-MVP)

Scope: planning + readiness only.  
No OAuth implementation changes in this phase.

## 1) DB Readiness (Already Prepared)

Current `User` fields support Google account linking:

- `authProvider`: `LOCAL | GOOGLE | BOTH`
- `googleSub`: `String? @unique`
- `avatarUrl`: `String?`
- `fullName`: `String?`

Linking rule:

- existing `LOCAL` user + Google login with same email -> set `googleSub` and `authProvider=BOTH`
- keep local password login working

## 2) Google Cloud Setup Requirements

Create and configure Google OAuth in Google Cloud Console:

1. Create a Google Cloud project.
2. Configure OAuth consent screen.
3. Create OAuth Client credentials (type: **Web application**).
4. Add authorized redirect URIs:
   - DEV: `http://localhost:4000/api/auth/google/callback`
   - PROD: `https://domain.tld/api/auth/google/callback`
5. Store credentials in backend env:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

Recommended env flags:

- `ENABLE_GOOGLE_AUTH=false` by default
- enable only after end-to-end validation in staging

## 3) Backend Implementation Plan (NestJS)

Routes:

- `GET /api/auth/google?locale=ro`
- `GET /api/auth/google/callback`

Callback flow (target behavior):

1. Read Google profile (`sub`, `email`, optional names/avatar).
2. Lookup user by:
   - `googleSub`, else
   - `email`.
3. If user exists:
   - if `googleSub` missing -> attach `googleSub`
   - if `authProvider=LOCAL` -> set `authProvider=BOTH`
   - if `emailVerifiedAt` is null -> set `emailVerifiedAt=now`
4. If user does not exist:
   - create organization (MVP default name, e.g. `"My Organization"`)
   - create user with:
     - `authProvider=GOOGLE`
     - `role=ADMIN`
     - `emailVerifiedAt=now`
5. Issue same JWT cookie session used by local auth.
6. Redirect to `/{locale}/calendar`.

## 4) Security Requirements

- use and validate OAuth `state` parameter (include locale)
- allow only configured callback URI/domain
- gate feature by `ENABLE_GOOGLE_AUTH=true`
- keep local auth available during rollout
- never trust frontend role hints; backend RBAC remains source of truth

## 5) Frontend Enablement Plan

Login page behavior:

- show Google button only when `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`
- button target:
  - `${NEXT_PUBLIC_API_URL}/auth/google?locale=${locale}`
  - example in prod: `https://domain.tld/api/auth/google?locale=ro`

UI fallback when disabled:

- disabled button with text: `"Continue with Google (coming soon)"`

## 6) QA Plan Before Enable in Production

1. Local email/password login still works.
2. First-time Google login creates org + user and signs in.
3. Google email equals existing local user:
   - account is linked
   - data is preserved
   - user can still login with local password.
4. `emailVerifiedAt` is set for Google users.
5. Logout/login cycle works with cookie session.
6. RBAC unchanged (ADMIN/MANAGER/SUPERADMIN behavior remains correct).

## 7) Rollout Strategy

1. Keep flags off in production.
2. Enable in staging and run QA checklist.
3. Enable in production with monitoring.
4. If issues appear, disable via flag and keep local auth active.
