import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight text-slate-950">Nu ai permisiunea necesară</h1>
      <p className="mt-2 text-sm text-slate-500">
        Contul tău nu are acces la această pagină sau această resursă aparține altei asociații.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          href="/admin"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Înapoi la dashboard
        </Link>
        <Link
          href="/login"
          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Autentificare
        </Link>
      </div>
    </div>
  );
}
