# Resident PWA Checklist

## Manifest

- `frontend/public/manifest.webmanifest` exists.
- `start_url` points to `/ro/resident`.
- `display` is `standalone`.
- `theme_color` is `#0F172A`.
- App icons exist under `frontend/public/icons`.
- Maskable icon entries are present.

## Offline

- `frontend/public/sw.js` registers a minimal service worker.
- Navigations fall back to `frontend/public/offline.html` when offline.
- `/api/*` responses are not cached.
- `POST`, `PATCH`, `PUT`, and `DELETE` requests are not intercepted.
- No invoices, payments, tokens, or user data are stored in static cache.

## Mobile UX

- Resident routes use a mobile-first shell.
- Bottom navigation is visible on mobile and respects `safe-area-inset-bottom`.
- Header respects `safe-area-inset-top`.
- Main content has enough bottom padding so the nav does not cover buttons.
- Touch targets are at least 44px for primary navigation/actions.
- Resident pages use cards on mobile instead of wide tables.

## Resident Routes

- `/ro/resident`
- `/ro/resident/invoices`
- `/ro/resident/invoices/[id]`
- `/ro/resident/payments`
- `/ro/resident/payments/[id]`
- `/ro/resident/announcements`
- `/ro/resident/requests`
- `/ro/resident/meters`
- `/ro/resident/profile`
- `/ro/resident/notifications`
- `/ro/resident/payment-intents/[id]`

## Manual Checks

- Open Chrome DevTools, switch to mobile viewport, and check bottom nav.
- Toggle offline mode and refresh a Resident route; `offline.html` should render.
- Confirm `/api/*` calls are not served from service worker cache.
- Install prompt appears on supported Android browsers after `beforeinstallprompt`.
- On iOS, the install card explains `Share -> Add to Home Screen`.
- Payment pages still say online payments are in preparation and do not imply real payment processing.
