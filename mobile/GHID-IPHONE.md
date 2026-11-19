# Espace pe iPhone — ce faci tu, pas cu pas

> Înainte de toate: adaugă `app.espace.md` la Cloudflare → Workers & Pages → espace → Custom domains. Aplicația de telefon deschide adresa asta.
> Dacă ai deja cont Apple Developer pentru SmartRepair, sari peste pasul 1 și folosește același cont.

Aplicația e gata și se compilează în GitHub. Ca să ajungă pe telefoanele echipei, îi trebuie contul tău Apple și câteva chei. Pe toate le faci tu: cheile nu trec prin mine.

Durează ~40 de minute, plus așteptarea aprobării contului.

---

## 1. Contul Apple Developer (99 $/an)

1. Pe iPhone descarci aplicația **Apple Developer** → **Account** → **Enroll Now**.
2. Alegi:
   - **Organization**: în App Store apare „Espace”. Îți trebuie numărul D-U-N-S, care e gratuit și vine în 5–14 zile.
   - **Individual**: în App Store apare numele tău. Merge imediat.
3. Plătești 99 $ și aștepți emailul de confirmare.

## 2. Aplicația la Apple — developer.apple.com/account

**a) Numele aplicației (App ID)**
1. **Certificates, Identifiers & Profiles → Identifiers → +**
2. **App IDs → App → Continue**
3. Description: `Espace`
4. Bundle ID: alegi **Explicit** și scrii exact `md.espace.app`
5. La Capabilities bifezi **Push Notifications**, apoi **Continue → Register**.

**b) Cheia pentru notificări (APNs)**
1. **Keys → +**, nume `Espace Push`.
2. Bifezi **Apple Push Notifications service (APNs)**, apoi **Continue → Register**.
3. **Download**: fișierul `.p8` se descarcă **o singură dată**, păstrează-l.
4. Notezi **Key ID** (10 caractere).

**c) Team ID**
- Îl găsești la **Membership details**: 10 caractere, ex. `AB12CD34EF`.

## 3. App Store Connect — appstoreconnect.apple.com

**a) Aplicația**
1. **Apps → + → New App**
2. Platform: iOS
3. Name: `Espace` (dacă e ocupat: `Espace App`)
4. Limba: Russian
5. Bundle ID: `md.espace.app`
6. SKU: `espace-app`, apoi **Create**.

**b) Cheia pentru GitHub (urcă aplicația automat)**
1. **Users and Access → Integrations → App Store Connect API → Team Keys → +**
2. Nume `GitHub`, Access: **Admin**. Trebuie Admin, ca GitHub să poată semna singur aplicația.
3. **Download** fișierul `.p8`, tot o singură dată.
4. Notezi **Key ID** și **Issuer ID** (e afișat deasupra listei).

## 4. Pui cheile în GitHub

Mergi pe **github.com/bolboceanuigor/Espace → Settings → Secrets and variables → Actions → New repository secret**.

| Nume (exact așa) | Ce pui |
|---|---|
| `APPLE_TEAM_ID` | Team ID de la pasul 2c |
| `ASC_KEY_ID` | Key ID de la pasul 3b |
| `ASC_ISSUER_ID` | Issuer ID de la pasul 3b |
| `ASC_KEY` | conținutul fișierului `.p8` de la 3b, tot, cu tot cu liniile `-----BEGIN…` și `-----END…` (deschizi fișierul cu Notepad sau TextEdit) |
| `APNS_KEY_ID` | Key ID de la pasul 2b |
| `APNS_KEY` | conținutul fișierului `.p8` de la 2b, tot |

## 5. Pornești prima versiune

1. GitHub → **Actions → „Espace — aplicația de iPhone” → Run workflow**. Durează ~15 minute.
2. GitHub → **Actions → „Deploy espace.md” → Run workflow**, ca serverul să primească cheia pentru notificări.
3. În App Store Connect → aplicația → **TestFlight**, versiunea apare după 10–20 de minute de procesare.

## 6. Dai aplicația echipei (TestFlight, fără verificarea Apple)

1. App Store Connect → **Users and Access → +**. Adaugi fiecare om cu emailul lui de Apple ID, rolul **Developer**, bifat doar accesul la Espace. Ei primesc un email și acceptă.
2. Aplicația → **TestFlight → Internal Testing → +**: creezi grupul „Echipa”, adaugi oamenii și bifezi **Automatic distribution**.
3. Fiecare instalează aplicația **TestFlight** din App Store și apasă **Install** la Espace.
4. Se loghează ca de obicei, apoi telefonul întreabă de notificări, iar ei apasă **Permite**.

Pot fi până la 100 de oameni. Aplicația nu apare în App Store și n-o poate instala nimeni altcineva.

---

## Ce se întâmplă singur

- **Orice schimbare în Espace** apare imediat și în aplicația de iPhone, fără reinstalare.
- **Versiunile din TestFlight expiră după 90 de zile.** De aceea GitHub urcă singur una nouă la fiecare 2 luni (pe 1 ale lunii), iar oamenii o primesc automat.
- **Notificările** vin prin Apple: cu sunet, pe ecranul blocat, cu cifra roșie pe iconiță, în limba fiecăruia.
- **Face ID**: fiecare îl poate porni din profil → „Блокировка Face ID”. Aplicația se blochează la pornire și după 2 minute în fundal.
- **Fără internet** apare un ecran „Нет интернета” cu butonul „Попробовать снова”.

## Cost

Doar cei **99 $ pe an** pentru contul Apple. GitHub și restul sunt gratuite la volumul ăsta.
