# FUNCTIONALITY AUDIT (real functionality, not appearance)

Audit date: 2026-04-28  
Scope: critical modules requested for beta functional verification  
Verification method: frontend/backend code-path audit + API wiring check + `backend npm run build` + `frontend npm run build` (both successful)

> Important: statuses below are strict. `PARTIAL` means module is usable but missing required CRUD depth, missing endpoint support, or incomplete UX/error handling for full end-to-end reliability.

---

- Module name: Auth / login / role redirect
- Route: `/[locale]/login`, protected routes via middleware (`/admin`, `/resident`, `/superadmin`)
- Backend endpoint status: WORKING (`/auth/login`, `/auth/me`, `/auth/logout`, `/auth/change-password`)
- Frontend status: WORKING
- Create works: yes (register flow exists)
- Edit works: yes (change password, preferences)
- Delete works: no (not applicable for auth session; logout works)
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: none blocking in audited flow
- Fixes applied: none needed

---

- Module name: Superadmin organizations
- Route: `/[locale]/superadmin/organizations`
- Backend endpoint status: WORKING (`/api/superadmin/orgs` list/create/update)
- Frontend status: FIXED and now functional
- Create works: yes
- Edit works: yes (active/beta/demo toggles)
- Delete works: no (no delete endpoint in current API)
- API connected: yes
- Mobile ready: yes
- Status: PARTIAL
- Problems found: route previously exported subscriptions page instead of organizations module (functional mismatch)
- Fixes applied: replaced page with real organizations management UI wired to `superadminApi.listOrgs/createOrg/updateOrg`

---

- Module name: Admin buildings
- Route: `/[locale]/admin/buildings`, `/[locale]/admin/buildings/[id]`
- Backend endpoint status: WORKING (list/create/get/update/delete)
- Frontend status: PARTIAL
- Create works: yes
- Edit works: yes (building detail page supports staircase edit; building-level edit is not exposed in list page)
- Delete works: yes (building delete)
- API connected: yes
- Mobile ready: yes
- Status: PARTIAL
- Problems found: building edit action is not clearly exposed from main list; fragmented management across pages
- Fixes applied: none in this pass

---

- Module name: Admin staircases
- Route: `/[locale]/admin/staircases`, `/[locale]/admin/buildings/[id]`
- Backend endpoint status: WORKING (list/create/update/delete)
- Frontend status: FIXED
- Create works: yes (in building detail)
- Edit works: yes (in building detail)
- Delete works: yes (in building detail)
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: staircase index page used `listBuildings()` expecting embedded staircases that backend does not return
- Fixes applied: staircase page now loads buildings then fetches real staircases per building via `adminStructureApi.listStaircases`

---

- Module name: Admin apartments
- Route: `/[locale]/admin/apartments`, `/[locale]/admin/buildings/[id]`
- Backend endpoint status: WORKING (list/create/update/delete)
- Frontend status: PARTIAL
- Create works: yes (building detail page)
- Edit works: no (no full apartment edit UI found in audited pages)
- Delete works: no (no apartment delete UI found in audited pages)
- API connected: yes
- Mobile ready: yes
- Status: PARTIAL
- Problems found: apartment module page is mostly listing/filtering + reminder toggle, not full CRUD
- Fixes applied: none in this pass

---

- Module name: Admin residents
- Route: `/[locale]/admin/residents`
- Backend endpoint status: WORKING (list/create/update/delete)
- Frontend status: PARTIAL
- Create works: yes
- Edit works: partial (primary toggle supported; full profile edit fields not exposed)
- Delete works: yes
- API connected: yes
- Mobile ready: yes
- Status: PARTIAL
- Problems found: incomplete edit surface (type/phone/apartment reassignment not fully covered by UI)
- Fixes applied: none in this pass

---

- Module name: Tariffs
- Route: `/[locale]/admin/tariffs`
- Backend endpoint status: PARTIAL (rendered from reports/charges, no dedicated tariff CRUD endpoint in audited flow)
- Frontend status: PARTIAL
- Create works: no
- Edit works: no
- Delete works: no
- API connected: yes (read-only through `reportsApi.adminCharges`)
- Mobile ready: yes
- Status: PARTIAL
- Problems found: read-only view; no direct tariff CRUD
- Fixes applied: none in this pass

---

- Module name: Charges generation
- Route: `/[locale]/admin/charges`
- Backend endpoint status: PARTIAL (generation is invoice-based endpoint; no separate charge CRUD in this module)
- Frontend status: PARTIAL
- Create works: yes (generation action)
- Edit works: no
- Delete works: no
- API connected: yes
- Mobile ready: yes
- Status: PARTIAL
- Problems found: module behavior depends on invoice generation flow; missing dedicated edit/delete actions for generated charge rows
- Fixes applied: none in this pass

---

- Module name: Invoices generation
- Route: `/[locale]/admin/invoices`, `/[locale]/admin/invoices/[id]`
- Backend endpoint status: WORKING (generate/list/get/issue/regenerate/pdf/reminders)
- Frontend status: WORKING
- Create works: yes (generate monthly)
- Edit works: yes (issue/regenerate operationally update state)
- Delete works: no (not provided)
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: no delete endpoint/UI (acceptable for financial traceability)
- Fixes applied: none in this pass

---

- Module name: Manual payments
- Route: `/[locale]/admin/payments`
- Backend endpoint status: WORKING (manual create, confirm, cancel, list)
- Frontend status: WORKING
- Create works: yes
- Edit works: no (no payment amount edit; status operations available)
- Delete works: no (cancel is available and safer)
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: quick links use mixed navigation patterns; functional but inconsistent
- Fixes applied: none in this pass

---

- Module name: Resident dashboard
- Route: `/[locale]/resident`
- Backend endpoint status: WORKING (statement, invoices, announcements, issues, chat summaries)
- Frontend status: WORKING
- Create works: no (dashboard is overview)
- Edit works: no
- Delete works: no
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: none blocking in audited flow
- Fixes applied: none needed

---

- Module name: Resident payments / invoices
- Route: `/[locale]/resident/payments`, `/[locale]/resident/invoices`, `/[locale]/resident/invoices/[id]`
- Backend endpoint status: WORKING
- Frontend status: WORKING
- Create works: yes (payment intent)
- Edit works: no
- Delete works: no
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: no user-facing edit/cancel of submitted payment intents
- Fixes applied: none in this pass

---

- Module name: Avizier
- Route: `/[locale]/admin/announcements`, `/[locale]/resident/announcements`, `/[locale]/resident/announcements/[id]`
- Backend endpoint status: WORKING (admin CRUD + resident list/detail/comments)
- Frontend status: WORKING
- Create works: yes
- Edit works: yes
- Delete works: yes (admin; demo mode safely simulates)
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: none blocking in audited flow
- Fixes applied: none needed

---

- Module name: Chat
- Route: `/[locale]/admin/chat`, `/[locale]/resident/chat`
- Backend endpoint status: WORKING (support + community endpoints)
- Frontend status: WORKING
- Create works: yes (new support thread / new community channel)
- Edit works: partial (status/assignment moderation; message edit not provided)
- Delete works: yes (admin community message delete/hide)
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: polling architecture (12s) instead of realtime sockets; acceptable for beta
- Fixes applied: none in this pass

---

- Module name: Issues
- Route: `/[locale]/resident/issues`, `/[locale]/resident/issues/new`, `/[locale]/admin/issues`
- Backend endpoint status: WORKING (resident create/list/detail/comment, admin list/update/delete)
- Frontend status: PARTIAL
- Create works: yes
- Edit works: yes (admin status updates)
- Delete works: partial (admin delete endpoint exists; limited exposure in audited pages)
- API connected: yes
- Mobile ready: partial (resident issues list lacks standardized loading/error shell compared with other core pages)
- Status: PARTIAL
- Problems found: inconsistent UX/error handling compared to other core modules
- Fixes applied: none in this pass

---

- Module name: Bottom navigation
- Route: fixed mobile nav for admin/resident shells
- Backend endpoint status: N/A (frontend nav component)
- Frontend status: WORKING
- Create works: no
- Edit works: no
- Delete works: no
- API connected: yes (indirectly via page routes and auth/navigation guards)
- Mobile ready: yes
- Status: WORKING
- Problems found: none blocking; route targets resolve correctly with locale prefixing in component
- Fixes applied: none needed

---

- Module name: Account page / logout / change password
- Route: `/[locale]/admin/account`, `/[locale]/resident/account`, change-password subroutes
- Backend endpoint status: WORKING (`/auth/logout`, `/auth/change-password`, `/api/me/preferences`)
- Frontend status: WORKING
- Create works: no
- Edit works: yes (language/preferences + password)
- Delete works: no
- API connected: yes
- Mobile ready: yes
- Status: WORKING
- Problems found: none blocking in audited flow
- Fixes applied: none needed

---

## Final status snapshot

- WORKING: 10 modules
  - Auth/login/role redirect
  - Admin staircases
  - Invoices generation
  - Manual payments
  - Resident dashboard
  - Resident payments/invoices
  - Avizier
  - Chat
  - Bottom navigation
  - Account/logout/change password

- PARTIAL: 8 modules
  - Superadmin organizations
  - Admin buildings
  - Admin apartments
  - Admin residents
  - Tariffs
  - Charges generation
  - Issues

- BROKEN: 0 modules after fixes in this pass

## Build/compile check

- Backend compile: PASS (`npm run build`)
- Frontend compile: PASS (`npm run build`)
- Note: frontend has pre-existing non-blocking React hook dependency warnings; no TypeScript blocking errors.
