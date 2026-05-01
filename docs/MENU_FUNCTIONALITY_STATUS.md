# Menu Functionality Status

Audit scope for this step: ADMIN menu items 1-5 only, in order.

Status legend:
- `WORKING`
- `PARTIAL`
- `BROKEN`
- `MISSING`

## ADMIN

| Menu item | Route | Status | API connected | Mobile ready | Notes |
|---|---|---:|---:|---:|---|
| Dashboard | `/admin` | WORKING | yes | yes | Uses `GET /api/admin/overview`; loading + empty + error + retry added. |
| Buildings | `/admin/buildings` | WORKING | yes | yes | Uses buildings API list/create/delete; loading + empty + error + toasts + confirm delete. |
| Staircases | `/admin/buildings/[id]` | WORKING | yes | yes | Managed in building details page; add/edit/delete now functional with validation/toasts/error handling. |
| Apartments | `/admin/apartments` | WORKING | yes | yes | Uses apartments list API; loading + empty + error present; reminder action now has per-row loading/error feedback. |
| Residents | `/admin/residents` | WORKING | yes | yes | Uses resident profile APIs; create/set-primary/delete actions with loading/confirm/toasts; loading+error states added. |
| Tariffs | `/admin/tariffs` | PARTIAL | yes | yes | Route added and connected to `GET /api/admin/reports/charges` (tariff aggregation by month/year); full create/edit/activate/deactivate/delete is blocked by missing dedicated tariff CRUD endpoints in backend. |
| Charges | `/admin/charges` | WORKING | yes | yes | Month/year selector, monthly generation action, generated charges list, status/apartment filters, duplicate-safe generation flow via existing monthly generation API. |
| Payments | `/admin/payments` | WORKING | yes | yes | List + filters, manual add with validation/toasts, confirm/cancel actions with loading/error feedback, organization-scoped backend filtering. |
| Invoices | `/admin/invoices` | WORKING | yes | yes | Monthly generation, list, issue action, status visibility (UNPAID/PARTIAL/PAID via backend), PDF download fallback toast when unavailable. |
| Balances | `/admin/balances` | WORKING | yes | yes | Apartment debt list with building/staircase/floor filters, debt highlighting, export to XLSX using existing reports export endpoint. |
| Issues | `/admin/issues` | PARTIAL | no | no | Not audited in this step yet. |
| Chat | `/admin/chat` | PARTIAL | no | no | Not audited in this step yet. |
| Announcements | `/admin/announcements` | PARTIAL | no | no | Not audited in this step yet. |
| Documents | `/admin/documents` | PARTIAL | no | no | Not audited in this step yet. |
| Voting | `/admin/votes` | PARTIAL | no | no | Not audited in this step yet. |
| Maintenance | `/admin/maintenance/calendar` | PARTIAL | no | no | Not audited in this step yet. |
| Suppliers | `/admin/suppliers` | PARTIAL | no | no | Not audited in this step yet. |
| Expenses | `/admin/expenses` | PARTIAL | no | no | Not audited in this step yet. |
| Imports | `/admin/imports` | PARTIAL | no | no | Not audited in this step yet. |
| Reconciliation | `/admin/reconciliation` | PARTIAL | no | no | Not audited in this step yet. |
| Reports | `/admin/reports` | PARTIAL | no | no | Not audited in this step yet. |
| Reminders | `/admin/reminders` | PARTIAL | no | no | Not audited in this step yet. |
| Team | `/team` | PARTIAL | no | no | Not audited in this step yet. |
| Audit Logs | `/admin/audit-logs` | PARTIAL | no | no | Not audited in this step yet. |
| Settings | `/admin/settings/organization` | PARTIAL | no | no | Not audited in this step yet. |
| Subscription | `/admin/subscription` | PARTIAL | no | no | Not audited in this step yet. |
| Onboarding | `/admin/onboarding` | PARTIAL | no | no | Not audited in this step yet. |
