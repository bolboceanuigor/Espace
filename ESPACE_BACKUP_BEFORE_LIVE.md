# ESPACE_BACKUP_BEFORE_LIVE

## 1. Ce trebuie backup-uit

- baza de date PostgreSQL
- `backend/uploads`
- orice storage privat folosit de `FileAsset`
- directoarele de backup existente
- `.env.production.local`
- config-ul serverului web / reverse proxy
- config cron / systemd / supervisor, daca exista
- commit-ul sau tag-ul release-ului curent
- `package-lock.json`
- `backend/package-lock.json`

## 2. Backup DB

### PostgreSQL

Exemplu:

```bash
mkdir -p backups
timestamp="$(date +%Y%m%d_%H%M%S)"
pg_dump "$DATABASE_URL" --format=custom --file="backups/espace_${timestamp}.dump"
```

Sau compresat:

```bash
timestamp="$(date +%Y%m%d_%H%M%S)"
pg_dump "$DATABASE_URL" | gzip > "backups/espace_${timestamp}.sql.gz"
```

Verificare ca backup-ul nu este gol:

```bash
ls -lh backups/espace_*
```

Test restore pe staging:

```bash
pg_restore --list backups/espace_20260603_120000.dump | head
```

### MySQL / MariaDB

Daca in viitor apare o instalare MySQL:

```bash
mysqldump -u USER -p --single-transaction --routines --triggers DB_NAME | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

## 3. Backup fisiere

Exemplu pentru uploads:

```bash
timestamp="$(date +%Y%m%d_%H%M%S)"
tar -czf "backups/espace_uploads_${timestamp}.tar.gz" backend/uploads
```

Daca ai directoare suplimentare private:

```bash
tar -czf "backups/espace_files_${timestamp}.tar.gz" backend/uploads backups
```

Verificare arhiva:

```bash
tar -tzf backups/espace_uploads_${timestamp}.tar.gz | head
```

## 4. Backup `.env`

- copiaza separat `.env.production.local`
- pastreaza permisiuni restrictive
- nu il pui in Git
- nu il trimiti public

Exemplu:

```bash
cp .env.production.local backups/.env.production.local.$(date +%Y%m%d_%H%M%S)
chmod 600 backups/.env.production.local.*
```

## 5. Restore plan

### Restore DB

Pentru dump custom:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" backups/espace_20260603_120000.dump
```

### Restore fisiere

```bash
tar -xzf backups/espace_uploads_20260603_120000.tar.gz
```

### Restore env

```bash
cp backups/.env.production.local.20260603_120000 .env.production.local
chmod 600 .env.production.local
```

### Dupa restore

```bash
npm install
npm run build
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d --build
```

## 6. Checklist inainte de deploy

- backup DB creat
- backup fisiere creat
- backup env creat
- spatiu suficient pe disk
- release anterior identificat
- restore testat sau cel putin verificat logic

## Riscuri

- scriptul existent `backend/scripts/restore.sh` foloseste `pg_restore --clean`; foloseste-l doar controlat
- fara backup de uploads, poti pierde documente si dovezi
- fara backup env, poti bloca login, email, CORS sau platile
