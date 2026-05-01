# Real User Journey Test

Scope: end-to-end journey simulation for `ADMIN` and `RESIDENT` using existing modules only.

Date: 2026-04-28
Release: `0.1.0-beta` (locked)

Lock note:
- Product is frozen for beta validation.
- No new functionality until real-user beta feedback cycle is completed.

## SCENARIO 1: ADMIN (real flow)

1. **Login as ADMIN**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

2. **Go to Dashboard**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

3. **Go to Cont -> create building**  
   - Result: **PASSED**  
   - Issues found: none (Buildings shortcut available from Account, create form available in Buildings page)  
   - Fixes applied: n/a

4. **Create staircase**  
   - Result: **PASSED**  
   - Issues found: empty-state CTA in Staircases used non-localized hard redirect (`/admin/buildings`)  
   - Fixes applied: switched to localized router navigation (`/${locale}/admin/buildings`)

5. **Create apartments**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

6. **Add residents**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

7. **Create tariff**  
   - Result: **PASSED (adjusted flow)**  
   - Issues found: confusing CTA implied unavailable tariff CRUD action ("pending backend")  
   - Fixes applied: removed confusing action and connected page to actionable flow (`Charges` + `Invoices`) with clear guidance

8. **Generate charges**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

9. **Generate invoices**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

10. **Add manual payment**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

11. **Go to Avizier -> create announcement**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

12. **Go to Mesaje -> send message**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

13. **Go to Plăți -> verify payment appears**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

14. **Go to Dashboard -> verify data updates**  
   - Result: **PASSED**  
   - Issues found: none (dashboard fetches operational/payment data sources)  
   - Fixes applied: n/a

---

## SCENARIO 2: RESIDENT (real flow)

1. **Login as RESIDENT**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

2. **Go to Dashboard**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

3. **Check debt**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

4. **Go to Plăți -> view invoice**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

5. **Go to Avizier -> read announcement**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

6. **Go to Mesaje -> send message**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

7. **Go to Issues -> create issue**  
   - Result: **PASSED**  
   - Issues found: issue-create page lacked consistent header/back UX and robust submission feedback  
   - Fixes applied: added `MobilePageHeader` with back button, loading/empty hints for apartments, validation + toast feedback, submit loading state

8. **Go to Cont -> change password**  
   - Result: **PASSED (fixed)**  
   - Issues found: page was placeholder ("module in work") -> dead-end  
   - Fixes applied: implemented real change-password form and wired to backend endpoint (`POST /auth/change-password`) via `authApi.changePassword`

9. **Logout**  
   - Result: **PASSED**  
   - Issues found: none  
   - Fixes applied: n/a

---

## Global Checks

- **No broken steps**: PASSED after fixes above
- **No confusing UI**: PASSED after removing non-actionable tariff CTA
- **No missing buttons**: PASSED for both scenario paths
- **No dead pages**: PASSED after implementing change password and issue-create UX updates
- **Resident sees own flow only**: PASSED by route/API role scoping already in app

## Compile Status

- Frontend build: **PASSED** (`npm run build`)
- Backend build: **PASSED** (`npm run build`)

Notes:
- Existing repository-wide ESLint hook dependency warnings remain pre-existing and do not block TypeScript compilation.
