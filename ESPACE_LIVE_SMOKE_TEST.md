# ESPACE_LIVE_SMOKE_TEST

Scop: checklist rapid dupa deploy live pe `https://www.espace.md`, pentru a confirma ca aplicatia este functionala, protejata si poate ramane online.

Inainte de test:
- foloseste domeniul canonic final: `https://www.espace.md`
- pregateste conturi reale sau de staging pentru: `Super Admin`, `Society Admin`, `Owner`, `Tenant`, `Staff`
- pregateste doua organizatii separate: `Societatea A` si `Societatea B`
- pregateste cel putin un apartament, o factura si un document in fiecare societate

Status:
- `PASS`
- `FAIL`
- `N/A`

## 1. Public

### LIVE-PUB-01
- Pasi: deschide `https://www.espace.md`
- Rezultat asteptat: homepage-ul se incarca cu branding Espace, fara eroare 500
- Status:
- Observatii:

### LIVE-PUB-02
- Pasi: verifica bara browserului
- Rezultat asteptat: conexiune HTTPS valida, fara certificat expirat sau avertismente
- Status:
- Observatii:

### LIVE-PUB-03
- Pasi: deschide `http://espace.md`, `http://www.espace.md` si varianta non-canonica HTTPS
- Rezultat asteptat: redirect 301 catre domeniul canonic, cu path-ul pastrat
- Status:
- Observatii:

### LIVE-PUB-04
- Pasi: verifica logo-ul, favicon-ul si culorile principale
- Rezultat asteptat: doar branding Espace, fara SocietyPro sau alte asset-uri vechi
- Status:
- Observatii:

### LIVE-PUB-05
- Pasi: verifica homepage pe mobil in DevTools
- Rezultat asteptat: fara overflow major, butoane accesibile, navigare utilizabila
- Status:
- Observatii:

### LIVE-PUB-06
- Pasi: apasa `Intra in platforma`
- Rezultat asteptat: redirect corect catre login
- Status:
- Observatii:

### LIVE-PUB-07
- Pasi: apasa `Cere acces` sau `Contact`
- Rezultat asteptat: pagina sau formularul public se incarca fara erori
- Status:
- Observatii:

## 2. Auth

### LIVE-AUTH-01
- Pasi: autentifica-te cu contul de `Society Admin`
- Rezultat asteptat: login reusit, redirect catre dashboard-ul corect
- Status:
- Observatii:

### LIVE-AUTH-02
- Pasi: delogheaza-te
- Rezultat asteptat: sesiunea se inchide si paginile protejate nu mai sunt accesibile
- Status:
- Observatii:

### LIVE-AUTH-03
- Pasi: porneste resetarea parolei
- Rezultat asteptat: emailul de reset ajunge, iar linkul foloseste domeniul `espace.md`
- Status:
- Observatii:

### LIVE-AUTH-04
- Pasi: incearca login cu user inactiv
- Rezultat asteptat: acces respins cu mesaj clar, fara login partial
- Status:
- Observatii:

### LIVE-AUTH-05
- Pasi: incearca login cu user din societate inactiva, daca regula este activa
- Rezultat asteptat: acces respins conform politicii aplicatiei
- Status:
- Observatii:

## 3. Dashboard

### LIVE-DASH-01
- Pasi: autentifica-te ca `Super Admin` si deschide dashboard-ul
- Rezultat asteptat: dashboard-ul se incarca fara 500 si afiseaza statistici globale coerente
- Status:
- Observatii:

### LIVE-DASH-02
- Pasi: autentifica-te ca `Society Admin` si deschide dashboard-ul
- Rezultat asteptat: vede doar datele societatii sale
- Status:
- Observatii:

### LIVE-DASH-03
- Pasi: autentifica-te ca `Tenant`
- Rezultat asteptat: dashboard-ul rezidentului se incarca fara date din alta societate
- Status:
- Observatii:

## 4. Module esentiale

### LIVE-MOD-01
- Pasi: creeaza sau editeaza o societate test ca `Super Admin`
- Rezultat asteptat: salvare reusita, fara impact pe date existente
- Status:
- Observatii:

### LIVE-MOD-02
- Pasi: in societatea A, creeaza bloc/scara
- Rezultat asteptat: entitatea apare doar in societatea A
- Status:
- Observatii:

### LIVE-MOD-03
- Pasi: creeaza apartament in societatea A
- Rezultat asteptat: apartamentul apare in listele corecte si in dashboard-ul relevant
- Status:
- Observatii:

### LIVE-MOD-04
- Pasi: creeaza proprietar si asociaza-l apartamentului
- Rezultat asteptat: proprietarul apare corect in UI si nu este vizibil in alta societate
- Status:
- Observatii:

### LIVE-MOD-05
- Pasi: creeaza locatar si asociaza-l apartamentului
- Rezultat asteptat: locatarul vede doar propriile date dupa login
- Status:
- Observatii:

### LIVE-MOD-06
- Pasi: creeaza factura pentru apartamentul din societatea A
- Rezultat asteptat: factura apare la admin si la rezidentul corect
- Status:
- Observatii:

### LIVE-MOD-07
- Pasi: inregistreaza o plata offline
- Rezultat asteptat: statusul urmeaza flow-ul Espace, cu aprobare corecta daca este necesara
- Status:
- Observatii:

### LIVE-MOD-08
- Pasi: creeaza o cerere de mentenanta
- Rezultat asteptat: cererea apare doar in societatea corecta si urmeaza statusurile configurate
- Status:
- Observatii:

### LIVE-MOD-09
- Pasi: publica un anunt
- Rezultat asteptat: anuntul este vizibil doar publicului tinta din societatea corecta
- Status:
- Observatii:

### LIVE-MOD-10
- Pasi: incarca un document permis si descarca-l apoi
- Rezultat asteptat: upload reusit, download permis doar utilizatorilor autorizati
- Status:
- Observatii:

## 5. Multi-tenancy

### LIVE-TEN-01
- Pasi: autentifica-te ca admin din societatea A si navigheaza la apartamente/facturi/mentenanta
- Rezultat asteptat: nu apare nicio resursa din societatea B
- Status:
- Observatii:

### LIVE-TEN-02
- Pasi: incearca URL direct catre o resursa din societatea B folosind un ID cunoscut
- Rezultat asteptat: raspuns `403`, `404` sau redirect sigur, fara scurgere de date
- Status:
- Observatii:

### LIVE-TEN-03
- Pasi: verifica dropdown-uri de selectie pentru apartamente, rezidenti, facturi, task-uri
- Rezultat asteptat: nu afiseaza date din alta societate
- Status:
- Observatii:

## 6. Email

### LIVE-MAIL-01
- Pasi: trimite un reset password
- Rezultat asteptat: emailul vine de la Espace si linkul foloseste domeniul corect
- Status:
- Observatii:

### LIVE-MAIL-02
- Pasi: declanseaza o notificare de factura
- Rezultat asteptat: emailul foloseste branding Espace si informatii corecte
- Status:
- Observatii:

### LIVE-MAIL-03
- Pasi: declanseaza o notificare de mentenanta
- Rezultat asteptat: emailul ajunge si nu contine linkuri sparte
- Status:
- Observatii:

### LIVE-MAIL-04
- Pasi: foloseste formularul public de contact sau cere acces
- Rezultat asteptat: mesajul este procesat fara eroare si are expeditorul/brandingul corect
- Status:
- Observatii:

## 7. Payments

### LIVE-PAY-01
- Pasi: verifica success/cancel URLs configurate pentru providerul activ
- Rezultat asteptat: URL-urile folosesc `https://www.espace.md`
- Status:
- Observatii:

### LIVE-PAY-02
- Pasi: testeaza webhook-ul in sandbox, daca providerul este activat
- Rezultat asteptat: webhook invalid este respins, webhook valid este procesat o singura data
- Status:
- Observatii:

### LIVE-PAY-03
- Pasi: daca se aproba un live smoke payment, ruleaza o plata mica
- Rezultat asteptat: redirect corect, confirmare reala doar dupa verificarea webhook-ului
- Status:
- Observatii:

## 8. Queue si scheduler

### LIVE-OPS-01
- Pasi: verifica procesul worker sau serviciul backend
- Rezultat asteptat: joburile sunt procesate, fara backlog critic
- Status:
- Observatii:

### LIVE-OPS-02
- Pasi: verifica joburile programate sau cron-ul de orchestrare
- Rezultat asteptat: reminders si task-urile programate ruleaza fara erori
- Status:
- Observatii:

## 9. Logs

### LIVE-LOG-01
- Pasi: verifica logurile backend, frontend si reverse proxy dupa primele 10-15 minute
- Rezultat asteptat: fara erori critice repetitive, fara secrete logate
- Status:
- Observatii:

### LIVE-LOG-02
- Pasi: verifica logurile de plati si upload
- Rezultat asteptat: fara stack traces critice si fara payload-uri sensibile expuse
- Status:
- Observatii:

## 10. Final

### LIVE-FIN-01
- Pasi: confirma din configurare runtime ca debug-ul este dezactivat
- Rezultat asteptat: `APP_DEBUG=false` sau echivalent runtime, fara pagini verbose in productie
- Status:
- Observatii:

### LIVE-FIN-02
- Pasi: confirma ca exista backup DB si backup uploads pentru deploy-ul curent
- Rezultat asteptat: backup-urile sunt create si pot fi localizate rapid
- Status:
- Observatii:

### LIVE-FIN-03
- Pasi: confirma ca exista rollback plan si release precedent identificabil
- Rezultat asteptat: echipa poate reveni rapid la versiunea anterioara
- Status:
- Observatii:

## Criterii ca deploy-ul sa ramana live

- homepage, login si dashboard-urile principale raspund fara erori critice
- nu exista scurgeri cross-tenant
- platile nu marcheaza facturi sau abonamente ca `paid` fara confirmare valida
- upload/download privat functioneaza doar cu autorizare
- emailurile critice merg si folosesc branding Espace
- nu apar erori severe repetate in logs in primele 30-60 minute

## Criterii pentru rollback imediat

- homepage sau login returneaza 500 pentru utilizatori reali
- dashboard-ul principal este indisponibil
- se observa date cross-tenant in orice suprafata
- platile sunt marcate gresit ca reusite
- fisiere private sunt accesibile public sau cross-tenant
- debug-ul este expus in productie

## Cine trebuie notificat

- proprietarul produsului
- persoana responsabila de deploy
- responsabilul tehnic pentru backend
- responsabilul tehnic pentru frontend
- responsabilul pentru plati/email, daca exista separat

## Probleme care pot fi rezolvate dupa live

- warning-uri neblocante de build fara impact functional
- mici ajustari de copy sau aliniere UI
- optimizari de performanta care nu afecteaza fluxurile critice
- rapoarte sau module secundare fara impact pe login, facturi, plati si tenant isolation
