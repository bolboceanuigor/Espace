# Security Manual Tests

Run these tests before each release and after every hotfix that touches auth, RBAC, calendar, exports, or tenancy filters.

## Test 1 — Cross-tenant property isolation

- **Given** two organizations `Org A` and `Org B`
- **When** an `Org A` user opens `/properties`
- **Then** only `Org A` properties are visible
- **And** no `Org B` IDs/names appear in API payloads

## Test 2 — Manager assignment scope

- **Given** a manager assigned to only a subset of properties
- **When** manager opens `/properties` and `/calendar`
- **Then** manager sees only assigned properties
- **And** unassigned properties are never listed

## Test 3 — Manager create restriction (if policy is view-only)

- **Given** manager role with view-only property policy
- **When** manager calls `POST /api/properties` (UI or direct request)
- **Then** API returns `403 FORBIDDEN`
- **And** no new property is created

## Test 4 — Team route access control

- **Given** manager role
- **When** manager opens `/{locale}/team` directly
- **Then** user is redirected to forbidden/calendar flow
- **And** API endpoints for team management return `403`

## Test 5 — Calendar endpoint tenant filter

- **Given** overlapping date ranges in multiple orgs
- **When** `GET /api/calendar?start=...&end=...` is called by `Org A`
- **Then** response includes only `Org A` properties/reservations
- **And** `organizationId` scoping is enforced on backend queries

## Test 6 — Export endpoint tenant filter

- **Given** both orgs have reservations/clients
- **When** `Org A` admin exports CSV endpoints
- **Then** exported rows contain only `Org A` data
- **And** no cross-tenant leakage exists in files

## Pass Criteria

- All 6 tests pass
- No cross-tenant records observed in UI/API/exports
- Any failure blocks release until fixed
