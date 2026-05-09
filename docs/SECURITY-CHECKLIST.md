# Espace Security Checklist

Checklist pentru verificarea finală a accesului pe roluri și a izolării datelor între A.P.C.-uri.

## Principii

- SUPERADMIN poate gestiona toate A.P.C.-urile.
- ADMIN poate gestiona doar datele propriei A.P.C.
- RESIDENT poate vedea doar datele propriului apartament și documentele publice ale A.P.C.-ului său.
- Nu se expun `passwordHash`, chei API, `JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL` sau service role keys.
- Datele demo nu trebuie să fie accesibile ca sesiune protejată decât dacă demo mode este activat explicit prin env.

## A. Superadmin

- Autentificare ca SUPERADMIN.
- Acces la `/ro/superadmin`.
- Acces la lista completă de A.P.C.-uri din `/ro/superadmin/organizations`.
- Creare A.P.C. nouă cu format `A0123-0940`.
- Creare ADMIN pentru A.P.C.
- Acces la `/ro/superadmin/workbench` sau `/api/superadmin/workbench`.
- Răspunsurile nu includ `passwordHash` sau secrete.

## B. Admin

- Autentificare ca ADMIN.
- Acces la `/ro/admin`.
- Acces la apartamente, locatari, contoare, facturi, plăți, cereri, avizier, documente și rapoarte doar pentru A.P.C.-ul propriu.
- Încercare acces `/ro/superadmin` redirecționează spre `/ro/admin`.
- Cerere către endpoint superadmin cu token ADMIN returnează 403.
- Schimbarea manuală a `organizationId` sau `x-org-id` nu oferă acces la alt A.P.C.
- Endpointurile admin folosesc organizația din utilizatorul autentificat.

## C. Resident

- Autentificare ca RESIDENT.
- Acces la `/ro/resident`.
- Încercare acces `/ro/admin` redirecționează spre `/ro/resident`.
- Încercare acces `/ro/superadmin` redirecționează spre `/ro/resident`.
- Facturile, plățile, contoarele și cererile afișate aparțin doar apartamentului conectat la cont.
- Încercarea de a deschide factura altui apartament returnează 404 sau 403.
- Documentele afișate sunt doar `RESIDENT_VISIBLE`.
- Notele interne, sarcinile CRM și documentele admin-only nu apar în portal.

## D. API

- Fără token pe endpoint protejat: 401 cu `Trebuie să te autentifici.`
- Token expirat sau invalid: 401 cu `Sesiunea a expirat. Te rugăm să te autentifici din nou.`
- RESIDENT pe endpoint admin: 403 cu `Nu ai acces la această zonă.`
- ADMIN pe endpoint superadmin: 403 cu `Nu ai acces la această zonă.`
- ID inexistent sau inaccesibil: 404 cu `Înregistrarea nu a fost găsită.`
- Erorile Prisma nu apar brut în răspunsuri.
- `/health` și `/health/db` nu expun secrete sau URL-uri de bază de date.

## E. Frontend

- Fără sesiune reală pe rute protejate: redirect la `/ro/login`.
- Rol greșit: redirect la dashboard-ul rolului corect.
- La verificarea sesiunii se afișează `Se verifică sesiunea...`, fără pagină goală.
- 401 curăță sesiunea locală și redirecționează la login.
- 403/404/500/network afișează mesaje prietenoase în română, fără stack trace.
- `NEXT_PUBLIC_API_URL` este folosit pentru API; nu există URL Render sau localhost hardcodat în fluxurile reale.

## F. Smoke API Manual

Folosește tokenuri reale pentru fiecare rol:

```bash
curl -i https://espace-ru41.onrender.com/health
curl -i https://espace-ru41.onrender.com/health/db
curl -i https://espace-ru41.onrender.com/api/admin/workbench
curl -i -H "Authorization: Bearer <ADMIN_TOKEN>" https://espace-ru41.onrender.com/api/superadmin/workbench
curl -i -H "Authorization: Bearer <RESIDENT_TOKEN>" https://espace-ru41.onrender.com/api/admin/workbench
curl -i -H "Authorization: Bearer <RESIDENT_TOKEN>" https://espace-ru41.onrender.com/api/resident/invoices
```

Rezultate așteptate:

- Endpointurile fără token protejate returnează 401.
- ADMIN pe superadmin returnează 403.
- RESIDENT pe admin returnează 403.
- RESIDENT pe propriile endpointuri returnează doar datele proprii.
