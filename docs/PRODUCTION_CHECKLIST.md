# Production Checklist

## Required Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `API_URL`
- `CORS_ORIGIN` (optional if `FRONTEND_URL` is set, must not be `*` in production)
- `COOKIE_SECURE=true` (recommended in production)
- `COOKIE_DOMAIN` (recommended for multi-subdomain deployments)

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
2. Run schema sync/migrations:
   - `npx prisma migrate deploy --schema backend/prisma/schema.prisma`
   - or (if using db push flow) `npx prisma db push --schema backend/prisma/schema.prisma`
3. Regenerate Prisma client:
   - `npx prisma generate --schema backend/prisma/schema.prisma`

## Seed Command (optional/non-prod bootstrap)

- `npm --prefix backend run seed`

## Build Commands

- Backend build:
  - `npm --prefix backend run build`
- Frontend build:
  - `npm --prefix frontend run build`

## Deploy Notes

- Deploy backend and frontend from the same release tag/commit.
- Restart all backend instances after migration.
- Verify health endpoint and authentication flow post-deploy.
- Verify support mode banner/exit flow if superadmin support session exists.
- Validate backup export and audit logging in production-like environment.

## Post-Deploy Verification

- Login succeeds/fails with expected audit entries.
- Password change endpoint works and requires old password.
- Admin cannot access foreign organizations.
- Resident cannot access admin data or foreign apartment data.
- Backup export is organization-scoped and sensitive provider config is masked.

