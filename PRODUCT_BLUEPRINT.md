# Product Blueprint

## Scope
This document captures product requirements inferred from the licensed SocietyPro SaaS codebase, rewritten in original language for a separate SaaS implementation. It is a functional blueprint, not a code port.

## Problem The Product Solves
Residential associations and property operators often run core workflows across spreadsheets, chat apps, paper notices, bank statements, and ad hoc accounting tools. A dedicated SaaS should centralize resident records, apartments, recurring charges, maintenance, announcements, visitor access, service tasks, and subscription billing for each association.

## Primary Users
- Platform operator: manages the SaaS business, plans, billing, support, and tenant onboarding.
- Association admin: manages one association's residents, apartments, billing, notices, tickets, and settings.
- Owner / property owner: views units, balances, invoices, notices, bookings, and documents tied to owned apartments.
- Resident / tenant: views assigned unit data, invoices, balance, notices, visits, bookings, and support tickets.
- Service staff: handles assigned maintenance, cleaning, security, or technical work.
- Visitor / guest: may receive temporary access, booking confirmation, or check-in approval through controlled public flows.

## Role Model
- Super Admin
- Support / Ops Admin
- Association Admin
- Association Staff
- Owner
- Resident / Tenant
- Service Provider / Contractor
- Visitor (limited or temporary identity)

## Core Product Modules
- Multi-tenant association management
- Buildings / towers / entrances
- Floors
- Apartments / units
- Ownership and resident registry
- Parking allocation
- Utility and maintenance billing
- Rent and lease tracking
- Shared invoices and payment ledger
- Payment proofs and offline reconciliation
- Online payment gateways
- Amenities and reservations
- Visitor registration and approvals
- Announcements / notice board
- Tickets / support requests
- Service providers and work logs
- Asset registry and maintenance history
- Events and attendance
- Community forum / discussion boards
- SaaS subscriptions and package plans
- Global settings and tenant settings
- Public website / landing pages
- Notifications: email, in-app, web push

## Primary Business Flows
### Platform flows
- Public lead submits access request
- Super Admin reviews request and creates a new association
- Initial admin user is created or invited
- Association is assigned a plan, trial, or paid subscription
- Webhooks confirm recurring billing and renew access

### Association setup flows
- Admin creates towers, floors, apartments, and parking spots
- Admin adds owners, residents, family members, and documents
- Admin configures bill types, utility settings, branding, notifications, and storage
- Admin completes onboarding checklist

### Financial flows
- Admin generates monthly maintenance and utility charges
- Admin publishes invoices or charges to units / residents
- Resident sees the same financial position as admin
- Resident pays online or uploads proof for manual review
- Admin accepts, rejects, or partially reconciles the payment
- Ledger, invoice status, and resident balance stay in sync

### Resident experience flows
- Resident logs in securely under the correct association
- Resident views dashboard, notices, balance, invoices, payments, bookings, and tickets
- Resident books amenities, registers visitors, replies to tickets, and reads announcements

### Operations flows
- Service staff receives tasks or ticket assignments
- Staff logs work, clock-in/out, and issue resolution
- Admin monitors asset issues, maintenance schedules, and contractor actions

## Business Entities
- Association / society / tenant account
- User
- Role
- Permission
- Building / tower
- Floor
- Apartment / unit
- Ownership record
- Resident assignment
- Lease / rent agreement
- Parking spot and allocation
- Bill type
- Charge / maintenance batch
- Utility bill
- Shared area invoice
- Resident invoice
- Payment
- Payment proof
- Payment gateway credential
- Offline payment method
- Subscription
- Package / plan
- Amenity
- Booking
- Visitor
- Announcement
- Ticket
- Ticket reply / attachment
- Service provider
- Service task / clock log
- Asset
- Asset issue / maintenance event
- Event / attendance
- Forum category / thread / reply
- Notification
- Email / push / web settings
- Audit log

## Dashboards Needed
- Super Admin dashboard
  - total associations
  - paid vs trial vs expired accounts
  - MRR / renewals / failed payments
  - open onboarding requests
  - support and operational alerts
- Association Admin dashboard
  - occupancy summary
  - unpaid balances
  - invoices due soon
  - open tickets
  - visitors expected today
  - current bookings
  - recent notices and actions
- Owner / Resident dashboard
  - current balance
  - active invoices
  - payment history
  - recent announcements
  - active tickets
  - upcoming bookings / events
- Service Staff dashboard
  - assigned tickets
  - due maintenance tasks
  - clock status
  - overdue work

## Reports Needed
- Accounts receivable by association, building, unit, resident
- Monthly charge generation summary
- Payment collection report
- Outstanding balance aging
- Occupancy and unit allocation report
- Visitor logs
- Amenity usage and booking report
- Asset maintenance history
- Service performance / SLA report
- Subscription and billing report for the SaaS operator
- Audit and access history report

## Notifications Needed
- Welcome / invite / password setup
- Approval and account status changes
- New invoice published
- Payment received / proof accepted / proof rejected
- Booking approved / rejected / upcoming
- Visitor approved / denied / arriving
- New announcement
- Ticket created / assigned / replied / resolved
- Subscription renewal / payment failed / trial ending
- Security alerts: suspicious login, forced logout, webhook failure, storage failure

## Payments And Subscriptions Needed
- Trial plans
- Paid monthly and annual subscriptions
- Optional lifetime or enterprise plans
- Gateway-specific webhook confirmation
- Offline billing approvals
- Invoice and receipt generation
- Failed payment recovery and dunning basics
- Plan upgrade / downgrade / renewal logic

## Global Settings Needed
- SaaS branding
- supported locales and timezones
- payment gateway credentials
- mail settings
- queue and storage settings
- notification defaults
- feature flags / module toggles
- support and legal pages
- public site content
- security defaults

## Per-Association Settings Needed
- association profile and branding
- currency and formatting
- enabled modules
- payment methods
- billing rules and bill types
- resident portal settings
- forum / notice / visitor rules
- amenity booking rules
- storage preferences
- notification preferences
- role mappings and staff assignments

## Non-Functional Requirements For The New SaaS
- strict tenant isolation
- original UI and copy
- audited webhook verification
- no request-time migrations
- private file serving through authorization
- policy-driven authorization
- strong audit trail for billing and admin actions
