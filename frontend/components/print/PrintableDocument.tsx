'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { useLocalizedPath } from '@/lib/use-localized-path';
import type { ApcOrganizationInfo } from '@/lib/print-documents';
import { formatDatePrint } from '@/lib/print-documents';

export function PrintableDocumentShell({
  organization,
  title,
  subtitle,
  children,
}: {
  organization: ApcOrganizationInfo;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="print-document-page min-h-screen bg-slate-100 px-4 py-6 text-slate-950 print:bg-white print:p-0">
      <div className="print-sheet mx-auto max-w-[210mm] rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <ApcDocumentHeader organization={organization} title={title} subtitle={subtitle} />
        <div className="mt-8">{children}</div>
        <div className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500">
          Document generat la {formatDatePrint(new Date())}. Generat din sistemul Espace pentru administrarea A.P.C.
        </div>
      </div>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm;
        }
        @media print {
          html,
          body {
            background: #fff !important;
          }
          nav,
          aside,
          .no-print,
          .print-actions,
          [data-print-hidden='true'] {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          .print-document-page {
            min-height: auto !important;
          }
          .print-table {
            page-break-inside: auto;
          }
          .print-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}

export function PrintActions({
  printLabel,
  backHref,
  backLabel = 'Înapoi',
}: {
  printLabel: string;
  backHref: string;
  backLabel?: string;
}) {
  const localizedPath = useLocalizedPath();
  return (
    <div className="print-actions mb-4 flex flex-wrap items-center justify-between gap-2">
      <Link
        href={localizedPath(backHref)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
      >
        <Printer className="h-4 w-4" />
        {printLabel}
      </button>
    </div>
  );
}

function ApcDocumentHeader({
  organization,
  title,
  subtitle,
}: {
  organization: ApcOrganizationInfo;
  title: string;
  subtitle?: string;
}) {
  const location = [organization.address, organization.city, organization.country].filter(Boolean).join(', ');
  return (
    <div className="border-b border-slate-200 pb-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">{organization.shortName}</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-950">{organization.legalName}</h1>
          <div className="mt-3 grid gap-1 text-sm text-slate-600">
            {organization.associationCode ? <p>Cod APC: <span className="font-semibold text-slate-800">{organization.associationCode}</span></p> : null}
            {organization.associationNumber ? <p>Număr intern: <span className="font-semibold text-slate-800">{organization.associationNumber}</span></p> : null}
            {location ? <p>{location}</p> : null}
            {organization.phone || organization.email ? (
              <p>{[organization.phone, organization.email].filter(Boolean).join(' · ')}</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left sm:min-w-56 sm:text-right print:bg-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</p>
          <p className="mt-1 text-xl font-bold text-slate-950">{title}</p>
          {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
          <p className="mt-3 text-xs text-slate-500">Data generării: {formatDatePrint(new Date())}</p>
        </div>
      </div>
    </div>
  );
}

export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PrintInfoGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs text-slate-500">{label}</p>
          <div className="mt-1 text-sm font-semibold text-slate-950">{value || '-'}</div>
        </div>
      ))}
    </div>
  );
}

export function PaymentInstructions({ organization }: { organization: ApcOrganizationInfo }) {
  const hasInstructions = organization.bankName || organization.bankAccountIban || organization.bankSwift || organization.paymentInstructions;
  if (!hasInstructions) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Administratorul nu a configurat încă instrucțiunile de plată.
      </p>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
      {organization.bankName ? <p><span className="font-semibold text-slate-950">Bancă:</span> {organization.bankName}</p> : null}
      {organization.bankAccountIban ? <p><span className="font-semibold text-slate-950">IBAN:</span> {organization.bankAccountIban}</p> : null}
      {organization.bankSwift ? <p><span className="font-semibold text-slate-950">SWIFT:</span> {organization.bankSwift}</p> : null}
      {organization.paymentInstructions ? <p className="mt-2">{organization.paymentInstructions}</p> : null}
    </div>
  );
}
