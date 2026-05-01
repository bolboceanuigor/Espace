# MVP Checklist

Scop: livrare MVP clar, fara scope creep.

## Scope implementat acum (MVP-1)

- Auth: register org + admin, login, `/me`, logout, RBAC `ADMIN`/`MANAGER`
- i18n: RO/RU/EN, locale in URL, language switcher, traduceri UI/form/errors
- UI: sidebar modern (icon-only + tooltip + toggle), tokens consistente, skeleton/empty states, 403/404
- Core: Properties CRUD, Reservations CRUD + overlap 409, calendar 40 zile sticky + lanes, create/cancel din calendar, cleanings auto + done toggle, clients CRUD minim
- Multi-tenant: `organizationId` pe date + izolare stricta
- Export: CSV reservations (plus alte exporturi disponibile)

## Out of scope (explicit)

- Payments / billing UI
- Channel sync Airbnb/Booking (doar fundatie)
- Drag&drop (post-MVP)
- Mobile app nativ (doar responsive basic)
- Advanced reporting
- Complex permissions (ramane ADMIN/MANAGER)

## Final MVP Acceptance Checklist

- [ ] Register org
- [ ] Login
- [ ] /me
- [ ] i18n routes ok
- [ ] switch language ok
- [ ] Sidebar toggle ok
- [ ] Admin creates property
- [ ] Admin creates reservation
- [ ] Overlap returns 409
- [ ] Calendar shows booking
- [ ] Manager sees assigned only
- [ ] Cleanings generated
- [ ] Export reservations CSV
- [ ] Build passes

## Final Gate (obligatoriu)

```bash
cd frontend && npm run build
cd ../backend && npm run build
```

