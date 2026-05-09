# Security Manual Tests

Run these tests before each release and after every hotfix that touches auth, RBAC, reports, exports, or tenancy filters.

## Test 1 — Cross-tenant A.P.C. isolation

- **Given** two organizations `Org A` and `Org B`
- **When** an `Org A` admin opens apartments, residents, invoices, payments, issues or documents
- **Then** only `Org A` records are visible
- **And** no `Org B` IDs/names appear in API payloads

## Test 2 — Admin organization scope

- **Given** an admin belongs to one A.P.C.
- **When** the admin calls organization-scoped endpoints
- **Then** backend queries are scoped to that admin's `organizationId`
- **And** the admin cannot choose another organization manually

## Test 3 — Resident portal scope

- **Given** a resident linked to one apartment
- **When** resident opens invoices, meters, issues, announcements or public documents
- **Then** only that resident's apartment and A.P.C. data is returned

## Test 4 — Role route access control

- **Given** a resident role
- **When** resident opens `/{locale}/admin` or `/{locale}/superadmin` directly
- **Then** API returns `403 FORBIDDEN`
- **And** UI redirects or shows `Nu ai acces la această zonă.`

## Test 5 — Internal data protection

- **Given** internal notes, CRM tasks or admin-only documents exist
- **When** a resident calls resident endpoints
- **Then** internal records are never returned

## Test 6 — Export endpoint tenant filter

- **Given** both orgs have apartments, residents, invoices and payments
- **When** `Org A` admin exports report CSV endpoints
- **Then** exported rows contain only `Org A` data
- **And** no cross-tenant leakage exists in files

## Test 7 — Secrets and password hashes

- **Given** any authenticated API response
- **When** payloads are inspected
- **Then** `passwordHash`, database URLs, JWT secrets and provider API keys are absent

## Pass Criteria

- All tests pass
- No cross-tenant records observed in UI/API/exports
- Any failure blocks release until fixed
