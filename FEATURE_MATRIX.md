# Feature Matrix

## Scope
This matrix defines the target capabilities for a new original SaaS, based on functional analysis of the licensed reference product.

## Roles
- `SA` Super Admin
- `SUP` Platform Support / Ops
- `AA` Association Admin
- `AS` Association Staff
- `OW` Owner
- `RS` Resident / Tenant
- `SS` Service Staff
- `VG` Visitor / Guest

## Module Access Matrix

| Module | SA | SUP | AA | AS | OW | RS | SS | VG |
|---|---|---|---|---|---|---|---|---|
| Associations / Tenants | CRUD | R/U | R | - | - | - | - | - |
| Plans / Packages | CRUD | R | - | - | - | - | - | - |
| SaaS Subscriptions | CRUD | R/U | R | - | - | - | - | - |
| Global Settings | CRUD | R/U | - | - | - | - | - | - |
| Association Settings | R | R | CRUD | U limited | R limited | R limited | - | - |
| Buildings / Towers | R | - | CRUD | CRUD | R | R | R | - |
| Floors | R | - | CRUD | CRUD | R | R | R | - |
| Apartments / Units | R | - | CRUD | CRUD | R own | R own | R assigned | - |
| Owners | R | - | CRUD | CRUD | R self | - | - | - |
| Residents | R | - | CRUD | CRUD | R occupants | R self | - | - |
| Leases / Rents | R | - | CRUD | CRUD | R own | R self | - | - |
| Parking | R | - | CRUD | CRUD | R own | R assigned | - | - |
| Maintenance Charges | R | - | CRUD | CRUD | R own | R self | - | - |
| Utility Bills | R | - | CRUD | CRUD | R own | R self | - | - |
| Invoices | R | - | CRUD | CRUD | R own | R self | - | - |
| Payments | R | - | CRUD | CRUD | R own | R self | - | - |
| Offline Payment Proofs | R | - | CRUD review | CRUD review | C/R own | C/R own | - | - |
| Payment Gateways | CRUD | R | CRUD | - | - | - | - | - |
| Amenities | R | - | CRUD | CRUD | R | R | - | - |
| Bookings | R | - | CRUD | CRUD | CRUD own | CRUD own | - | limited |
| Visitors | R | - | CRUD | CRUD | CRUD own | CRUD own | R assigned | C limited |
| Announcements | R | - | CRUD | CRUD | R | R | R | - |
| Tickets | R | - | CRUD | CRUD | CRUD own | CRUD own | CRUD assigned | - |
| Service Providers | R | - | CRUD | CRUD | - | - | R self | - |
| Assets | R | - | CRUD | CRUD | R limited | R limited | CRUD assigned | - |
| Asset Issues / Maintenance | R | - | CRUD | CRUD | C/R limited | C/R limited | CRUD assigned | - |
| Events | R | - | CRUD | CRUD | R / RSVP | R / RSVP | R | - |
| Forum | R | - | CRUD moderation | CRUD moderation | CRUD own | CRUD own | R | - |
| Notifications | R | - | CRUD templates / triggers | R | R own | R own | R own | limited |
| Reports | CRUD | R | CRUD | R | R own | R own | R assigned | - |
| Audit Logs | CRUD | R | R limited | - | - | - | - | - |
| Public Website / Landing | CRUD | R | - | - | - | - | - | R |

## CRUD Expectations By Module

### Super Admin
- manage tenant accounts, plans, trials, billing status, support actions
- configure global payment providers, legal pages, public site, feature flags
- view cross-tenant operational and financial reports

### Association Admin
- full CRUD on operational data inside one tenant boundary
- approve or reject resident financial proofs, visitors, bookings, and staff assignments
- configure association-specific rules, branding, and billing

### Association Staff
- operational CRUD only where delegated
- no access to platform billing or unrelated financial settings

### Owner
- read own units, invoices, balances, announcements, bookings
- create support tickets, booking requests, visitor requests
- limited profile and household updates

### Resident / Tenant
- similar to Owner, but scoped to assigned residency or lease
- no access to ownership administration

### Service Staff
- read assigned tasks and related units
- update task status, work notes, time logs, and issue resolution

### Visitor / Guest
- very limited create/read flows
- example: submit registration token, confirm visit, receive approval result

## Recommended Permission Domains
- `tenant.manage`
- `tenant.billing.manage`
- `tenant.settings.manage`
- `unit.manage`
- `resident.manage`
- `owner.manage`
- `rent.manage`
- `maintenance.manage`
- `invoice.manage`
- `payment.review`
- `payment.gateway.manage`
- `booking.manage`
- `visitor.manage`
- `announcement.manage`
- `ticket.manage`
- `service.manage`
- `asset.manage`
- `event.manage`
- `forum.moderate`
- `report.view`
- `audit.view`
- `subscription.manage`
- `platform.admin`

## Module Activation Strategy
- Always-on core
  - associations
  - units
  - users / roles
  - billing core
  - notices
  - tickets
- Optional modules
  - forum
  - events
  - amenities / bookings
  - visitor management
  - parking
  - asset management
  - service clock / contractor workflows
  - advanced reports

## Recommended MVP For A New SaaS
- tenant onboarding
- association setup
- users / roles / policies
- apartments / residents / owners
- billing and invoices
- payment proofs
- resident balance view
- notices
- tickets
- subscriptions and SaaS billing

## Recommended Post-MVP Modules
- amenities and bookings
- visitors
- forum
- events
- asset lifecycle
- advanced service provider workflows
