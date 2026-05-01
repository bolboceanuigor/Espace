# Route Map

Status legend:
- `WORKING` = route exists and has functional page
- `EMPTY BUT OK` = fallback/placeholder page (non-blank)
- `BROKEN` = route exists but known broken behavior
- `MISSING` = no route file

## ADMIN

| Label | Href | Route file path | Status | Notes |
|---|---|---|---|---|
| Dashboard | `/admin` | `frontend/app/admin/page.tsx` | WORKING | API-backed overview |
| Buildings | `/admin/buildings` | `frontend/app/admin/buildings/page.tsx` | WORKING | CRUD + states |
| Staircases | `/admin/staircases` | `frontend/app/admin/staircases/page.tsx` | EMPTY BUT OK | Fallback list + link to building details |
| Apartments | `/admin/apartments` | `frontend/app/admin/apartments/page.tsx` | WORKING | API + filters + states |
| Residents | `/admin/residents` | `frontend/app/admin/residents/page.tsx` | WORKING | API + create/update/delete |
| Tariffs | `/admin/tariffs` | `frontend/app/admin/tariffs/page.tsx` | EMPTY BUT OK | Non-blank fallback over available tariff aggregate data |
| Charges | `/admin/charges` | `frontend/app/admin/charges/page.tsx` | WORKING | API + generate monthly + filters |
| Payments | `/admin/payments` | `frontend/app/admin/payments/page.tsx` | WORKING | API + manual add + confirm/cancel |
| Invoices | `/admin/invoices` | `frontend/app/admin/invoices/page.tsx` | WORKING | API + generate + issue + PDF |
| Balances | `/admin/balances` | `frontend/app/admin/balances/page.tsx` | WORKING | API + debt filters + export |
| Issues | `/admin/issues` | `frontend/app/admin/issues/page.tsx` | WORKING | API list and actions |
| Chat | `/admin/chat` | `frontend/app/admin/chat/page.tsx` | WORKING | API polling chat |
| Announcements | `/admin/announcements` | `frontend/app/admin/announcements/page.tsx` | WORKING | API list/create |
| Documents | `/admin/documents` | `frontend/app/admin/documents/page.tsx` | WORKING | API list/create |
| Voting | `/admin/votes` | `frontend/app/admin/votes/page.tsx` | WORKING | API voting management |
| Maintenance | `/admin/maintenance/calendar` | `frontend/app/admin/maintenance/calendar/page.tsx` | WORKING | API events/tasks |
| Suppliers | `/admin/suppliers` | `frontend/app/admin/suppliers/page.tsx` | WORKING | API CRUD |
| Expenses | `/admin/expenses` | `frontend/app/admin/expenses/page.tsx` | WORKING | API CRUD |
| Imports | `/admin/imports` | `frontend/app/admin/imports/page.tsx` | WORKING | API import jobs |
| Reconciliation | `/admin/reconciliation` | `frontend/app/admin/reconciliation/page.tsx` | WORKING | API batches |
| Reports | `/admin/reports` | `frontend/app/admin/reports/page.tsx` | WORKING | Reports hub |
| Reminders | `/admin/reminders` | `frontend/app/admin/reminders/page.tsx` | WORKING | API reminder rules/logs |
| Team | `/admin/team` | `frontend/app/admin/team/page.tsx` | EMPTY BUT OK | Fallback entry; links to `/team` |
| Audit Logs | `/admin/audit-logs` | `frontend/app/admin/audit-logs/page.tsx` | WORKING | API logs |
| Settings | `/admin/settings/organization` | `frontend/app/admin/settings/organization/page.tsx` | WORKING | API settings |
| Subscription | `/admin/subscription` | `frontend/app/admin/subscription/page.tsx` | WORKING | API subscription status/invoices |
| Onboarding | `/admin/onboarding` | `frontend/app/admin/onboarding/page.tsx` | WORKING | API onboarding steps |

## RESIDENT

| Label | Href | Route file path | Status | Notes |
|---|---|---|---|---|
| Dashboard | `/resident` | `frontend/app/(app)/resident/page.tsx` | WORKING | API-backed overview |
| Chat | `/resident/chat` | `frontend/app/(app)/resident/chat/page.tsx` | WORKING | API chat |
| Payments | `/resident/payments` | `frontend/app/(app)/resident/payments/page.tsx` | WORKING | API list/intents |
| Invoices | `/resident/invoices` | `frontend/app/(app)/resident/invoices/page.tsx` | WORKING | API invoices |
| Issues | `/resident/issues` | `frontend/app/(app)/resident/issues/page.tsx` | WORKING | API issues |
| Announcements | `/resident/announcements` | `frontend/app/(app)/resident/announcements/page.tsx` | WORKING | API announcements |
| Documents | `/resident/documents` | `frontend/app/(app)/resident/documents/page.tsx` | WORKING | API documents |
| Voting | `/resident/votes` | `frontend/app/(app)/resident/votes/page.tsx` | WORKING | API votes |
| Maintenance | `/resident/maintenance` | `frontend/app/(app)/resident/maintenance/page.tsx` | WORKING | API events |
| Reports | `/resident/reports` | `frontend/app/(app)/resident/reports/page.tsx` | WORKING | API statement |
| Profile | `/resident/profile` | `frontend/app/(app)/resident/profile/page.tsx` | WORKING | API profile/preferences |
| Settings | `/resident/settings` | `frontend/app/(app)/resident/settings/page.tsx` | EMPTY BUT OK | Fallback hub to notification settings |

## SUPER_ADMIN

| Label | Href | Route file path | Status | Notes |
|---|---|---|---|---|
| Dashboard | `/superadmin` | `frontend/app/(app)/superadmin/page.tsx` | WORKING | Command center |
| Organizations | `/superadmin/organizations` | `frontend/app/(app)/superadmin/organizations/page.tsx` | WORKING | API list |
| Subscriptions | `/superadmin/subscriptions` | `frontend/app/(app)/superadmin/subscriptions/page.tsx` | WORKING | API list/actions |
| Billing | `/superadmin/billing` | `frontend/app/(app)/superadmin/billing/page.tsx` | WORKING | API billing |
| Leads | `/superadmin/leads` | `frontend/app/(app)/superadmin/leads/page.tsx` | WORKING | API leads |
| Demo Requests | `/superadmin/demo-requests` | `frontend/app/(app)/superadmin/demo-requests/page.tsx` | WORKING | API requests |
| Trials | `/superadmin/trials` | `frontend/app/(app)/superadmin/trials/page.tsx` | WORKING | API trial workflow |
| Feedback | `/superadmin/feedback` | `frontend/app/(app)/superadmin/feedback/page.tsx` | WORKING | API feedback |
| Jobs | `/superadmin/jobs` | `frontend/app/(app)/superadmin/jobs/page.tsx` | WORKING | API scheduler jobs |
| System Errors | `/superadmin/system/errors` | `frontend/app/(app)/superadmin/system/errors/page.tsx` | WORKING | API system logs |
| System Status | `/superadmin/system/status` | `frontend/app/(app)/superadmin/system/status/page.tsx` | WORKING | API health status |
| QA Checklist | `/superadmin/qa-checklist` | `frontend/app/(app)/superadmin/qa-checklist/page.tsx` | WORKING | API checklist |
| Beta Readiness | `/superadmin/beta-readiness` | `frontend/app/(app)/superadmin/beta-readiness/page.tsx` | WORKING | API readiness |
| Support Mode | `/superadmin/support-mode` | `frontend/app/(app)/superadmin/support-mode/page.tsx` | WORKING | API current support session |
| Help Articles | `/superadmin/help` | `frontend/app/(app)/superadmin/help/page.tsx` | WORKING | API article management |
| Email Templates | `/superadmin/email-templates` | `frontend/app/(app)/superadmin/email-templates/page.tsx` | WORKING | API templates |
| Tasks | `/superadmin/tasks` | `frontend/app/(app)/superadmin/tasks/page.tsx` | WORKING | API tasks |
| Roadmap | `/superadmin/roadmap` | `frontend/app/(app)/superadmin/roadmap/page.tsx` | WORKING | API roadmap |
| Release Notes | `/superadmin/release-notes` | `frontend/app/(app)/superadmin/release-notes/page.tsx` | WORKING | API release notes |
| Demo Reset | `/superadmin/demo` | `frontend/app/(app)/superadmin/demo/page.tsx` | WORKING | API demo reset/status |
| Storage | `/superadmin/storage` | `frontend/app/(app)/superadmin/storage/page.tsx` | WORKING | API storage summary |
| Audit Logs | `/superadmin/audit-logs` | `frontend/app/(app)/superadmin/audit-logs/page.tsx` | WORKING | API audit logs |
| Settings | `/superadmin/settings` | `frontend/app/(app)/superadmin/settings/page.tsx` | EMPTY BUT OK | Fallback settings hub |
| Smoke Test | `/superadmin/smoke-test` | `frontend/app/(app)/superadmin/smoke-test/page.tsx` | WORKING | Internal manual smoke checklist tracking page |
