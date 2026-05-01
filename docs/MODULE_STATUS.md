# Module Functional Status

Scope: end-to-end usability validation before deployment, without adding new major features.

Legend:

- `DONE` = flow usable end-to-end
- `PARTIAL` = mostly usable, but some flows/actions are incomplete or not fully covered
- `BROKEN` = major blocker preventing normal usage
- `TODO` = missing dedicated module/page flow

## SUPER_ADMIN

- organizations: `DONE`
- subscriptions: `DONE`
- billing: `DONE`
- leads: `DONE`
- demo requests: `DONE`
- support mode: `PARTIAL` (API flow exists; UX discoverability and full scenario validation still needed)
- jobs: `DONE`
- system status: `DONE`
- QA checklist: `DONE`

## ADMIN

- onboarding: `DONE`
- buildings: `DONE`
- staircases: `PARTIAL` (managed from building details, no standalone module page)
- apartments: `DONE`
- residents: `DONE`
- tariffs: `TODO` (no dedicated admin tariffs module page/CRUD flow)
- charges: `PARTIAL` (monthly generation available through invoices/reports flows; dedicated charges UX is limited)
- invoices: `DONE`
- payments: `DONE`
- balances: `TODO` (no dedicated balances module page)
- announcements: `DONE`
- documents: `DONE`
- issues: `DONE`
- chat: `DONE`
- reports: `DONE`
- imports: `DONE`
- reconciliation: `DONE`
- reminders: `DONE`
- settings: `DONE`

## RESIDENT

- dashboard: `DONE`
- mobile bottom navigation: `DONE`
- invoices: `DONE`
- payments: `DONE`
- issues: `DONE`
- chat: `DONE`
- announcements: `DONE`
- documents: `DONE`
- maintenance: `DONE`
- profile: `DONE`

## Fixes Applied In This Pass

- Added robust loading/error/empty states and retry action on `admin/imports`.
- Added robust loading/error/empty states and retry action on `admin/votes`.
- Added explicit error fallback with retry path for `superadmin` command center dashboard.

## Remaining Priority Follow-ups (Pre-deploy)

- Decide whether `tariffs` and `balances` should be separate modules or intentionally merged into reports/invoices flow.
- Decide if `staircases` needs a standalone page (currently functional under building details).
- Perform manual permission/multi-tenant checks for support mode and cross-org restrictions on staging data.
