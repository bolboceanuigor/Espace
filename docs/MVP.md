# MVP Checklist

Scop: livrare MVP clar pentru administrarea A.P.C. din Republica Moldova, fara scope creep.

## Scope implementat acum (MVP-1)

- Auth: login real, `/me`, logout, RBAC `SUPER_ADMIN`/`ADMIN`/`RESIDENT`
- i18n: RO/RU/EN, locale in URL, language switcher, traduceri UI/form/errors
- UI: sidebar modern (icon-only + tooltip + toggle), tokens consistente, skeleton/empty states, 403/404
- Core: A.P.C., blocuri, scări, apartamente, locatari, contoare, facturi, plăți, cereri, avizier, documente
- Multi-tenant: `organizationId` pe date + izolare stricta
- Export: rapoarte CSV pentru datorii, plăți, facturi, apartamente și locatari

## Out of scope (explicit)

- Procesator real de plăți online
- Semnătură electronică
- Integrări automate cu furnizori utilități
- Vechi fluxuri de cazare/turism, rezervări, disponibilitate, check-in/check-out
- Mobile app nativ (doar responsive basic)
- Contabilitate avansată

## Final MVP Acceptance Checklist

- [ ] Login Superadmin
- [ ] Create A.P.C.
- [ ] Create Admin
- [ ] Login Admin
- [ ] Add bloc, scară, apartament
- [ ] Add locatar and link to apartament
- [ ] Add contor and citire
- [ ] Configure tarife
- [ ] Generate facturi
- [ ] Register plată
- [ ] Login Resident
- [ ] Resident sees apartment, facturi, contoare, cereri, avizier, documente
- [ ] /me
- [ ] i18n routes ok
- [ ] switch language ok
- [ ] Sidebar toggle ok
- [ ] Build passes

## Final Gate (obligatoriu)

```bash
cd frontend && npm run build
cd ../backend && npm run build
```
