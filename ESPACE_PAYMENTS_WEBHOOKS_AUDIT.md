# Espace Payments & Webhooks Audit

Date: 2026-06-03

## 1. Gateway-uri verificate

- `MANUAL_TEST` (activ in `online-payments`)
- `BPAY` (skeleton/config preset, fara webhook activ)
- `MAIB` / `PAYNET` / `OPLATA` (doar legacy placeholders in modulul vechi `payments`)
- `STRIPE` (apare doar in enum `OnlinePaymentProviderType`, fara integrare runtime)
- `PayPal` / `Razorpay` / `Paystack` / `Flutterwave` / `Payfast` (nu exista integrare activa in codul Espace auditata in acest pas)
- `offline payments` prin `payment proofs` si aprobare admin

## 2. Probleme gasite

### Critice

- Endpointul nou [`/Users/bolboceanu/espace/backend/src/online-payments/online-payments.controller.ts`](/Users/bolboceanu/espace/backend/src/online-payments/online-payments.controller.ts) accepta webhook-uri pe ruta exacta `POST /api/payments/webhooks/:providerType`, dar logica din [`/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts`](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts) nu impunea suficient:
  - semnatura obligatorie;
  - `providerEventId` obligatoriu;
  - idempotency reala pe eveniment;
  - verificare `paymentIntentId` + provider match;
  - blocarea providerilor fara implementare activa.

### Mari

- Flow-ul legacy din [`/Users/bolboceanu/espace/backend/src/payments/payments.service.ts`](/Users/bolboceanu/espace/backend/src/payments/payments.service.ts) avea o metoda `webhook()` mai permisiva decat controllerul actual. Ruta este deja dezactivata in [`/Users/bolboceanu/espace/backend/src/payments/payments.controller.ts`](/Users/bolboceanu/espace/backend/src/payments/payments.controller.ts), dar service-ul merita hardening ca sa nu ramana reutilizabil gresit.

### Observatii importante

- Nu exista rute generice `/success` sau `/failed` care sa marcheze plati ca reusite.
- Redirectul de success din modulul nou nu confirma bani; confirmarea ramane separata de webhook.
- Offline payment in Espace este deja `pending -> admin review -> accepted` prin `payment proofs`.
- Aplicatia nu este Laravel; nu exista `VerifyCsrfToken` sau wildcard-uri de exceptie CSRF de tip SocietyPro. Pentru webhook-uri exista doar ruta exacta NestJS.

## 3. Patch-uri aplicate

### Webhook hardening

Fisier: [`/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts`](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts)

- am limitat procesarea webhook la provideri implementati explicit (`MANUAL_TEST` in starea curenta);
- am cerut `providerEventId` obligatoriu;
- am adaugat idempotency prin cautare `PaymentWebhookEvent` pe `{ providerType, providerEventId }`;
- am respins cererile fara semnatura sau cu semnatura invalida;
- am verificat secretul din env `PAYMENTS_MANUAL_TEST_WEBHOOK_SECRET`;
- am verificat `paymentIntentId` obligatoriu si existenta intentului;
- am verificat ca `intent.providerType` sa corespunda providerului care trimite webhook-ul;
- pentru webhook valid am actualizat doar `PaymentIntent`, nu am creat `Payment` si nu am marcat nicio factura/subscriptie ca achitata;
- am inregistrat evenimentul in `payment_webhook_events` cu `headers` mascate si fara secrete in logs.

### Legacy webhook hardening

Fisier: [`/Users/bolboceanu/espace/backend/src/payments/payments.service.ts`](/Users/bolboceanu/espace/backend/src/payments/payments.service.ts)

- am blocat `webhook()` daca `PAYMENTS_EXTERNAL_ENABLED=false`;
- am respins provideri non-externi;
- am verificat intent/provider match inainte de orice procesare.

### Config explicit pentru secret de test

Fisier: [`/Users/bolboceanu/espace/backend/.env.example`](/Users/bolboceanu/espace/backend/.env.example)

- adaugat `PAYMENTS_MANUAL_TEST_WEBHOOK_SECRET=""`.

## 4. Rute finale

### Active

- `POST /api/payments/webhooks/:providerType`
  - controller: [`/Users/bolboceanu/espace/backend/src/online-payments/online-payments.controller.ts`](/Users/bolboceanu/espace/backend/src/online-payments/online-payments.controller.ts)
  - service: [`/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts`](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.ts)
  - comportament curent:
    - accepta doar `MANUAL_TEST` ca implementare webhook activa;
    - providerii externi neimplementati sunt respinsi;
    - nu settle-uieste bani.

### Legacy, dar dezactivate cu 410

- `POST /api/payments/webhook/:provider`
  - controller: [`/Users/bolboceanu/espace/backend/src/payments/payments.controller.ts`](/Users/bolboceanu/espace/backend/src/payments/payments.controller.ts)
  - raspuns: `GoneException`

### Fara confirmare de plata prin redirect

- nu exista endpointuri backend generice `/success` sau `/failed` care sa marcheze plati ca `paid`.

## 5. CSRF exceptions finale

- `N/A` pentru modelul Laravel clasic:
  - Espace nu foloseste `bootstrap/app.php` sau `VerifyCsrfToken`.
  - Nu exista wildcard-uri de exceptie CSRF pentru plati.
  - Singurul endpoint relevant este ruta exacta `POST /api/payments/webhooks/:providerType`.

## 6. Teste adaugate

### Noi

- [`/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.spec.ts`](/Users/bolboceanu/espace/backend/src/online-payments/payment-provider.service.spec.ts)
  - webhook fara semnatura -> respins
  - webhook valid `MANUAL_TEST` -> acceptat
  - webhook duplicat -> ignorat
  - provider fara implementare activa -> respins

- [`/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.spec.ts`](/Users/bolboceanu/espace/backend/src/invoice-publishing/invoice-publishing.service.spec.ts)
  - offline payment proof ramane `SUBMITTED` pana la review admin
  - aprobarea admin creeaza `Payment` cu `PaymentSource.PAYMENT_PROOF` si actualizeaza dovada

### Rulate

- `npm --prefix backend run test -- --runInBand src/online-payments/payment-provider.service.spec.ts`
- `npm --prefix backend run test -- --runInBand src/invoice-publishing/invoice-publishing.service.spec.ts`
- `npm run test`
- `npm run check`

Toate au trecut. `npm run check` a ramas cu warning-uri frontend existente `react-hooks/exhaustive-deps` in paginile superadmin, fara a bloca build-ul.

## 7. Ce trebuie testat in sandbox real

- webhook real pentru providerul care va fi integrat primul (de ex. `BPAY` sau `Stripe`) cu:
  - semnatura oficiala provider;
  - replay webhook;
  - dublare eveniment;
  - fake success request fara semnatura;
  - success redirect fara webhook;
  - mismatch intre `providerType` si `paymentIntent.providerType`.
- mapping complet spre:
  - invoice paid / partial / failed;
  - subscription update, daca providerul va fi folosit pentru SaaS billing;
  - reconciliere receipt / ledger.
- logs operationale:
  - webhook failed count;
  - duplicate webhook count;
  - masked headers si fara secrete in persistence/logs.

## Concluzie

- `offline payments`: flow-ul Espace este corect pentru pilot, cu review admin inainte de creare `Payment`.
- `online/webhooks`: acum sunt suficient de inchise ca sa nu marcheze plati ca successful fara confirmare valida in implementarea curenta.
- `live gateways`: inca nu sunt gata pentru productie. Stripe/PayPal/Razorpay/Paystack/Flutterwave/Payfast nu au integrare runtime activa in Espace la momentul acestui audit.
