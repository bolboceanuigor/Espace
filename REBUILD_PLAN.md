# Rebuild Plan

## Goal
Build an original Laravel SaaS for residential associations that preserves useful business ideas from the analyzed product while using a cleaner architecture, stronger tenant isolation, and safer operational defaults.

## Recommended Stack
- Laravel 12+
- PHP 8.3+
- PostgreSQL preferred
- Laravel Sanctum for SPA/API auth
- Laravel Fortify or custom auth actions for login hardening
- Laravel Policies + Gates
- Laravel Queues with Redis
- Laravel Horizon
- Laravel Notifications
- Laravel Cashier only if it clearly fits the chosen billing providers; otherwise custom billing services
- Livewire or Inertia for back-office UI
- Vite, Tailwind, original component library
- Pest or PHPUnit for tests

## Multi-Tenant Architecture
- Single database, shared schema, strict row-level tenant ownership via `tenant_id`
- Tenant resolution at login and per request
- No implicit trust in session-cached tenant objects as source of truth
- Tenant-scoped query services for all sensitive data
- Policies require both role permission and tenant ownership
- Optional future path: database row-level security if PostgreSQL strategy matures

## Authentication Design
- Single authentication pipeline
- Steps:
  - validate credentials
  - resolve tenant context
  - verify user active
  - verify tenant active
  - verify approval state where needed
  - optional MFA / recaptcha
  - issue session or token
- Support:
  - invitation-based onboarding
  - password reset
  - forced password rotation
  - suspicious-login alerting

## Authorization Design
- Use Policies and permission checks, not role-name string checks spread across views
- Permission domains grouped by module
- Guard every resident-facing record by tenant and user-to-unit association
- Super Admin actions separated from tenant admin flows by route groups and policies

## Billing Design
- One source of truth for invoices, balances, and payments
- Explicit lifecycle:
  - draft charge batch
  - publish invoices
  - receive payment or proof
  - reconcile
  - update invoice balance
- Transactions around multi-step payment operations
- Idempotency for provider callbacks and manual acceptance actions

## Payment Webhooks
- One webhook controller per provider family
- Dedicated verifier service per provider
- Exact CSRF exemptions only for those endpoints
- Persist raw payload + signature metadata for audit
- Process:
  - verify signature
  - deduplicate event
  - resolve tenant / invoice / subscription
  - mutate state in transaction
  - emit domain events

## File Upload Strategy
- Central upload service with per-feature allowlists
- Store private documents outside public web root
- Keep only public branding/media on public disk
- Save metadata in `stored_files`
- Virus scanning hook optional for enterprise tier
- Signed or authorized download routes for sensitive files

## Notifications
- In-app notifications table
- Queued email notifications
- Optional web push
- Event-driven notification dispatch
- Per-tenant notification preferences

## Dashboard Strategy
- Separate dashboard compositions:
  - platform
  - association admin
  - resident/owner
  - service staff
- Each dashboard backed by dedicated query services, not large shared controllers

## API Design
- Versioned JSON API
- Route groups:
  - `/api/platform/*`
  - `/api/tenant/*`
  - `/api/resident/*`
  - `/api/webhooks/*`
- Use Form Requests for validation
- Use API Resources / DTOs for output shape

## Audit Logging
- Log all sensitive changes:
  - auth events
  - role changes
  - invoice publish
  - payment status changes
  - proof approvals
  - visitor approvals
  - tenant settings changes
- Keep actor, tenant, entity, before/after, IP, user agent

## Testing Strategy
- Unit tests for services and validators
- Feature tests for auth, tenant isolation, invoice flows, payment proofs, announcements, bookings
- Webhook signature verification tests with valid/invalid payloads
- Policy tests for every role
- Smoke tests for scheduler commands
- Browser/E2E tests for key admin and resident flows

## Deployment Strategy
- CI:
  - composer install
  - npm build
  - lint / static analysis
  - test suite
- CD:
  - config cache
  - route cache
  - queue restart
  - migrations during deploy job only
- No request-time install or migrate behavior

## Backup And Recovery
- Daily database backups
- retention policy by environment
- encrypted object storage for backup archives
- periodic restore drills

## Monitoring
- application error tracking
- job failure alerts
- webhook failure alerts
- billing anomaly alerts
- queue depth monitoring
- health checks for DB, cache, queue, storage
- audit dashboard for suspicious tenant access attempts

## Suggested Delivery Phases

### Phase 1: Core SaaS foundation
- tenant model
- auth
- roles / permissions
- settings
- audit logs
- subscription basics

### Phase 2: Property operations MVP
- buildings / floors / units
- owners / residents
- announcements
- tickets

### Phase 3: Financial MVP
- charge batches
- invoices
- resident balance
- payment proofs
- manual reconciliation

### Phase 4: Extended community modules
- amenities / bookings
- visitors
- events
- forum
- assets / service tasks

### Phase 5: Advanced billing and integrations
- online gateways
- recurring SaaS billing
- advanced reports
- monitoring and dunning

## Decisions To Confirm Before Coding
- single-tenant login domain vs subdomain-per-tenant
- owner and resident as separate roles or one account with relationship labels
- invoice granularity: one invoice per unit vs one per resident account
- MVP payment methods: manual proof only vs immediate online gateway support
- whether forum, events, and visitors are MVP or phase 4
