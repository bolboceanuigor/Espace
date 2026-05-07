# Date de producție

Aceste comenzi sunt pentru pregătirea primelor date reale Espace. Nu rula resetări, trunchieri sau migrări în baza Supabase de producție fără aprobare explicită.

## Listare demo/test

Rulează dry-run:

```bash
npm run db:demo-cleanup
```

Scriptul afișează numărări și înregistrări candidate demo/test. Nu afișează parole, hash-uri sau secrete.

## Curățare demo sigură

Ștergerea este dezactivată implicit. Pentru ștergere limitată la asociații marcate explicit `isDemo=true` și cunoscute ca demo:

```bash
npm run db:demo-cleanup -- --confirm-delete-demo
```

Reguli de siguranță:

- nu șterge toate asociațiile;
- nu face truncate;
- nu rulează reset;
- nu șterge date nemarcate sigur drept demo;
- datele istorice precum `APC Alba Iulia 75` sunt listate pentru verificare manuală dacă nu au `isDemo=true`.

## Superadmin de producție

Helperul creează sau actualizează un singur utilizator `SUPERADMIN` folosind variabile de mediu. Parola nu este afișată.

```bash
PRODUCTION_SUPERADMIN_EMAIL="admin@example.md" \
PRODUCTION_SUPERADMIN_PASSWORD="parola-temporara-puternica" \
npm run seed:production-admin
```

Variabile opționale:

- `PRODUCTION_SUPERADMIN_FIRST_NAME`
- `PRODUCTION_SUPERADMIN_LAST_NAME`
- `PRODUCTION_SUPERADMIN_PHONE`
- `PRODUCTION_SUPERADMIN_ORGANIZATION_ID`

Dacă nu este setat `PRODUCTION_SUPERADMIN_ORGANIZATION_ID`, scriptul folosește prima asociație non-demo. Dacă nu există nicio asociație non-demo, creează o organizație internă minimă `Espace Platform`.

## Atenționări

- Nu comite `.env`.
- Nu afișa `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` sau parole.
- Nu rula `prisma migrate reset`.
- Nu rula `prisma db push` pe producție fără aprobare explicită.
