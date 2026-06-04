# Data Model Spec

## Scope
This is a proposed original relational model for a Laravel SaaS that manages residential associations. Names and structure are intentionally re-authored and should be implemented with fresh migrations.

## Multi-Tenancy Rules
- Every tenant-specific table must include `tenant_id`.
- Every tenant-specific foreign key should be indexed with `tenant_id`.
- Policies and query scopes must enforce `tenant_id` equality for every read/write path.
- Cross-tenant unique values should use composite uniqueness, for example `tenant_id + email` where appropriate.

## Tables

### tenants
- Purpose: root business account for each association or property organization.
- Important fields: `id`, `name`, `slug`, `status`, `approval_status`, `timezone`, `currency_code`, `locale`, `subscription_status`, `trial_ends_at`, `activated_at`.
- Relations: has many users, buildings, units, invoices, payments, settings.
- Indexes: unique `slug`, index `status`, index `subscription_status`.
- Multi-tenancy field: not needed; this is the tenant anchor.
- Security constraints: only platform roles can access all rows.

### users
- Purpose: authentication identity for platform and tenant members.
- Important fields: `id`, `tenant_id nullable`, `email`, `password_hash`, `name`, `status`, `last_login_at`, `must_reset_password`, `type`.
- Relations: belongs to tenant, many roles through assignments, many notifications, many audit logs.
- Indexes: unique `email` for platform-wide identities or composite `tenant_id,email` if per-tenant login is required, index `tenant_id,status`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: password hashed, MFA-ready fields, session invalidation support.

### roles
- Purpose: named role catalog.
- Important fields: `id`, `tenant_id nullable`, `code`, `name`, `scope`.
- Relations: many permissions, many user assignments.
- Indexes: unique `scope,code`, index `tenant_id`.
- Multi-tenancy field: `tenant_id nullable` for tenant-local roles.
- Security constraints: reserved platform roles immutable in production.

### permissions
- Purpose: permission catalog.
- Important fields: `id`, `code`, `name`, `resource`, `action`.
- Relations: many roles.
- Indexes: unique `code`.
- Multi-tenancy field: none.
- Security constraints: permission changes audited.

### role_assignments
- Purpose: user-to-role mapping.
- Important fields: `id`, `tenant_id`, `user_id`, `role_id`.
- Relations: belongs to user, role, tenant.
- Indexes: unique `tenant_id,user_id,role_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: validate role and user belong to same tenant.

### buildings
- Purpose: logical building / tower / entrance structure.
- Important fields: `id`, `tenant_id`, `name`, `code`, `address_line`, `sort_order`.
- Relations: has many floors, units, parking spots.
- Indexes: unique `tenant_id,code`, index `tenant_id,name`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: tenant-scoped CRUD only.

### floors
- Purpose: floors inside buildings.
- Important fields: `id`, `tenant_id`, `building_id`, `label`, `level_number`.
- Relations: belongs to building, has many units.
- Indexes: unique `tenant_id,building_id,level_number`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: enforce floor belongs to building in same tenant.

### units
- Purpose: apartment or commercial unit inventory.
- Important fields: `id`, `tenant_id`, `building_id`, `floor_id`, `unit_number`, `unit_type`, `area_sq_m`, `occupancy_status`, `billing_status`.
- Relations: belongs to building/floor, has many ownerships, residencies, invoices, leases.
- Indexes: unique `tenant_id,building_id,unit_number`, index `tenant_id,occupancy_status`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: all resident-facing access must resolve through authorized user-to-unit links.

### ownerships
- Purpose: owner-to-unit relationship over time.
- Important fields: `id`, `tenant_id`, `unit_id`, `user_id`, `ownership_share`, `starts_on`, `ends_on`, `is_primary`.
- Relations: belongs to unit and owner user.
- Indexes: index `tenant_id,unit_id`, index `tenant_id,user_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: prevent cross-tenant user/unit linkage.

### residencies
- Purpose: resident or tenant assignment to a unit.
- Important fields: `id`, `tenant_id`, `unit_id`, `user_id`, `relationship_type`, `starts_on`, `ends_on`, `is_primary_contact`.
- Relations: belongs to unit and resident user.
- Indexes: index `tenant_id,unit_id`, index `tenant_id,user_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: resident portal filters through active residencies only.

### leases
- Purpose: rent agreements for occupied units.
- Important fields: `id`, `tenant_id`, `unit_id`, `owner_user_id`, `resident_user_id`, `rent_amount`, `deposit_amount`, `billing_day`, `starts_on`, `ends_on`, `status`.
- Relations: belongs to unit, owner, resident.
- Indexes: index `tenant_id,status`, index `tenant_id,unit_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: only tenant admins and authorized parties may view financial terms.

### parking_spots
- Purpose: parking inventory.
- Important fields: `id`, `tenant_id`, `building_id`, `label`, `spot_type`, `status`.
- Relations: belongs to building, has many parking assignments.
- Indexes: unique `tenant_id,building_id,label`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: tenant-scoped only.

### parking_assignments
- Purpose: map parking spots to units or users.
- Important fields: `id`, `tenant_id`, `parking_spot_id`, `unit_id nullable`, `user_id nullable`, `starts_on`, `ends_on`.
- Relations: belongs to parking spot, optionally unit/user.
- Indexes: index `tenant_id,parking_spot_id`, index `tenant_id,user_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: same-tenant referential checks.

### charge_batches
- Purpose: monthly or ad hoc batch for maintenance / shared cost generation.
- Important fields: `id`, `tenant_id`, `period_start`, `period_end`, `charge_type`, `status`, `created_by`.
- Relations: has many invoices or invoice lines.
- Indexes: index `tenant_id,charge_type,status`, index `tenant_id,period_start`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: immutable or revision-logged after publishing.

### invoices
- Purpose: resident-facing payable documents.
- Important fields: `id`, `tenant_id`, `unit_id`, `bill_to_user_id`, `batch_id nullable`, `invoice_number`, `category`, `status`, `currency_code`, `issued_at`, `due_at`, `subtotal`, `discount_total`, `tax_total`, `total_amount`, `balance_due`.
- Relations: belongs to unit, user, batch; has many invoice lines and payments.
- Indexes: unique `tenant_id,invoice_number`, index `tenant_id,status,due_at`, index `tenant_id,bill_to_user_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: resident access only to assigned invoices.

### invoice_lines
- Purpose: line items on invoices.
- Important fields: `id`, `tenant_id`, `invoice_id`, `line_type`, `description`, `quantity`, `unit_amount`, `line_total`, `meta json`.
- Relations: belongs to invoice.
- Indexes: index `tenant_id,invoice_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: write only via billing services.

### payments
- Purpose: accepted payment ledger.
- Important fields: `id`, `tenant_id`, `invoice_id nullable`, `payer_user_id`, `amount`, `currency_code`, `method`, `status`, `provider`, `provider_reference`, `received_at`, `recorded_by`.
- Relations: belongs to invoice, payer user; has many payment allocations if partials are supported.
- Indexes: unique nullable `provider,provider_reference`, index `tenant_id,status,received_at`, index `tenant_id,payer_user_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: status transitions audited and idempotent.

### payment_proofs
- Purpose: uploaded evidence for offline or bank transfer payments.
- Important fields: `id`, `tenant_id`, `invoice_id`, `submitted_by`, `file_id`, `status`, `reviewed_by nullable`, `reviewed_at nullable`, `notes`.
- Relations: belongs to invoice, user, file.
- Indexes: index `tenant_id,status`, index `tenant_id,invoice_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: file served via authorized private route.

### subscriptions
- Purpose: SaaS subscription record per tenant.
- Important fields: `id`, `tenant_id`, `package_id`, `status`, `billing_cycle`, `trial_ends_at`, `current_period_start`, `current_period_end`, `provider`, `provider_customer_ref`, `provider_subscription_ref`.
- Relations: belongs to tenant and package, has many subscription invoices.
- Indexes: index `tenant_id,status`, unique nullable `provider,provider_subscription_ref`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: platform-managed writes only.

### packages
- Purpose: SaaS plan catalog.
- Important fields: `id`, `code`, `name`, `price_monthly`, `price_annual`, `limits json`, `features json`, `status`.
- Relations: has many subscriptions.
- Indexes: unique `code`, index `status`.
- Multi-tenancy field: none.
- Security constraints: platform-only management.

### amenities
- Purpose: shared facilities that can be booked.
- Important fields: `id`, `tenant_id`, `name`, `booking_mode`, `capacity`, `fee_type`, `fee_amount`, `status`.
- Relations: has many bookings.
- Indexes: index `tenant_id,status`, unique `tenant_id,name`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: rules enforced in booking service.

### bookings
- Purpose: amenity reservations.
- Important fields: `id`, `tenant_id`, `amenity_id`, `requested_by`, `unit_id`, `starts_at`, `ends_at`, `status`, `approval_notes`.
- Relations: belongs to amenity, user, unit.
- Indexes: index `tenant_id,amenity_id,starts_at`, index `tenant_id,requested_by`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: overlap checks, policy checks, audit on approval.

### visitors
- Purpose: visitor access requests and logs.
- Important fields: `id`, `tenant_id`, `host_user_id`, `unit_id`, `name`, `contact_phone`, `vehicle_plate`, `scheduled_for`, `status`, `approved_by`.
- Relations: belongs to host user and unit.
- Indexes: index `tenant_id,status,scheduled_for`, index `tenant_id,unit_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: PII minimization and retention policy.

### tickets
- Purpose: support and operational issues.
- Important fields: `id`, `tenant_id`, `requester_user_id`, `unit_id nullable`, `category`, `priority`, `status`, `subject`, `description_sanitized`, `assigned_to nullable`, `opened_at`, `resolved_at`.
- Relations: belongs to requester, assignee, unit; has many ticket messages and attachments.
- Indexes: index `tenant_id,status,priority`, index `tenant_id,assigned_to`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: sanitize rich text, enforce staff visibility rules.

### ticket_messages
- Purpose: threaded communication inside a ticket.
- Important fields: `id`, `tenant_id`, `ticket_id`, `author_user_id`, `body_sanitized`, `is_internal`, `created_at`.
- Relations: belongs to ticket and author.
- Indexes: index `tenant_id,ticket_id,created_at`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: internal notes hidden from resident roles.

### announcements
- Purpose: notices sent to residents or specific groups.
- Important fields: `id`, `tenant_id`, `title`, `body_sanitized`, `audience_scope`, `published_at`, `expires_at`, `created_by`, `status`.
- Relations: belongs to creator; may have audience pivot tables.
- Indexes: index `tenant_id,status,published_at`, index `tenant_id,audience_scope`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: sanitize HTML and enforce audience targeting.

### service_providers
- Purpose: internal staff or external vendors.
- Important fields: `id`, `tenant_id`, `name`, `provider_type`, `contact_name`, `contact_phone`, `email`, `status`.
- Relations: has many service tasks, contracts, invoices.
- Indexes: index `tenant_id,status`, unique nullable `tenant_id,email`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: scoped vendor visibility.

### service_tasks
- Purpose: work orders or scheduled service actions.
- Important fields: `id`, `tenant_id`, `service_provider_id`, `unit_id nullable`, `asset_id nullable`, `ticket_id nullable`, `title`, `status`, `scheduled_for`, `completed_at`.
- Relations: belongs to provider, unit, asset, ticket.
- Indexes: index `tenant_id,status,scheduled_for`, index `tenant_id,service_provider_id`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: only assigned staff can update task state.

### assets
- Purpose: common-area assets and equipment inventory.
- Important fields: `id`, `tenant_id`, `asset_code`, `name`, `category`, `location`, `status`, `purchase_date`, `warranty_expires_at`.
- Relations: has many asset issues and maintenance logs.
- Indexes: unique `tenant_id,asset_code`, index `tenant_id,status`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: tenant-scoped access only.

### asset_events
- Purpose: asset incidents, repairs, and preventive maintenance history.
- Important fields: `id`, `tenant_id`, `asset_id`, `event_type`, `status`, `notes_sanitized`, `reported_by`, `assigned_to`, `occurred_at`.
- Relations: belongs to asset and users.
- Indexes: index `tenant_id,asset_id,occurred_at`, index `tenant_id,status`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: change history preserved.

### tenant_settings
- Purpose: association-specific configuration.
- Important fields: `id`, `tenant_id`, `group_key`, `settings json`.
- Relations: belongs to tenant.
- Indexes: unique `tenant_id,group_key`.
- Multi-tenancy field: `tenant_id`.
- Security constraints: only allowed setting groups editable by tenant admins.

### platform_settings
- Purpose: global SaaS configuration.
- Important fields: `id`, `group_key`, `settings json`.
- Relations: none.
- Indexes: unique `group_key`.
- Multi-tenancy field: none.
- Security constraints: platform-only access.

### stored_files
- Purpose: managed file metadata for private/public assets.
- Important fields: `id`, `tenant_id nullable`, `disk`, `path`, `visibility`, `mime_type`, `extension`, `size_bytes`, `uploaded_by`, `sha256`.
- Relations: polymorphic use from payment proofs, tickets, documents, notices.
- Indexes: unique `disk,path`, index `tenant_id,visibility`, index `sha256`.
- Multi-tenancy field: `tenant_id nullable`.
- Security constraints: allowlist by module, signed or authorized delivery for private files.

### notifications
- Purpose: in-app delivery log.
- Important fields: `id`, `tenant_id nullable`, `user_id`, `type`, `title`, `body`, `data json`, `read_at`.
- Relations: belongs to user.
- Indexes: index `user_id,read_at`, index `tenant_id,type`.
- Multi-tenancy field: `tenant_id nullable`.
- Security constraints: user can read only own rows.

### audit_logs
- Purpose: tamper-evident trail of sensitive actions.
- Important fields: `id`, `tenant_id nullable`, `actor_user_id nullable`, `action`, `entity_type`, `entity_id`, `before json`, `after json`, `ip_address`, `user_agent`, `created_at`.
- Relations: belongs to actor user optionally.
- Indexes: index `tenant_id,entity_type,entity_id`, index `actor_user_id,created_at`, index `action`.
- Multi-tenancy field: `tenant_id nullable`.
- Security constraints: append-only, visible only to privileged roles.

## Security Implementation Notes
- Use Laravel Policies, not role-name checks in Blade only.
- Add tenant-aware global scopes carefully, but keep explicit repository / query service filters for sensitive reads.
- For every request that mutates financial data, use database transactions and idempotency guards.
- For every tenant-facing query, prove tenant ownership through joins or explicit filters.
