'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, FileText, Lock, Mail, Scale, ShieldCheck } from 'lucide-react';
import { legalApi } from '@/lib/api';
import { CookieBanner, PublicFooter, PublicNavbar } from './PublicWebsite';

type LegalPageKind = 'trust' | 'security' | 'privacy' | 'terms' | 'cookies' | 'data-processing' | 'legal-index' | 'contact';

type LegalDoc = {
  slug: string;
  title: string;
  subtitle: string;
  type: string;
  version: string;
  publishedAt: string;
  intro: string;
  sections: Array<{ title: string; body: string[] }>;
};

const legalDocs: Record<Exclude<LegalPageKind, 'legal-index' | 'contact'>, LegalDoc> = {
  trust: {
    slug: 'trust',
    title: 'Incredere si transparenta',
    subtitle: 'Espace este construit pentru administrarea sigura si organizata a datelor asociatiilor de proprietari.',
    type: 'TRUST_CENTER',
    version: '1.0',
    publishedAt: '27 mai 2026',
    intro: 'Aceste informatii descriu modul in care Espace trateaza increderea, securitatea si datele la nivel de produs. Textele trebuie revizuite juridic inainte de utilizare contractuala oficiala.',
    sections: [
      { title: 'Securitate', body: ['Autentificare, roluri, permisiuni, separarea datelor pe asociatii, audit log, sesiuni de suport controlate si monitorizare operationala.'] },
      { title: 'Date personale', body: ['Datele pot include locatari, administratori, apartamente, facturi interne, plati, solicitari, contoare si comunicari operationale.'] },
      { title: 'Control si trasabilitate', body: ['Actiunile sensibile pot fi urmarite, iar drepturile difera intre Superadmin, Admin/Staff si Resident.'] },
      { title: 'Suport asistat', body: ['Espace poate ajuta la configurare. Accesul de suport trebuie sa fie controlat si auditat acolo unde modulul este activ.'] },
      { title: 'Documente utile', body: ['Consulta politica de confidentialitate, termenii de utilizare, politica cookies, prelucrarea datelor si pagina de contact.'] },
    ],
  },
  security: {
    slug: 'securitate',
    title: 'Securitate',
    subtitle: 'Controale de acces, audit si separarea datelor pentru informatiile administrate in Espace.',
    type: 'SECURITY',
    version: '1.0',
    publishedAt: '27 mai 2026',
    intro: 'Espace foloseste masuri operationale pentru protectia datelor, fara a promite securitate absoluta sau certificari care nu sunt publicate oficial.',
    sections: [
      { title: 'Autentificare si acces cont', body: ['Conturile sunt personale. Utilizatorii trebuie sa foloseasca parole puternice si sa nu partajeze datele de acces.'] },
      { title: 'Roluri si permisiuni', body: ['Accesul este separat pentru Superadmin, Admin/Staff si Resident. Functionalitatile disponibile depind de rol si configuratie.'] },
      { title: 'Izolarea datelor intre asociatii', body: ['Datele sunt operate in contextul asociatiei. Utilizatorii nu trebuie sa aiba acces la asociatii pentru care nu sunt autorizati.'] },
      { title: 'Audit si trasabilitate', body: ['Actiunile sensibile pot fi inregistrate pentru verificare ulterioara.'] },
      { title: 'Recomandari', body: ['Espace nu trebuie folosit pentru partajarea parolelor sau a datelor sensibile in campuri libere. Administratorii trebuie sa ofere acces doar persoanelor autorizate.'] },
    ],
  },
  privacy: {
    slug: 'confidentialitate',
    title: 'Politica de confidentialitate',
    subtitle: 'Cum sunt tratate datele in Espace.',
    type: 'PRIVACY_POLICY',
    version: '1.0',
    publishedAt: '27 mai 2026',
    intro: 'Aceasta politica este o versiune operationala initiala si trebuie revizuita juridic inainte de lansarea publica finala.',
    sections: [
      { title: 'Ce date pot fi procesate', body: ['Date despre asociatii, administratori, locatari, apartamente, facturi interne, plati, contoare, indici, solicitari si comunicari.'] },
      { title: 'Cine introduce datele', body: ['Administratorii APC, membrii echipei autorizate, locatarii prin portal si echipa Espace in configurari asistate.'] },
      { title: 'Pentru ce sunt folosite datele', body: ['Administrare APC, facturare interna, evidenta platilor, solicitari, anunturi, rapoarte si verificari de calitate a datelor.'] },
      { title: 'Cine are acces', body: ['Accesul este limitat in functie de rol. Locatarii vad doar datele relevante pentru contul si apartamentele lor.'] },
      { title: 'Drepturi si solicitari', body: ['Solicitarile privind accesul, corectarea sau stergerea datelor trebuie analizate in functie de contractele dintre parti.'] },
    ],
  },
  terms: {
    slug: 'termeni',
    title: 'Termeni de utilizare',
    subtitle: 'Reguli generale pentru folosirea platformei Espace.',
    type: 'TERMS_OF_USE',
    version: '1.0',
    publishedAt: '27 mai 2026',
    intro: 'Termenii sunt redactati ca baza operationala si trebuie revizuiti juridic inainte de utilizare contractuala oficiala.',
    sections: [
      { title: 'Descriere serviciu', body: ['Espace este o platforma SaaS pentru administrarea APC-urilor: apartamente, locatari, facturi interne, plati, contoare, solicitari, anunturi si rapoarte.'] },
      { title: 'Conturi si acces', body: ['Utilizatorii trebuie sa pastreze confidentialitatea contului si sa foloseasca platforma doar in scopuri autorizate.'] },
      { title: 'Responsabilitatea administratorilor APC', body: ['Administratorii sunt responsabili pentru corectitudinea datelor, configurarea tarifelor si comunicarea cu locatarii.'] },
      { title: 'Facturi si plati interne', body: ['Documentele din Espace sunt operationale interne, daca nu se stabileste altfel contractual. Platile online reale nu sunt prezentate ca disponibile in aceste texte.'] },
      { title: 'Disponibilitate si suport', body: ['Espace urmareste un serviciu stabil, dar nu promite disponibilitate absoluta sau lipsa totala a erorilor.'] },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Politica cookies',
    subtitle: 'Cum pot fi folosite cookies si tehnologii similare in Espace.',
    type: 'COOKIE_POLICY',
    version: '1.0',
    publishedAt: '27 mai 2026',
    intro: 'Nu implementam consent management complex in aceasta versiune. Bannerul explica folosirea cookies necesare.',
    sections: [
      { title: 'Ce sunt cookies', body: ['Cookies sunt fisiere mici folosite de browser pentru functionarea site-urilor si aplicatiilor web.'] },
      { title: 'Cookies necesare', body: ['Espace poate folosi cookies necesare pentru autentificare, sesiune, limba si functionarea aplicatiei.'] },
      { title: 'Cookies de preferinte', body: ['Pot fi salvate preferinte locale, precum confirmarea bannerului cookies.'] },
      { title: 'Analytics si marketing', body: ['In acest moment, Espace poate folosi cookies necesare. Cookies de analytics sau marketing pot fi adaugate ulterior doar daca sunt configurate.'] },
      { title: 'Gestionare', body: ['Poti gestiona cookies din setarile browserului. Dezactivarea cookies necesare poate afecta autentificarea.'] },
    ],
  },
  'data-processing': {
    slug: 'prelucrarea-datelor',
    title: 'Prelucrarea datelor',
    subtitle: 'Informatii despre rolurile si responsabilitatile legate de datele administrate in Espace.',
    type: 'DATA_PROCESSING',
    version: '1.0',
    publishedAt: '27 mai 2026',
    intro: 'Rolurile exacte privind prelucrarea datelor trebuie stabilite in contractele dintre parti.',
    sections: [
      { title: 'Date introduse de asociatii', body: ['Asociatiile pot introduce date despre apartamente, locatari, contacte, tarife, facturi interne, plati si contoare.'] },
      { title: 'Datele locatarilor', body: ['Locatarii pot vedea datele asociate contului lor si pot transmite solicitari sau indici.'] },
      { title: 'Acces pe roluri', body: ['Espace separa accesul intre Superadmin, Admin/Staff si Resident.'] },
      { title: 'Audit si istoricul actiunilor', body: ['Actiunile sensibile pot fi pastrate in audit log pentru trasabilitate.'] },
      { title: 'Export, corectare si arhivare', body: ['Aceste operatiuni trebuie realizate doar de utilizatori autorizati, conform regulilor stabilite intre parti.'] },
    ],
  },
};

function useLocale() {
  const params = useParams<{ locale?: string }>();
  return typeof params?.locale === 'string' ? params.locale : 'ro';
}

function localized(locale: string, href: string) {
  return `/${locale}${href === '/' ? '' : href}`;
}

function LegalContactForm() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    requestType: 'GENERAL',
    subject: '',
    message: '',
    consent: false,
    website: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await legalApi.contactRequest({ ...form, source: 'PUBLIC_LEGAL' });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Cererea nu a putut fi trimisa.');
    } finally {
      setSaving(false);
    }
  };
  if (done) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="font-semibold text-emerald-950">Cererea a fost trimisa</h3>
        <p className="mt-2 text-sm text-emerald-800">Echipa Espace va analiza solicitarea si te va contacta pentru pasii urmatori.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <input className="hidden" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input required placeholder="Nume si prenume" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="h-11 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
      <input placeholder="Telefon" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
      <select value={form.requestType} onChange={(e) => setForm((p) => ({ ...p, requestType: e.target.value }))} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm">
        <option value="GENERAL">General</option>
        <option value="PRIVACY">Confidentialitate</option>
        <option value="DATA_ACCESS">Acces la date</option>
        <option value="DATA_CORRECTION">Corectare date</option>
        <option value="DATA_DELETION">Stergere date</option>
        <option value="SECURITY">Securitate</option>
        <option value="TERMS">Termeni</option>
      </select>
      <input required placeholder="Subiect" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm" />
      <textarea required placeholder="Mesaj" value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} className="min-h-[120px] w-full rounded-md border border-slate-200 p-3 text-sm" />
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input required type="checkbox" checked={form.consent} onChange={(e) => setForm((p) => ({ ...p, consent: e.target.checked }))} className="mt-1" />
        Sunt de acord sa fiu contactat pentru aceasta solicitare.
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button disabled={saving} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? 'Se trimite...' : 'Trimite solicitarea'}
      </button>
    </form>
  );
}

function DocumentBody({ doc }: { doc: LegalDoc }) {
  const locale = useLocale();
  const toc = useMemo(() => doc.sections.map((section) => section.title), [doc.sections]);
  return (
    <main className="bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-sm text-slate-500">
            <Link href={localized(locale, '/legal')} className="hover:text-slate-950">Legal</Link>
            <span className="mx-2">/</span>
            <span>{doc.title}</span>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">{doc.type}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">{doc.title}</h1>
              <p className="mt-4 text-lg leading-8 text-slate-600">{doc.subtitle}</p>
              <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{doc.intro}</p>
            </div>
            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-950">Versiune {doc.version}</p>
              <p className="mt-1">Publicata la {doc.publishedAt}</p>
              <Link href={localized(locale, '/contact')} className="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-700">Contact <ArrowRight className="h-4 w-4" /></Link>
            </aside>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-24">
          <p className="text-sm font-semibold text-slate-950">Cuprins</p>
          <div className="mt-3 space-y-2">
            {toc.map((item) => <a key={item} href={`#${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="block text-sm text-slate-600 hover:text-slate-950">{item}</a>)}
          </div>
        </aside>
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-8">
            {doc.sections.map((section) => (
              <section key={section.title} id={section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
                <h2 className="text-2xl font-semibold text-slate-950">{section.title}</h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((paragraph) => <p key={paragraph} className="leading-7 text-slate-600">{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function LegalIndex() {
  const locale = useLocale();
  const items = [
    ['Confidentialitate', '/confidentialitate', FileText],
    ['Termeni', '/termeni', Scale],
    ['Cookies', '/cookies', CheckCircle2],
    ['Prelucrarea datelor', '/prelucrarea-datelor', ShieldCheck],
    ['Securitate', '/securitate', Lock],
    ['Contact', '/contact', Mail],
  ] as const;
  return (
    <main className="bg-slate-50 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-slate-950">Legal & Trust</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slate-600">Documente publice despre securitate, confidentialitate, termeni si prelucrarea datelor in Espace.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([title, href, Icon]) => (
            <Link key={href} href={localized(locale, href)} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200">
              <Icon className="h-5 w-5 text-emerald-700" />
              <p className="mt-4 font-semibold text-slate-950">{title}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function ContactLegalPage() {
  return (
    <main className="bg-slate-50 py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold text-slate-950">Contact legal si incredere</h1>
          <p className="mt-4 leading-7 text-slate-600">Pentru intrebari despre confidentialitate, date, securitate sau termeni, trimite o solicitare. Nu promitem un termen exact de raspuns pana cand procesul operational este stabilit oficial.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <LegalContactForm />
        </div>
      </div>
    </main>
  );
}

export function LegalPublicPage({ page }: { page: LegalPageKind }) {
  const doc = page !== 'legal-index' && page !== 'contact' ? legalDocs[page] : null;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <PublicNavbar />
      {doc ? <DocumentBody doc={doc} /> : null}
      {page === 'legal-index' ? <LegalIndex /> : null}
      {page === 'contact' ? <ContactLegalPage /> : null}
      <PublicFooter />
      <CookieBanner />
    </div>
  );
}

export function LegalDynamicPage({ slug }: { slug: string }) {
  const entry = Object.entries(legalDocs).find(([, doc]) => doc.slug === slug);
  if (!entry) return <LegalPublicPage page="legal-index" />;
  return <LegalPublicPage page={entry[0] as LegalPageKind} />;
}
