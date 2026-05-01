# Auth Module (Current)

## What is implemented now

- Local auth with cookie session (`httpOnly` access token)
- Register -> email verification -> login
- Forgot/reset password
- Team invite flow (copy link, no email sender yet)
- RBAC with `SUPERADMIN`, `ADMIN`, `MANAGER`
- Rate limiting on auth endpoints

## Local Auth Flow

1. `POST /api/auth/register`
   - creates organization + admin user
   - stores `emailVerifiedAt = null`
   - creates verification token (hashed in DB)
2. `POST /api/auth/verify-email`
   - validates token and expiry
   - sets `emailVerifiedAt`
3. `POST /api/auth/login`
   - checks password
   - blocks unverified users with `EMAIL_NOT_VERIFIED`
   - sets `accessToken` cookie
4. `POST /api/auth/logout`
   - clears auth cookies

## Password Recovery

- `POST /api/auth/forgot-password`
  - always returns generic success message
- `POST /api/auth/reset-password`
  - validates token + expiry
  - enforces strong password policy

## Invite Flow (no email provider required)

1. Admin creates invite: `POST /api/invitations`
2. API returns `inviteLink` (copy and share manually)
3. Invited user opens `/[locale]/accept-invite?token=...`
4. `POST /api/invitations/accept` creates account, marks invite used, logs user in

## Roles

- `SUPERADMIN`: global admin capabilities
- `ADMIN`: full access in own organization
- `MANAGER`: restricted access

## Session & Security

- Access token in secure cookie (`httpOnly`, `sameSite=lax`)
- CORS allowlist + credentials
- Helmet enabled
- Endpoint throttling:
  - login: 10/min
  - register: 5/min
  - resend: 3/min
  - forgot: 3/min
  - reset: 5/min

## Google Auth (prepared, disabled)

- Feature flag: `ENABLE_GOOGLE_AUTH=false`
- Placeholder routes exist:
  - `GET /api/auth/google`
  - `GET /api/auth/google/callback`
- Disabled response:
  - `501` with `GOOGLE_AUTH_DISABLED` and message `Coming soon`

## Planned Google linking strategy

- Local user + same Google email -> link account (`authProvider=BOTH`, set `googleSub`)
- New Google email -> create Google user + default org
- Invited user can later link Google with same email

## Manual QA Checklist (Auth + Invite + RBAC)

1. Register a new admin account
   - submit register form
   - receive verify link in backend logs (`EMAIL_PROVIDER=console`)
   - open verify link and confirm success
2. Login checks
   - invalid password shows generic `INVALID_CREDENTIALS`
   - unverified user shows `EMAIL_NOT_VERIFIED` + resend banner
   - verified user logs in and reaches calendar
3. Forgot/reset flow
   - forgot password always returns generic success
   - reset with valid token updates password
   - expired token returns `TOKEN_EXPIRED`
4. Team invite onboarding
   - admin creates invite in `/team`
   - copy invite link and open `/[locale]/accept-invite`
   - invited user sets password and lands in calendar
   - reused invite returns `INVITE_ALREADY_USED`
5. RBAC checks
   - manager cannot access `/team` (redirect/forbidden)
   - admin can list users and invitations
6. i18n checks
   - auth pages and invite page texts are translated in RO/RU/EN

## Hard Gate Before Release

Auth is not considered stable until all below pass:

- `cd backend && npm run build`
- `cd frontend && npm run build`
- Manual QA checklist above completed successfully
