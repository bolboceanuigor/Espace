import { LegalDocumentAudience, LegalDocumentStatus, LegalDocumentType } from '@prisma/client';

export const LEGAL_DOCUMENT_SEEDS = [
  {
    slug: 'confidentialitate',
    title: 'Politica de confidentialitate',
    description: 'Cum sunt tratate datele in Espace.',
    type: LegalDocumentType.PRIVACY_POLICY,
    audience: LegalDocumentAudience.PUBLIC,
    version: '1.0',
    locale: 'ro',
    body: `# Politica de confidentialitate

Acest document descrie modul in care Espace trateaza datele la nivel de produs. Este o versiune operationala initiala si trebuie revizuita juridic inainte de utilizare contractuala oficiala.

## Ce date pot fi procesate
Espace poate procesa date despre asociatii, administratori, locatari, apartamente, facturi interne, plati inregistrate manual, contoare, indici, solicitari si comunicari operationale.

## Cine introduce datele
Datele sunt introduse de administratorii APC, membrii echipei autorizate, locatari prin portal si, in anumite situatii, de echipa Espace in cadrul configurarii asistate.

## Pentru ce sunt folosite datele
Datele sunt folosite pentru administrarea asociatiei, facturare interna, evidenta platilor, transmiterea solicitarilor, comunicarea cu locatarii, rapoarte si verificari de calitate a datelor.

## Cine are acces
Accesul este limitat in functie de rol: Superadmin, Admin/Staff si Resident. Locatarii vad doar informatiile relevante pentru contul si apartamentele lor.

## Notificari
Espace poate trimite notificari in aplicatie, email sau SMS doar daca providerii sunt configurati si fluxul respectiv este activ.

## Stocare si securitate
Platforma foloseste controale de acces, separarea datelor intre asociatii si audit pentru actiuni sensibile. Utilizatorii nu trebuie sa introduca parole sau secrete in campuri libere.

## Drepturi si solicitari
Solicitarile privind accesul, corectarea sau stergerea datelor trebuie analizate in functie de rolurile stabilite contractual intre parti.

## Contact
Pentru intrebari privind confidentialitatea, foloseste pagina Contact sau formularul legal.`,
  },
  {
    slug: 'termeni',
    title: 'Termeni de utilizare',
    description: 'Reguli generale pentru folosirea platformei Espace.',
    type: LegalDocumentType.TERMS_OF_USE,
    audience: LegalDocumentAudience.PUBLIC,
    version: '1.0',
    locale: 'ro',
    body: `# Termeni de utilizare

Acesti termeni sunt o versiune operationala initiala si trebuie revizuiti juridic inainte de utilizare contractuala oficiala.

## Descriere serviciu
Espace este o platforma SaaS pentru administrarea asociatiilor de proprietari, cu module pentru apartamente, locatari, facturi interne, plati, contoare, solicitari, anunturi si rapoarte.

## Conturi si acces
Utilizatorii trebuie sa pastreze confidentialitatea datelor de autentificare. Accesul trebuie oferit doar persoanelor autorizate.

## Responsabilitatea administratorilor APC
Administratorii APC sunt responsabili pentru corectitudinea datelor introduse, configurarea tarifelor, generarea facturilor interne si comunicarea cu locatarii.

## Responsabilitatea utilizatorilor
Utilizatorii trebuie sa foloseasca platforma in scopuri legitime si sa nu introduca date false, parole sau informatii sensibile in campuri libere.

## Facturi si plati interne
Facturile si confirmarile de plata din Espace sunt documente operationale interne, daca nu se stabileste altfel contractual.

## Disponibilitate si suport
Espace urmareste sa ofere un serviciu stabil, dar nu promite disponibilitate absoluta sau lipsa totala a erorilor.

## Modificari
Termenii pot fi actualizati. Versiunile publicate vor afisa data si numarul versiunii.`,
  },
  {
    slug: 'cookies',
    title: 'Politica cookies',
    description: 'Cum pot fi folosite cookies si tehnologii similare.',
    type: LegalDocumentType.COOKIE_POLICY,
    audience: LegalDocumentAudience.PUBLIC,
    version: '1.0',
    locale: 'ro',
    body: `# Politica cookies

Acest document este o versiune initiala si trebuie revizuit juridic inainte de utilizare oficiala.

## Ce sunt cookies
Cookies sunt fisiere mici folosite de browser pentru functionarea site-urilor si aplicatiilor web.

## Cookies necesare
Espace poate folosi cookies necesare pentru autentificare, sesiune, limba si functionarea aplicatiei.

## Cookies de preferinte
Pot fi folosite preferinte locale precum confirmarea bannerului cookies sau limba selectata.

## Analytics si marketing
In acest moment, Espace poate folosi cookies necesare pentru autentificare si functionarea aplicatiei. Cookies de analytics sau marketing pot fi adaugate ulterior doar daca sunt configurate.

## Gestionare
Poti gestiona cookies din setarile browserului. Dezactivarea cookies necesare poate afecta autentificarea si functionalitatea aplicatiei.`,
  },
  {
    slug: 'prelucrarea-datelor',
    title: 'Prelucrarea datelor',
    description: 'Roluri si responsabilitati privind datele administrate in Espace.',
    type: LegalDocumentType.DATA_PROCESSING,
    audience: LegalDocumentAudience.PUBLIC,
    version: '1.0',
    locale: 'ro',
    body: `# Prelucrarea datelor

Acest document explica la nivel operational cum circula datele in Espace. Rolurile exacte privind prelucrarea datelor trebuie stabilite in contractele dintre parti.

## Date introduse de asociatii
Asociatiile si administratorii pot introduce date despre apartamente, locatari, contacte, tarife, facturi interne, plati si contoare.

## Datele locatarilor
Locatarii pot vedea datele asociate contului lor si pot transmite solicitari sau indici, in functie de modulele active.

## Acces pe roluri
Espace separa accesul intre Superadmin, Admin/Staff si Resident. Administratorii trebuie sa acorde roluri potrivite responsabilitatilor.

## Audit si istoric
Actiunile sensibile pot fi pastrate in audit log pentru trasabilitate.

## Import, export si corectare
Importurile si exporturile trebuie efectuate doar de utilizatori autorizati. Corectarea sau stergerea datelor se gestioneaza conform regulilor stabilite intre parti.`,
  },
  {
    slug: 'securitate',
    title: 'Securitate',
    description: 'Controale de acces, audit si separarea datelor in Espace.',
    type: LegalDocumentType.SECURITY,
    audience: LegalDocumentAudience.PUBLIC,
    version: '1.0',
    locale: 'ro',
    body: `# Securitate

Espace foloseste controale de acces, audit si separarea datelor pentru a proteja informatiile administrate in platforma.

## Autentificare si acces cont
Conturile sunt personale si nu trebuie partajate. Utilizatorii trebuie sa foloseasca parole puternice si sa pastreze accesul in siguranta.

## Roluri si permisiuni
Accesul este controlat prin roluri: Superadmin, Admin/Staff si Resident. Functionalitatile disponibile depind de rol si de configuratia asociatiei.

## Izolarea datelor intre asociatii
Datele sunt operate in contextul asociatiei, iar utilizatorii nu trebuie sa aiba acces la asociatii pentru care nu sunt autorizati.

## Audit si trasabilitate
Actiunile sensibile pot fi inregistrate pentru analiza ulterioara.

## Recomandari
Espace nu trebuie folosit pentru partajarea parolelor sau a datelor sensibile in campuri libere. Administratorii trebuie sa ofere acces doar persoanelor autorizate.`,
  },
  {
    slug: 'trust',
    title: 'Trust Center',
    description: 'Informatii despre incredere, securitate si transparenta.',
    type: LegalDocumentType.TRUST_CENTER,
    audience: LegalDocumentAudience.PUBLIC,
    version: '1.0',
    locale: 'ro',
    body: `# Incredere si transparenta

Espace este construit pentru administrarea sigura si organizata a datelor asociatiilor de proprietari.

## Securitate
Platforma foloseste autentificare, roluri, permisiuni si audit pentru actiuni sensibile.

## Date personale
Datele sunt folosite pentru administrarea asociatiei: locatari, apartamente, facturi interne, plati, contoare, solicitari si comunicare.

## Control si trasabilitate
Utilizatorii vad doar zonele permise de rolul lor, iar actiunile importante pot fi urmarite.

## Suport asistat
Configurarea poate fi asistata, iar accesul de suport trebuie sa fie controlat si auditat acolo unde modulul este activ.

## Documente utile
Consulta politica de confidentialitate, termenii, politica cookies, prelucrarea datelor si pagina de contact.`,
  },
] as const;

export type LegalSeed = (typeof LEGAL_DOCUMENT_SEEDS)[number];
