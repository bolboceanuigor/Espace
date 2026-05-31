# Espace

Platformă pentru administrarea A.P.C. și condominiilor din Republica Moldova, cu roluri pentru Superadmin, Administrator și Locatar.

Product direction is documented in [`docs/PROJECT_DIRECTION.md`](docs/PROJECT_DIRECTION.md). Espace MVP v1 is not a lodging or rental-operations product; old rental, reservation and cleaning flows are legacy-only and hidden or redirected away from the production navigation.

## Local Setup

1. Install dependencies:
```bash
npm install
```
2. Configure env files:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# optional deploy templates
cp .env.staging .env.staging.local
cp .env.production .env.production.local
```
3. Start database:
```bash
docker-compose up -d postgres
```
4. Run Prisma migration and seed:
```bash
cd backend && npx prisma migrate dev && npx prisma db seed
```
5. Start apps:
```bash
npm run dev
```

## Developer Quick Steps

1. Start database: `npm run db:up`
2. Run migrations: `cd backend && npx prisma migrate dev`
3. Seed demo data (optional): `npm run seed` (`SEED_DEMO=true`)
4. Start all services: `npm run dev`
5. Quick verification:
   - `curl http://localhost:4000/api/health`
   - open `http://localhost:3001`
6. Run pre-demo checks: `npm run check`
   - Includes: backend build + frontend build
7. Optional data integrity check (requires DB): `npm run check:data`

## README Quick Start

1) Start DB:
```bash
npm run db:up
```

2) Generate Prisma client:
```bash
cd backend
npx prisma generate
```

### Database Safety

- PROD (safe migrations only):
```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```
- Never run `prisma db push`, resets, truncates or destructive commands against Supabase production data.
- Demo cleanup scripts are dry-run by default and require explicit confirmation flags.

3) Start apps:
```bash
npm run dev
```

Alternative one-liner:
```bash
./dev.sh
```

Or from root with full reset + seed + start:
```bash
npm run dev:clean
```

4) URLs:
- Frontend: `http://localhost:3001`
- Backend API base: `http://localhost:4000/api`
- Backend health: `http://localhost:4000/api/health`

5) Demo accounts:
- Superadmin: `bolboceanuigor@gmail.com` / `SuperAdmin123!`
- Manager: `manager.test@example.com` / `Manager123!`

## Environment Variables

### Backend (`backend/.env`)
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `COOKIE_SECURE`
- `ENABLE_CHANNELS_UI`
- `APP_URL` (used in verify/reset email links)
- `EMAIL_PROVIDER` (`console` in dev, `resend` in prod)
- `RESEND_API_KEY` (recommended email provider for auth emails)
- `EMAIL_FROM` (e.g. `Espace <no-reply@domain>`)
- `SUPPORT_EMAIL` (used as reply-to for support)
- `SUPERADMIN_EMAIL` (dev seed default: `bolboceanuigor@gmail.com`)
- `SUPERADMIN_PASSWORD` (dev seed fallback: `SuperAdmin123!`)
- `MANAGER_TEST_EMAIL` (dev seed default: `manager.test@example.com`)
- `MANAGER_TEST_PASSWORD` (dev seed fallback: `Manager123!`)
- `SEED`
- `SEED_DEMO`

### Frontend (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `NEXT_PUBLIC_DEFAULT_LOCALE`
- `NEXT_PUBLIC_ENABLE_BILLING_UI` (default `false`)
- `NEXT_PUBLIC_ENABLE_SOFT_LIMITS` (default `false`)
- `NEXT_PUBLIC_ENABLE_CHANNELS_UI` (default `false`)

### Deploy Templates (root)
- `.env.staging` (example)
- `.env.production` (example)
- `DOMAIN` + URLs should point to the same public host (API via `/api`)

## Seed Users

- Superadmin: `bolboceanuigor@gmail.com` / `SuperAdmin123!`
- Manager test: `manager.test@example.com` / `Manager123!`

## Auth Email Flow (MVP)

- Register creates org + admin user with `emailVerifiedAt=null` and sends verification email.
- Verify email endpoint marks user verified and sends welcome email.
- Login is blocked with `EMAIL_NOT_VERIFIED` until verification is completed.
- Forgot/reset password uses short-lived reset tokens and stores only token hashes in DB.
- Forgot/resend endpoints return generic success response to avoid email enumeration.

## Email Provider Setup (Dev/Prod)

- Recommended provider: Resend.
- Dev mode: set `EMAIL_PROVIDER=console` to avoid sending real emails; links are printed in backend logs.
- Prod mode: set `EMAIL_PROVIDER=resend`, configure `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `SUPPORT_EMAIL`.
- In production, `console` should be treated as dev-only; if a real provider is configured, Espace now prefers it automatically instead of simulating a successful send.
- Deliverability checklist in production DNS:
  - SPF
  - DKIM
  - optional DMARC

## Auth Abuse Protection

- Rate limits:
  - `POST /auth/login`: 10/min/IP
  - `POST /auth/register`: 5/min/IP
  - `POST /auth/resend-verification`: 3/min/IP
  - `POST /auth/forgot-password`: 3/min/IP
  - `POST /auth/reset-password`: 5/min/IP

## Run / Build

- Dev (monorepo): `npm run dev`
- Lint all: `npm run lint`
- Frontend build: `cd frontend && npm run build`
- Backend build: `cd backend && npm run build`
- Production compose: `docker compose -f docker-compose.prod.yml up -d --build`

## Deployment Targets

- Option A: Vercel (frontend) + VPS Docker (backend + db)
- Option B: VPS full Docker (frontend + backend + db + Caddy) **[baseline configured]**
- Step-by-step runbook: `docs/DEPLOYMENT.md`
- Go-live checklist: `docs/DEPLOY.md`
- Caddy config source: `deploy/Caddyfile`

## Data Ops

- Consistency checks: `npm run check:data`
- Backup DB: `cd backend && npm run db:backup`
- Restore DB: `cd backend && npm run db:restore -- backups/<file>.dump`

## i18n Structure

- Locales in URL: `/{locale}/...` with supported locales `ro`, `ru`, `en`
- Dictionaries: `frontend/messages/{ro,ru,en}.json`
- Locale resolution: middleware + `locale` cookie persistence
- Locale can be switched from UI (RO/RU/EN) and is persisted in cookie/preferences

## RBAC Rules

- `SUPER_ADMIN`: platform CRM access for A.P.C. associations, administrators and onboarding.
- `ADMIN`: organization-scoped access for one A.P.C., including apartments, residents, meters, invoices, payments, requests, announcements and documents.
- `RESIDENT`: self-service access only to the linked apartment, invoices, meters, requests, announcements, public documents and account data.
- Middleware may use role hints from cookie/JWT for UX redirects, but backend RBAC is always source of truth

## UI Stack

- Styling: Tailwind + CSS variables (single styling system)
- Icons: `lucide-react` (frontend only)
- Components: custom minimal kit in `frontend/components/ui` (Tooltip, Switch, Button, Input, Dialog/Drawer patterns)

## Prisma Migration Discipline

- Every Prisma schema change must have a new migration (`npx prisma migrate dev --name <change>`).
- Never edit historical migrations after they were created.
- Seed is idempotent (`cd backend && npm run prisma:seed`) and does not duplicate demo data.

## Backup / Export

- Admin reports support practical A.P.C. exports for:
  - datorii
  - plăți
  - facturi lunare
  - apartamente
  - locatari
- Legacy rental exports are not part of the public MVP direction.

## Billing Note

- Billing is planned, but not implemented in UI/checkout flows.
- Schema/domain placeholders exist for future integration (plans, subscriptions, usage metering).
- Internal placeholder endpoints:
  - `GET /api/usage/today`
  - `GET /api/billing/plans`
  - `GET /api/billing/subscription`

## Legacy Modules Note

- Old channel, calendar, rental-property, reservation and cleaning modules are not part of Espace MVP v1.
- Production navigation must stay focused on A.P.C. workflows.
- Direct legacy routes are redirected to the relevant A.P.C. dashboards where safe.

## Manual E2E Checklist

1. Login as Superadmin and create an A.P.C. with code format `A0123-0940`.
2. Create or invite an administrator for that A.P.C.
3. Login as Admin and create bloc, scară, apartament and locatar records.
4. Add contor and citire records.
5. Configure tarife, generate facturi and register a plată.
6. Login as Resident and verify apartment, invoices, meters, requests, announcements and public documents.

## MVP / Demo Docs

- MVP checklist: `docs/MVP.md`
- 2-minute demo flow: `docs/DEMO.md`
- Launch preflight checklist: `docs/LAUNCH.md`
- First customer onboarding checklist: `docs/FIRST_CUSTOMER.md`
- Security manual tests: `docs/SECURITY_TESTS.md`
- Release operations: `docs/RELEASE.md`
- Customer onboarding kit: `docs/ONBOARDING.md`
