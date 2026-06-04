# ESPACE_ENV_PRODUCTION_GUIDE

## 1. Ce variabile trebuie completate manual

Obligatoriu:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `RESEND_API_KEY` sau configurarea SMTP reala
- `SUPPORT_EMAIL`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_REPLY_TO`
- `COOKIE_DOMAIN`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Pentru plati, doar daca activezi providerul real:

- `BPAY_*`
- sau viitoarele `STRIPE_*`, `PAYPAL_*`, `RAZORPAY_*`, `PAYSTACK_*`, `FLUTTERWAVE_*`, `PAYFAST_*`

## 2. Ce variabile trebuie sa fie diferite pe staging si production

- `APP_URL`
- `CANONICAL_URL`
- `FRONTEND_URL`
- `API_URL`
- `CORS_ORIGIN`
- `COOKIE_DOMAIN`
- `GOOGLE_CALLBACK_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `EMAIL_FROM_ADDRESS`
- `MAIL_FROM`
- `RESEND_API_KEY`
- orice chei de plati

## 3. Ce variabile nu trebuie puse in Git

- parole DB
- `JWT_SECRET`
- toate API keys
- toate webhook secrets
- parole SMTP
- `VAPID_PRIVATE_KEY`
- orice credential provider extern

## 4. Cum verifici `APP_URL`

- trebuie sa fie domeniul canonic final: `https://www.espace.md`
- verifica manual:
  - linkurile din email
  - linkurile de reset password
  - canonical/meta links
  - redirects dupa login/logout

## 5. Cum verifici mail

- seteaza providerul real in staging
- trimite:
  - reset password
  - verify email
  - invitatie
  - notificare operationala
- confirma:
  - `from`
  - `reply-to`
  - linkuri valide
  - nu apar adrese demo

## 6. Cum verifici payments

- pastreaza `PAYMENTS_EXTERNAL_ENABLED=false` pana ai provider real verificat
- pentru primul provider:
  - configureaza sandbox
  - confirma URL-urile de success/cancel
  - confirma webhook URL
  - confirma semnatura / idempotency
  - confirma ca redirectul singur nu marcheaza plata drept reusita

## 7. Cum verifici queue / scheduler

- Espace nu foloseste acum un worker Laravel
- schedulerul ruleaza in backend Nest
- verifica:
  - `GET /api/superadmin/jobs`
  - loguri backend
  - health endpoint
  - o singura instanta backend activa pentru a evita joburi duplicate

## Variabile recomandate in productie

Actualizate in:

- [`/Users/bolboceanu/espace/.env.example`](/Users/bolboceanu/espace/.env.example)
- [`/Users/bolboceanu/espace/backend/.env.example`](/Users/bolboceanu/espace/backend/.env.example)
- [`/Users/bolboceanu/espace/frontend/.env.example`](/Users/bolboceanu/espace/frontend/.env.example)

Setari recomandate:

- `APP_NAME="Espace SaaS"`
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://www.espace.md`
- `NEXT_PUBLIC_APP_URL=https://www.espace.md`
- `NEXT_PUBLIC_API_URL=https://www.espace.md/api`
- `COOKIE_DOMAIN=.espace.md`
- `COOKIE_SECURE=true`

## Observatie importanta

Espace nu este runtime Laravel/PHP. Nu exista `php artisan config:clear`, `config:cache` sau `route:list` aplicabile aplicatiei principale.
