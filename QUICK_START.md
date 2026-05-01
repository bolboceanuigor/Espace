# Quick Start - Espace PMS

## ⚠️ Rezolvare permisiuni (OBLIGATORIU)

```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /Users/bolboceanu/espace/node_modules
```

## 🚀 Rulare rapidă

### Pasul 1: Fix permisiuni și instalare
```bash
cd /Users/bolboceanu/espace

# Fix permisiuni
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ./node_modules

# Instalare dependențe
cd backend && npm install
cd ../frontend && npm install
```

### Pasul 2: Baza de date

**Opțiune A: Docker (dacă este instalat)**
```bash
docker compose up -d postgres
```

**Opțiune B: PostgreSQL local**
- Instalați PostgreSQL
- Creați baza: `createdb espace_db`
- Actualizați `backend/.env`:
```
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/espace_db?schema=public"
```

**Opțiune C: SQLite (rapid pentru testare)**
Modificați `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### Pasul 3: Migrații Prisma
```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

### Pasul 4: Pornire aplicație

**Terminal 1:**
```bash
cd /Users/bolboceanu/espace/backend
npm run start:dev
```

**Terminal 2:**
```bash
cd /Users/bolboceanu/espace/frontend
npm run dev
```

### Pasul 5: Accesare
- 🌐 Frontend: http://localhost:3000
- 🔌 Backend API: http://localhost:3001
- ✅ Health: http://localhost:3001/health

## 📋 Structura aplicației

```
espace/
├── backend/              # NestJS API
│   ├── src/
│   │   ├── auth/        # Autentificare JWT
│   │   ├── users/        # Management utilizatori
│   │   ├── properties/   # CRUD proprietăți
│   │   ├── reservations/ # CRUD rezervări + validare overlap
│   │   └── events/       # Socket.io real-time
│   └── prisma/           # Schema baza de date
│
├── frontend/             # Next.js 14
│   ├── app/             # Pages (App Router)
│   ├── components/      # CalendarView, LoginForm
│   └── lib/             # API client, auth utils
│
└── docker-compose.yml    # PostgreSQL container
```

## 🎯 Funcționalități implementate

✅ Autentificare JWT (Register/Login)  
✅ CRUD Utilizatori (Admin only)  
✅ CRUD Proprietăți (cu ownership)  
✅ CRUD Rezervări (cu validare overlap)  
✅ Calendar view cu timeline  
✅ Real-time updates (Socket.io)  
✅ Role-based access (Admin/Manager)  

## 🧪 Testare

1. Deschide http://localhost:3000
2. Click "Sign up" și creează cont
3. După login vezi calendarul gol
4. Pentru a adăuga date, folosește API-ul sau adaugă manual în baza de date

## 📡 API Endpoints

- `POST /auth/register` - Înregistrare
- `POST /auth/login` - Login
- `GET /properties` - Listă proprietăți
- `POST /properties` - Creare proprietate
- `GET /reservations` - Listă rezervări
- `POST /reservations` - Creare rezervare

Toate endpoint-urile (except auth) necesită header: `Authorization: Bearer <token>`
