# Backend Quick Start (DEV)

## DB align + seed

```bash
npx prisma db push --force-reset --accept-data-loss
npx prisma generate
npx prisma db seed
```

Seed is the source of truth for demo accounts and demo data in development.

## Start backend

```bash
npm run start:dev
```

Expected API URL: `http://localhost:4000/api`
