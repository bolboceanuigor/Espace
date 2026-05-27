import Link from 'next/link';
import { FileText, ShieldCheck } from 'lucide-react';

function legalHref(path: string) {
  return `/ro${path}`;
}

export function AppLegalIndexPage({ audience }: { audience: 'admin' | 'resident' }) {
  const links = audience === 'admin'
    ? [
        ['Confidentialitate', '/admin/legal/privacy'],
        ['Termeni', '/admin/legal/terms'],
        ['Prelucrarea datelor', '/admin/legal/data-processing'],
        ['Contact', '/contact'],
      ]
    : [
        ['Confidentialitate', '/resident/legal/privacy'],
        ['Termeni', '/resident/legal/terms'],
        ['Ajutor', '/resident/help'],
        ['Contact', '/contact'],
      ];
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold text-slate-950">Legal & Trust</h1>
        <p className="mt-2 text-slate-600">Documente utile despre confidentialitate, termeni si prelucrarea datelor in Espace.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {links.map(([title, href]) => (
            <Link key={href} href={legalHref(href)} className="rounded-lg border border-slate-200 bg-white p-5 hover:border-emerald-200">
              <FileText className="h-5 w-5 text-emerald-700" />
              <p className="mt-4 font-semibold text-slate-950">{title}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

export function AppLegalDocumentPage({ title, publicHref }: { title: string; publicHref: string }) {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6">
        <ShieldCheck className="h-6 w-6 text-emerald-700" />
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Documentul public actualizat este disponibil in zona Legal & Trust. Textele sunt operationale si trebuie revizuite juridic inainte de utilizare contractuala oficiala.
        </p>
        <Link href={legalHref(publicHref)} className="mt-6 inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Deschide documentul public
        </Link>
      </div>
    </main>
  );
}
