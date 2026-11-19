# Espace pe Android — ce faci tu, pas cu pas

APK-ul se construiește singur în GitHub la fiecare schimbare în `mobile/` și se descarcă de aici:
https://github.com/bolboceanuigor/Espace/releases/download/espace-android/Espace.apk

Merge și fără pașii de mai jos. Ca să vină **notificările** (sunet, ecran blocat), îți trebuie Firebase. E gratuit și durează ~10 minute.

## 1. Proiectul Firebase
1. Intri pe console.firebase.google.com → **Add project** → nume `Espace` → Analytics: poți să-l oprești → **Create**.
2. În proiect: iconița **Android** („Add app”).
3. Package name: exact `md.espace.app` → **Register app**.
4. **Download google-services.json**. Restul pașilor din ecran îi sari (Next, Next, Continue).

## 2. Cheia pentru server
1. ⚙️ **Project settings → Service accounts → Generate new private key → Generate key**.
2. Se descarcă un fișier `.json`: păstrează-l, nu-l trimite nimănui.

## 3. Le pui în GitHub
**github.com/bolboceanuigor/Espace → Settings → Secrets and variables → Actions → New repository secret**

| Nume (exact așa) | Ce pui |
|---|---|
| `GOOGLE_SERVICES_JSON` | tot conținutul fișierului `google-services.json` de la pasul 1 |
| `FCM_SERVICE_ACCOUNT` | tot conținutul fișierului `.json` de la pasul 2 |

## 4. Pornești
1. GitHub → **Actions → „Deploy espace.md” → Run workflow** (serverul primește cheia).
2. GitHub → **Actions → „Espace — aplicația de Android (APK)” → Run workflow** (APK-ul nou, cu notificări).
3. Pe telefon instalezi APK-ul nou peste cel vechi, intri în cont și apeși **Permite** la notificări.
