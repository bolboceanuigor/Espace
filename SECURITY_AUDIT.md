# Security Audit

## Scope
This audit summarizes key risks found in the licensed SocietyPro SaaS project and translates them into lessons for a clean, original implementation.

## Critical Risks

### 1. Duplicate Fortify authentication callbacks
- File: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Providers/FortifyServiceProvider.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Providers/FortifyServiceProvider.php)
- Why it is a risk: `Fortify::authenticateUsing(...)` is defined twice. The later callback effectively replaces the earlier one.
- Possible impact: login checks can silently skip parts of the intended flow, especially society status and subdomain restrictions from `User::validateLoginActiveDisabled()`.
- How to avoid in the new implementation: keep one authentication pipeline only; make each rule explicit and testable; separate credential validation, tenant resolution, approval checks, and optional recaptcha checks.
- Priority: critical

### 2. Broad CSRF exclusions
- Files:
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/bootstrap/app.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/bootstrap/app.php)
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Middleware/VerifyCsrfToken.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Middleware/VerifyCsrfToken.php)
- Why it is a risk: wildcard exclusions include `custom-modules/*` and generic webhook patterns.
- Possible impact: administrative routes can become CSRFable; attacker-controlled browser sessions may trigger unsafe state changes.
- How to avoid in the new implementation: exempt only exact webhook endpoints that require third-party POSTs; never exempt admin CRUD routes.
- Priority: critical

### 3. Unsafe custom module upload / extraction flow
- Files:
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/CustomModuleController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/CustomModuleController.php)
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/web.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/web.php)
- Why it is a risk: the controller trusts `filePath`, opens ZIP archives directly, extracts content before strong validation, and the `update` route is explicitly stripped of CSRF.
- Possible impact: arbitrary file write, ZipSlip-style traversal, activation of unintended code, admin session abuse.
- How to avoid in the new implementation: avoid runtime code uploads in the main app unless strictly required; if needed, keep superadmin-only access, CSRF enabled, path allowlists, archive traversal checks, MIME and extension validation, signed install flow, and extraction into quarantined temp paths.
- Priority: critical

### 4. Weak or missing webhook signature verification
- Files:
  - Paystack admin: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/AdminPaystackController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/AdminPaystackController.php)
  - Paystack SaaS: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/SuperAdmin/PaystackWebhookController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/SuperAdmin/PaystackWebhookController.php)
  - Flutterwave admin: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/AdminFlutterwaveController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/AdminFlutterwaveController.php)
  - Flutterwave SaaS: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/SuperAdmin/FlutterwaveWebhookController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/SuperAdmin/FlutterwaveWebhookController.php)
  - PayPal admin: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/PaypalWebhookController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/PaypalWebhookController.php)
  - PayFast admin: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/AdminPayfastController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/AdminPayfastController.php)
- Why it is a risk: several webhook handlers accept payloads and mark payments successful without strong provider-side signature confirmation.
- Possible impact: forged payment confirmations, false invoice settlement, tenant access extension without valid payment.
- How to avoid in the new implementation: each provider gets its own verifier service using the official signature scheme; payment mutation happens only after signature verification and idempotency checks.
- Priority: critical

### 5. Route collisions on public payment callbacks
- File: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/web.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/web.php)
- Why it is a risk: `/success` and `/failed` are both defined twice for different providers.
- Possible impact: one route can shadow another; payment callbacks become nondeterministic.
- How to avoid in the new implementation: use unique per-provider callback paths and keep them grouped by billing domain.
- Priority: critical

### 6. Request-time migrations
- Files:
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Helper/start.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Helper/start.php)
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Providers/FortifyServiceProvider.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Providers/FortifyServiceProvider.php)
- Why it is a risk: login-page rendering can invoke migration checks and even run `migrate`.
- Possible impact: unexpected schema mutation during production traffic, race conditions, downtime, partial deploy states.
- How to avoid in the new implementation: all migrations run in deployment pipelines only, never from web requests.
- Priority: critical

## High Risks

### 7. SQL built by string concatenation
- File: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Livewire/Settings/LanguageSettings.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Livewire/Settings/LanguageSettings.php)
- Why it is a risk: raw SQL concatenates locale into the query string.
- Possible impact: future injection risk if upstream validation changes; brittle code path.
- How to avoid in the new implementation: use query builder or parameter binding only.
- Priority: high

### 8. Raw HTML output from database-backed content
- Files:
  - forum: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/livewire/forum/forum-detail.blade.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/livewire/forum/forum-detail.blade.php)
  - landing / FAQ / dynamic pages: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/landing/dynamic-index.blade.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/landing/dynamic-index.blade.php), [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/livewire/landing-site/faq-page.blade.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/livewire/landing-site/faq-page.blade.php), [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/livewire/new-custom-pages.blade.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/livewire/new-custom-pages.blade.php)
  - legal pages: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/terms.blade.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/terms.blade.php), [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/policy.blade.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/resources/views/policy.blade.php)
- Why it is a risk: raw `{!! !!}` output renders stored HTML directly.
- Possible impact: stored XSS against residents, admins, or superadmins.
- How to avoid in the new implementation: default to escaped output; only allow sanitized HTML via a strict allowlist sanitizer.
- Priority: high

### 9. Multi-tenancy is scope-based but easy to bypass
- Files:
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Traits/HasSociety.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Traits/HasSociety.php)
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Scopes/SocietyScope.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Scopes/SocietyScope.php)
  - multiple `withoutGlobalScope(s)` usages across models and Livewire flows
- Why it is a risk: tenant isolation depends heavily on an Eloquent global scope and session-cached tenant context.
- Possible impact: cross-tenant reads or writes when a query bypasses the scope or a model omits the trait.
- How to avoid in the new implementation: combine tenant-aware query services, policies, middleware, and database-level discipline; audit every privileged query path; avoid session-cached tenant truth where possible.
- Priority: high

### 10. Public and private uploads are not uniformly separated
- Files: multiple upload flows centered around `Files::uploadLocalOrS3(...)`, plus storage under `public/user-uploads`
- Why it is a risk: some files appear suitable for private delivery, but the structure encourages public asset serving.
- Possible impact: leaked payment proofs, identity documents, contracts, or resident files.
- How to avoid in the new implementation: classify every file type as public or private; store private files outside public web root; serve through signed or policy-protected routes.
- Priority: high

## Medium Risks

### 11. Version file path mismatch
- Files:
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/CustomModuleController.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Http/Controllers/CustomModuleController.php)
  - [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/Module.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/app/Models/Module.php)
  - existing file is [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/public/version.txt`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/public/version.txt)
- Why it is a risk: code reads `version.txt` from root while the file exists only under `public/`.
- Possible impact: broken module compatibility checks and inconsistent update behavior.
- How to avoid in the new implementation: keep version metadata in one config or manifest location only.
- Priority: medium

### 12. Scheduler coverage for subscription lifecycle is incomplete
- File: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/console.php`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/routes/console.php)
- Why it is a risk: commands for trial/license expiry exist but are not scheduled.
- Possible impact: stale subscription states, delayed access revocation, billing inconsistency.
- How to avoid in the new implementation: define all recurring business jobs centrally and test them.
- Priority: medium

### 13. Example environment ships with an application key
- File: [`/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/.env.example`](/private/tmp/societypro-analysis.y2MSAx/societypro-saas-1.0.75/script/.env.example)
- Why it is a risk: a sample environment includes a concrete `APP_KEY`.
- Possible impact: unsafe copy-paste deployments.
- How to avoid in the new implementation: never commit real `.env`; keep `.env.example` secret-free and generate keys per environment.
- Priority: medium

## Positive Patterns Worth Reusing Conceptually
- clear product segmentation between platform admin and association admin
- dedicated modules for billing, notices, tickets, and bookings
- explicit webhook endpoints per provider, even where verification must be improved
- role-oriented workflows that can be reimplemented cleanly with Policies and Form Requests
