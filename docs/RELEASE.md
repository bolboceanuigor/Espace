# Release Operations

Practical post-launch process for stable weekly delivery without scope creep.

## Release Cadence

- **Regular release:** weekly (`v0.x`)
- **Hotfix release:** anytime when critical defects appear

## Error Budget Rules

- **Critical (fix immediately):**
  - bugs affecting auth/RBAC, A.P.C. organization scope, resident apartment scope, invoices, payments, imports, or health checks
- **Minor UI issues (batch weekly):**
  - cosmetic spacing/copy/hover glitches that do not risk data or access

## Support Workflow (no ticket system)

1. User sends in-app feedback from Settings
2. Admin reviews feedback list
3. Team responds manually (email/Telegram/phone)
4. Important issues are logged in changelog/roadmap

No impersonation in MVP. Use diagnostics/export + activity logs for investigation.

## Go/No-Go Gate (stop scope creep)

Do not merge new features until all are green:

1. `npm run check` passes
2. Security tests pass (`docs/SECURITY_TESTS.md`)
3. Real A.P.C. beta flow works end-to-end
4. Legacy PMS routes remain hidden or safely redirected

## Release Checklist

1. Confirm migrations tested locally
2. Run backup before deploy
3. Deploy + migrate in prod (`prisma migrate deploy`)
4. Run beta smoke tests (see `docs/BETA-RELEASE-CHECKLIST.md`)
5. Update `whats-new` JSON and changelog notes

## Deferred / Optional (not now)

- Admin impersonation (explicitly deferred for security reasons)
- Feedback voting/ranking
- Automated support ticketing

## Data Retention Placeholder

Planned org setting (not active yet):

- `documentRetentionDays`

No automatic deletion job is enabled in MVP.
