# Production Checklist

## Required Environment Variables

### Render Backend

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FRONTEND_URL`
- `API_URL`
- `APP_URL`
- `CORS_ORIGIN` (optional if `FRONTEND_URL` is set, must not be `*` in production)
- `NODE_ENV=production`
- `PORT`
- `COOKIE_SECURE=true` (recommended in production)
- `COOKIE_DOMAIN` (recommended for multi-subdomain deployments)
- `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` only when email delivery is configured

### Vercel Frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL` if the browser client is used
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` if the browser client is used

Never put `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RESEND_API_KEY`, or any Supabase service role key in frontend variables.

## Security Baseline

- Verify `NODE_ENV=production`.
- Ensure CORS does not contain wildcard origins.
- Enable HTTPS termination at load balancer/reverse proxy.
- Keep JWT secret rotated and strong.
- Confirm rate limits are active for:
  - login
  - password reset
  - invitation accept/public invitation lookup
- Confirm audit logs are stored and retained.

## Database Migration Steps

1. Backup current database.
2. Run approved production migrations only:
   - `npx prisma migrate deploy --schema backend/prisma/schema.prisma`
3. Do not run `prisma migrate reset`, `prisma db push`, or destructive cleanup commands against production without explicit approval.
4. Regenerate Prisma client:
   - `npx prisma generate --schema backend/prisma/schema.prisma`

## Seed Command (optional/non-prod bootstrap)

- `npm --prefix backend run seed`

## Build Commands

- Backend build:
  - root directory: `backend`
  - Render build command: `npm install --include=dev && npx prisma generate && npm run build`
  - Render start command: `npm run start:prod`
  - `npm --prefix backend run build`
- Frontend build:
  - root directory: `frontend`
  - Vercel build command: `npm run build`
  - `npm --prefix frontend run build`

## Deploy Notes

- Deploy backend and frontend from the same release tag/commit.
- Restart all backend instances after migration.
- Verify health endpoint and authentication flow post-deploy.
- Verify support mode banner/exit flow if superadmin support session exists.
- Validate backup export and audit logging in production-like environment.

## Post-Deploy Verification

- `GET /health` returns `status: ok`.
- `GET /health/db` returns `database: connected` and safe counts.
- Login succeeds/fails with expected audit entries.
- Password change endpoint works and requires old password.
- Admin cannot access foreign organizations.
- Resident cannot access admin data or foreign apartment data.
- Backup export is organization-scoped and sensitive provider config is masked.
