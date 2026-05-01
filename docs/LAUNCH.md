# Launch Preflight Checklist

Use this checklist before production launch.

- [ ] Environment variables are set (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`)
- [ ] Database migrations are applied
- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] Initial admin user exists and can login
- [ ] i18n routes work for `ro`, `ru`, `en`
- [ ] `npm run check` passes in monorepo root
- [ ] Docker services start successfully (`docker compose up -d`)
- [ ] Backup/export plan is documented and tested

## Notes

- Seed is blocked in production by default. Enable only if explicitly needed (`SEED=true`).
- Billing/sync integrations remain out of launch scope unless feature flags are enabled.
