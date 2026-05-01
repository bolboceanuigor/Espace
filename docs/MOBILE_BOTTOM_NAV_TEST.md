# Mobile Bottom Nav Usability Test

Scope: mobile-first flow using only `Avizier`, `Plăți`, `Acasă`, `Mesaje`, `Cont`.

Date: 2026-04-28
Release: `0.1.0-beta` (locked)

Lock note:
- No new features after this checkpoint.
- Only critical bug fixes allowed.

## 1) Bottom Navigation

- PASSED - Visible on resident/admin mobile pages (`BottomNavigation` rendered in shell for both roles).
- PASSED - Active item highlighted via pathname matching.
- PASSED - Dashboard center action is visually larger (`Acasă` center item has larger height and icon).
- PASSED - Safe-area padding works on iPhone (`env(safe-area-inset-bottom)` applied in nav and page main padding).
- PASSED - Content not hidden behind nav (mobile shell bottom padding increased with safe-area formula).
- NOTES - Feedback floating button moved above safe-area/nav stack to avoid overlap.

## 2) Avizier

- PASSED - Feed load with loading and retry error state.
- PASSED - Posts open correctly to details page.
- PASSED - Pinned/urgent indicators visible in feed cards.
- PASSED - Comments flow available when enabled in announcement details.
- PASSED - Empty state available for no announcements.
- NOTES - Resident and admin feed cards include direct related shortcuts (comments/documents/maintenance/votes).

## 3) Plăți

- PASSED - Debt/payment data load with retry on errors.
- PASSED - Payment history list renders and empty state handled.
- PASSED - Invoice shortcuts (`Vezi factura`, `Vezi toate facturile`) work from resident payments.
- PASSED - Bank transfer instructions shown when no online provider is configured.
- PASSED - Admin reminders and balances shortcuts available from payments hub.

## 4) Dashboard (Acasă)

- PASSED - Main KPI/cards load for admin/resident dashboards.
- PASSED - Quick actions route to expected modules.
- PASSED - Alert/activity items open correct target pages.
- PASSED - Resident apartment selector works and selected apartment persists.
- NOTES - Resident quick launcher row added for 4 primary module jumps.

## 5) Mesaje

- PASSED - Chat list opens for community and support modes.
- PASSED - Community chat and support/admin chat switch works.
- PASSED - Sending messages supported on both resident and admin chat pages.
- PASSED - Composer remains above bottom nav due to safe-area-aware page padding.
- NOTES - Last open tab persists for both resident and admin chat.

## 6) Cont

- PASSED - Profile data loads from auth/context and related APIs.
- PASSED - Secondary module links available and open existing pages.
- PASSED - Change password page accessible and now includes back navigation.
- PASSED - Notification/language actions accessible from account actions.
- PASSED - Logout action wired in both resident and admin account pages.

## 7) Mobile Layout

- PASSED - No horizontal scroll policy enforced in app shell and main mobile pages (`overflow-x-hidden`).
- PASSED - Card layout remains intact for 1-column mobile content.
- PASSED - Tap targets in bottom navigation are >= comfortable mobile size.
- PASSED - Blank-page fallback handled with loading/error/empty states in main 5 modules.
- PASSED - Dead-end reduction: back button added on key detail/change-password flows.

## Build Verification

- PASSED - `frontend` builds successfully with TypeScript (`npm run build`).
- NOTES - Existing repo-level hook dependency ESLint warnings remain, but no TypeScript compile errors.

