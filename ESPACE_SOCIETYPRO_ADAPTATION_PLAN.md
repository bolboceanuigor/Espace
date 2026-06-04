# ESPACE_SOCIETYPRO_ADAPTATION_PLAN

## Scope
This report compares the current Espace SaaS codebase with the licensed SocietyPro SaaS source and defines a practical adaptation path into Espace.

Important boundary:
- Espace remains the target product, architecture, UI, and brand.
- SocietyPro is a licensed source of functional coverage and implementation ideas.
- We should adapt modules into Espace's stack, not transplant Laravel/Livewire structure as-is.

## 1. What Espace SaaS Already Has

### Architecture
- Monorepo root with workspaces in [package.json](/Users/bolboceanu/espace/package.json)
- Backend: NestJS 10 + Prisma + PostgreSQL in [backend/package.json](/Users/bolboceanu/espace/backend/package.json)
- Frontend: Next.js 14 + React 18 + Tailwind + `next-intl` in [frontend/package.json](/Users/bolboceanu/espace/frontend/package.json)
- API-first structure with separate backend/frontend instead of Laravel monolith

### Backend modules already present
Espace already includes many domain and platform modules in [backend/src](/Users/bolboceanu/espace/backend/src):
- auth, security, association-context, rbac, team
- organizations, apartments, residents, properties
- billing-read, billing-drafts, invoice-publishing, invoices, payments, reconciliation
- online-payments, saas-billing, saas-invoices, saas-management, saas-usage, saas-upgrades
- notifications, email, files, documents-mvp, document-render
- communications, community-read, connect, votes, issues, maintenance
- reports, imports, exports, data-quality, audit, backup-recovery, launch-control
- superadmin, superadmin-search, superadmin-clients

### Database / tenancy
Prisma schema already models strict tenant scoping mostly through `organizationId`:
- [Organization](/Users/bolboceanu/espace/backend/prisma/schema.prisma:2928)
- [Building, Staircase, Apartment, ResidentProfile](/Users/bolboceanu/espace/backend/prisma/schema.prisma:6904)
- [ResidentInvoice, Payment, PaymentProof, Notification, OrganizationSetting, OrganizationSubscription, OrganizationInvoice, OrganizationPayment](/Users/bolboceanu/espace/backend/prisma/schema.prisma:8374)

### Authentication
- JWT + cookie auth handled by [backend/src/security/mvp-auth.guard.ts](/Users/bolboceanu/espace/backend/src/security/mvp-auth.guard.ts)
- Active-user checks already exist
- Admin membership validation already exists
- Resident portal access status checks already exist
- Association context resolution already exists

### Roles and permissions
- Global roles are lean: `SUPERADMIN`, `ADMIN`, `RESIDENT`
- Espace also has more granular association/team roles such as `ORG_ADMIN`, `ACCOUNTANT`, `MANAGER`, `TECHNICIAN`, `OPERATOR` in Prisma enums
- Dedicated RBAC/team modules exist in [backend/src/rbac](/Users/bolboceanu/espace/backend/src/rbac) and [backend/src/team](/Users/bolboceanu/espace/backend/src/team)

### Frontend / branding
- Strong existing Espace branding is already wired into:
  - [frontend/app/layout.tsx](/Users/bolboceanu/espace/frontend/app/layout.tsx)
  - [frontend/context/BrandingContext.tsx](/Users/bolboceanu/espace/frontend/context/BrandingContext.tsx)
  - [frontend/public/manifest.webmanifest](/Users/bolboceanu/espace/frontend/public/manifest.webmanifest)
  - [frontend/app/globals.css](/Users/bolboceanu/espace/frontend/app/globals.css)
  - [frontend/messages/ro.json](/Users/bolboceanu/espace/frontend/messages/ro.json)
- Admin, resident, and superadmin surfaces are already extensive in [frontend/app](/Users/bolboceanu/espace/frontend/app)

### Existing domain coverage in Espace
Already present or meaningfully started:
- organizations / associations
- buildings + staircases + apartments
- residents / invitations / resident access
- billing drafts + invoices + payments + payment proofs
- online payments
- announcements
- issues / maintenance
- documents
- reports
- SaaS plans, subscriptions, SaaS invoices
- notifications
- audit logs
- onboarding and superadmin CRM

## 2. What SocietyPro Has That Espace Lacks Or Covers More Deeply

SocietyPro adds breadth mainly in association operations:
- explicit `tower` + `floor` CRUD as first-class modules
- owner registry as separate management surface
- tenant management as separate operational module
- parking module
- utility bills and common-area bills as distinct modules
- rent module
- amenities + bookings
- visitor management
- service provider management
- service clock-in / clock-out
- asset registry + asset issue + asset maintenance
- events
- forum / society forum
- in-app landing/content management
- richer tenant-specific settings UI surface

Relevant evidence:
- SocietyPro routes in [routes/web.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/web.php)
- models in [app/Models](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models)
- Livewire modules in [app/Livewire](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Livewire)

## 3. SocietyPro Modules Worth Adapting Into Espace

Priority modules to adapt because they complement Espace without fighting its architecture:
- owners / owner documents
- more explicit resident-owner-apartment relationships
- utility bills
- common-area bills
- parking
- visitors
- service providers
- service clock-in / clock-out
- assets / asset issues / asset maintenance
- amenities and reservations
- events
- selected reports shaped for association admins

Second-wave modules worth evaluating:
- forum, only if it fits Espace community strategy
- rent, if Espace intends to serve mixed owner/tenant rental operations
- richer society settings patterns and admin setup flows

## 4. Modules That Should Not Be Copied

These should not be ported directly from SocietyPro:
- Laravel auth stack itself: Fortify, Jetstream, Blade auth views
- Livewire components and Blade layouts as implementation units
- Froiden Envato installer / updater / purchase verification flows
- custom modules ZIP upload flow
- SocietyPro landing pages, public content management, and demo content
- SocietyPro branding, logos, favicon, public copy, support texts
- broad webhook/CSRF patterns and other known insecure implementation details

## 5. Espace Files Likely To Be Affected

### Backend
- Prisma schema and new migrations:
  - [backend/prisma/schema.prisma](/Users/bolboceanu/espace/backend/prisma/schema.prisma)
- app module registration:
  - [backend/src/app.module.ts](/Users/bolboceanu/espace/backend/src/app.module.ts)
- existing auth/security hooks if module access needs role expansion:
  - [backend/src/security/mvp-auth.guard.ts](/Users/bolboceanu/espace/backend/src/security/mvp-auth.guard.ts)
  - [backend/src/association-context](/Users/bolboceanu/espace/backend/src/association-context)
- existing organization/apartment/resident modules:
  - [backend/src/organizations](/Users/bolboceanu/espace/backend/src/organizations)
  - [backend/src/apartments](/Users/bolboceanu/espace/backend/src/apartments)
  - [backend/src/residents](/Users/bolboceanu/espace/backend/src/residents)
- billing/payments/reporting surfaces:
  - [backend/src/invoices](/Users/bolboceanu/espace/backend/src/invoices)
  - [backend/src/payments](/Users/bolboceanu/espace/backend/src/payments)
  - [backend/src/reports](/Users/bolboceanu/espace/backend/src/reports)
  - [backend/src/notifications](/Users/bolboceanu/espace/backend/src/notifications)

### Frontend
- admin navigation and routing:
  - [frontend/app/admin](/Users/bolboceanu/espace/frontend/app/admin)
  - [frontend/app/[locale]/(app)/admin](/Users/bolboceanu/espace/frontend/app/%5Blocale%5D/%28app%29/admin)
- resident navigation and routing:
  - [frontend/app/(app)/resident](/Users/bolboceanu/espace/frontend/app/%28app%29/resident)
- domain client API:
  - [frontend/lib/api.ts](/Users/bolboceanu/espace/frontend/lib/api.ts)
- branding-aware settings:
  - [frontend/context/BrandingContext.tsx](/Users/bolboceanu/espace/frontend/context/BrandingContext.tsx)
  - [frontend/app/(app)/settings/page.tsx](/Users/bolboceanu/espace/frontend/app/%28app%29/settings/page.tsx)
- dashboard pages:
  - [frontend/components](/Users/bolboceanu/espace/frontend/components)

## 6. SocietyPro Files That Are Relevant Sources

### Domain structure and CRUD patterns
- routes:
  - [routes/web.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/web.php)
- models:
  - [app/Models/ApartmentManagement.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/ApartmentManagement.php)
  - [app/Models/Tenant.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/Tenant.php)
  - [app/Models/ApartmentOwner.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/ApartmentOwner.php)
  - [app/Models/UtilityBillManagement.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/UtilityBillManagement.php)
  - [app/Models/CommonAreaBills.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/CommonAreaBills.php)
  - [app/Models/ParkingManagementSetting.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/ParkingManagementSetting.php)
  - [app/Models/Amenities.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/Amenities.php)
  - [app/Models/BookAmenity.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/BookAmenity.php)
  - [app/Models/VisitorManagement.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/VisitorManagement.php)
  - [app/Models/ServiceManagement.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/ServiceManagement.php)
  - [app/Models/ServiceClockInOut.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/ServiceClockInOut.php)
  - [app/Models/AssetManagement.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/AssetManagement.php)
  - [app/Models/AssetIssue.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/AssetIssue.php)
  - [app/Models/AssetMaintenance.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/AssetMaintenance.php)
  - [app/Models/Event.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/Event.php)
  - [app/Models/Forum.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/Forum.php)

### Controller/service references
- [app/Http/Controllers/TowerManagmentController.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/TowerManagmentController.php)
- [app/Http/Controllers/FloorManagementController.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/FloorManagementController.php)
- [app/Http/Controllers/TenantManagementController.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/TenantManagementController.php)
- [app/Http/Controllers/VisitorManagementController.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/VisitorManagementController.php)
- [app/Http/Controllers/ServiceManagementController.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/ServiceManagementController.php)
- [app/Http/Controllers/AssetsManagementController.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/AssetsManagementController.php)
- [app/Http/Controllers/TicketController.php](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/TicketController.php)

### UI workflow sources
- Livewire inventory in [app/Livewire](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Livewire)

## 7. Conflicts Between The Two Projects

### Stack conflict
- Espace is not Laravel.
- SocietyPro is Laravel 12 + Livewire 3 + Jetstream + Fortify + Sanctum + Spatie Permission.
- Direct file copy of controllers, models, policies, Blade, Livewire, routes, or migrations is not viable.

### Data-model conflict
- Espace uses `organizationId` and Prisma models.
- SocietyPro uses `society_id` and Eloquent models.
- Espace already has a dual-track structure for both resident billing and SaaS billing.
- SocietyPro stores many modules as separate CRUD islands that will need remapping into Prisma and Nest services.

### Auth conflict
- Espace auth is JWT/cookie + Nest guards.
- SocietyPro auth is Fortify/Jetstream session auth.
- Login code cannot be reused directly.

### UI conflict
- Espace uses Next App Router and brand-aware React pages.
- SocietyPro uses Blade/Livewire plus a different information architecture.
- Any copied UX must be re-expressed in Espace components.

## 8. Database Differences

### Espace
- already has `Organization`, `Building`, `Staircase`, `Apartment`, `ResidentProfile`
- already has `ResidentInvoice`, `Payment`, `PaymentProof`
- already has `Notification`, `OrganizationSetting`, `OrganizationSubscription`, `OrganizationInvoice`
- already has `MaintenanceTask` and `MaintenanceEvent`
- likely missing first-class tables for some SocietyPro features such as:
  - parking
  - amenities / bookings
  - visitors
  - service providers / service shifts
  - asset registry
  - forum
  - utility/common-area bill specific entities
  - owner documents

### SocietyPro
- models are more granular for property ops, but the schema is also more fragmented
- separate modules exist for:
  - `Tower`, `Floor`, `ApartmentManagement`
  - `Tenant`, `ApartmentOwner`
  - `UtilityBillManagement`, `CommonAreaBills`, `MaintenanceApartment`
  - `Amenities`, `BookAmenity`
  - `VisitorManagement`
  - `ServiceManagement`, `ServiceClockInOut`
  - `AssetManagement`, `AssetIssue`, `AssetMaintenance`
  - `Forum`

### Mapping implication
- Espace should add new Prisma models and migrations for missing operations, not rewrite existing billing/organization core
- New constraints must remain tenant-scoped by `organizationId`

## 9. Authentication And Role Differences

### Espace
- stronger current access flow for existing product:
  - active user check
  - membership status check
  - resident portal access state check
  - association selection context
- roles are a mix of platform roles and organization member roles

### SocietyPro
- uses role names and Spatie permission
- superadmin/admin/tenant separation is present, but authorization is more controller-centric and less consistent

### Adaptation direction
- keep Espace auth
- do not transplant Fortify callbacks
- map SocietyPro role semantics into Espace enums / member roles / permissions

## 10. Multi-Tenancy Differences

### Espace
- tenant boundary is explicit through `organizationId`
- many models already carry `organizationId`
- auth guard actively resolves organization context

### SocietyPro
- tenant boundary is mostly `society_id` with global Eloquent scope
- many exceptions bypass the scope via `withoutGlobalScope(s)`

### Adaptation direction
- keep Espace tenancy model
- when adapting SocietyPro modules, every query must be built around `organizationId`
- avoid scope-only protection patterns copied from SocietyPro

## 11. UI / Branding Differences

### Espace
- established brand:
  - `Espace`
  - custom logo slots
  - custom manifest, metadata, legal pages, support copy
  - modern app-shell and public-site structure

### SocietyPro
- own brand, public site, terms, updater/install UI, demo copy, marketplace flows

### Adaptation direction
- Espace branding must remain authoritative
- only functional flows should be adapted
- SocietyPro public UI, landing pages, and marketplace text should not surface in Espace

## 12. Technical Risks

- attempting a direct Laravel-to-Nest port would create fragile, duplicated logic
- Espace already has rich billing and superadmin modules; introducing parallel SocietyPro-style modules could create overlapping sources of truth
- apartment hierarchy mismatch:
  - SocietyPro: tower + floor
  - Espace: building + staircase + apartment.floor integer
- owner/resident modeling differs and needs careful mapping to avoid duplicate person/unit identity
- payments and invoices already exist in Espace; adapting SocietyPro financial modules must not revive dual contradictory flows

## 13. Security Risks

Known SocietyPro risks that must not be copied:
- duplicate Fortify auth callbacks
- broad CSRF exemptions
- insecure custom module ZIP flow
- weak webhook verification for several providers
- route collisions on payment callbacks
- request-time migrations
- raw HTML output from DB
- public/private file boundary problems
- SQL built by string concatenation
- scope-bypass tenancy patterns

Relevant audit reference:
- [SECURITY_AUDIT.md](/Users/bolboceanu/espace/SECURITY_AUDIT.md)

## 14. Recommended Implementation Order

### Step 0: Clean comparison boundary
- treat `adminsociety-saas/` and earlier analysis docs as unrelated local artifacts, not part of the Espace adaptation path

### Step 1: Core model gap analysis
- compare Prisma models with SocietyPro operational modules
- define exact additions for:
  - owners
  - parking
  - visitors
  - amenities/bookings
  - service providers
  - assets
  - utility/common-area billing

### Step 2: Core module adaptation into Espace
- extend existing Espace modules first:
  - organizations
  - apartments
  - residents
  - payments / invoices
  - reports
- add new modules only where Espace truly lacks them

### Step 3: UI adaptation
- create Next.js admin/resident screens in Espace style
- add nav entries only after backend endpoints exist

### Step 4: Secondary ops modules
- visitors
- amenities / bookings
- service providers / shifts
- assets
- events

### Step 5: Financial deepening
- utility bills
- common-area bills
- offline approvals and reports
- only then evaluate if more gateway logic is needed beyond current Espace

### Step 6: Rebranding verification
- scan for SocietyPro references in any adapted code
- ensure Espace metadata, logos, print docs, emails, and support copy remain intact

## Practical Recommendation

The best adaptation strategy is not "copy SocietyPro into Espace", but:
- preserve Espace auth, tenancy, SaaS billing, frontend shell, and branding
- harvest SocietyPro for missing property-management workflows
- translate those workflows into Nest services, Prisma models, Next pages, and Espace naming
- explicitly skip SocietyPro installer/updater/public-site patterns

## Immediate Next Modules To Start With

For the first real integration pass into Espace, the highest-value low-conflict modules are:
1. owners
2. resident-owner-apartment relationship refinement
3. utility/common-area billing enrichment
4. visitors
5. service providers
6. assets

## 15. Base Module Mapping Before Code

### Societies / associations
- SocietyPro source:
  - `Society`, onboarding/billing CRUD in Laravel controllers and models
- Espace existing:
  - `Organization` in [`/Users/bolboceanu/espace/backend/prisma/schema.prisma`](/Users/bolboceanu/espace/backend/prisma/schema.prisma)
  - backend surfaces in [`/Users/bolboceanu/espace/backend/src/organizations`](/Users/bolboceanu/espace/backend/src/organizations)
  - superadmin pages in [`/Users/bolboceanu/espace/frontend/app/(app)/superadmin/organizations`](/Users/bolboceanu/espace/frontend/app/%28app%29/superadmin/organizations)
- Gap:
  - no structural gap for this slice
- Action:
  - keep Espace as source of truth

### Towers / buildings
- SocietyPro source:
  - `TowerManagmentController`, tower CRUD
- Espace existing:
  - `Building` model and admin CRUD in [`/Users/bolboceanu/espace/backend/src/admin-structure`](/Users/bolboceanu/espace/backend/src/admin-structure)
  - UI in [`/Users/bolboceanu/espace/frontend/app/admin/buildings/page.tsx`](/Users/bolboceanu/espace/frontend/app/admin/buildings/page.tsx)
- Gap:
  - SocietyPro uses explicit "tower" naming; Espace uses `Building`
- Action:
  - no schema change; `Building` remains the Espace equivalent for tower/block

### Floors
- SocietyPro source:
  - `FloorManagementController`, dedicated floor CRUD
- Espace existing:
  - `Apartment.floor` integer
  - `Building.totalFloors`
  - `Staircase.floorsCount`
- Gap:
  - no standalone `Floor` table or admin screen
- Action:
  - defer dedicated floors table until there is a concrete business need; current Espace model covers MVP

### Apartments
- SocietyPro source:
  - `ApartmentManagement`
- Espace existing:
  - `Apartment` model with tenant scoping, owner relation, billing links
  - admin CRUD and CRM pages
- Gap:
  - no critical gap for this slice
- Action:
  - keep Espace implementation; do not fork schema

### Owners
- SocietyPro source:
  - `ApartmentOwner` model and owner management surface
- Espace existing:
  - `ResidentProfile.type`
  - `Apartment.ownerResidentId`
  - `ApartmentResident.role`
  - residents CRM already counts owners
- Gap:
  - missing dedicated `/admin/owners` surface and dedicated API alias
- Action:
  - implement owner module as a focused view over existing residents data

### Tenants / residents
- SocietyPro source:
  - `Tenant` and tenant management module
- Espace existing:
  - `ResidentProfile`, resident access, residents CRM, resident portal
- Gap:
  - no structural gap for MVP
- Action:
  - reuse Espace residents implementation

### Users / roles / permissions
- SocietyPro source:
  - Jetstream users + Spatie permissions
- Espace existing:
  - `User`, `OrganizationMember`, `AssociationRole`, granular permission matrix
  - admin RBAC and team modules
- Gap:
  - no need to import SocietyPro auth/RBAC code
- Action:
  - extend only if a new module needs a new permission key

### Society settings / global settings
- SocietyPro source:
  - society/global settings views and models
- Espace existing:
  - `OrganizationSetting`
  - frontend settings pages and branding hooks
- Gap:
  - no critical gap for the current base slice
- Action:
  - keep Espace settings stack

### Audit
- SocietyPro source:
  - activity logs
- Espace existing:
  - `AuditLog` and `AuditService`
  - admin/superadmin audit screens
- Gap:
  - no structural gap
- Action:
  - reuse existing audit service for any adapted module

### Dashboards
- SocietyPro source:
  - role dashboards
- Espace existing:
  - `RbacDashboardService`
  - admin/resident/superadmin dashboard pages
- Gap:
  - owner visibility is embedded, not first-class
- Action:
  - for this slice, keep existing dashboard and add dedicated owner management surface first

These complement Espace without forcing a rewrite of the current platform foundation.
