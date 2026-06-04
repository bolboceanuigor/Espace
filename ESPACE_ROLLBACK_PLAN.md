# ESPACE_ROLLBACK_PLAN

Scop: daca deploy-ul pe `https://www.espace.md` produce erori critice, revenirea la versiunea anterioara trebuie sa fie rapida, controlata si fara pierdere suplimentara de date.

## 1. Cand facem rollback imediat

Rollback-ul trebuie initiat imediat daca apare oricare dintre situatiile de mai jos:
- homepage-ul returneaza `500` sau nu se incarca
- loginul nu functioneaza pentru conturile valide
- dashboard-urile principale returneaza `500`
- sunt expuse date cross-tenant intre societati
- platile sunt marcate gresit ca reusite
- migrarea bazei de date esueaza si lasa aplicatia intr-o stare nefunctionala
- exista pierdere sau corupere de date
- joburile critice sunt blocate si afecteaza functionalitati esentiale
- debug sau date sensibile sunt expuse in productie
- logurile arata erori severe repetitive fara workaround imediat

## 2. Ce trebuie pregatit inainte de deploy

- release-ul anterior trebuie marcat prin `git tag` sau commit SHA clar
- backup complet pentru baza de date
- backup complet pentru uploads si fisiere private
- backup separat pentru `.env` de productie
- backup pentru configuratia reverse proxy si servicii de sistem
- lista exacta a comenzilor de deploy folosita la release
- persoana responsabila pentru decizia de rollback si executie

## 3. Rollback de cod

Pasii recomandati:
1. opreste deploy-ul curent si noteaza commit-ul problematic
2. confirma ca backup-ul DB si backup-ul de fisiere exista
3. revino la release-ul anterior:

```bash
git fetch --all --tags
git checkout <release-anterior>
```

4. reinstaleaza dependintele daca release-ul anterior o cere

Pentru stack-ul Espace:

```bash
npm install
npm run build
```

5. reporneste serviciile pentru release-ul anterior
6. ruleaza verificari rapide pe homepage, login si dashboard

## 4. Rollback DB

Rollback-ul bazei de date este necesar doar daca release-ul nou a introdus o schimbare incompatibila sau a corupt datele.

Principii:
- nu rula rollback automat de migrari fara analiza
- nu folosi comenzi destructive de tip `fresh`, `wipe`, `reset`
- prefera restore din backup verificat

Exemplu pentru PostgreSQL:

```bash
dropdb --if-exists espace_restore_tmp
createdb espace_restore_tmp
pg_restore --clean --if-exists --no-owner --dbname=espace_restore_tmp /path/to/backup.dump
```

Dupa validarea backup-ului, restore-ul real trebuie planificat atent pe baza de productie, in fereastra controlata.

## 5. Rollback fisiere

Pentru uploads si storage:
1. opreste traficul sau pune aplicatia in maintenance mode operational, daca infrastructura o permite
2. restaureaza arhiva de uploads si fisiere private
3. verifica permisiunile de scriere/citire
4. confirma ca rutele securizate pentru fisiere functioneaza dupa restore

## 6. Comenzi post-rollback

Espace nu este Laravel, deci comenzile reale dupa rollback sunt cele ale stack-ului `NestJS + Prisma + Next.js`.

Comenzi minime:

```bash
npm install
npm run build
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d --build
curl -fsS https://www.espace.md/api/health
```

Verificari obligatorii dupa rollback:
- homepage
- login
- dashboard superadmin
- dashboard admin societate
- lista de facturi
- upload/download fisier autorizat

## 7. Comunicare

Daca se face rollback:
- afiseaza utilizatorilor un mesaj scurt si neutru, daca exista downtime vizibil
- noteaza ora inceperii incidentului si ora revenirii
- comunica intern cauza probabila si impactul
- pastreaza logurile si commit-urile implicate pentru analiza post-incident

## 8. Ce nu trebuie facut

- nu sterge manual date din productie ca workaround rapid
- nu rula rollback de migrari fara backup si analiza
- nu rescrie `.env` cu valori neverificate
- nu relansa deploy-ul problematic inainte de incident review

## 9. Checklist rapid de rollback

- backup DB confirmat
- backup uploads confirmat
- release anterior identificat
- persoana responsabila desemnata
- planul de restore DB pregatit
- verificari post-rollback definite
- incident report completat
