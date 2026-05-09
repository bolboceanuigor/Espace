# Espace Project Direction

Espace MVP v1 is a Moldova-only platform for administrarea A.P.C. și condominiilor. The product uses A.P.C. terminology and real API/Supabase data as the primary source.

## Product Roles

- Superadmin: CRM for A.P.C. associations, onboarding, administrators, subscriptions, follow-ups and platform status.
- Admin: workbench and CRM for one A.P.C., focused on apartments, residents, meters, invoices, payments, requests, announcements, documents and reports.
- Resident: simple self-service portal for apartment information, invoices, debt, meters, requests, announcements, public documents and account data.

## A.P.C. Identity

Recommended code format: `A0123-0940`.

- `legalName`: `Asociația de Proprietari din Condominiu A0123-0940`
- `shortName`: `A.P.C. A0123-0940`
- `associationNumber`: last four digits, for example `0940`
- country: `Republica Moldova`
- currency: `MDL`

## Production Infrastructure

- Frontend: Vercel, `https://espace.md`
- Backend: Render, `https://espace-ru41.onrender.com`
- Database: Supabase Postgres
- Deployment source: GitHub main branch

## Not Product Direction

Espace MVP v1 is not a lodging or rental-operations product. The following areas must stay hidden from visible production navigation and redirected or marked unavailable if opened directly:

- reservations
- availability calendar
- rental properties
- hotel clients or guests
- cleaning/check-in/check-out flows
- debug, demo, QA, smoke-test and roadmap pages

## Data Rules

- Real API and Supabase are primary.
- Empty API responses show empty states, not fake data.
- Emergency fallback data is allowed only when the API is unavailable and must be labelled as temporary.
- Do not run destructive database commands for production data preparation.
- Do not expose `passwordHash`, database URLs, JWT secrets or provider keys.
